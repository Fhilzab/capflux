/**
 * WorkOSAuthService
 * Backend-proxy for WorkOS User Management (AuthKit).
 * The frontend NEVER talks to WorkOS directly — it calls /api/auth/*
 * which delegates to this service.
 *
 * Uses @workos-inc/node v10 API:
 *   import { WorkOS } from '@workos-inc/node'
 *   workos.userManagement.authenticateWithPassword / authenticateWithCode /
 *   authenticateWithRefreshToken / createUser / revokeSession /
 *   createPasswordReset / resetPassword / sendVerificationEmail / getUser
 */

import { WorkOS } from '@workos-inc/node';
import crypto from 'node:crypto';

class WorkOSAuthService {
  constructor() {
    const apiKey = process.env.WORKOS_API_KEY;
    const clientId = process.env.WORKOS_CLIENT_ID;
    const rawSecret = process.env.WORKOS_CLIENT_SECRET;
    // Only treat it as a real secret if it's not a placeholder value.
    const clientSecret = (rawSecret && rawSecret !== 'your-workos-client-secret') ? rawSecret : undefined;

    if (!apiKey || !clientId) {
      throw new Error('WORKOS_API_KEY and WORKOS_CLIENT_ID are required');
    }

    const workosOpts = { clientId };
    if (clientSecret) workosOpts.clientSecret = clientSecret;
    this.workos = new WorkOS(apiKey, workosOpts);
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = process.env.WORKOS_REDIRECT_URI || undefined;
  }

  /**
   * Authenticate with email and password.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{accessToken, refreshToken, sessionId, user}>}
   */
  async signInWithPassword(email, password) {
    try {
      const response = await this.workos.userManagement.authenticateWithPassword({
        clientId: this.clientId,
        email,
        password,
      });

      return this.formatAuthResponse(response);
    } catch (error) {
      throw this.transformError(error, 'Failed to sign in');
    }
  }

  /**
   * Create a user with email/password + full name, then authenticate.
   * @param {string} email
   * @param {string} password
   * @param {string} fullName
   * @returns {Promise<{accessToken, refreshToken, sessionId, user}>}
   */
  async signUpWithPassword(email, password, fullName) {
    try {
      const [firstName = '', ...lastNameParts] = (fullName || '').trim().split(' ');

      const created = await this.workos.userManagement.createUser({
        email,
        password,
        firstName,
        lastName: lastNameParts.join(' ') || '',
        emailVerified: true,
      });

      // Authenticate to obtain a session for the newly created user
      const response = await this.workos.userManagement.authenticateWithPassword({
        clientId: this.clientId,
        email,
        password,
      });

      return this.formatAuthResponse(response, created.user);
    } catch (error) {
      throw this.transformError(error, 'Failed to sign up');
    }
  }

  /**
   * Exchange an OAuth authorization code for a session.
   * @param {string} code
   * @returns {Promise<{accessToken, refreshToken, sessionId, user}>}
   */
  async handleOAuthCallback(code) {
    try {
      const response = await this.workos.userManagement.authenticateWithCode({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        code,
      });

      return this.formatAuthResponse(response);
    } catch (error) {
      throw this.transformError(error, 'OAuth callback failed');
    }
  }

  /**
   * Refresh access token using a refresh token.
   * @param {string} refreshToken
   * @returns {Promise<{accessToken, refreshToken, sessionId, user}>}
   */
  async refreshToken(refreshToken) {
    try {
      const response = await this.workos.userManagement.authenticateWithRefreshToken({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        refreshToken,
      });

      return this.formatAuthResponse(response);
    } catch (error) {
      throw this.transformError(error, 'Failed to refresh token');
    }
  }

  /**
   * Get current user by WorkOS user ID.
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async getCurrentUser(userId) {
    try {
      const { user } = await this.workos.userManagement.getUser({ userId });
      return this.formatUser(user);
    } catch (error) {
      throw this.transformError(error, 'Failed to get current user');
    }
  }

  /**
   * Sign out by revoking a WorkOS session.
   * @param {string} sessionId
   * @returns {Promise<void>}
   */
  async signOut(sessionId) {
    if (!sessionId) return;

    try {
      await this.workos.userManagement.revokeSession({ sessionId });
    } catch (error) {
      // Sign out should not throw errors
      console.warn('Warn: Failed to revoke session:', error.message);
    }
  }

  /**
   * Get a WorkOS user by email (read-only lookup).
   * Used by the legacy account-claim flow. Returns null when not found.
   */
  async getWorkosUserByEmail(email) {
    try {
      const users = await this.workos.userManagement.listUsers({ email, limit: 1 });
      return { user: users?.data?.[0] || null };
    } catch (error) {
      throw this.transformError(error, 'Failed to look up user');
    }
  }

  /**
   * Create a WorkOS user for the legacy account-claim flow.
   * Creates WITHOUT a password (so the user must set one via the reset email).
   * @returns {Promise<{id: string, email: string}>}
   */
  async createWorkosUserForClaim(email) {
    try {
      const created = await this.workos.userManagement.createUser({
        email,
        emailVerified: true, // legacy Supabase emails were already verified
        firstName: '',
        lastName: '',
      });
      return { id: created.user?.id, email: created.user?.email || email };
    } catch (error) {
      // If the user already exists in WorkOS, treat as already-created.
      if (error?.code === 'user_already_exists') {
        const existing = await this.getWorkosUserByEmail(email);
        return { id: existing?.user?.id, email };
      }
      throw this.transformError(error, 'Failed to create user');
    }
  }

  /**
   * Send password reset email.
   * @param {string} email
   * @returns {Promise<{success: boolean}>}
   */
  async sendPasswordResetEmail(email) {
    try {
      await this.workos.userManagement.createPasswordReset({
        email,
      });
      return { success: true };
    } catch (error) {
      throw this.transformError(error, 'Failed to send password reset email');
    }
  }

  /**
   * Reset password with token from the reset email.
   * @param {string} token
   * @param {string} newPassword
   * @returns {Promise<{user: Object}>}
   */
  async resetPassword(token, newPassword) {
    try {
      const { user } = await this.workos.userManagement.resetPassword({
        token,
        newPassword,
      });
      return { user: this.formatUser(user) };
    } catch (error) {
      throw this.transformError(error, 'Failed to reset password');
    }
  }

  /**
   * Send email verification email.
   * @param {string} userId
   * @returns {Promise<{success: boolean}>}
   */
  async sendVerificationEmail(userId) {
    try {
      await this.workos.userManagement.sendVerificationEmail({ userId });
      return { success: true };
    } catch (error) {
      throw this.transformError(error, 'Failed to send verification email');
    }
  }

  /**
   * Build the OAuth authorization URL for a provider (e.g. google).
   * @param {string} provider
   * @param {string} redirectUri
   * @returns {string}
   */
  getOAuthAuthorizationUrl(provider, redirectUri) {
    try {
      return this.workos.userManagement.getAuthorizationUrl({
        clientId: this.clientId,
        redirectUri: redirectUri || this.redirectUri,
        provider,
        state: 'capflux',
      });
    } catch (error) {
      throw this.transformError(error, `Failed to get ${provider} authorization URL`);
    }
  }

  /**
   * Generate a cryptographically random OAuth state value.
   * Uses crypto.randomBytes(32) for 256 bits of entropy.
   * @returns {string} 64-character hex string
   */
  generateAuthState() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Timing-safe comparison of state values to prevent timing attacks.
   * @param {string} provided - The state returned by WorkOS in the callback.
   * @param {string} expected - The state stored in the HttpOnly cookie.
   * @returns {boolean} True if states match, false otherwise.
   */
  validateAuthState(provided, expected) {
    if (!provided || !expected) return false;
    const prov = Buffer.from(provided, 'utf8');
    const exp = Buffer.from(expected, 'utf8');
    if (prov.length !== exp.length || prov.length === 0) return false;
    return crypto.timingSafeEqual(prov, exp);
  }

  /**
   * Build the AuthKit Hosted UI authorization URL.
   * Uses WorkOS AuthKit (provider: 'authkit') with a screenHint of
   * 'signin' or 'signup' to direct the WorkOS hosted UI to the
   * correct screen.
   * @param {('login'|'signup')} mode
   * @param {string} [state] - Optional OAuth state value. If omitted, a random
   *   state is generated. The caller should persist it for validation at callback.
   * @returns {{url: string, state: string}} The AuthKit authorization URL and state
   */
  getAuthKitAuthorizationUrl(mode, state) {
    const screenHint = mode === 'signup' ? 'signup' : 'signin';
    const redirectUri =
      process.env.WORKOS_AUTHKIT_REDIRECT_URI ||
      `http://localhost:5173/auth/callback`;
    const generatedState = state || this.generateAuthState();
    try {
      const url = this.workos.userManagement.getAuthorizationUrl({
        clientId: this.clientId,
        redirectUri,
        provider: 'authkit',
        screenHint,
        state: generatedState,
      });
      return { url, state: generatedState };
    } catch (error) {
      throw this.transformError(error, 'Failed to generate AuthKit authorization URL');
    }
  }

  /**
   * Format a WorkOS AuthenticationResponse into the internal session shape.
   * @private
   */
  formatAuthResponse(response, fallbackUser) {
    const user = this.formatUser(response.user || fallbackUser);
    return {
      accessToken: response.accessToken || '',
      refreshToken: response.refreshToken || '',
      sessionId: response.sessionId || null,
      expiresAt: response.accessTokenExpiresAt
        ? Math.floor(new Date(response.accessTokenExpiresAt).getTime() / 1000)
        : undefined,
      user,
    };
  }

  /**
   * Format a WorkOS User into the internal User model.
   * @private
   */
  formatUser(workosUser) {
    if (!workosUser) return null;

    return {
      id: workosUser.id,
      email: workosUser.email || '',
      firstName: workosUser.firstName || '',
      lastName: workosUser.lastName || '',
      fullName: `${workosUser.firstName || ''} ${workosUser.lastName || ''}`.trim(),
      emailVerified: Boolean(workosUser.emailVerified),
      createdAt: workosUser.createdAt || undefined,
      updatedAt: workosUser.updatedAt || undefined,
      profilePictureUrl: workosUser.profilePictureUrl || null,
    };
  }

  /**
   * Transform WorkOS errors to application errors.
   * @private
   */
  transformError(error, defaultMessage) {
     const sdkCode = error.code || '';
    const rawMessage = error.message || defaultMessage || 'Authentication error';
    const lowerRaw = rawMessage.toLowerCase();

    // Distinguish password-policy failures from other errors so the frontend
    // can surface a useful message instead of masking as a generic error.
    let appErrorCode;
    if (lowerRaw.includes('breach') ||
        lowerRaw.includes('compromised') ||
        lowerRaw.includes('pwned') ||
        lowerRaw.includes('commonly used')) {
      appErrorCode = 'BREACHED_PASSWORD';
    } else if (sdkCode === 'invalid_password' ||
               lowerRaw.includes('password does not meet') ||
               lowerRaw.includes('password must') ||
               lowerRaw.includes('does not meet any password')) {
      appErrorCode = 'WEAK_PASSWORD';
    } else {
      const errorMap = {
        invalid_credentials: 'INVALID_CREDENTIALS',
        user_already_exists: 'USER_ALREADY_EXISTS',
        invalid_password: 'WEAK_PASSWORD',
        email_verification_required: 'EMAIL_NOT_VERIFIED',
        session_expired: 'SESSION_EXPIRED',
        unauthorized: 'UNAUTHORIZED',
        not_found: 'NOT_FOUND',
      };
      appErrorCode = errorMap[sdkCode] || 'AUTH_ERROR';
    }

    // WorkOS SDK exceptions expose the HTTP status on `.status` (e.g.
    // UnauthorizedException.status = 401, ConflictException.status = 409),
    // not on `.statusCode`. Map well-known codes to canonical HTTP statuses
    // so the frontend can distinguish invalid credentials, duplicates, etc.
    const statusByCode = {
      INVALID_CREDENTIALS: 401,
      USER_ALREADY_EXISTS: 409,
      EMAIL_NOT_VERIFIED: 403,
      UNAUTHORIZED: 401,
      NOT_FOUND: 404,
      WEAK_PASSWORD: 400,
      BREACHED_PASSWORD: 400,
    };

    const err = new Error(rawMessage);
    err.code = appErrorCode;
    err.statusCode =
      statusByCode[appErrorCode] || error.status || error.statusCode || 500;

    return err;
  }
}

export default WorkOSAuthService;