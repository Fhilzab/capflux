/**
 * SessionService
 * Encapsulates the canonical CAPFLUX session mechanism.
 *
 * AUTHORITATIVE SESSION MECHANISM:
 *   AuthKit sealed session cookie (`workos_session`), created by sealing the
 *   WorkOS authentication response (access token + user) with
 *   `WORKOS_COOKIE_PASSWORD`. The cookie is HttpOnly and never read by
 *   frontend JavaScript. On every request the backend calls
 *   `authenticateWithSessionCookie`, which unseals the cookie, verifies the
 *   access-token JWT signature/expiry against the WorkOS JWKS, and returns
 *   the authenticated user.
 *
 * The frontend only sees safe session information via GET /api/auth/session.
 * Never return refresh tokens or cookie values to the frontend.
 */

import { WorkOS } from '@workos-inc/node';

const SESSION_COOKIE_NAME = 'workos_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days (WorkOS default)

class SessionService {
  constructor() {
    const apiKey = process.env.WORKOS_API_KEY;
    const clientId = process.env.WORKOS_CLIENT_ID;
    const clientSecret = process.env.WORKOS_CLIENT_SECRET;
    const cookiePassword = process.env.WORKOS_COOKIE_PASSWORD;

    if (!apiKey || !clientId) {
      throw new Error('WORKOS_API_KEY and WORKOS_CLIENT_ID are required');
    }
    if (!cookiePassword || cookiePassword.length < 32) {
      throw new Error('WORKOS_COOKIE_PASSWORD must be at least 32 characters');
    }

    this.workos = new WorkOS(apiKey);
    this.clientId = clientId;
    this.clientSecret = clientSecret || undefined;
    this.cookiePassword = cookiePassword;
  }

  get cookieName() {
    return SESSION_COOKIE_NAME;
  }

  /**
   * Build the HttpOnly cookie configuration.
   * - Secure: true in production (HTTPS required).
   * - SameSite: Lax (safe for top-level navigations; strict CSRF posture for
   *   an API-only session cookie).
   * - Narrow path: only sent to the API backend.
   * - Explicit Max-Age.
   */
  cookieOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    const secure = isProduction
      ? true
      : process.env.COOKIE_SECURE === 'true'; // dev opt-in must be explicit

    return {
      name: SESSION_COOKIE_NAME,
      options: {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/api',
        maxAge: SESSION_MAX_AGE_SECONDS,
      },
    };
  }

  /**
   * Create the sealed session cookie value from a WorkOS authentication
   * response (the shape returned by authenticateWithPassword / authenticateWithCode).
   */
  async createSessionCookieValue(authenticationResponse) {
    if (!authenticationResponse?.accessToken || !authenticationResponse?.user) {
      throw new Error('Cannot create session without a valid authentication response');
    }
    return this.workos.userManagement.sealSessionDataFromAuthenticationResponse({
      authenticationResponse,
      cookiePassword: this.cookiePassword,
    });
  }

  /**
   * Verify the sealed session cookie and resolve the authenticated user.
   * Returns null (not an error) when the session is missing/invalid/expired.
   */
  async authenticateRequest({ sessionData, accessToken } = {}) {
    const opts = { cookiePassword: this.cookiePassword };

    // 1. Bearer sealed session (alternative transport) — used by non-browser
    //    clients and kept for compatibility, but the cookie is canonical.
    if (accessToken && !sessionData) {
      const result = await this.workos.userManagement.authenticateWithSessionCookie({
        sessionData: accessToken,
        ...opts,
      });
      if (!result.authenticated) return null;
      return this.normalize(result);
    }

    // 2. Canonical: sealed session cookie.
    if (sessionData) {
      const result = await this.workos.userManagement.authenticateWithSessionCookie({
        sessionData,
        ...opts,
      });
      if (!result.authenticated) return null;
      return this.normalize(result);
    }

    return null;
  }

  /**
   * Extract the session value from the request (cookie first, then a Bearer
   * sealed session for API clients).
   */
  extractSession(req) {
    const cookieValue = this.parseCookieHeader(req.headers.cookie)[SESSION_COOKIE_NAME];
    if (cookieValue) return { sessionData: cookieValue };

    const authorization = req.headers.authorization || req.headers.Authorization;
    if (authorization && typeof authorization === 'string') {
      const [scheme, token] = authorization.split(' ');
      if (scheme?.toLowerCase() === 'bearer' && token) {
        // The bearer value is the SEALED SESSION (not a user id).
        return { accessToken: token };
      }
    }
    return {};
  }

  /**
   * Minimal RFC 6265 cookie header parser (avoids a runtime dependency).
   */
  parseCookieHeader(header) {
    const cookies = {};
    if (!header || typeof header !== 'string') return cookies;
    for (const part of header.split(';')) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      const name = part.slice(0, eq).trim();
      let value = part.slice(eq + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      if (name) cookies[name] = decodeURIComponent(value);
    }
    return cookies;
  }

  /**
   * Normalize a verified WorkOS session into req.user.
   * Only identity fields are exposed to request handlers — never the
   * raw access token or refresh token.
   */
  normalize(result) {
    const user = result.user || {};
    return {
      user: {
        id: user.id,
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        fullName: user.fullName || '',
        emailVerified: Boolean(user.emailVerified),
        profilePictureUrl: user.profilePictureUrl || null,
        createdAt: user.createdAt || null,
        updatedAt: user.updatedAt || null,
      },
      sessionId: result.sessionId || null,
      organizationId: result.organizationId || null,
      authenticationMethod: result.authenticationMethod || null,
      roles: result.roles || [],
    };
  }

  /**
   * Build a WorkOS logout URL for the given session id.
   */
  getLogoutUrl(sessionId, returnTo) {
    return this.workos.userManagement.getLogoutUrl({
      sessionId,
      ...(returnTo ? { returnTo } : {}),
    });
  }

  /**
   * Revoke a WorkOS session (used on explicit signout).
   */
  async revokeSession(sessionId) {
    if (!sessionId) return;
    try {
      await this.workos.userManagement.revokeSession({ sessionId });
    } catch (err) {
      // Sign out should not throw.
      console.warn('Warn: failed to revoke session:', err?.message || err);
    }
  }

  /**
   * Safe session payload for GET /api/auth/session.
   * NEVER includes refresh tokens or cookie values.
   */
  safeSessionPayload(session) {
    if (!session) return { authenticated: false, user: null };
    return {
      authenticated: true,
      user: session.user,
      sessionId: session.sessionId,
    };
  }
}

const sessionService = new SessionService();
export { SessionService };
export default sessionService;
