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

class WorkOSAuthService {
  constructor() {
    const apiKey = process.env.WORKOS_API_KEY;
    const clientId = process.env.WORKOS_CLIENT_ID;
    const clientSecret = process.env.WORKOS_CLIENT_SECRET;

    if (!apiKey || !clientId) {
      throw new Error('WORKOS_API_KEY and WORKOS_CLIENT_ID are required');
    }

    this.workos = new WorkOS(apiKey);
    this.clientId = clientId;
    this.clientSecret = clientSecret || undefined;
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
        emailVerified: false,
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
    const code = error.code || error.message || '';
    const rawMessage = error.message || defaultMessage;

    const errorMap = {
      invalid_credentials: 'INVALID_CREDENTIALS',
      user_already_exists: 'USER_ALREADY_EXISTS',
      invalid_password: 'INVALID_PASSWORD',
      email_verification_required: 'EMAIL_NOT_VERIFIED',
      session_expired: 'SESSION_EXPIRED',
      unauthorized: 'UNAUTHORIZED',
      not_found: 'NOT_FOUND',
    };

    const appErrorCode = errorMap[code] || 'AUTH_ERROR';

    const err = new Error(rawMessage);
    err.code = appErrorCode;
    err.statusCode = error.statusCode || 500;

    return err;
  }
}

export default WorkOSAuthService;