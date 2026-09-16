/**
 * requireAuthHybrid — Supports both WorkOS authentication methods.
 *
 * Authentication priority:
 *   1. Authorization: Bearer <WORKOS_ACCESS_TOKEN> (new JWT flow)
 *   2. HttpOnly workos_session cookie (legacy sealed cookie flow)
 *
 * This allows gradual migration from cookie-based to JWT Bearer token authentication.
 */
import type { NextFunction, Request, Response } from 'express';
import sessionService from '../services/SessionService.js';
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
      cacheMaxAge: 60 * 60 * 1000,
      cooldownDuration: 5 * 60 * 1000,
    });
  }
  return jwks;
}

/**
 * Try to authenticate using WorkOS Bearer token (new JWT flow).
 * Returns the CAPFLUX user if successful, null otherwise.
 */
async function tryBearerTokenAuth(req: Request): Promise<AuthUser | null> {
  const authHeader = req.headers.authorization;

  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) return null;

  // Validate JWT signature using WorkOS JWKS
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

  const workosUserId = payload.sub;
  if (!workosUserId || typeof workosUserId !== 'string' || !workosUserId.match(/^user_[0-9A-Za-z]{10,}$/)) {
    return null;
  }

  // Check if session ID (sid) is revoked using durable database store
  const sessionId = payload.sid;
  if (sessionId && typeof sessionId === 'string') {
    const { data: isRevoked, error: revokedErr } = await supabase.rpc('is_workos_session_revoked', {
      p_session_id: sessionId,
    });
    if (revokedErr) {
      console.error('tryBearerTokenAuth: Failed to check session revocation:', errorMessage(revokedErr));
    } else if (isRevoked) {
      return null;
    }
  }

  // Resolve canonical CAPFLUX UUID
  const resolution = await workOSIdentityService.resolveCAPFLUXUserFromWorkOSIdentity(workosUserId);

  if (resolution.status !== 'ACTIVE' || !resolution.capfluxUserId) {
    return null;
  }

  // Get CAPFLUX user
  const { data: appUser, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', resolution.capfluxUserId)
    .single();

  if (error || !appUser) return null;

  // Attach WorkOS info to request for downstream use
  req.workosUserId = workosUserId;
  req.capfluxUserId = resolution.capfluxUserId;
  req.token = token; // The Bearer token

  return appUser as unknown as AuthUser;
}

/**
 * Try to authenticate using WorkOS sealed session cookie (legacy flow).
 * Returns the CAPFLUX user if successful, null otherwise.
 */
async function tryCookieAuth(req: Request): Promise<AuthUser | null> {
  const extracted = sessionService.extractSession(req);
  const session = await sessionService.authenticateRequest(extracted);

  if (!session || !session.user?.id) return null;

  // Enforce revocation on the sealed-cookie path as well (durable store).
  // On infrastructure error the check is logged and authentication continues;
  // enforcement additionally requires migration 202609150001 applied.
  if (session.sessionId) {
    try {
      const { data: isRevoked, error: revokedErr } = await supabase.rpc('is_workos_session_revoked', {
        p_session_id: session.sessionId,
      });
      if (revokedErr) {
        console.error('tryCookieAuth: Failed to check session revocation:', errorMessage(revokedErr));
      } else if (isRevoked) {
        return null;
      }
    } catch (error) {
      console.error('tryCookieAuth: Failed to check session revocation:', errorMessage(error));
    }
  }

  req.sessionId = session.sessionId || null;
  req.organizationId = session.organizationId || null;
  req.authenticationMethod = session.authenticationMethod || null;
  req.roles = session.roles || [];

  return session.user as unknown as AuthUser;
}

/**
 * Hybrid authentication middleware supporting both WorkOS JWT Bearer token
 * and WorkOS sealed session cookie.
 *
 * Tries Bearer token first (new flow), then falls back to cookie (legacy flow).
 */
export async function requireAuthHybrid(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
  try {
    // Try Bearer token first (new JWT flow)
    const bearerUser = await tryBearerTokenAuth(req);
    if (bearerUser) {
      req.user = bearerUser;
      return next();
    }

    // Fall back to cookie (legacy flow)
    const cookieUser = await tryCookieAuth(req);
    if (cookieUser) {
      req.user = cookieUser;
      return next();
    }

    return res.status(401).json({ error: 'Unauthorized: valid session required.' });
  } catch (error) {
    console.error('requireAuthHybrid error:', errorMessage(error) || error);
    return res.status(401).json({ error: 'Unauthorized: authentication failed.' });
  }
}

export default requireAuthHybrid;