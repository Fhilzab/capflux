-- ==========================================================
-- CAPFLUX — FHILZAB NIG LTD
-- Migration: 202607100027_supabase_auth_uuid.sql
-- Purpose: Prepare schema for Supabase Auth identity model.
--   1. Revert school_members.user_id from TEXT back to UUID
--   2. Fix school_members.invited_by FK to reference public.users
--   3. Add auth.users → public.users provisioning trigger
--   4. Ensure user_profiles has all fields needed by the app
-- ==========================================================

BEGIN;

-- ==========================================================
-- 1. REVERT school_members.user_id FROM TEXT TO UUID
-- ==========================================================
-- Migration 021 converted user_id to TEXT to accommodate WorkOS string IDs.
-- Supabase Auth uses UUID, so we revert to UUID for type consistency with
-- public.users.id (UUID), organization_members.user_id (UUID), and
-- profiles.user_id (UUID).
--
-- SAFETY: Only proceed if every existing value is a valid UUID string.
-- ==========================================================

DO $$
DECLARE
    v_invalid_count INTEGER;
    v_invalid_sample TEXT;
BEGIN
    -- Count rows where user_id is NOT a valid UUID.
    -- uuid 'text' cast fails for non-UUID strings, so we catch the exception.
    SELECT COUNT(*) INTO v_invalid_count
    FROM public.school_members sm
    WHERE sm.user_id IS NOT NULL
      AND sm.user_id::text !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

    IF v_invalid_count > 0 THEN
        SELECT string_agg(sm.user_id, ', ' LIMIT 10) INTO v_invalid_sample
        FROM public.school_members sm
        WHERE sm.user_id IS NOT NULL
          AND sm.user_id::text !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        LIMIT 10;

        RAISE EXCEPTION 'school_members.user_id has % non-UUID value(s): % — conversion aborted. Investigate before retrying.',
            v_invalid_count, v_invalid_sample
        USING HINT = 'These WorkOS user IDs do not match UUID format. Add a supabase_uid mapping column before converting.';
    END IF;

    -- All values are valid UUID strings — safe to convert.
    RAISE NOTICE 'All school_members.user_id values are valid UUIDs. Proceeding with conversion.';
END $$;

-- Drop the TEXT foreign key and constraints, then convert to UUID.
ALTER TABLE public.school_members
    DROP CONSTRAINT IF EXISTS school_members_user_id_fkey;

ALTER TABLE public.school_members
    ALTER COLUMN user_id TYPE UUID USING user_id::uuid;

-- Restore the FK to public.users(id).
ALTER TABLE public.school_members
    ADD CONSTRAINT school_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Also fix invited_by to reference public.users (not auth.users) for consistency.
ALTER TABLE public.school_members
    DROP CONSTRAINT IF EXISTS school_members_invited_by_fkey;

ALTER TABLE public.school_members
    ADD CONSTRAINT school_members_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- Index for fast membership lookups (UUID is faster than TEXT).
DROP INDEX IF EXISTS idx_school_members_user;
CREATE INDEX IF NOT EXISTS idx_school_members_user
    ON public.school_members(user_id);

-- ==========================================================
-- 2. PROVISIONING TRIGGER: auth.users → public.users + user_profiles
-- ==========================================================
-- When a new user signs up via Supabase Auth, automatically create the
-- corresponding CAPFLUX application records.
--
-- This replaces the manual upsertUserRecords() in the Express route handler.
-- The trigger is idempotent (INSERT ... ON CONFLICT DO NOTHING).
-- It does NOT touch school_members, organization_members, or any tenant
-- association — those are resolved by the application layer.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.handle_new_supabase_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Create the application user record (idempotent via ON CONFLICT).
    INSERT INTO public.users (id, email, auth_provider, email_verified, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        'supabase',
        COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
        COALESCE(NEW.created_at, now()),
        COALESCE(NEW.updated_at, now())
    )
    ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            email_verified = EXCLUDED.email_verified,
            auth_provider = 'supabase';

    -- Create or update the profile (idempotent via ON CONFLICT).
    INSERT INTO public.user_profiles (
        user_id,
        full_name,
        phone,
        avatar_url,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name',
                 NEW.raw_user_meta_data ->> 'name',
                 CONCAT(
                     COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
                     ' ',
                     COALESCE(NEW.raw_user_meta_data ->> 'last_name', '')
                 )),
        NULLIF(NEW.raw_user_meta_data ->> 'phone', '')::TEXT,
        NEW.raw_user_meta_data ->> 'avatar_url',
        now(),
        now()
    )
    ON CONFLICT (user_id) DO UPDATE
        SET full_name = EXCLUDED.full_name,
            phone = EXCLUDED.phone,
            avatar_url = EXCLUDED.avatar_url,
            updated_at = now();

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the failure but never block authentication.
        RAISE WARNING 'Failed to provision user profile for %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Attach the trigger to auth.users (Supabase built-in table).
DROP TRIGGER IF EXISTS supabase_auth_provisioning ON auth.users;
CREATE TRIGGER supabase_auth_provisioning
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_supabase_user();

-- Also handle updates to email_verified (e.g., email confirmation).
DROP TRIGGER IF EXISTS supabase_auth_update_hook ON auth.users;
CREATE TRIGGER supabase_auth_update_hook
    AFTER UPDATE OF email_confirmed_at ON auth.users
    FOR EACH ROW
    WHEN (OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at)
    EXECUTE FUNCTION public.handle_new_supabase_user();

-- ==========================================================
-- 3. ENSURE user_profiles SCHEMA IS SUFFICIENT
-- ==========================================================
-- user_profiles already has: user_id, full_name, phone, avatar_url, timestamps.
-- No structural changes needed for Phase 2 — it covers the fields written by
-- the provisioning trigger. The legacy `profiles` table is NOT modified.
-- ==========================================================

-- ==========================================================
-- 4. DOCUMENT RLS MIGRATION (not applied in Phase 2)
-- ==========================================================
-- The following policies currently use auth.uid()::text and need updating
-- to auth.uid() (UUID) after this migration is applied:
--
--   public.users (migration 021):
--     "Users can view own identity" — USING (auth.uid()::text = id)
--     Should become: USING (auth.uid() = id)
--
--   public.user_profiles (migration 021):
--     "Users can view own profile" — USING (auth.uid()::text = user_id)
--     Should become: USING (auth.uid() = user_id)
--     "Users can update own profile" — same pattern
--
--   public.school_members (migration 020):
--     "Users can view their own school memberships"
--     — user_id = auth.uid()::text → user_id = auth.uid()
--
--   public.roles, public.role_permissions (migration 020):
--     All policies use auth.uid()::text → should use auth.uid()
--
--   public.organizations, public.organization_members (migration 022):
--     All policies use auth.uid()::text → should use auth.uid()
--
-- These RLS changes are applied in Phase 6 after verifying the UUID conversion
-- is safe and the provisioning trigger is working.

COMMIT;
