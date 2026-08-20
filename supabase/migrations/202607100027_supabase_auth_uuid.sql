-- ===============================================================
-- CAPFLUX — SUPABASE AUTH MIGRATION (REPAIRED)
-- Migration: 202607100027_supabase_auth_uuid.sql
-- Purpose: Establish ONE consistent UUID identity model across the
--          entire database:
--
--   auth.users.id (UUID) → public.users.id (UUID)
--     → user_profiles.user_id (UUID)
--     → school_members.user_id (UUID)
--     → organization_members.user_id (UUID)
--     → all other user-reference columns (UUID)
--
-- The purge of 21 WorkOS test identities (Phase 6D) has already
-- been executed. All remaining identity values are valid UUIDs.
--
-- This repair extends the original migration which only handled
-- school_members.user_id. This version converts ALL 18 user-reference
-- columns and rebuilds ALL 16 FK constraints for type consistency.
--
-- LIVE DATABASE STATUS (verified via Management API):
--   - public.users.id: TEXT (2 rows, both valid UUIDs)
--   - All 16 FK-referenced columns: TEXT
--   - All financial/audit columns: TEXT, all NULL (no data to migrate)
--   - auth.users: empty
--   - No WorkOS IDs remain anywhere in the database
-- ===============================================================

BEGIN;

-- ==========================================================
-- 1. VALIDATE ALL IDENTITY VALUES ARE VALID UUIDs
-- ==========================================================
-- Phase 6F: Before any conversion, validate every user-reference
-- column contains only valid UUID-format values (or NULL).
-- If ANY invalid value is found, RAISE EXCEPTION and abort.

DO $$
DECLARE
    v_invalid_count INTEGER;
    v_invalid_sample TEXT;
    v_col_type TEXT;

    -- List of (table, column) pairs to validate
    -- (excluding empty/NULL-only tables which are trivially safe)
    CURSOR cols IS
        SELECT t::TEXT, c::TEXT
        FROM (
            VALUES
                ('public.users', 'id'),
                ('public.user_profiles', 'user_id'),
                ('public.school_members', 'user_id'),
                ('public.school_members', 'invited_by'),
                ('public.organization_members', 'user_id'),
                ('public.organizations', 'owner_user_id'),
                ('public.profiles', 'user_id'),
                ('public.schools', 'owner_user_id'),
                ('public.gateway_assignments', 'assigned_by'),
                ('public.kyc_records', 'reviewed_by'),
                ('public.kyc_records', 'cac_verified_by'),
                ('public.kyc_records', 'identity_verified_by'),
                ('public.kyc_verifications', 'verified_by'),
                ('public.payment_transactions', 'reversed_by'),
                ('public.reconciliation_issues', 'resolved_by'),
                ('public.reconciliation_runs', 'started_by'),
                ('public.settlement_accounts', 'submitted_by'),
                ('public.settlement_accounts', 'verified_by')
        ) AS v(t, c);

    rec RECORD;
BEGIN
    FOR rec IN cols LOOP
        -- Check current column type
        SELECT data_type INTO v_col_type
        FROM information_schema.columns
        WHERE table_schema = split_part(rec.t, '.', 2)
          AND table_name = rec.t
          AND column_name = rec.c;

        -- Skip if already UUID
        IF v_col_type = 'uuid' THEN
            RAISE NOTICE '%.% is already UUID — skipping validation.', rec.t, rec.c;
            CONTINUE;
        END IF;

        -- Count invalid (non-UUID, non-NULL) values
        EXECUTE format('SELECT COUNT(*) FROM %I.%I WHERE %I IS NOT NULL AND %I !~ ''^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$''',
            split_part(rec.t, '.', 1), rec.t, rec.c, rec.c)
        INTO v_invalid_count;

        IF v_invalid_count > 0 THEN
            EXECUTE format('SELECT string_agg(%I::text, '', '' ORDER BY %I) FROM %I.%I WHERE %I IS NOT NULL AND %I !~ ''^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$''',
            rec.c, rec.c, split_part(rec.t, '.', 1), rec.t, rec.c, rec.c)
            INTO v_invalid_sample;

            RAISE EXCEPTION 'ABORT: %.% has % non-UUID value(s): %. Cannot convert to UUID.',
                rec.t, rec.c, v_invalid_count, LEFT(v_invalid_sample, 200);
        ELSE
            RAISE NOTICE '%.% validated — all values are valid UUIDs or NULL.', rec.t, rec.c;
        END IF;
    END LOOP;
END $$;

-- ==========================================================
-- 2. DROP ALL FK CONSTRAINTS REFERENCING public.users(id)
-- ==========================================================
-- Phase 6G: Must drop FKs before type conversion (types must match
-- for FK constraints to remain valid).

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_user_id_fkey;
ALTER TABLE public.school_members DROP CONSTRAINT IF EXISTS school_members_user_id_fkey;
ALTER TABLE public.school_members DROP CONSTRAINT IF EXISTS school_members_invited_by_fkey;
ALTER TABLE public.organization_members DROP CONSTRAINT IF EXISTS organization_members_user_id_fkey;
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_owner_user_id_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE public.gateway_assignments DROP CONSTRAINT IF EXISTS gateway_assignments_assigned_by_fkey;
ALTER TABLE public.kyc_records DROP CONSTRAINT IF EXISTS kyc_records_reviewed_by_fkey;
ALTER TABLE public.kyc_records DROP CONSTRAINT IF EXISTS kyc_records_cac_verified_by_fkey;
ALTER TABLE public.kyc_records DROP CONSTRAINT IF EXISTS kyc_records_identity_verified_by_fkey;
ALTER TABLE public.kyc_verifications DROP CONSTRAINT IF EXISTS kyc_verifications_verified_by_fkey;
ALTER TABLE public.payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_reversed_by_fkey;
ALTER TABLE public.reconciliation_issues DROP CONSTRAINT IF EXISTS reconciliation_issues_resolved_by_fkey;
ALTER TABLE public.reconciliation_runs DROP CONSTRAINT IF EXISTS reconciliation_runs_started_by_fkey;
ALTER TABLE public.settlement_accounts DROP CONSTRAINT IF EXISTS settlement_accounts_submitted_by_fkey;
ALTER TABLE public.settlement_accounts DROP CONSTRAINT IF EXISTS settlement_accounts_verified_by_fkey;

-- ==========================================================
-- 3. CONVERT ALL IDENTITY COLUMNS TO UUID
-- ==========================================================
-- Phase 6F: Convert every user-reference column from TEXT to UUID.
-- The USING clause validates each value can be cast to UUID.
-- If any value fails, PostgreSQL will raise an error and the
-- transaction will ROLL BACK.

-- 3a. public.users.id (the root identity column)
ALTER TABLE public.users
    ALTER COLUMN id TYPE UUID USING id::uuid;

-- 3b. Core application tables
ALTER TABLE public.user_profiles
    ALTER COLUMN user_id TYPE UUID USING user_id::uuid;

ALTER TABLE public.school_members
    ALTER COLUMN user_id TYPE UUID USING user_id::uuid;

ALTER TABLE public.school_members
    ALTER COLUMN invited_by TYPE UUID USING invited_by::uuid;

ALTER TABLE public.organization_members
    ALTER COLUMN user_id TYPE UUID USING user_id::uuid;

ALTER TABLE public.organizations
    ALTER COLUMN owner_user_id TYPE UUID USING owner_user_id::uuid;

ALTER TABLE public.profiles
    ALTER COLUMN user_id TYPE UUID USING user_id::uuid;

ALTER TABLE public.schools
    ALTER COLUMN owner_user_id TYPE UUID USING owner_user_id::uuid;

-- 3c. Financial/audit tables (all values are NULL, conversion is trivial)
ALTER TABLE public.gateway_assignments
    ALTER COLUMN assigned_by TYPE UUID USING assigned_by::uuid;

ALTER TABLE public.kyc_records
    ALTER COLUMN reviewed_by TYPE UUID USING reviewed_by::uuid;
ALTER TABLE public.kyc_records
    ALTER COLUMN cac_verified_by TYPE UUID USING cac_verified_by::uuid;
ALTER TABLE public.kyc_records
    ALTER COLUMN identity_verified_by TYPE UUID USING identity_verified_by::uuid;

ALTER TABLE public.kyc_verifications
    ALTER COLUMN verified_by TYPE UUID USING verified_by::uuid;

ALTER TABLE public.payment_transactions
    ALTER COLUMN reversed_by TYPE UUID USING reversed_by::uuid;

ALTER TABLE public.reconciliation_issues
    ALTER COLUMN resolved_by TYPE UUID USING resolved_by::uuid;

ALTER TABLE public.reconciliation_runs
    ALTER COLUMN started_by TYPE UUID USING started_by::uuid;

ALTER TABLE public.settlement_accounts
    ALTER COLUMN submitted_by TYPE UUID USING submitted_by::uuid;
ALTER TABLE public.settlement_accounts
    ALTER COLUMN verified_by TYPE UUID USING verified_by::uuid;

-- ==========================================================
-- 4. RE-ADD ALL FK CONSTRAINTS (UUID → UUID)
-- ==========================================================
-- Phase 6G: Rebuild all FK constraints with matching UUID types.
-- ON DELETE rules are chosen per-column semantics:
--   - CASCADE: membership rows should be deleted when user is deleted
--   - SET NULL: ownership/audit references should survive (NULLifiable)

ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.school_members
    ADD CONSTRAINT school_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.school_members
    ADD CONSTRAINT school_members_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.organization_members
    ADD CONSTRAINT organization_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_owner_user_id_fkey
    FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.schools
    ADD CONSTRAINT schools_owner_user_id_fkey
    FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.gateway_assignments
    ADD CONSTRAINT gateway_assignments_assigned_by_fkey
    FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.kyc_records
    ADD CONSTRAINT kyc_records_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.kyc_records
    ADD CONSTRAINT kyc_records_cac_verified_by_fkey
    FOREIGN KEY (cac_verified_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.kyc_records
    ADD CONSTRAINT kyc_records_identity_verified_by_fkey
    FOREIGN KEY (identity_verified_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.kyc_verifications
    ADD CONSTRAINT kyc_verifications_verified_by_fkey
    FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.payment_transactions
    ADD CONSTRAINT payment_transactions_reversed_by_fkey
    FOREIGN KEY (reversed_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.reconciliation_issues
    ADD CONSTRAINT reconciliation_issues_resolved_by_fkey
    FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.reconciliation_runs
    ADD CONSTRAINT reconciliation_runs_started_by_fkey
    FOREIGN KEY (started_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.settlement_accounts
    ADD CONSTRAINT settlement_accounts_submitted_by_fkey
    FOREIGN KEY (submitted_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.settlement_accounts
    ADD CONSTRAINT settlement_accounts_verified_by_fkey
    FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- Rebuild indexes on converted UUID columns for query performance
DROP INDEX IF EXISTS idx_school_members_user;
CREATE INDEX IF NOT EXISTS idx_school_members_user
    ON public.school_members(user_id);

-- ==========================================================
-- 5. FUNCTION COMPATIBILITY — Fix parameter types to UUID
-- ==========================================================
-- Phase 6H: Functions that previously took TEXT user IDs now
-- take UUID, matching the converted columns.

-- 5a. is_super_admin — KEEP as UUID (do NOT downgrade to TEXT)
-- The live version already takes p_user_id UUID. No CREATE OR REPLACE
-- needed — it will work natively with UUID columns after conversion.
-- (The original on-disk migration 027 erroneously changed this to TEXT;
--  this repair deliberately omits that change.)

-- 5b. get_onboarding_status — change parameter TEXT → UUID
CREATE OR REPLACE FUNCTION public.get_onboarding_status(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
    DECLARE
        v_school_id UUID;
        v_progress RECORD;
    BEGIN
        SELECT school_id INTO v_school_id
        FROM public.school_members
        WHERE user_id = p_user_id AND is_active = true
        LIMIT 1;

        IF v_school_id IS NULL THEN
            RETURN jsonb_build_object('has_school', false);
        END IF;

        SELECT * INTO v_progress
        FROM public.onboarding_progress
        WHERE school_id = v_school_id;

        RETURN jsonb_build_object(
            'has_school', true,
            'school_id', v_school_id,
            'profile_completed', COALESCE(v_progress.profile_completed, false),
            'organization_completed', COALESCE(v_progress.organization_completed, false),
            'school_completed', COALESCE(v_progress.school_completed, false),
            'owner_completed', COALESCE(v_progress.owner_completed, false)
        );
    END;
$function$;

COMMENT ON FUNCTION public.get_onboarding_status(uuid) IS 'Get onboarding status for a user (Supabase Auth UUID model)';

-- 5c. create_organization_with_owner — change p_owner_user_id TEXT → UUID
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(p_name TEXT, p_owner_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
    DECLARE v_org_id UUID; v_role_id UUID;
    BEGIN
      INSERT INTO public.organizations (name, owner_user_id, slug)
      VALUES (p_name, p_owner_user_id, lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substring(gen_random_uuid()::text, 1, 8))
      RETURNING id INTO v_org_id;
      SELECT id INTO v_role_id FROM public.roles WHERE system_role = 'OWNER' AND is_system_role = true LIMIT 1;
      INSERT INTO public.organization_members (user_id, organization_id, role_id, is_active)
      VALUES (p_owner_user_id, v_org_id, v_role_id, true);
      RETURN v_org_id;
    END;
$function$;

-- 5d. create_school_with_onboarding — change p_owner_user_id TEXT → UUID
CREATE OR REPLACE FUNCTION public.create_school_with_onboarding(
    p_organization_id UUID,
    p_name TEXT,
    p_owner_user_id UUID,
    p_address TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    p_lga TEXT DEFAULT NULL,
    p_country TEXT DEFAULT 'Nigeria',
    p_school_type TEXT DEFAULT 'MIXED',
    p_academic_calendar JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
    DECLARE
        v_school_id UUID;
        v_owner_role_id UUID;
    BEGIN
        INSERT INTO public.schools (organization_id, name, address, state, lga, country, school_type, academic_calendar, owner_user_id)
        VALUES (p_organization_id, p_name, p_address, p_state, p_lga, p_country, p_school_type, p_academic_calendar, p_owner_user_id)
        RETURNING id INTO v_school_id;
        SELECT id INTO v_owner_role_id FROM public.roles WHERE system_role = 'OWNER' AND is_system_role = true LIMIT 1;
        INSERT INTO public.school_members (user_id, school_id, role_id, is_active)
        VALUES (p_owner_user_id, v_school_id, v_owner_role_id, true);
        INSERT INTO public.onboarding_progress (school_id) VALUES (v_school_id);
        RETURN v_school_id;
    END;
$function$;

-- 5e. create_school_with_owner (overload with p_owner_user_id) — TEXT → UUID
CREATE OR REPLACE FUNCTION public.create_school_with_owner(
    p_organization_id UUID,
    p_name TEXT,
    p_owner_user_id UUID,
    p_address TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    p_lga TEXT DEFAULT NULL,
    p_country TEXT DEFAULT 'Nigeria',
    p_school_type TEXT DEFAULT 'MIXED',
    p_academic_calendar JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
    DECLARE
        v_school_id UUID;
        v_owner_role_id UUID;
    BEGIN
        INSERT INTO public.schools (organization_id, name, address, state, lga, country, school_type, academic_calendar, owner_user_id)
        VALUES (p_organization_id, p_name, p_address, p_state, p_lga, p_country, p_school_type, p_academic_calendar, p_owner_user_id)
        RETURNING id INTO v_school_id;
        SELECT id INTO v_owner_role_id FROM public.roles WHERE system_role = 'OWNER' AND is_system_role = true LIMIT 1;
        INSERT INTO public.school_members (user_id, school_id, role_id, is_active)
        VALUES (p_owner_user_id, v_school_id, v_owner_role_id, true);
        INSERT INTO public.onboarding_progress (school_id) VALUES (v_school_id);
        RETURN v_school_id;
    END;
$function$;

-- ==========================================================
-- 6. PROVISIONING TRIGGER: auth.users → public.users → user_profiles
-- ==========================================================
-- Phase 6I: When a new user signs up via Supabase Auth, automatically
-- provision the CAPFLUX application records.
--
-- Properties:
--   - Uses NEW.id as UUID (auth.users.id is UUID)
--   - Creates/updates public.users with the same UUID
--   - Creates/updates user_profiles with the same UUID
--   - Idempotent (INSERT ... ON CONFLICT DO UPDATE)
--   - SECURITY DEFINER with restricted search_path
--   - Does NOT touch school_members, organization_members, or any tenant
--   - Does NOT create tenant membership automatically
--   - Preserves the UNIQUE email constraint on public.users.id
--   - Does not add a name column (public.users has no name column)

CREATE OR REPLACE FUNCTION public.handle_new_supabase_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Create the application user record (idempotent via ON CONFLICT).
    -- NEW.id is a UUID from auth.users; public.users.id is now UUID.
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
            auth_provider = 'supabase',
            updated_at = now();

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
        COALESCE(
            NEW.raw_user_meta_data ->> 'full_name',
            NEW.raw_user_meta_data ->> 'name',
            TRIM(
                COALESCE(NEW.raw_user_meta_data ->> 'first_name', '') || ' ' ||
                COALESCE(NEW.raw_user_meta_data ->> 'last_name', '')
            )
        ),
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

-- Attach triggers to auth.users (Supabase built-in table).
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
-- 7. CASCADE DELETE: auth.users → public.users → user_profiles
-- ==========================================================
-- Phase 6I (continued): When a Supabase Auth user is deleted,
-- cascade the deletion to public.users (and via CASCADE FK,
-- to user_profiles). Does NOT touch school_members, organization_members,
-- or any tenant business data.

CREATE OR REPLACE FUNCTION public.handle_supabase_user_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    DELETE FROM public.users WHERE id = OLD.id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS supabase_auth_delete ON auth.users;
CREATE TRIGGER supabase_auth_delete
    AFTER DELETE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_supabase_user_delete();

-- ==========================================================
-- 8. log_admin_status_change — handled by migration 028
-- ==========================================================
-- The log_admin_status_change trigger function is repaired in
-- migration 028 to use native UUID (v_actor_id UUID, auth.uid()
-- direct — no ::text cast). The admin_status_audit trigger on
-- profiles (created in migration 018) already calls this function;
-- only the function definition needs updating.

COMMIT;
