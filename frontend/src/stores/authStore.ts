import { defineStore } from 'pinia';
import { supabase, hasSupabaseConfig } from '../shared/services/api/supabase';
import { AuthService } from '../shared/services/AuthService';
import { sanitizeAuthError } from '../utils/error-handler';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as null | { id: string; email?: string; email_confirmed_at?: string },
    session: null as null | {
      access_token: string;
      refresh_token: string;
      expires_at: number;
      user?: { id: string; email?: string; email_confirmed_at?: string };
    },
    loading: false,
    error: null as string | null,
    schoolId: null as string | null,
    role: null as string | null,
    adminStatus: 'ACTIVE' as 'ACTIVE' | 'SUSPENDED',
    profile: null as Record<string, unknown> | null,
    schoolSetupComplete: false,
    emailVerified: false,
  }),
  getters: {
    isAuthenticated: (state) => !!state.user,
    currentSchoolId: (state) => state.schoolId,
    isOwner: (state) => state.role === 'PROPRIETOR',
    isAdmin: (state) => state.role === 'ADMIN',
    isSchoolSetupComplete: (state) => state.schoolSetupComplete && !!state.schoolId,
  },
  actions: {
    async initialize() {
      const { session, error } = await AuthService.initialize();
      
      if (error) {
        this.error = sanitizeAuthError(error);
      }

      this.session = session;
      this.user = session?.user ?? null;
      
      // Check email verification status on init
      if (session?.user) {
        const user = session.user as { email_confirmed_at?: string };
        this.emailVerified = !!user.email_confirmed_at;
      }
      this.schoolId = null;

      supabase.auth.onAuthStateChange((_, sessionUpdate) => {
        this.session = sessionUpdate;
        this.user = sessionUpdate?.user ?? null;
        
        // Check email verification status
        if (sessionUpdate?.user) {
          const user = sessionUpdate.user as { email_confirmed_at?: string };
          this.emailVerified = !!user.email_confirmed_at;
        } else {
          this.emailVerified = false;
        }
        
        if (!sessionUpdate) {
          this.schoolId = null;
          this.role = null;
          this.adminStatus = 'ACTIVE';
        }
      });

      // Fetch school setup status if authenticated
      if (session) {
        this.schoolSetupComplete = false;
      }
    },

    async signIn({ email, password }: { email: string; password: string }) {
      this.loading = true;
      this.error = null;

      const { data, error } = await AuthService.signIn(email, password);

      this.loading = false;

      if (error) {
        this.error = sanitizeAuthError(error);
        return false;
      }

      this.session = data?.session ?? null;
      this.user = data?.user ?? null;

      // Check email verification status
      if (data?.session?.user) {
        const user = data.session.user as { email_confirmed_at?: string };
        this.emailVerified = !!user.email_confirmed_at;
      }

      // If email is not verified, show verification required message
      if (data?.session && !this.emailVerified) {
        this.error = 'Please verify your email before signing in. Check your inbox for a verification link.';
        // Sign out to prevent access with unverified email
        await AuthService.signOut();
        this.session = null;
        this.user = null;
        return false;
      }

      // Emit event for session manager
      if (data?.session) {
        window.dispatchEvent(new CustomEvent('auth:session-start'));
      }

      return true;
    },

    async signUp({ email, password }: { email: string; password: string }) {
      this.loading = true;
      this.error = null;

      const { data, error } = await AuthService.signUp(email, password);

      this.loading = false;

      if (error) {
        this.error = sanitizeAuthError(error);
        return { error };
      }

      // After signup, email is not verified yet
      this.emailVerified = false;
      return { data, error: null };
    },

    async refreshSession() {
      const { session } = await AuthService.refreshSession();
      this.session = session;
      this.user = session?.user ?? null;
      return { session };
    },

    async signOut() {
      await AuthService.signOut();
      
      // Clear all auth state
      this.user = null;
      this.session = null;
      this.schoolId = null;
      this.role = null;
      this.profile = null;
      this.schoolSetupComplete = false;
      this.emailVerified = false;
      this.error = null;
      this.loading = false;
      
      // Clear device ID on logout
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('capstone_device_id');
      }
      
      // Emit event for session manager
      window.dispatchEvent(new CustomEvent('auth:session-end'));
    },
  },
});