/**
 * AuthService - Refactored to consume AuthProvider
 * Delegates to AuthKitProvider which wraps Supabase
 * Maintains backward compatibility with existing authStore.js
 */

import { AuthKitProvider } from '../auth/AuthKitProvider';
import { mapProviderError } from '../auth/AuthError';

// Create a singleton provider instance
const authProvider = new AuthKitProvider();

// Helper to clear all Supabase-related localStorage items
const clearSupabaseLocalStorage = (): void => {
  if (typeof localStorage === 'undefined') return;
  
  Object.keys(localStorage)
    .filter(key => key.startsWith('sb-') || key.startsWith('supabase'))
    .forEach(key => localStorage.removeItem(key));
};

/**
 * Transform Session to raw Supabase format for backward compatibility
 */
const toRawSession = (session) => {
  if (!session) return null;
  return {
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
    expires_at: session.expiresAt,
    user: session.user,
  };
};

export const AuthService = {
  // Keep for backward compatibility - token refresh handled by Supabase
  _refreshTimer: null as ReturnType<typeof setTimeout> | null,

  async initialize() {
    try {
      const result = await authProvider.initialize();
      // Return raw Supabase session format for backward compatibility
      return { 
        session: toRawSession(result.data?.session), 
        error: result.error ? { message: result.error.message } : null 
      };
    } catch (rawError) {
      const authError = mapProviderError(rawError);
      return { session: null, error: { message: authError.message } };
    }
  },

  async signIn(email: string, password: string) {
    if (!authProvider.isConfigured()) {
      return {
        data: {
          session: {
            access_token: 'local-dev-token',
            refresh_token: 'local-dev-refresh',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: {
              id: 'local-user',
              email,
            },
          },
          user: {
            id: 'local-user',
            email,
          },
        },
        error: null,
      };
    }

    try {
      const result = await authProvider.signIn(email, password);
      
      if (result.error) {
        return { 
          data: { session: null, user: null }, 
          error: { message: result.error.message } 
        };
      }

      const session = result.data?.session;
      return {
        data: { 
          session: toRawSession(session),
          user: result.data?.user ?? null,
        },
        error: null,
      };
    } catch (rawError) {
      const authError = mapProviderError(rawError);
      return { 
        data: { session: null, user: null }, 
        error: { message: authError.message } 
      };
    }
  },

  async signUp(email: string, password: string) {
    if (!authProvider.isConfigured()) {
      return {
        data: {
          user: {
            id: 'local-user',
            email,
          },
        },
        error: null,
      };
    }

    try {
      const result = await authProvider.signUp(email, password);
      
      if (result.error) {
        return { data: { user: null }, error: { message: result.error.message } };
      }

      return { 
        data: { 
          user: result.data?.user ?? null,
        }, 
        error: null 
      };
    } catch (rawError) {
      const authError = mapProviderError(rawError);
      return { data: { user: null }, error: { message: authError.message } };
    }
  },

  async signOut() {
    this._clearTokenRefresh();
    
    // Clear storage first for immediate cleanup
    clearSupabaseLocalStorage();

    if (!authProvider.isConfigured()) {
      return { data: null, error: null };
    }

    try {
      const result = await authProvider.signOut();
      return { data: null, error: result.error ? { message: result.error.message } : null };
    } catch (rawError) {
      const authError = mapProviderError(rawError);
      return { data: null, error: { message: authError.message } };
    }
  },

  async refreshSession() {
    if (!authProvider.isConfigured()) {
      return { session: null, error: null };
    }

    try {
      const result = await authProvider.refreshSession();
      
      if (result.error) {
        return { session: null, error: { message: result.error.message } };
      }

      const session = result.data?.session;
      return { 
        session: toRawSession(session), 
        error: null 
      };
    } catch (rawError) {
      const authError = mapProviderError(rawError);
      return { session: null, error: { message: authError.message } };
    }
  },

  async getSession() {
    if (!authProvider.isConfigured()) {
      return { session: null, error: null };
    }

    try {
      const result = await authProvider.getSession();
      
      if (result.error) {
        return { session: null, error: { message: result.error.message } };
      }

      const session = result.data?.session;
      return { 
        session: toRawSession(session), 
        error: null 
      };
    } catch (rawError) {
      const authError = mapProviderError(rawError);
      return { session: null, error: { message: authError.message } };
    }
  },

  // TODO: Remove compatibility adapter after authStore migration
  // This method transforms Session objects to match Supabase's raw format
  // for backward compatibility with the authStore that still uses
  // raw Supabase session objects (access_token vs accessToken, etc.)
  onAuthStateChange(callback: (event: string, session: unknown) => void) {
    return authProvider.onAuthStateChange((event, session) => {
      // Transform Session back to raw Supabase format for backward compatibility
      callback(event, toRawSession(session));
    });
  },

  // Kept for backward compatibility - Supabase handles token refresh automatically
  // These methods are no longer actively used but kept to avoid breaking changes
  _setupTokenRefresh(_session: unknown) {
    // Supabase handles token refresh automatically
    // This method is kept for backward compatibility
  },

  _clearTokenRefresh() {
    if (this._refreshTimer) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }
  },
};