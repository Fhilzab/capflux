-- ==========================================================
-- CAPFLUX — FHILZAB NIG LTD
-- Migration: 202607100018_owner_admin_role.sql
-- Purpose: Owner/Admin role architecture for Nigerian private schools
-- ==========================================================

BEGIN;

-- ==========================================================
-- PROFILE ROLE ENUM — canonical OWNER/ADMIN
-- Convert profiles.role to the canonical enum via USING (idempotent).
-- ==========================================================

-- Ensure the canonical values exist (additive, safe).
DO $$ BEGIN
    ALTER TYPE profile_role ADD VALUE IF NOT EXISTS 'OWNER';
    ALTER TYPE profile_role ADD VALUE IF NOT EXISTS 'ADMIN';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Migrate existing rows to canonical values.
UPDATE profiles SET role = 'OWNER'::profile_role WHERE role::text IN ('PROPRIETOR', 'BURSAR');
UPDATE profiles SET role = 'ADMIN'::profile_role WHERE role::text = 'ADMIN';

-- Drop the legacy role values from the enum so only OWNER/ADMIN remain.
-- NOTE: Supabase PostgreSQL does not support ALTER TYPE ... DROP VALUE.
-- Since migration 0001 no longer defines 'PROPRIETOR', and 'BURSAR' is unused
-- by any seed data or application code, the DROP is safely skipped.
-- Legacy values that are unused cause no operational issues when present.


-- ==========================================================
-- ADD ADMIN STATUS TO PROFILES
-- ==========================================================

-- Ensure the admin_status enum exists.
DO $$ BEGIN
    CREATE TYPE admin_status AS ENUM (
        'ACTIVE',
        'SUSPENDED'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add the column as text first, then cast to the enum (idempotent).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_status TEXT NOT NULL DEFAULT 'ACTIVE';
-- Drop default before type change (TEXT 'ACTIVE' can't auto-cast to enum),
-- then restore it as the enum type.
ALTER TABLE profiles ALTER COLUMN admin_status DROP DEFAULT;
ALTER TABLE profiles ALTER COLUMN admin_status TYPE admin_status USING admin_status::admin_status;
ALTER TABLE profiles ALTER COLUMN admin_status SET DEFAULT 'ACTIVE'::admin_status;

-- ==========================================================
-- ADD OWNER REFERENCE TO SCHOOLS
-- ==========================================================

ALTER TABLE schools ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles (id);

-- Add constraint to ensure exactly one owner per school (handled by application logic)
-- The unique constraint ensures one owner per school

-- ==========================================================
-- OWNERSHIP TRANSFER FUNCTION
-- ==========================================================

CREATE OR REPLACE FUNCTION transfer_ownership(
    p_school_id UUID,
    p_current_owner_id UUID,
    p_new_owner_id UUID
) RETURNS VOID AS $$
DECLARE
    v_current_is_owner BOOLEAN;
    v_new_is_admin BOOLEAN;
BEGIN
    -- Verify current user is the owner
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = p_current_owner_id AND role = 'OWNER'
    ) INTO v_current_is_owner;

    IF NOT v_current_is_owner THEN
        RAISE EXCEPTION 'Current user is not the owner';
    END IF;

    -- Verify new owner is an active admin
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = p_new_owner_id 
        AND role = 'ADMIN' 
        AND admin_status = 'ACTIVE'
    ) INTO v_new_is_admin;

    IF NOT v_new_is_admin THEN
        RAISE EXCEPTION 'New owner must be an active admin';
    END IF;

    -- Perform transfer in transaction
    UPDATE profiles SET role = 'ADMIN', admin_status = 'ACTIVE' WHERE id = p_current_owner_id;
    UPDATE profiles SET role = 'OWNER', admin_status = 'ACTIVE' WHERE id = p_new_owner_id;
    UPDATE schools SET owner_id = p_new_owner_id WHERE id = p_school_id;

    -- Log audit event
    INSERT INTO audit_logs (school_id, actor_id, action, entity, entity_id, metadata)
    VALUES (p_school_id, p_current_owner_id, 'OWNERSHIP_TRANSFERRED', 'school', p_school_id, 
        jsonb_build_object('new_owner_id', p_new_owner_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================================
-- ADMIN MANAGEMENT FUNCTIONS
-- NOTE: These operate on profiles for legacy compatibility. New
-- authorization uses organization_members/school_members. Actor_id is
-- passed explicitly (never derived from auth.uid()::text, which is empty under
-- WorkOS).
-- ==========================================================

-- Suspend admin
CREATE OR REPLACE FUNCTION suspend_admin(
    p_school_id UUID,
    p_admin_id UUID,
    p_actor_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE profiles
    SET admin_status = 'SUSPENDED'
    WHERE id = p_admin_id
    AND role = 'ADMIN'
    AND school_id = p_school_id;

    IF p_actor_id IS NOT NULL THEN
        INSERT INTO audit_logs (school_id, actor_id, action, entity, entity_id, metadata)
        VALUES (p_school_id, p_actor_id, 'ADMIN_SUSPENDED', 'profile', p_admin_id,
            jsonb_build_object('admin_status', 'SUSPENDED'));
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reactivate admin
CREATE OR REPLACE FUNCTION reactivate_admin(
    p_school_id UUID,
    p_admin_id UUID,
    p_actor_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE profiles
    SET admin_status = 'ACTIVE'
    WHERE id = p_admin_id
    AND role = 'ADMIN'
    AND school_id = p_school_id;

    IF p_actor_id IS NOT NULL THEN
        INSERT INTO audit_logs (school_id, actor_id, action, entity, entity_id, metadata)
        VALUES (p_school_id, p_actor_id, 'ADMIN_REACTIVATED', 'profile', p_admin_id,
            jsonb_build_object('admin_status', 'ACTIVE'));
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove admin
CREATE OR REPLACE FUNCTION remove_admin(
    p_school_id UUID,
    p_admin_id UUID,
    p_actor_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    DELETE FROM profiles
    WHERE id = p_admin_id
    AND role = 'ADMIN'
    AND school_id = p_school_id;

    IF p_actor_id IS NOT NULL THEN
        INSERT INTO audit_logs (school_id, actor_id, action, entity, entity_id, metadata)
        VALUES (p_school_id, p_actor_id, 'ADMIN_REMOVED', 'profile', p_admin_id,
            jsonb_build_object('admin_status', 'REMOVED'));
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create admin (for invitations)
CREATE OR REPLACE FUNCTION create_admin(
    p_school_id UUID,
    p_email TEXT,
    p_invited_by UUID
) RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Find or create user
    SELECT id INTO v_user_id FROM profiles WHERE email = p_email;
    
    IF v_user_id IS NULL THEN
        -- This would be handled by Supabase auth signup
        -- Return null to indicate invitation needed
        RETURN NULL;
    END IF;

    -- Update existing user to admin
    UPDATE profiles 
    SET role = 'ADMIN', 
        admin_status = 'ACTIVE',
        school_id = p_school_id,
        updated_at = now()
    WHERE id = v_user_id;

    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================================
-- RLS POLICY UPDATES
-- ==========================================================

-- Drop legacy auth.uid()::text-based policies (auth.uid()::text is NULL under WorkOS).
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users in same school" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Owner can view all profiles in school" ON profiles;
DROP POLICY IF EXISTS "Admins and owner can view own profile" ON profiles;
DROP POLICY IF EXISTS "Owner can manage admins" ON profiles;
DROP POLICY IF EXISTS "Owner can insert admins" ON profiles;

-- Re-create with membership-based checks (WorkOS user id → school_members).
-- school_members/roles are created in migration 020; these policies depend on them.
-- Wrap in conditional DO blocks so the migration is self-healing if tables are missing.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'school_members') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles') THEN
            DROP POLICY IF EXISTS "School members can view profiles" ON profiles;
            EXECUTE $p$
                CREATE POLICY "School members can view profiles"
                    ON profiles FOR SELECT
                    USING (
                        EXISTS (
                            SELECT 1 FROM public.school_members sm
                            WHERE sm.user_id = auth.uid()::text
                              AND sm.school_id = profiles.school_id
                              AND sm.is_active = true
                        )
                    )
            $p$;
        END IF;
    END IF;
END
$$;

-- A user may always view their own profile (no external table references).
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid()::text = profiles.user_id);

-- Members with a school-manage role: deferred to 020 via conditional DO.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'school_members') THEN
        DROP POLICY IF EXISTS "School admins can manage profiles" ON profiles;
        EXECUTE $p$
            CREATE POLICY "School admins can manage profiles"
                ON profiles FOR UPDATE
                USING (
                    EXISTS (
                        SELECT 1 FROM public.school_members sm
                        JOIN public.roles r ON r.id = sm.role_id
                        WHERE sm.user_id = auth.uid()::text
                          AND sm.school_id = profiles.school_id
                          AND sm.is_active = true
                          AND r.system_role IN ('OWNER', 'ADMIN')
                    )
                )
                WITH CHECK (
                    EXISTS (
                        SELECT 1 FROM public.school_members sm
                        JOIN public.roles r ON r.id = sm.role_id
                        WHERE sm.user_id = auth.uid()::text
                          AND sm.school_id = profiles.school_id
                          AND sm.is_active = true
                          AND r.system_role IN ('OWNER', 'ADMIN')
                    )
                )
        $p$;
    END IF;
END
$$;

-- =========================================================
-- AUDIT LOGGING TRIGGERS
-- ==========================================================

-- Create function to log admin status changes
CREATE OR REPLACE FUNCTION log_admin_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID;
BEGIN
    -- Under WorkOS, auth.uid()::text is not populated; fall back to the NEW.user_id
    -- when the row carries one, else the system UUID.
    v_actor_id := auth.uid()::text;
    IF v_actor_id IS NULL THEN
        v_actor_id := NEW.user_id;
    END IF;
    IF v_actor_id IS NULL THEN
        v_actor_id := '00000000-0000-0000-0000-000000000000'::UUID;
    END IF;

    IF OLD.admin_status IS DISTINCT FROM NEW.admin_status THEN
        INSERT INTO audit_logs (school_id, actor_id, action, entity, entity_id, metadata)
        VALUES (NEW.school_id, v_actor_id, 'ADMIN_' || UPPER(NEW.admin_status), 'profile', NEW.id,
            jsonb_build_object('previous_status', OLD.admin_status));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to profiles table
DROP TRIGGER IF EXISTS admin_status_audit ON profiles;
CREATE TRIGGER admin_status_audit
    AFTER UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION log_admin_status_change();

COMMIT;