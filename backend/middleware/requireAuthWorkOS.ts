/**
 * requireAuthWorkOS — WorkOS AuthKit authentication middleware.
 *
 * Validates the WorkOS access token sent as:
 *   Authorization: Bearer <WORKOS_ACCESS_TOKEN>
 *
 * Flow:
 *   1. Read Authorization header.
 *   2. Verify Bearer token exists.
 *   3. Validate JWT signature using WorkOS JWKS.
 *   4. Verify issuer, audience, expiration.
 *   5. Extract WorkOS user ID from `sub` claim.
 *   6. Resolve canonical CAPFLUX UUID via WorkOSIdentityService.
 *   7. Attach CAPFLUX user to req.user.
 *
 * Never trusts user IDs supplied by request bodies or headers (x-user-id,
 * x-school-id). Identity is established ONLY from the validated JWT.
 *
 * This middleware replaces requireAuthSupabase for production WorkOS auth.
 */
import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { supabase } from '../supabaseClient.js';
import { workOSIdentityService } from '../services/WorkOSIdentityService.js';
import { errorMessage } from '../types/http.js';
import type { AuthUser } from '../types/http.js';

const WORKOS_JWKS_URL = 'https://api.workos.com/sso/jwks';
const WORKOS_ISSUER = 'https://api.workos.com';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(WORKOS_JWKS_URL), {
      cacheMaxAge: 60 * 60 * 1000, // 1 hour cache
      cooldownDuration: 5 * 60 * 1000, // 5 min cooldown on error
    });
  }
  return jwks;
}

/**
 * Try WorkOS Bearer-token authentication without sending a response.
 * Returns the CAPFLUX user on success, null on any failure. Used by
 * requireAuthWorkOS (which maps failures to 401 codes) and by
 * requireAuthProvider dual-mode (which falls back to Supabase on null).
 */
export async function tryAuthenticateWorkOS(req: Request): Promise<AuthUser | null> {
  // 1. Read Authorization header.
  const authHeader = req.headers.authorization;

  // 2. Verify Bearer token exists.
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return null;
  }

  // 3. Validate JWT signature using WorkOS JWKS.
  let payload: JWTPayload;
  try {
    const { payload: verifiedPayload } = await jwtVerify(token, getJWKS(), {
      issuer: WORKOS_ISSUER,
      audience: process.env.WORKOS_CLIENT_ID,
    });
    payload = verifiedPayload;
  } catch {
    return null;
  }

  // 4. Extract WorkOS user ID from `sub` claim.
  const workosUserId = payload.sub;
  if (!workosUserId || typeof workosUserId !== 'string' || !workosUserId.match(/^user_[0-9A-Za-z]{10,}$/)) {
    return null;
  }

  // 4b. Check if session ID (sid) is revoked (durable database store).
  // On infrastructure error the check is logged and authentication continues;
  // revocation enforcement additionally requires migration 202609150001 applied.
  const sessionId = payload.sid;
  if (sessionId && typeof sessionId === 'string') {
    try {
      const { data: isRevoked, error: revokedErr } = await supabase.rpc('is_workos_session_revoked', {
        p_session_id: sessionId,
      });
      if (revokedErr) {
        console.error('requireAuthWorkOS: Failed to check session revocation:', errorMessage(revokedErr));
      } else if (isRevoked) {
        return null;
      }
    } catch (error) {
      console.error('requireAuthWorkOS: Failed to check session revocation:', errorMessage(error));
    }
  }

  // 5. Resolve canonical CAPFLUX UUID via WorkOSIdentityService.
  const resolution = await workOSIdentityService.resolveCAPFLUXUserFromWorkOSIdentity(workosUserId);

  if (resolution.status !== 'ACTIVE' || !resolution.capfluxUserId) {
    return null;
  }

  const capfluxUserId = resolution.capfluxUserId;

  // 6. Resolve the corresponding CAPFLUX application user.
  const { data: appUser, error: appError } = await supabase
    .from('users')
    .select('*')
    .eq('id', capfluxUserId)
    .single();

  if (appError || !appUser) {
    return null;
  }

  // 7. Attach the authenticated users to the request.
  req.user = appUser as unknown as AuthUser;
  req.workosUserId = workosUserId;
  req.capfluxUserId = capfluxUserId;
  req.token = token;

  return appUser as unknown as AuthUser;
}

export async function requireAuthWorkOS(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Bearer token required.' });
    }

    const token = (authHeader.substring(7) || '').trim();
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Bearer token required.' });
    }

    // Distinguish failure reasons for observability without leaking secrets.
    let payload: JWTPayload | null = null;
    try {
      const { payload: verifiedPayload } = await jwtVerify(token, getJWKS(), {
        issuer: WORKOS_ISSUER,
        audience: process.env.WORKOS_CLIENT_ID,
      });
      payload = verifiedPayload;
    } catch (error) {
      console.error('requireAuthWorkOS: JWT verification failed:', errorMessage(error));
      return res.status(401).json({ error: 'Unauthorized: invalid or expired token.' });
    }

    const workosUserId = payload.sub;
    if (!workosUserId || typeof workosUserId !== 'string' || !workosUserId.match(/^user_[0-9A-Za-z]{10,}$/)) {
      return res.status(401).json({ error: 'Unauthorized: invalid token subject.' });
    }

    const user = await tryAuthenticateWorkOS(req);
    if (!user) {
      // tryAuthenticateWorkOS returns null for revoked sessions, unlinked
      // identities, and missing users. Re-resolve once to emit the precise
      // fail-closed code the frontend migration flow depends on.
      const resolution = await workOSIdentityService.resolveCAPFLUXUserFromWorkOSIdentity(workosUserId);
      if (resolution.status === 'REVOKED') {
        return res.status(401).json({ error: 'Unauthorized: identity revoked.' });
      }
      if (resolution.status === 'NOT_FOUND') {
        return res.status(401).json({ error: 'Unauthorized: CAPFLUX identity not provisioned.', code: 'IDENTITY_NOT_PROVISIONED' });
      }
      return res.status(401).json({ error: 'Unauthorized: authentication failed.' });
    }

    return next();
  } catch (error) {
    console.error('requireAuthWorkOS error:', errorMessage(error) || error);
    return res.status(401).json({ error: 'Unauthorized: authentication failed.' });
  }
}

export default requireAuthWorkOS;