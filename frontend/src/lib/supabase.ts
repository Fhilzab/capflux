/**
 * Centralized Supabase client for CAPFLUX.
 *
 * This is the SINGLE Supabase client used by the frontend. It enables
 * Supabase Auth (session persistence, auto-refresh) which the offline/sync
 * data plane and the auth provider both consume.
 *
 * NEVER expose SUPABASE_SERVICE_ROLE_KEY here — only the anon/publishable
 * key is used. The service-role key is backend-only.
 */
import { createClient } from '@supabase/supabase-js';
import { runtimeEnvironment } from '../shared/environment/runtimeEnvironment';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client: ReturnType<typeof createClient> | null = null;

function createSupabaseClient(): ReturnType<typeof createClient> {
  if (!hasSupabaseConfig) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
  }
  if (!client) {
    client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

export function getSupabase() {
  // Sandbox isolation tripwire: sandbox mode must never open a Supabase
  // channel — even when Supabase env vars happen to be present in the build.
  if (runtimeEnvironment.isSandbox) {
    throw new Error(
      'Sandbox isolation: Supabase access is blocked. Sandbox providers and the API simulator handle all data.'
    );
  }
  return createSupabaseClient();
}

// Eager singleton for code paths that always need a client instance.
// Consumers that may run before env vars are present should call getSupabase().
// (Deliberately bypasses the sandbox tripwire so merely importing this module
// can never crash a sandbox bundle; the tripwire guards USAGE.)
export const supabase = hasSupabaseConfig ? createSupabaseClient() : createClient('', '', {
  auth: { persistSession: false },
});
