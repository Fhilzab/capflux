-- ==========================================================
-- CAPFLUX — WorkOS AuthKit — Add gen_random_uuid RPC wrapper
-- Migration: 202608280001_add_gen_random_uuid_rpc_wrapper.sql
--
-- Purpose: Add a SECURITY DEFINER wrapper for gen_random_uuid() so it can
--          be called via Supabase RPC (PostgREST only exposes SECURITY DEFINER functions).
--
-- Root Cause:
--   gen_random_uuid() exists in PostgreSQL (from pgcrypto) but is not SECURITY DEFINER,
--   so it cannot be called via Supabase RPC (PostgREST only exposes SECURITY DEFINER functions).
--
-- Solution:
--   Create a SECURITY DEFINER wrapper function that calls gen_random_uuid().
--
-- Safety:
--   * Pure function, no side effects
--   * Only generates UUIDs
--   * SECURITY DEFINER with restricted search_path
--   * Grants only to service_role
--
-- ==========================================================

BEGIN;

-- Create SECURITY DEFINER wrapper for gen_random_uuid()
CREATE OR REPLACE FUNCTION public.gen_random_uuid_rpc()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT gen_random_uuid();
$$;

COMMENT ON FUNCTION public.gen_random_uuid_rpc() IS
  'SECURITY DEFINER wrapper for gen_random_uuid() to allow RPC calls via PostgREST.';

-- Grant execute to service_role only (not PUBLIC, anon, authenticated)
REVOKE ALL ON FUNCTION public.gen_random_uuid_rpc() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gen_random_uuid_rpc() TO service_role;

COMMIT;