/**
 * AuthProvider Interface
 * Abstract contract for authentication providers
 * Any auth implementation (Supabase, WorkOS, etc.) must implement this interface
 */

import type { User, Session, AuthProviderConfig, AuthResult } from './types';

export interface AuthStateChangeListener {
  (event: string, session: Session | null): void;
}

export interface AuthSubscription {
  unsubscribe: () => void;
}

/**
 * Abstract authentication provider interface
 * All auth providers must implement these methods
 */
export abstract class AuthProvider {
  /**
   * Initialize the provider and check for existing session
   */
  abstract initialize(): Promise<AuthResult<{ session: Session | null }>>;

  /**
   * Sign in with email and password
   */
  abstract signIn(email: string, password: string): Promise<AuthResult<{ session: Session; user: User }>>;

  /**
   * Sign up with email and password
   */
  abstract signUp(email: string, password: string, fullName?: string): Promise<AuthResult<{ user: User }>>;

  /**
   * Sign up with email, password, and full name
   */
  abstract signUpWithName(email: string, password: string, fullName: string): Promise<AuthResult<{ user: User }>>;

  /**
   * Sign in with an external provider (OAuth)
   */
  abstract signInWithProvider(provider: string): Promise<AuthResult<{ session: Session | null; user: User | null; redirect?: boolean }>>;

  /**
   * Handle OAuth callback with authorization code.
   */
  abstract handleOAuthCallback(code: string, state?: string): Promise<AuthResult<{ session: Session | null; user: User | null }>>;

  /**
   * Send a password reset email
   */
  abstract forgotPassword(email: string): Promise<AuthResult<void>>;

  /**
   * Reset password with a reset token
   */
  abstract resetPassword(token: string, newPassword: string): Promise<AuthResult<void>>;

  /**
   * Resend email verification
   */
  abstract resendVerification(userId: string): Promise<AuthResult<void>>;

  /**
   * Sign out and clear session
   */
  abstract signOut(): Promise<AuthResult<void>>;

  /**
   * Refresh the current session
   */
  abstract refreshSession(): Promise<AuthResult<{ session: Session | null }>>;

  /**
   * Restore session (alias for initialize on some providers)
   */
  abstract restoreSession(): Promise<AuthResult<{ session: Session | null }>>;

  /**
   * Get the current authenticated user
   */
  abstract getCurrentUser(): Promise<AuthResult<{ user: User | null }>>;

  /**
   * Get the current session
   */
  abstract getSession(): Promise<AuthResult<{ session: Session | null }>>;

  /**
   * Subscribe to auth state changes
   */
  abstract onAuthStateChange(callback: AuthStateChangeListener): AuthSubscription;

  /**
   * Get the provider configuration
   */
  abstract getConfig(): AuthProviderConfig;

  /**
   * Check if provider is configured (has required settings)
   */
  abstract isConfigured(): boolean;
}