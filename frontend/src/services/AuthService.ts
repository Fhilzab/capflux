import { supabase, hasSupabaseConfig } from './api/supabase';

export const AuthService = {
  async initialize() {
    if (!hasSupabaseConfig) {
      return { session: null, error: null };
    }

    const { data, error } = await supabase.auth.getSession();

    // Set up automatic token refresh
    if (data?.session) {
      this._setupTokenRefresh(data.session);
    }

    return { session: data?.session ?? null, error };
  },

  async signIn(email: string, password: string) {
    if (!hasSupabaseConfig) {
      return {
        data: {
          session: {
            access_token: 'local-dev-token',
            refresh_token: 'local-dev-refresh',
            expires_at: Date.now() + 3600000,
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

    const result = await supabase.auth.signInWithPassword({ email, password });

    if (result.data?.session) {
      this._setupTokenRefresh(result.data.session);
    }

    return result;
  },

  async signUp(email: string, password: string) {
    if (!hasSupabaseConfig) {
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

    return supabase.auth.signUp({ email, password });
  },

  async signOut() {
    if (!hasSupabaseConfig) {
      this._clearTokenRefresh();
      return { data: null, error: null };
    }

    this._clearTokenRefresh();
    return supabase.auth.signOut();
  },

  async refreshSession() {
    if (!hasSupabaseConfig) {
      return { session: null, error: null };
    }

    const { data, error } = await supabase.auth.refreshSession();
    if (data?.session) {
      this._setupTokenRefresh(data.session);
    }
    return { session: data?.session ?? null, error };
  },

  async getSession() {
    if (!hasSupabaseConfig) {
      return { session: null, error: null };
    }

    const { data, error } = await supabase.auth.getSession();
    return { session: data?.session ?? null, error };
  },

  // Private: Set up automatic token refresh before expiry
  _refreshTimer: null as ReturnType<typeof setTimeout> | null,

  _setupTokenRefresh(session: any) {
    this._clearTokenRefresh();

    if (!session?.expires_at) return;

    // Refresh 5 minutes before expiry
    const expiresAt = session.expires_at * 1000; // Convert to ms
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    const refreshTime = Math.max(timeUntilExpiry - 300000, 10000); // 5 min before, min 10s

    this._refreshTimer = setTimeout(async () => {
      try {
        await this.refreshSession();
      } catch (err) {
        console.warn('Token refresh failed:', err);
        // Retry after 30 seconds on failure
        this._refreshTimer = setTimeout(() => {
          this.refreshSession().catch((e) =>
            console.warn('Token refresh retry failed:', e)
          );
        }, 30000);
      }
    }, refreshTime);
  },

  _clearTokenRefresh() {
    if (this._refreshTimer) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }
  },
};