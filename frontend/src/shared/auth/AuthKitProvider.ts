/**
 * AuthKitProvider - Supabase-backed implementation of AuthProvider
 * Wraps the existing Supabase client
 * After this milestone, swapping to WorkOS means changing only this file
 */

import { supabase, hasSupabaseConfig } from '../services/api/supabase';
import { AuthProvider, AuthStateChangeListener, AuthSubscription } from './AuthProvider';
import type { User, Session, AuthProviderConfig, AuthResult, AuthErrorData } from './types';

/**
 * Helper to clear all Supabase-related localStorage items
 * Used during signOut for clean session cleanup
 */
const clearSupabaseLocalStorage = (): void => {
  if (typeof localStorage === 'undefined') return;
  
  Object.keys(localStorage)
    .filter(key => key.startsWith('sb-') || key.startsWith('supabase'))
    .forEach(key => localStorage.removeItem(key));
};

/**
 * Helper to transform Supabase user to our User model
 */
const transformUser = (supabaseUser: Record<string, unknown>): User => {
  const userMetadata = (supabaseUser.user_metadata || {}) as Record<string, unknown>;
  return {
    id: (supabaseUser.id as string) || '',
    email: (supabaseUser.email as string) || '',
    role: supabaseUser.role as 'OWNER' | 'ADMIN' | undefined,
    name: userMetadata.full_name as string | undefined,
    avatarUrl: userMetadata.avatar_url as string | undefined,
    createdAt: supabaseUser.created_at as string | undefined,
    updatedAt: supabaseUser.updated_at as string | undefined,
  };
};

/**
 * Helper to transform Supabase session to our Session model
 */
const transformSession = (supabaseSession: Record<string, unknown>): Session => {
  const user = supabaseSession.user 
    ? transformUser(supabaseSession.user as Record<string, unknown>) 
    : undefined;
  return {
    accessToken: (supabaseSession.access_token as string) || '',
    refreshToken: (supabaseSession.refresh_token as string) || '',
    expiresAt: supabaseSession.expires_at as number | undefined,
    user,
  };
};

/**
 * AuthKitProvider - Wraps Supabase auth for provider compatibility
 * All Supabase auth calls are isolated in this file
 */
export class AuthKitProvider extends AuthProvider {
  private config: AuthProviderConfig = {};

  constructor(config?: AuthProviderConfig) {
    super();
    this.config = config || {};
  }

  initialize(): Promise<AuthResult<{ session: Session | null }>> {
    if (!hasSupabaseConfig) {
      return Promise.resolve({
        data: { session: null },
        error: null as AuthErrorData | null,
      });
    }

    return supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        throw error;
      }
      return {
        data: { session: data?.session ? transformSession(data.session as unknown as Record<string, unknown>) : null },
        error: null as AuthErrorData | null,
      };
    }).catch((error) => {
      throw error;
    });
  }

  signIn(email: string, password: string): Promise<AuthResult<{ session: Session; user: User }>> {
    if (!hasSupabaseConfig) {
      // Local dev fallback
      const mockUser: User = {
        id: 'local-user',
        email,
        role: 'OWNER',
      };
      const mockSession: Session = {
        accessToken: 'local-dev-token',
        refreshToken: 'local-dev-refresh',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        user: mockUser,
      };
      return Promise.resolve({
        data: { session: mockSession, user: mockUser },
        error: null as AuthErrorData | null,
      });
    }

    return supabase.auth.signInWithPassword({ email, password })
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }
        const session = data?.session ? transformSession(data.session as unknown as Record<string, unknown>) : null;
        const user = session?.user || transformUser(data?.user as unknown as Record<string, unknown> || {});
        return { data: { session: session!, user }, error: null as AuthErrorData | null };
      });
  }

  signUp(email: string, password: string): Promise<AuthResult<{ user: User }>> {
    if (!hasSupabaseConfig) {
      // Local dev fallback
      const mockUser: User = {
        id: 'local-user',
        email,
        role: 'OWNER',
      };
      return Promise.resolve({
        data: { user: mockUser },
        error: null as AuthErrorData | null,
      });
    }

    return supabase.auth.signUp({ email, password })
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }
        const user = transformUser(data?.user as unknown as Record<string, unknown> || {});
        return { data: { user }, error: null as AuthErrorData | null };
      });
  }

  signOut(): Promise<AuthResult<void>> {
    // Clear storage first for immediate cleanup
    clearSupabaseLocalStorage();

    if (!hasSupabaseConfig) {
      return Promise.resolve({ data: null, error: null as AuthErrorData | null });
    }

    return supabase.auth.signOut().then(({ error }) => {
      if (error) {
        throw error;
      }
      return { data: null, error: null as AuthErrorData | null };
    });
  }

  refreshSession(): Promise<AuthResult<{ session: Session | null }>> {
    if (!hasSupabaseConfig) {
      // Local dev fallback - return mock refreshed session
      return Promise.resolve({
        data: {
          session: {
            accessToken: 'local-dev-token-refreshed',
            refreshToken: 'local-dev-refresh',
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            user: {
              id: 'local-user',
              email: 'demo@capflux.local',
            },
          },
        },
        error: null as AuthErrorData | null,
      });
    }

    return supabase.auth.refreshSession()
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }
        return {
          data: { session: data?.session ? transformSession(data.session as unknown as Record<string, unknown>) : null },
          error: null as AuthErrorData | null,
        };
      });
  }

  restoreSession(): Promise<AuthResult<{ session: Session | null }>> {
    // For Supabase, restore is same as initialize
    return this.initialize();
  }

  getCurrentUser(): Promise<AuthResult<{ user: User | null }>> {
    if (!hasSupabaseConfig) {
      return Promise.resolve({
        data: { user: null },
        error: null as AuthErrorData | null,
      });
    }

    return supabase.auth.getUser()
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }
        return {
          data: { user: data?.user ? transformUser(data.user as unknown as Record<string, unknown>) : null },
          error: null as AuthErrorData | null,
        };
      });
  }

  getSession(): Promise<AuthResult<{ session: Session | null }>> {
    if (!hasSupabaseConfig) {
      return Promise.resolve({
        data: { session: null },
        error: null as AuthErrorData | null,
      });
    }

    return supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }
        return {
          data: { session: data?.session ? transformSession(data.session as unknown as Record<string, unknown>) : null },
          error: null as AuthErrorData | null,
        };
      });
  }

  onAuthStateChange(callback: AuthStateChangeListener): AuthSubscription {
    if (!hasSupabaseConfig) {
      callback('SIGNED_OUT', null);
      return { unsubscribe: () => {} };
    }

    // Supabase onAuthStateChange returns { data: { subscription } }
    const result = supabase.auth.onAuthStateChange((event, session) => {
      const transformedSession = session 
        ? transformSession(session as unknown as Record<string, unknown>) 
        : null;
      callback(event, transformedSession);
    });

    // Extract unsubscribe from Supabase subscription format
    const unsubscribe = (() => {
      const data = result?.data;
      if (data && 'subscription' in data && data.subscription) {
        (data.subscription as { unsubscribe?: () => void }).unsubscribe?.();
      }
    }) as () => void;

    return { unsubscribe };
  }

  getConfig(): AuthProviderConfig {
    return this.config;
  }

  isConfigured(): boolean {
    return hasSupabaseConfig;
  }
}