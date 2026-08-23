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
import { errorMessage, errorCode, errorStatus } from '../types/http.js';

/** Internal normalized user model returned to routes. */
export interface WorkosFormattedUser {
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  emailVerified: boolean;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
  profilePictureUrl: string | null;
}

export interface WorkosAuthResult {
  accessToken: string;
  refreshToken: string;
  sessionId: string | null;
  expiresAt?: number;
  user: WorkosFormattedUser | null;
}

/** Loose view of WorkOS SDK users/responses consumed here. */
interface WorkosUserLike {
  id?: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  emailVerified?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  profilePictureUrl?: string | null;
}

/**
 * Runtime surface of WorkOS userManagement as used by this service.
 *
 * Migration note: the installed SDK's type declarations disagree with the
 * established runtime call shapes this service was written against (e.g.
 * `created.user`, `{userId}` option objects, `clientSecret` in auth calls).
 * The legacy access patterns are preserved verbatim behind this interface;
 * the getter reads `this.workos.userManagement` live so test monkey-patching
 * continues to work.
 */
interface UserManagementApi {
  authenticateWithPassword(opts: Record<string, unknown>): Promise<WorkosAuthResponseLike>;
  authenticateWithCode(opts: Record<string, unknown>): Promise<WorkosAuthResponseLike>;
  authenticateWithRefreshToken(opts: Record<string, unknown>): Promise<WorkosAuthResponseLike>;
  createUser(opts: Record<string, unknown>): Promise<{ user?: WorkosUserLike } & Record<string, unknown>>;
  revokeSession(opts: { sessionId: string }): Promise<unknown>;
  createPasswordReset(opts: { email: string }): Promise<unknown>;
  resetPassword(opts: { token: string; newPassword: string }): Promise<{ user?: WorkosUserLike | null }>;
  sendVerificationEmail(opts: { userId: string }): Promise<unknown>;
  getUser(opts: { userId: string }): Promise<{ user?: WorkosUserLike | null } & Record<string, unknown>>;
  listUsers(opts: { email: string; limit?: number }): Promise<{ data?: WorkosUserLike[] } & Record<string, unknown>>;
  getAuthorizationUrl(opts: Record<string, unknown>): string;
}

interface WorkosAuthResponseLike {
  accessToken?: string;
  refreshToken?: string;
  sessionId?: string | null;
  accessTokenExpiresAt?: string | Date | null;
  user?: WorkosUserLike;
}

class WorkOSAuthService {
  workos: WorkOS;
  clientId: string;
  clientSecret: string | undefined;
  redirectUri: string | undefined;

  /** Live lookup so runtime monkey-patching (tests) keeps working. */
  private get um(): UserManagementApi {
    return this.workos.userManagement as unknown as UserManagementApi;
  }

  constructor() {
    const apiKey = process.env.WORKOS_API_KEY;
    const clientId = process.env.WORKOS_CLIENT_ID;
    const rawSecret = process.env.WORKOS_CLIENT_SECRET;
    // Only treat it as a real secret if it's not a placeholder value.
    const clientSecret = (rawSecret && rawSecret !== 'your-workos-client-secret') ? rawSecret : undefined;

    if (!apiKey || !clientId) {
      throw new Error('WORKOS_API_KEY and WORKOS_CLIENT_ID are required');
    }

    const workosOpts: { clientId: string; clientSecret?: string } = { clientId };
    if (clientSecret) workosOpts.clientSecret = clientSecret;
    this.workos = new WorkOS(apiKey, workosOpts);
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = process.env.WORKOS_REDIRECT_URI || undefined;
  }

  /**
   * Authenticate with email and password.
   */
  async signInWithPassword(email: string, password: string): Promise<WorkosAuthResult> {
    try {
      const response = await this.um.authenticateWithPassword({
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
   */
  async signUpWithPassword(email: string, password: string, fullName: string): Promise<WorkosAuthResult> {
    try {
      const [firstName = '', ...lastNameParts] = (fullName || '').trim().split(' ');

      const created = await this.um.createUser({
        email,
        password,
        firstName,
        lastName: lastNameParts.join(' ') || '',
        emailVerified: true,
      });

      // Authenticate to obtain a session for the newly created user
      const response = await this.um.authenticateWithPassword({
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
   */
  async handleOAuthCallback(code: string): Promise<WorkosAuthResult> {
    try {
      const response = await this.um.authenticateWithCode({
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
   */
  async refreshToken(refreshToken: string): Promise<WorkosAuthResult> {
    try {
      const response = await this.um.authenticateWithRefreshToken({
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
   */
  async getCurrentUser(userId: string): Promise<WorkosFormattedUser | null> {
    try {
      const { user } = await this.um.getUser({ userId });
      return this.formatUser(user);
    } catch (error) {
      throw this.transformError(error, 'Failed to get current user');
    }
  }

  /**
   * Sign out by revoking a WorkOS session.
   */
  async signOut(sessionId: string): Promise<void> {
    if (!sessionId) return;

    try {
      await this.um.revokeSession({ sessionId });
    } catch (error) {
      // Sign out should not throw errors
      console.warn('Warn: Failed to revoke session:', errorMessage(error));
    }
  }

  /**
   * Get a WorkOS user by email (read-only lookup).
   * Used by the legacy account-claim flow. Returns null when not found.
   */
  async getWorkosUserByEmail(email: string): Promise<{ user: WorkosUserLike | null }> {
    try {
      const users = await this.um.listUsers({ email, limit: 1 });
      return { user: users?.data?.[0] ?? null };
    } catch (error) {
      throw this.transformError(error, 'Failed to look up user');
    }
  }

  /**
   * Create a WorkOS user for the legacy account-claim flow.
   * Creates WITHOUT a password (so the user must set one via the reset email).
   */
  async createWorkosUserForClaim(email: string): Promise<{ id?: string; email: string }> {
    try {
      const created = await this.um.createUser({
        email,
        emailVerified: true, // legacy Supabase emails were already verified
        firstName: '',
        lastName: '',
      });
      return { id: created.user?.id, email: created.user?.email || email };
    } catch (error) {
      // If the user already exists in WorkOS, treat as already-created.
      if (errorCode(error) === 'user_already_exists') {
        const existing = await this.getWorkosUserByEmail(email);
        return { id: existing?.user ? (existing.user as { id?: string }).id : undefined, email };
      }
      throw this.transformError(error, 'Failed to create user');
    }
  }

  /**
   * Send password reset email.
   */
  async sendPasswordResetEmail(email: string): Promise<{ success: boolean }> {
    try {
      await this.um.createPasswordReset({
        email,
      });
      return { success: true };
    } catch (error) {
      throw this.transformError(error, 'Failed to send password reset email');
    }
  }

  /**
   * Reset password with token from the reset email.
   */
  async resetPassword(token: string, newPassword: string): Promise<{ user: WorkosFormattedUser | null }> {
    try {
      const { user } = await this.um.resetPassword({
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
   */
  async sendVerificationEmail(userId: string): Promise<{ success: boolean }> {
    try {
      await this.um.sendVerificationEmail({ userId });
      return { success: true };
    } catch (error) {
      throw this.transformError(error, 'Failed to send verification email');
    }
  }

  /**
   * Build the OAuth authorization URL for a provider (e.g. google).
   */
  getOAuthAuthorizationUrl(provider: string, redirectUri?: string): string {
    try {
      return this.um.getAuthorizationUrl({
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
   */
  generateAuthState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Timing-safe comparison of state values to prevent timing attacks.
   */
  validateAuthState(provided: unknown, expected: unknown): boolean {
    if (!provided || !expected) return false;
    const prov = Buffer.from(String(provided), 'utf8');
    const exp = Buffer.from(String(expected), 'utf8');
    if (prov.length !== exp.length || prov.length === 0) return false;
    return crypto.timingSafeEqual(prov, exp);
  }

  /**
   * Build the AuthKit Hosted UI authorization URL.
   * Uses WorkOS AuthKit (provider: 'authkit') with a screenHint of
   * 'signin' or 'signup' to direct the WorkOS hosted UI to the
   * correct screen.
   */
  getAuthKitAuthorizationUrl(mode: 'login' | 'signup', state?: string): { url: string; state: string } {
    const screenHint = mode === 'signup' ? 'signup' : 'signin';
    const redirectUri =
      process.env.WORKOS_AUTHKIT_REDIRECT_URI ||
      `http://localhost:5173/auth/callback`;
    const generatedState = state || this.generateAuthState();
    try {
      const url = this.um.getAuthorizationUrl({
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
   */
  formatAuthResponse(
    response: { accessToken?: string; refreshToken?: string; sessionId?: string | null; accessTokenExpiresAt?: string | Date | null; user?: WorkosUserLike },
    fallbackUser?: WorkosUserLike
  ): WorkosAuthResult {
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
   */
  formatUser(workosUser: WorkosUserLike | null | undefined): WorkosFormattedUser | null {
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
   */
  transformError(error: unknown, defaultMessage: string): Error & { code?: string; statusCode?: number } {
    const sdkCode = errorCode(error) || '';
    const rawMessage = errorMessage(error) || defaultMessage || 'Authentication error';
    const lowerRaw = rawMessage.toLowerCase();

    // Distinguish password-policy failures from other errors so the frontend
    // can surface a useful message instead of masking as a generic error.
    let appErrorCode: string;
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
      const errorMap: Record<string, string> = {
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
    const statusByCode: Record<string, number> = {
      INVALID_CREDENTIALS: 401,
      USER_ALREADY_EXISTS: 409,
      EMAIL_NOT_VERIFIED: 403,
      UNAUTHORIZED: 401,
      NOT_FOUND: 404,
      WEAK_PASSWORD: 400,
      BREACHED_PASSWORD: 400,
    };

    const err: Error & { code?: string; statusCode?: number } = new Error(rawMessage);
    err.code = appErrorCode;
    err.statusCode =
      statusByCode[appErrorCode] || errorStatus(error) || errorStatusCodeOf(error) || 500;

    return err;
  }
}

/** Mirror of `error.statusCode`. */
function errorStatusCodeOf(e: unknown): number | undefined {
  if (e !== null && typeof e === 'object' && 'statusCode' in e) {
    const s = (e as { statusCode?: unknown }).statusCode;
    return typeof s === 'number' ? s : undefined;
  }
  return undefined;
}

export default WorkOSAuthService;
