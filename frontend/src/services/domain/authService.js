import { SupabaseRepository } from '../repository/supabaseRepository';

export const AuthService = {
  async initialize() {
    const { session, error } = await SupabaseRepository.getSession();
    return { session, error };
  },

  async signIn(email, password) {
    return SupabaseRepository.signIn(email, password);
  },

  async signOut() {
    return SupabaseRepository.signOut();
  },
};
