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
  abstract signUp(email: string, password: string): Promise<AuthResult<{ user: User }>>;

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