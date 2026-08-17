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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
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

// Eager singleton for code paths that always need a client instance.
// Consumers that may run before env vars are present should call getSupabase().
export const supabase = hasSupabaseConfig ? getSupabase() : createClient('', '', {
  auth: { persistSession: false },
});
