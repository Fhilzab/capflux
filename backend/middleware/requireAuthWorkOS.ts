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

export async function requireAuthWorkOS(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
  try {
    // 1. Read Authorization header.
    const authHeader = req.headers.authorization;

    // 2. Verify Bearer token exists.
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Bearer token required.' });
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Bearer token required.' });
    }

    // 3. Validate JWT signature using WorkOS JWKS.
    let payload: JWTPayload;
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

    // 4. Extract WorkOS user ID from `sub` claim.
    const workosUserId = payload.sub;
    if (!workosUserId || typeof workosUserId !== 'string' || !workosUserId.match(/^user_[0-9A-Za-z]{10,}$/)) {
      return res.status(401).json({ error: 'Unauthorized: invalid token subject.' });
    }

    // 5. Resolve canonical CAPFLUX UUID via WorkOSIdentityService.
    const resolution = await workOSIdentityService.resolveCAPFLUXUserFromWorkOSIdentity(workosUserId);

    if (resolution.status === 'ERROR') {
      return res.status(401).json({ error: 'Unauthorized: identity resolution failed.' });
    }

    if (resolution.status === 'REVOKED') {
      return res.status(401).json({ error: 'Unauthorized: identity revoked.' });
    }

    if (resolution.status === 'NOT_FOUND') {
      return res.status(401).json({ error: 'Unauthorized: CAPFLUX identity not provisioned.', code: 'IDENTITY_NOT_PROVISIONED' });
    }

    const capfluxUserId = resolution.capfluxUserId!;

    // 6. Resolve the corresponding CAPFLUX application user.
    const { data: appUser, error: appError } = await supabase
      .from('users')
      .select('*')
      .eq('id', capfluxUserId)
      .single();

    if (appError || !appUser) {
      return res.status(401).json({ error: 'Unauthorized: CAPFLUX user not found.' });
    }

    // 7. Attach the authenticated users to the request.
    req.user = appUser as unknown as AuthUser;
    req.workosUserId = workosUserId;
    req.capfluxUserId = capfluxUserId;
    req.token = token;

    return next();
  } catch (error) {
    console.error('requireAuthWorkOS error:', errorMessage(error) || error);
    return res.status(401).json({ error: 'Unauthorized: authentication failed.' });
  }
}

export default requireAuthWorkOS;