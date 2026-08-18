-- ===============================================================
-- CAPFLUX — SUPABASE AUTH MIGRATION
-- Migration: 202607100027_supabase_auth_uuid.sql
-- Purpose: Prepare schema for Supabase Auth identity model.
--
-- LIVE DATABASE STATUS (Phase 5 verified):
--   - school_members.user_id is currently TEXT
--   - Contains WorkOS-style IDs (user_01KZ...) that are NOT valid UUIDs
--   - public.users.id is TEXT (mixed UUID and WorkOS IDs)
--   - auth.users is empty (no Supabase Auth users exist yet)
--
-- STRATEGY:
--   If all school_members.user_id values are valid UUIDs → convert to UUID.
--   If any values are non-UUID (WorkOS IDs) → skip UUID conversion,
--   keep TEXT, and use auth.uid()::text in RLS policies (migration 028).
--   The provisioning trigger works with both UUID and TEXT columns.
-- ===============================================================

BEGIN;

-- ==========================================================
-- 1. CONDITIONAL UUID CONVERSION: school_members.user_id TEXT→UUID
-- ==========================================================
-- Migration 021 converted user_id from UUID to TEXT to accommodate
-- WorkOS string IDs. If all current values are valid UUIDs, we can
-- safely revert to UUID for type consistency. If WorkOS IDs exist,
-- we skip conversion and rely on auth.uid()::text in RLS policies.

DO $$
DECLARE
    v_invalid_count INTEGER;
    v_valid_count INTEGER;
    v_total_count INTEGER;
    v_invalid_sample TEXT;
    v_col_type TEXT;
BEGIN
    -- Check if the column is still TEXT (if already UUID, skip everything)
    SELECT data_type INTO v_col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'school_members'
      AND column_name = 'user_id';

    SELECT COUNT(*) INTO v_total_count FROM public.school_members;

    IF v_col_type = 'uuid' THEN
        RAISE NOTICE 'school_members.user_id is already UUID — skipping conversion.';
    ELSIF v_col_type = 'text' THEN
        -- Count rows with invalid UUID values.
        SELECT COUNT(*) INTO v_invalid_count
        FROM public.school_members sm
        WHERE sm.user_id IS NOT NULL
          AND sm.user_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

        IF v_invalid_count > 0 THEN
            SELECT string_agg(sm.user_id, ', ' ORDER BY sm.user_id) INTO v_invalid_sample
            FROM public.school_members sm
            WHERE sm.user_id IS NOT NULL
              AND sm.user_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

            RAISE WARNING 'school_members.user_id has % non-UUID value(s): %. Skipping UUID conversion — column stays TEXT. RLS policies will use auth.uid()::text.',
                v_invalid_count, LEFT(v_invalid_sample, 200);
            -- Skip conversion; do nothing here.
        ELSE
            SELECT COUNT(*) INTO v_valid_count
            FROM public.school_members
            WHERE user_id IS NOT NULL;

            RAISE NOTICE 'All % school_members.user_id values are valid UUIDs. Converting to UUID.', v_valid_count;

            -- Safe to convert: drop FK, convert column, restore FK.
            ALTER TABLE public.school_members
                DROP CONSTRAINT IF EXISTS school_members_user_id_fkey;

            ALTER TABLE public.school_members
                ALTER COLUMN user_id TYPE UUID USING user_id::uuid;

            ALTER TABLE public.school_members
                ADD CONSTRAINT school_members_user_id_fkey
                FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

            DROP INDEX IF EXISTS idx_school_members_user;
            CREATE INDEX IF NOT EXISTS idx_school_members_user
                ON public.school_members(user_id);
        END IF;

        -- Always fix invited_by FK to reference public.users (not auth.users),
        -- regardless of UUID conversion.
        ALTER TABLE public.school_members
            DROP CONSTRAINT IF EXISTS school_members_invited_by_fkey;

        ALTER TABLE public.school_members
            ADD CONSTRAINT school_members_invited_by_fkey
            FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ==========================================================
-- 2. PROVISIONING TRIGGER: auth.users → public.users + user_profiles
-- ==========================================================
-- When a new user signs up via Supabase Auth, automatically create the
-- corresponding CAPFLUX application records.
--
-- The trigger is idempotent (INSERT ... ON CONFLICT DO UPDATE).
-- It does NOT touch school_members, organization_members, or any tenant
-- association — those are resolved by the application layer.
--
-- NOTE: NEW.id is a UUID from auth.users. If public.users.id is TEXT,
-- PostgreSQL implicitly casts the UUID to TEXT. This works for both
-- UUID and TEXT column types.

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
-- No structural changes needed — it covers the fields written by the provisioning
-- trigger. The legacy `profiles` table is NOT modified.

-- ==========================================================
-- 4. FIX is_super_admin FUNCTION
-- ==========================================================
-- The is_super_admin function (created in migration 020) takes
-- p_user_id UUID but school_members.user_id is TEXT. This causes
-- "operator does not exist: text = uuid" errors.
--
-- Fix: change parameter to TEXT and use ::text for the comparison.
-- This works for both TEXT and UUID column types.

CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.school_members sm
        JOIN public.roles r ON sm.role_id = r.id
        WHERE sm.user_id::text = p_user_id
        AND sm.is_active = true
        AND r.system_role = 'SUPER_ADMIN'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_super_admin(TEXT) IS 'Returns true if the given user is a SUPER_ADMIN';

-- ==========================================================
-- 5. DOCUMENT RLS MIGRATION (applied by migration 028)
-- ==========================================================
-- The following policies currently use auth.uid()::text and need updating
-- to use auth.uid()::text consistently (which works for both TEXT and UUID
-- column types after this migration):
--
--   public.users (migration 021):
--     "Users can view own identity" — USING (auth.uid()::text = id)
--
--   public.user_profiles (migration 021):
--     "Users can view own profile" — USING (auth.uid()::text = user_id)
--     "Users can update own profile" — USING (auth.uid()::text = user_id)
--                                   WITH CHECK (auth.uid()::text = user_id)
--
--   public.school_members (migration 020):
--     All policies use auth.uid()::text → remain auth.uid()::text
--     (no change needed if column stays TEXT)
--
--   public.roles, public.role_permissions (migration 020):
--     All policies use auth.uid()::text
--
--   public.profiles (migration 018):
--     All policies use auth.uid()::text
--
--   public.organizations, public.organization_members,
--   public.onboarding_progress, public.kyc_records (migration 022):
--     All policies use auth.uid()::text
--
-- If the UUID conversion succeeded, school_members.user_id is UUID
-- and auth.uid()::text = user_id still works (UUID is cast to TEXT).
-- If the conversion was skipped, school_members.user_id remains TEXT
-- and auth.uid()::text = user_id is a direct TEXT comparison.

COMMIT;
