import { defineStore } from 'pinia';
import { supabase, hasSupabaseConfig } from '../shared/services/api/supabase';
import { AuthService } from '../shared/services/AuthService';
import { sanitizeAuthError } from '../utils/error-handler';
import { useSchoolStore } from './schoolStore';

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
    emailVerified: false,
  }),
  getters: {
    isAuthenticated: (state) => !!state.user,
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
      });

      // Initialize school context if authenticated
      if (session) {
        const schoolStore = useSchoolStore();
        await schoolStore.initialize();
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

       const anyData = data as any;
       this.session = anyData?.session ?? null;
       this.user = anyData?.verifiedUser ?? anyData?.session?.user ?? null;

      // Check email verification status from authoritative user
      const verifiedUserEmailConfirmed = anyData?.verifiedUser?.email_confirmed_at;
      this.emailVerified = !!verifiedUserEmailConfirmed;
      console.log('[AUTH DEBUG] authStore signIn state', {
        session: !!this.session,
        emailVerified: this.emailVerified,
        verifiedUserConfirmedAt: verifiedUserEmailConfirmed,
        user: this.user?.email,
      });

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
      this.emailVerified = false;
      this.error = null;
      this.loading = false;
      
      // Clear device ID on logout
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('capstone_device_id');
      }
      
      // Clear school context
      const schoolStore = useSchoolStore();
      schoolStore.clear();
      
      // Emit event for session manager
      window.dispatchEvent(new CustomEvent('auth:session-end'));
    },
  },
});