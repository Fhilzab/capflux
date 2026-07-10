import { defineStore } from 'pinia';
import { supabase } from '../services/api/supabase';
import { AuthService } from '../services/domain/authService';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    session: null,
    loading: false,
    error: null,
  }),
  getters: {
    isAuthenticated: (state) => !!state.user,
  },
  actions: {
    async initialize() {
      const { session, error } = await AuthService.initialize();
      if (error) {
        this.error = error.message;
      }

      this.session = session;
      this.user = session?.user ?? null;

      supabase.auth.onAuthStateChange((_, sessionUpdate) => {
        this.session = sessionUpdate;
        this.user = sessionUpdate?.user ?? null;
      });
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
      return true;
    },

    async signOut() {
      await AuthService.signOut();
      this.user = null;
      this.session = null;
    },
  },
});
