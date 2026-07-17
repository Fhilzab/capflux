import { defineStore } from 'pinia';
import { supabase, hasSupabaseConfig } from '../shared/services/api/supabase';
import { AuthService } from '../shared/services/AuthService.ts';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    session: null,
    loading: false,
    error: null,
    schoolId: null,
    role: null,
    adminStatus: 'ACTIVE',
    profile: null,
    onboardingComplete: false,
    emailVerified: false,
  }),
  getters: {
    isAuthenticated: (state) => !!state.user,
    currentSchoolId: (state) => state.schoolId,
    isOwner: (state) => state.role === 'OWNER',
    isAdmin: (state) => state.role === 'ADMIN',
    isOnboardingComplete: (state) => state.onboardingComplete && !!state.schoolId,
  },
  actions: {
    async initialize() {
      const { session, error } = await AuthService.initialize();
      if (error) {
        this.error = error.message;
      }

      this.session = session;
      this.user = session?.user ?? null;
      this.schoolId = null;

      supabase.auth.onAuthStateChange((_, sessionUpdate) => {
        this.session = sessionUpdate;
        this.user = sessionUpdate?.user ?? null;
        if (sessionUpdate) {
          this.fetchSchoolFromProfile();
        } else {
          this.schoolId = null;
        }
      });

      // Fetch school from profile if authenticated
      if (session) {
        await this.fetchSchoolFromProfile();
      }
    },

    async fetchSchoolFromProfile() {
      if (!hasSupabaseConfig) {
        // Local dev fallback: use demo-school
        this.schoolId = 'demo-school';
        this.role = 'OWNER';
        this.adminStatus = 'ACTIVE';
        return;
      }

      // Note: In production, school_id comes from JWT claims via Supabase
      // The profile's school_id is determined by the JWT token at login
      // For now, we read it from the profile table on first access
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Use RPC to get profile with role info
          const { data: profile, error } = await supabase.rpc('get_profile', { user_id: user.id });
          if (!error && profile) {
            this.schoolId = profile.school_id ?? null;
            this.role = profile.role ?? null;
            this.adminStatus = profile.admin_status ?? 'ACTIVE';
          } else {
            // Fallback to direct query
            const result = await supabase
              .from('profiles')
              .select('school_id, role, admin_status')
              .eq('id', user.id)
              .single();
            if (result.data) {
              this.schoolId = result.data.school_id ?? null;
              this.role = result.data.role ?? null;
              this.adminStatus = result.data.admin_status ?? 'ACTIVE';
            }
          }
        }
      } catch {
        // Failed to fetch school - will be handled by RLS
      }
    },

    async signIn({ email, password }) {
      this.loading = true;
      this.error = null;

      const { data, error } = await AuthService.signIn(email, password);

      this.loading = false;

      if (error) {
        this.error = error.message;
        return false;
      }

      this.session = data?.session ?? null;
      this.user = data?.user ?? null;

      if (data?.session) {
        await this.fetchSchoolFromProfile();
      }

      return true;
    },

    async signUp({ email, password }) {
      this.loading = true;
      this.error = null;

      const { data, error } = await AuthService.signUp(email, password);

      this.loading = false;

      if (error) {
        this.error = error.message;
        return { error };
      }

      return { data, error: null };
    },

    async refreshSession() {
      const { session } = await AuthService.refreshSession();
      this.session = session;
      this.user = session?.user ?? null;
      if (session) {
        await this.fetchSchoolFromProfile();
      }
      return { session };
    },

    async signOut() {
      await AuthService.signOut();
      this.user = null;
      this.session = null;
      this.schoolId = null;
    },
  },
});