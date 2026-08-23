/**
 * requireAuth — shared backend authentication middleware.
 *
 * Canonical identity resolution:
 *   Browser -> HttpOnly workos_session cookie -> authenticateWithSessionCookie
 *              (JWT signature + expiry verified against WorkOS JWKS)
 *   -> req.user (trusted authenticated identity)
 *
 * The legacy "Authorization: Bearer <user-id>" and x-user-id/x-school-id
 * headers are NEVER accepted as authentication. Identity is established only
 * from a WorkOS-verified session.
 */

import type { NextFunction, Request, Response } from 'express';
import sessionService from '../services/SessionService.js';
import { errorMessage } from '../types/http.js';
import type { AuthUser } from '../types/http.js';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
  try {
    const extracted = sessionService.extractSession(req);
    const session = await sessionService.authenticateRequest(extracted);

    if (!session || !session.user?.id) {
      return res.status(401).json({ error: 'Unauthorized: valid session required.' });
    }

    // Trusted authenticated identity.
    req.user = session.user as unknown as AuthUser;
    req.sessionId = session.sessionId || null;
    req.organizationId = session.organizationId || null;
    req.authenticationMethod = session.authenticationMethod || null;
    req.roles = session.roles || [];

    return next();
  } catch (error) {
    console.error('requireAuth error:', errorMessage(error) || error);
    return res.status(401).json({ error: 'Unauthorized: invalid session.' });
  }
}

export default requireAuth;
