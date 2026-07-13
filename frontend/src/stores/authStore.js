import { defineStore } from 'pinia';
import { supabase } from '../services/api/supabase';
import { hasSupabaseConfig } from '../services/api/supabase';
import { AuthService } from '../services/AuthService.ts';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    session: null,
    loading: false,
    error: null,
    schoolId: null,
  }),
  getters: {
    isAuthenticated: (state) => !!state.user,
    currentSchoolId: (state) => state.schoolId,
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
        return;
      }

      // Note: In production, school_id comes from JWT claims via Supabase
      // The profile's school_id is determined by the JWT token at login
      // For now, we read it from the profile table on first access
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('school_id')
            .eq('id', user.id)
            .single();
          this.schoolId = profile?.school_id ?? null;
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

    async signOut() {
      await AuthService.signOut();
      this.user = null;
      this.session = null;
      this.schoolId = null;
    },
  },
});
