/**
 * Re-export of the centralized Supabase client.
 *
 * This file previously contained a neutered/fake client that intentionally
 * prevented any Supabase connection. It now re-exports the single real
 * client from @/lib/supabase.ts so that all consumers — including the
 * offline/sync data plane — share ONE client instance.
 *
 * Auth provider: @/shared/auth/SupabaseAuthProvider
 * Data plane (sync): this module is re-exported here for backward compat.
 */
export { supabase, hasSupabaseConfig, getSupabase } from '@/lib/supabase';
