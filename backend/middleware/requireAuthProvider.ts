/**
 * requireAuthProvider — production authentication cutover switch.
 *
 * Dispatches Bearer-token authentication by AUTH_PROVIDER_MODE:
 *   supabase_only — Supabase Auth JWT only (pre-cutover behavior; default).
 *   dual          — WorkOS AuthKit JWT first, Supabase JWT fallback (controlled
 *                   transition only; must not remain permanently).
 *   workos_primary— alias of dual (explicit cutover intent, same behavior).
 *   workos_only   — WorkOS AuthKit JWT only (cutover end state).
 *
 * Sandbox demo tokens: when CAPFLUX_MODE=sandbox, tokens carrying
 * `sandbox:true` and `demo:true` unverified claims are routed to
 * requireAuthDemo, which validates the HMAC signature and resolves the
 * demo persona. Demo tokens are NEVER accepted in production.
 *
 * Fail-closed: an invalid AUTH_PROVIDER_MODE value returns 500 and serves no
 * traffic. An unset value preserves pre-cutover behavior (supabase_only) so
 * that deploying this code alone never flips production authentication.
 *
 * Routing hint (optimization only, never trust): the unverified JWT payload
 * is decoded to decide which validator to try first. Both validators fully
 * verify signatures, so a forged hint cannot bypass authentication — at worst
 * it costs one extra failed validation before the fallback runs.
 *
 * Identity is established ONLY from a validated JWT and resolved to the
 * canonical CAPFLUX UUID (Supabase path: direct UUID lookup; WorkOS path:
 * user_identity_links bridge). Email is never an identity fallback.
 */

import type { NextFunction, Request, Response } from 'express';
import { decodeJwt } from 'jose';
import { supabase } from '../supabaseClient.js';
import { errorMessage } from '../types/http.js';
import type { AuthUser } from '../types/http.js';
import { requireAuthDemo } from './requireAuthDemo.js';
import { requireAuthSupabase } from './requireAuthSupabase.js';
import { tryAuthenticateWorkOS } from './requireAuthWorkOS.js';

export type AuthProviderMode = 'supabase_only' | 'dual' | 'workos_primary' | 'workos_only';

const VALID_MODES: readonly AuthProviderMode[] = [
  'supabase_only',
  'dual',
  'workos_primary',
  'workos_only',
];

/**
 * Resolve the configured provider mode. Unset/blank preserves pre-cutover
 * behavior. Returns the raw value when invalid so the caller can fail closed.
 */
export function getAuthProviderMode(env: NodeJS.ProcessEnv = process.env): AuthProviderMode | { invalid: string } {
  const raw = env.AUTH_PROVIDER_MODE;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return 'supabase_only';
  }
  const normalized = String(raw).trim().toLowerCase();
  if ((VALID_MODES as readonly string[]).includes(normalized)) {
    return normalized as AuthProviderMode;
  }
  return { invalid: String(raw) };
}

/**
 * Unverified routing hint: true when the token looks like a WorkOS AuthKit
 * JWT (WorkOS issuer + user_* subject). Never trusted for identity — only
 * decides which validator runs first in dual mode.
 */
function looksLikeWorkOSJwt(token: string): boolean {
  try {
    const claims = decodeJwt(token);
    return (
      claims.iss === 'https://api.workos.com' &&
      typeof claims.sub === 'string' &&
      /^user_[0-9A-Za-z]{10,}$/.test(claims.sub)
    );
  } catch {
    return false;
  }
}

/**
 * Unverified routing hint: true when the token looks like a CAPFLUX sandbox
 * demo session JWT (sandbox:true + demo:true claims). Only delegated to
 * requireAuthDemo when CAPFLUX_MODE=sandbox — production never accepts
 * demo tokens.
 */
function looksLikeDemoToken(token: string): boolean {
  try {
    const claims = decodeJwt(token);
    return claims.sandbox === true && claims.demo === true;
  } catch {
    return false;
  }
}

function bearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  return token || null;
}

export async function requireAuthProvider(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
  // Sandbox demo token fast-path: detect before the provider-mode switch so
  // demo sessions work regardless of AUTH_PROVIDER_MODE setting. The token
  // is fully verified by requireAuthDemo (HMAC signature + persona lookup).
  // Production never accepts demo tokens — the check requires CAPFLUX_MODE=sandbox.
  const token = bearerToken(req);
  if (token && looksLikeDemoToken(token) && process.env.CAPFLUX_MODE?.toLowerCase() === 'sandbox') {
    return requireAuthDemo(req, res, next);
  }

  const modeResolution = getAuthProviderMode();

  if (typeof modeResolution !== 'string') {
    console.error(`requireAuthProvider: invalid AUTH_PROVIDER_MODE "${modeResolution.invalid}" — refusing to serve traffic.`);
    return res.status(500).json({ error: 'Server authentication misconfigured.' });
  }

  const mode = modeResolution;

  try {
    if (mode === 'supabase_only') {
      return requireAuthSupabase(req, res, next);
    }

    if (mode === 'workos_only') {
      const { requireAuthWorkOS } = await import('./requireAuthWorkOS.js');
      return requireAuthWorkOS(req, res, next);
    }

    // dual / workos_primary: try the hinted validator first, fall back once.
    const dualToken = bearerToken(req);
    if (!dualToken) {
      return res.status(401).json({ error: 'Unauthorized: Bearer token required.' });
    }

    const tryWorkOSFirst = looksLikeWorkOSJwt(dualToken);

    if (tryWorkOSFirst) {
      const workosUser = await tryAuthenticateWorkOS(req);
      if (workosUser) return next();
      return requireAuthSupabase(req, res, next);
    }

    // Supabase-shaped (or opaque) token first: validate via Supabase, then
    // fall back to WorkOS once before rejecting.
    const supabaseAttempt = await tryAuthenticateSupabase(req);
    if (supabaseAttempt) return next();
    const workosUser = await tryAuthenticateWorkOS(req);
    if (workosUser) return next();
    return res.status(401).json({ error: 'Unauthorized: invalid or expired token.' });
  } catch (error) {
    console.error('requireAuthProvider error:', errorMessage(error) || error);
    return res.status(401).json({ error: 'Unauthorized: authentication failed.' });
  }
}

/**
 * Supabase validation without sending a response. Mirrors
 * requireAuthSupabase success semantics; returns the user or null.
 */
async function tryAuthenticateSupabase(req: Request): Promise<AuthUser | null> {
  const token = bearerToken(req);
  if (!token) return null;

  const { data: { user: supabaseUser }, error: getUserError } = await supabase.auth.getUser(token);
  if (getUserError || !supabaseUser) return null;

  const { data: appUser, error: appError } = await supabase
    .from('users')
    .select('*')
    .eq('id', supabaseUser.id)
    .single();

  if (appError || !appUser) return null;

  req.user = appUser as unknown as AuthUser;
  req.token = token;
  return appUser as unknown as AuthUser;
}

export default requireAuthProvider;
