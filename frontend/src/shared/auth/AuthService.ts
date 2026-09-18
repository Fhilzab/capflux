/**
 * AuthService - Consumer of AuthProvider
 * Wraps the provider with error mapping and exposes clean API
 * Used by authStore.js - maintains compatibility with existing store API
 */

import { SupabaseAuthProvider } from './SupabaseAuthProvider';
import { AuthKitProvider } from './AuthKitProvider';
import type { User, Session, AuthResult, AuthErrorData, AuthProvider } from './types';
import { mapProviderError } from './AuthError';
import { runtimeEnvironment } from '../environment/runtimeEnvironment';
import { getSandboxAuthProvider, type SandboxAuthProvider } from '../../sandbox/session/sandboxAuth';

/**
 * Execution-mode provider resolution:
 * - sandbox: demo persona provider
 * - production: WorkOS AuthKit (primary) with Supabase Auth as fallback
 */
function createAuthProvider(): AuthKitProvider | SupabaseAuthProvider | SandboxAuthProvider {
  if (runtimeEnvironment.isSandbox) {
    return getSandboxAuthProvider();
  }

  // Production: Use WorkOS AuthKit as primary auth provider
  // SupabaseAuthProvider is kept as fallback/rollback infrastructure
  const useWorkOS = import.meta.env.VITE_AUTH_PROVIDER === 'workos';
  return useWorkOS ? new AuthKitProvider() : new SupabaseAuthProvider();
}

/**
 * AuthService - Wraps AuthProvider for use by the application
 * - Maps raw provider errors to friendly messages
 * - Provides a clean, consistent API
 * - No provider-specific logic outside this file
 */
export const AuthService = {
  _provider: createAuthProvider() as AuthKitProvider | SupabaseAuthProvider | SandboxAuthProvider,

  /**
   * Initiate provider auth flow. With Supabase Auth there is no hosted UI
   * redirect — returns an empty URL so the caller renders inline forms.
   * With WorkOS AuthKit, redirects to hosted UI and returns { url, redirect: true }.
   */
  async initiateAuthKit(mode: 'login' | 'signup'): Promise<{ data: { url: string; redirect?: boolean } | null; error: AuthErrorData | null }> {
    try {
      const result = await this._provider.initiateAuthKit(mode);
      return { data: result.data as { url: string; redirect?: boolean } | null, error: result.error };
    } catch (rawError) {
      return { data: null, error: mapProviderError(rawError) };
    }
  },

  /**
   * Initialize the auth provider and check for existing session
   * Returns session or null if none exists
   */
  async initialize(): Promise<{ session: Session | null; error: AuthErrorData | null }> {
    try {
      const result = await this._provider.initialize();
      return {
        session: result.data?.session ?? null,
        error: result.error,
      };
    } catch (rawError) {
      return {
        session: null,
        error: mapProviderError(rawError),
      };
    }
  },

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<{ data: { session: Session | null; user: User | null }; error: AuthErrorData | null }> {
    try {
      const result = await this._provider.signIn(email, password);
      return {
        data: {
          session: result.data?.session ?? null,
          user: result.data?.user ?? null,
        },
        error: result.error,
      };
    } catch (rawError) {
      return {
        data: { session: null, user: null },
        error: mapProviderError(rawError),
      };
    }
  },

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string, fullName?: string): Promise<{ data: { user: User | null; verificationRequired?: boolean }; error: AuthErrorData | null }> {
    try {
      const result = fullName
        ? await this._provider.signUpWithName(email, password, fullName)
        : await this._provider.signUp(email, password);
      return {
        data: {
          user: result.data?.user ?? null,
          verificationRequired: result.data?.verificationRequired ?? false,
        },
        error: result.error,
      };
    } catch (rawError) {
      return {
        data: { user: null, verificationRequired: false },
        error: mapProviderError(rawError),
      };
    }
  },

  async handleOAuthCallback(code: string, state?: string): Promise<{ data: { session: Session | null; user: User | null }; error: AuthErrorData | null }> {
    try {
      const result = await this._provider.handleOAuthCallback(code, state);
      return {
        data: {
          session: result.data?.session ?? null,
          user: result.data?.user ?? null,
        },
        error: result.error,
      };
    } catch (rawError) {
      return {
        data: { session: null, user: null },
        error: mapProviderError(rawError),
      };
    }
  },

  async signInWithProvider(provider: string): Promise<{ data: { session: Session | null; user: User | null; redirect?: boolean }; error: AuthErrorData | null }> {
    try {
      const result = await this._provider.signInWithProvider(provider);
      return {
        data: {
          session: result.data?.session ?? null,
          user: result.data?.user ?? null,
          redirect: result.data?.redirect,
        },
        error: result.error,
      };
    } catch (rawError) {
      return {
        data: { session: null, user: null, redirect: false },
        error: mapProviderError(rawError),
      };
    }
  },

  /**
   * Sign out and clear session
   */
  async signOut(): Promise<{ error: AuthErrorData | null }> {
    try {
      const result = await this._provider.signOut();
      return { error: result.error };
    } catch (rawError) {
      return { error: mapProviderError(rawError) };
    }
  },

  /**
   * Refresh the current session
   */
  async refreshSession(): Promise<{ session: Session | null; error: AuthErrorData | null }> {
    try {
      const result = await this._provider.refreshSession();
      return {
        session: result.data?.session ?? null,
        error: result.error,
      };
    } catch (rawError) {
      return {
        session: null,
        error: mapProviderError(rawError),
      };
    }
  },

  /**
   * Send a password reset email
   */
  async forgotPassword(email: string): Promise<{ error: AuthErrorData | null }> {
    try {
      const result = await this._provider.forgotPassword(email);
      return { error: result.error };
    } catch (rawError) {
      return { error: mapProviderError(rawError) };
    }
  },

  /**
   * Reset password with a reset token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ error: AuthErrorData | null }> {
    try {
      const result = await this._provider.resetPassword(token, newPassword);
      return { error: result.error };
    } catch (rawError) {
      return { error: mapProviderError(rawError) };
    }
  },

  /**
   * Resend the email verification code
   */
  async resendVerification(email: string): Promise<{ error: AuthErrorData | null }> {
    try {
      const result = await this._provider.resendVerification(email);
      return { error: result.error };
    } catch (rawError) {
      return { error: mapProviderError(rawError) };
    }
  },

  /**
   * Verify email with 6-digit code
   */
  async verifyEmail(code: string, userId: string): Promise<{ data: { verificationSuccess: boolean } | null; error: AuthErrorData | null }> {
    try {
      const result = await (this._provider as AuthKitProvider).verifyEmail(code, userId);
      return {
        data: result.data ?? null,
        error: result.error,
      };
    } catch (rawError) {
      return {
        data: null,
        error: mapProviderError(rawError),
      };
    }
  },

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<{ user: User | null; error: AuthErrorData | null }> {
    try {
      const result = await this._provider.getCurrentUser();
      return {
        user: result.data?.user ?? null,
        error: result.error,
      };
    } catch (rawError) {
      return {
        user: null,
        error: mapProviderError(rawError),
      };
    }
  },

  /**
   * Get current session
   */
  async getSession(): Promise<{ session: Session | null; error: AuthErrorData | null }> {
    try {
      const result = await this._provider.getSession();
      return {
        session: result.data?.session ?? null,
        error: result.error,
      };
    } catch (rawError) {
      return {
        session: null,
        error: mapProviderError(rawError),
      };
    }
  },

  /**
   * Restore session from storage
   */
  async restoreSession(): Promise<{ session: Session | null; error: AuthErrorData | null }> {
    try {
      const result = await this._provider.restoreSession();
      return {
        session: result.data?.session ?? null,
        error: result.error,
      };
    } catch (rawError) {
      return {
        session: null,
        error: mapProviderError(rawError),
      };
    }
  },

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: Session | null) => void): { unsubscribe: () => void } {
    return this._provider.onAuthStateChange(callback);
  },

  /**
   * Check if the provider is configured
   */
  isConfigured(): boolean {
    return this._provider.isConfigured();
  },
};