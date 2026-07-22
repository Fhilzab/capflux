import { supabase, hasSupabaseConfig } from './api/supabase';
import { validatePassword } from '../../utils/validation';
import { getDeviceId } from '../../utils/device';

// Helper to clear all Supabase-related localStorage items
const clearSupabaseLocalStorage = () => {
  if (typeof localStorage === 'undefined') return;
  
  // Clear Supabase auth keys - these are prefixed with 'sb-' and include auth tokens
  Object.keys(localStorage)
    .filter(key => key.startsWith('sb-') || key.startsWith('supabase'))
    .forEach(key => localStorage.removeItem(key));
};

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
    // Validate password before sending to Supabase
    const validation = validatePassword(password);
    if (!validation.valid) {
      return {
        data: null,
        error: new Error(validation.error || 'Invalid password')
      };
    }

    // Development mode fallback
    if (!hasSupabaseConfig) {
      return {
        data: {
          session: {
            access_token: 'local-dev-token',
            refresh_token: 'local-dev-refresh',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: {
              id: 'local-user',
              email,
              email_confirmed_at: new Date().toISOString(),
            },
          },
          user: {
            id: 'local-user',
            email,
            email_confirmed_at: new Date().toISOString(),
          },
        },
        error: null,
      };
    }

    const result = await supabase.auth.signInWithPassword({ email, password });

    // Fetch authoritative user after successful sign-in
    // Newer Supabase SDKs may not include email_confirmed_at in session.user
    let verifiedUser = null;
    if (!result.error && hasSupabaseConfig) {
      const { data: userData } = await supabase.auth.getUser();
      verifiedUser = userData.user;
      console.log('[AUTH DEBUG] signIn success', {
        sessionUserConfirmedAt: (result.data?.session?.user as any)?.email_confirmed_at,
        verifiedUserConfirmedAt: (verifiedUser as any)?.email_confirmed_at,
      });
    }

    if (result.data?.session) {
      this._setupTokenRefresh(result.data.session);
    }

    return {
      data: {
        ...result.data,
        verifiedUser,
      },
      error: result.error,
    };
  },

  async signUp(email: string, password: string) {
    // Validate password before sending to Supabase
    const validation = validatePassword(password);
    if (!validation.valid) {
      return {
        data: null,
        error: new Error(validation.error || 'Invalid password')
      };
    }

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
    this._clearTokenRefresh();
    
    if (hasSupabaseConfig) {
      const result = await supabase.auth.signOut();
      // Clear all Supabase auth data from localStorage
      clearSupabaseLocalStorage();
      return result;
    }
    
    // Clear any local storage for dev mode
    clearSupabaseLocalStorage();
    return { data: null, error: null };
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

  /**
   * Check if user email is verified
   */
  async hasVerifiedEmail(): Promise<boolean> {
    if (!hasSupabaseConfig) {
      return true; // Dev mode - assume verified
    }

    const { data: { user } } = await supabase.auth.getUser();
    return !!user?.email_confirmed_at;
  },

  /**
   * Resend email verification
   */
  async resendVerificationEmail(): Promise<{ error: Error | null }> {
    if (!hasSupabaseConfig) {
      return { error: null };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return { error: new Error('No email address found') };
    }

    // Use verifyOtp for email verification resend
    const { error } = await supabase.auth.signInWithOtp({
      email: user.email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth?mode=login`,
      },
    });

    return { error: error as Error | null };
  },

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string): Promise<{ error: Error | null }> {
    if (!hasSupabaseConfig) {
      return { error: null };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?mode=reset-password`,
    });

    return { error: error as Error | null };
  },

  /**
   * Update user password
   */
  async updatePassword(password: string): Promise<{ error: Error | null }> {
    if (!hasSupabaseConfig) {
      return { error: null };
    }

    // Validate password before sending to Supabase
    const validation = validatePassword(password);
    if (!validation.valid) {
      return {
        error: new Error(validation.error || 'Invalid password')
      };
    }

    const { error } = await supabase.auth.updateUser({ password });
    return { error: error as Error | null };
  },

  /**
   * Verify OTP (for email verification or password reset)
   */
  async verifyOtp(token: string, type: 'email' | 'recovery' = 'email'): Promise<{ error: Error | null }> {
    if (!hasSupabaseConfig) {
      return { error: null };
    }

    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type,
    });

    return { error: error as Error | null };
  },

  /**
   * Get device ID for auth tracking
   */
  getDeviceId(): string {
    return getDeviceId();
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