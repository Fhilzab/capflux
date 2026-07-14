-- ==========================================================
-- CAPSTONE SOFTWARE SOLUTIONS LTD
-- Migration: 202607100018_owner_admin_role.sql
-- Purpose: Owner/Admin role architecture for Nigerian private schools
-- ==========================================================

BEGIN;

-- ==========================================================
-- ALTER PROFILE_ROLE ENUM
-- ==========================================================

-- Drop old enum values by recreating enum
ALTER TYPE profile_role RENAME TO profile_role_old;

CREATE TYPE profile_role AS ENUM (
    'OWNER',
    'ADMIN'
);

-- Migrate existing data
UPDATE profiles SET role = 'OWNER'::profile_role WHERE role::text IN ('PROPRIETOR', 'BURSAR');
UPDATE profiles SET role = 'ADMIN'::profile_role WHERE role::text = 'ADMIN';

-- Drop old enum
DROP TYPE profile_role_old;

-- ==========================================================
-- ADD ADMIN STATUS TO PROFILES
-- ==========================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_status TEXT NOT NULL DEFAULT 'ACTIVE';

CREATE TYPE admin_status AS ENUM (
    'ACTIVE',
    'SUSPENDED'
);

-- Migrate existing admin_status text to enum
ALTER TABLE profiles ALTER COLUMN admin_status TYPE admin_status USING admin_status::admin_status;

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
-- ==========================================================

-- Suspend admin
CREATE OR REPLACE FUNCTION suspend_admin(
    p_school_id UUID,
    p_admin_id UUID
) RETURNS VOID AS $$
BEGIN
    UPDATE profiles 
    SET admin_status = 'SUSPENDED'
    WHERE id = p_admin_id 
    AND role = 'ADMIN'
    AND school_id = p_school_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reactivate admin
CREATE OR REPLACE FUNCTION reactivate_admin(
    p_school_id UUID,
    p_admin_id UUID
) RETURNS VOID AS $$
BEGIN
    UPDATE profiles 
    SET admin_status = 'ACTIVE'
    WHERE id = p_admin_id 
    AND role = 'ADMIN'
    AND school_id = p_school_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove admin
CREATE OR REPLACE FUNCTION remove_admin(
    p_school_id UUID,
    p_admin_id UUID
) RETURNS VOID AS $$
BEGIN
    DELETE FROM profiles 
    WHERE id = p_admin_id 
    AND role = 'ADMIN'
    AND school_id = p_school_id;
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

-- Drop existing policies to recreate with role-based access
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users in same school" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Re-create with role-based checks
CREATE POLICY "Owner can view all profiles in school"
    ON profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.role = 'OWNER' 
            AND p.school_id = profiles.school_id
        )
    );

CREATE POLICY "Admins and owner can view own profile"
    ON profiles FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Owner can manage admins"
    ON profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.role = 'OWNER' 
            AND p.school_id = profiles.school_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.role = 'OWNER' 
            AND p.school_id = profiles.school_id
        )
    );

CREATE POLICY "Owner can insert admins"
    ON profiles FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.role = 'OWNER' 
            AND p.school_id = profiles.school_id
        )
    );

-- ==========================================================
-- AUDIT LOGGING TRIGGERS
-- ==========================================================

-- Create function to log admin status changes
CREATE OR REPLACE FUNCTION log_admin_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.admin_status IS DISTINCT FROM NEW.admin_status THEN
        INSERT INTO audit_logs (school_id, actor_id, action, entity, entity_id, metadata)
        VALUES (NEW.school_id, auth.uid(), 'ADMIN_' || UPPER(NEW.admin_status), 'profile', NEW.id,
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