/**
 * AuthService - Consumer of AuthProvider
 * Wraps the provider with error mapping and exposes clean API
 * Used by authStore.js - maintains compatibility with existing store API
 */

import { AuthKitProvider } from './AuthKitProvider';
import type { User, Session, AuthResult, AuthErrorData } from './types';
import { mapProviderError } from './AuthError';

/**
 * AuthService - Wraps AuthProvider for use by the application
 * - Maps raw provider errors to friendly messages
 * - Provides a clean, consistent API
 * - No provider-specific logic outside this file
 */
export const AuthService = {
  _provider: new AuthKitProvider() as AuthKitProvider,

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
  async signUp(email: string, password: string): Promise<{ data: { user: User | null }; error: AuthErrorData | null }> {
    try {
      const result = await this._provider.signUp(email, password);
      return {
        data: {
          user: result.data?.user ?? null,
        },
        error: result.error,
      };
    } catch (rawError) {
      return {
        data: { user: null },
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