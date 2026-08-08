/**
 * LEGACY Supabase client — NEUTRALIZED (Milestone 6.3).
 *
 * Supabase Auth and the direct Supabase data plane are no longer used.
 * Authentication is WorkOS AuthKit via the backend (/api/*). Domain data flows
 * through the backend service-role client.
 *
 * This module exists only so residual offline/sync code that still imports it
 * fails SAFE (returns "not configured" errors) instead of reaching a Supabase
 * project or fabricating sessions. It never authenticates and never connects.
 *
 * New code must NOT import this. Use @/shared/services/api/client instead.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Always treated as unconfigured: Supabase Auth is not the identity provider.
export const hasSupabaseConfig = false;

const errorResponse = async () => ({ data: null, error: new Error('Supabase is not configured. Use the CAPFLUX backend API.') });

const createFailSafeClient = () => ({
  auth: {
    async signInWithPassword() {
      return { data: { session: null, user: null }, error: new Error('Supabase Auth is disabled. Use WorkOS via /api/auth.') };
    },
    async signUp() {
      return { data: { user: null }, error: new Error('Supabase Auth is disabled. Use WorkOS via /api/auth.') };
    },
    async signOut() {
      return { data: null, error: null };
    },
    async getSession() {
      return { data: { session: null }, error: null };
    },
    async refreshSession() {
      return { data: { session: null }, error: null };
    },
    async getUser() {
      return { data: { user: null }, error: null };
    },
    onAuthStateChange() {
      return { unsubscribe() {} };
    },
  },
  from() {
    const builder = {
      eq: () => builder,
      insert: errorResponse,
      update: errorResponse,
      upsert: errorResponse,
      delete: errorResponse,
      select: () => builder,
      maybeSingle: errorResponse,
      single: errorResponse,
      order: () => builder,
    };
    return builder;
  },
  functions: {
    async invoke() {
      return { data: null, error: new Error('Supabase is not configured. Use the CAPFLUX backend API.') };
    },
  },
  rpc: async () => ({ data: null, error: new Error('Supabase is not configured. Use the CAPFLUX backend API.') }),
  channel() {
    return {
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
      subscribe: () => ({ unsubscribe: () => {} }),
      unsubscribe: () => {},
    };
  },
});

// Never construct a real client: the canonical data plane is the backend API.
export const supabase = createFailSafeClient();
