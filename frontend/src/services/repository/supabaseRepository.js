import { supabase } from '../api/supabase';

export const SupabaseRepository = {
  async signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password });
  },

  async signOut() {
    return supabase.auth.signOut();
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    return { session: data?.session ?? null, error };
  },

  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    return { user: data?.user ?? null, error };
  },

  async fetchStudents() {
    return supabase.from('students').select('*');
  },

  async createLedgerEntry(entry) {
    return supabase.from('ledger_entries').insert(entry);
  },

  async syncEntity(item) {
    return supabase.from(item.entity_type).insert(item.payload);
  },
};
