import { supabase } from './api/supabase';

export const AuthService = {
  async initialize() {
    const { data, error } = await supabase.auth.getSession();
    return { session: data?.session ?? null, error };
  },

  async signIn(email: string, password: string) {
    return supabase.auth.signInWithPassword({ email, password });
  },

  async signOut() {
    return supabase.auth.signOut();
  },
};
