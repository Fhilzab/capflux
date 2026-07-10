import { supabase, hasSupabaseConfig } from './api/supabase';

export const AuthService = {
  async initialize() {
    if (!hasSupabaseConfig) {
      return { session: null, error: null };
    }

    const { data, error } = await supabase.auth.getSession();
    return { session: data?.session ?? null, error };
  },

  async signIn(email: string, password: string) {
    if (!hasSupabaseConfig) {
      return {
        data: {
          session: {
            access_token: 'local-dev-token',
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

    return supabase.auth.signInWithPassword({ email, password });
  },

  async signOut() {
    if (!hasSupabaseConfig) {
      return { data: null, error: null };
    }

    return supabase.auth.signOut();
  },
};
