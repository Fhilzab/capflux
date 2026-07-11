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
            refresh_token: 'local-dev-refresh',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
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
    async signUp() {
      return {
        data: {
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
    async refreshSession() {
      return {
        data: {
          session: {
            access_token: 'local-dev-token-refreshed',
            refresh_token: 'local-dev-refresh',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: {
              id: 'local-user',
              email: 'demo@capstone.local',
            },
          },
        },
        error: null,
      };
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
    const errorResponse = async () => ({ data: null, error: new Error('Supabase is not configured in local dev') });
    const builder = {
      eq: () => builder,
      insert: errorResponse,
      update: errorResponse,
      upsert: errorResponse,
      delete: errorResponse,
      select: errorResponse,
      maybeSingle: errorResponse,
      single: errorResponse,
    };
    return builder;
  },
  functions: {
    async invoke() {
      return { data: null, error: new Error('Supabase is not configured in local dev') };
    },
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
