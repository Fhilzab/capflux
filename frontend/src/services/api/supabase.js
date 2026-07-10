import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const createFallbackClient = () => ({
  auth: {
    async signInWithPassword() {
      return {
        data: {
          session: {
            access_token: 'local-dev-token',
            user: {
              id: 'local-user',
              email: 'demo@capstone.local',
            },
          },
          user: {
            id: 'local-user',
            email: 'demo@capstone.local',
          },
        },
        error: null,
      };
    },
    async signOut() {
      return { data: null, error: null };
    },
    async getSession() {
      return { data: { session: null }, error: null };
    },
    async getUser() {
      return { data: { user: null }, error: null };
    },
    onAuthStateChange(callback) {
      callback('SIGNED_OUT', null);
      return { unsubscribe() {} };
    },
  },
  from() {
    return {
      insert: async () => ({ data: null, error: new Error('Supabase is not configured in local dev') }),
    };
  },
});

export const supabase = hasSupabaseConfig
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : createFallbackClient();
