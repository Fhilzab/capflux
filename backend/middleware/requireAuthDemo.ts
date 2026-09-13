/**
 * requireAuthDemo — Sandbox demo session authentication middleware.
 *
 * Validates a demo session token (Bearer token) issued by /api/auth/demo-login.
 * Only available when CAPFLUX_MODE=sandbox. Production deployments must not
 * register this middleware on any route.
 *
 * The demo session token carries:
 * - sandbox: true
 * - demo: true
 * - personaId: string
 * - role: string
 * - systemRole: string
 * - platformStaff: boolean
 * - title: string
 * - issuedAt: number
 * - exp: number (expiration timestamp)
 *
 * The middleware resolves the authoritative persona from the token and
 * attaches it to req.user for downstream authorization.
 */
import type { NextFunction, Request, Response } from 'express';
import { DemoAuthService, type DemoSessionPayload, type DemoPersona } from '../services/DemoAuthService.js';
import { errorMessage } from '../types/http.js';
import type { AuthUser } from '../types/http.js';

export interface DemoRequest extends Request {
  user: AuthUser;
  demoSession: DemoSessionPayload;
  demoPersona: DemoPersona;
  isDemo: true;
}

export async function requireAuthDemo(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
  try {
    // Only available in sandbox mode
    const mode = process.env.CAPFLUX_MODE?.toLowerCase();
    if (mode !== 'sandbox') {
      return res.status(404).json({ error: 'Not found' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Bearer token required.' });
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Bearer token required.' });
    }

    let payload: DemoSessionPayload;
    try {
      payload = await DemoAuthService.verifyDemoSession(token);
    } catch (error) {
      console.error('requireAuthDemo: token verification failed:', errorMessage(error));
      return res.status(401).json({ error: 'Unauthorized: invalid or expired demo session.' });
    }

    const persona = DemoAuthService.getPersonaById(payload.personaId);
    if (!persona) {
      return res.status(401).json({ error: 'Unauthorized: demo persona not found.' });
    }

    // Build a user object compatible with AuthUser type
    const demoUser: AuthUser = {
      id: `demo-${persona.id}`,
      email: persona.email,
      firstName: persona.fullName.split(' ')[0] || '',
      lastName: persona.fullName.split(' ').slice(1).join(' ') || '',
      fullName: persona.fullName,
      emailVerified: true,
      profilePictureUrl: null,
      createdAt: new Date(payload.issuedAt * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    } as AuthUser;

    const demoReq = req as DemoRequest;
    demoReq.user = demoUser;
    demoReq.demoSession = payload;
    demoReq.demoPersona = persona;
    demoReq.isDemo = true;

    return next();
  } catch (error) {
    console.error('requireAuthDemo error:', errorMessage(error) || error);
    return res.status(401).json({ error: 'Unauthorized: demo authentication failed.' });
  }
}

export default requireAuthDemo;