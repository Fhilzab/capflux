-- ==========================================================
-- CAPSTONE SOFTWARE SOLUTIONS LTD
-- Migration: 202607100020_tenant_foundation.sql
-- Purpose: School & profile schema enhancement for Phase 2
-- ==========================================================

BEGIN;

-- ==========================================================
-- SAFE ENUM CREATION (never drop existing enums in production)
-- ==========================================================

DO $$ BEGIN
    CREATE TYPE school_status AS ENUM (
        'ONBOARDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE', 'ARCHIVED'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE school_level AS ENUM (
        'NURSERY', 'PRIMARY', 'SECONDARY',
        'NURSERY_PRIMARY', 'PRIMARY_SECONDARY',
        'NURSERY_PRIMARY_SECONDARY'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE gender_type AS ENUM ('MIXED', 'BOYS', 'GIRLS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==========================================================
-- EXTEND SCHOOLS TABLE (operational metadata)
-- ==========================================================

ALTER TABLE schools ADD COLUMN IF NOT EXISTS operational_status school_status NOT NULL DEFAULT 'ONBOARDING';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS school_level school_level;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS gender_type gender_type;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'NG';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Africa/Lagos';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'NGN';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
-- FK constraints added in migration 022 after academic tables are created
ALTER TABLE schools ADD COLUMN IF NOT EXISTS current_session_id UUID;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS current_term_id UUID;

-- Migrate existing subscription_status to operational_status
UPDATE schools SET operational_status = 'ACTIVE' WHERE subscription_status = 'ACTIVE';
UPDATE schools SET operational_status = 'SUSPENDED' WHERE subscription_status = 'SUSPENDED';
-- Keep subscription_status column for backward compatibility

-- ==========================================================
-- EXTEND PROFILES TABLE
-- ==========================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
-- NOTE: email is NOT added to profiles. Email comes from auth.users.

-- ==========================================================
-- FIX TENANT CONTEXT FUNCTIONS (use auth.uid() → profiles lookup)
-- ==========================================================

CREATE OR REPLACE FUNCTION current_profile_id()
RETURNS UUID LANGUAGE SQL STABLE AS $$
    SELECT auth.uid();
$$;

CREATE OR REPLACE FUNCTION current_school_id()
RETURNS UUID LANGUAGE SQL STABLE AS $$
    SELECT school_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION current_profile_role()
RETURNS profile_role LANGUAGE SQL STABLE AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- ==========================================================
-- FIX create_school_with_owner (uses auth.uid(), no profile creation)
-- ==========================================================

CREATE OR REPLACE FUNCTION create_school_with_owner(
    p_school_name TEXT,
    p_school_level school_level DEFAULT NULL,
    p_gender_type gender_type DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    p_contact_email TEXT DEFAULT NULL,
    p_contact_phone TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_school_id UUID;
    v_owner_id UUID;
BEGIN
    v_owner_id := auth.uid();
    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    INSERT INTO schools (
        id, name, school_level, gender_type,
        address, city, state, contact_email, contact_phone,
        operational_status, owner_id, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), p_school_name, p_school_level, p_gender_type,
        p_address, p_city, p_state, p_contact_email, p_contact_phone,
        'ONBOARDING', v_owner_id, now(), now()
    ) RETURNING id INTO v_school_id;

    UPDATE profiles
    SET school_id = v_school_id, role = 'PROPRIETOR', admin_status = 'ACTIVE'
    WHERE id = v_owner_id;

    INSERT INTO onboarding_progress (school_id, stage) VALUES (v_school_id, 1);

    RETURN v_school_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================================
-- UPDATED_AT + VERSION TRIGGER FOR SCHOOLS
-- ==========================================================

CREATE OR REPLACE FUNCTION update_school_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS school_updated_at ON schools;
CREATE TRIGGER school_updated_at
    BEFORE UPDATE ON schools
    FOR EACH ROW
    EXECUTE FUNCTION update_school_timestamp();

-- ==========================================================
-- SCHOOL READINESS FUNCTION
-- ==========================================================

CREATE OR REPLACE FUNCTION school_is_ready(p_school_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
    SELECT
        EXISTS (SELECT 1 FROM profiles WHERE school_id = p_school_id AND role = 'PROPRIETOR')
        AND EXISTS (
            SELECT 1 FROM academic_sessions 
            WHERE school_id = p_school_id AND is_current = true
        )
        AND EXISTS (
            SELECT 1 FROM academic_terms t 
            JOIN academic_sessions s ON t.session_id = s.id 
            WHERE s.school_id = p_school_id AND t.is_current = true
        )
        AND EXISTS (
            SELECT 1 FROM tuition_configuration 
            WHERE school_id = p_school_id
        )
        AND EXISTS (
            SELECT 1 FROM payment_gateway_config 
            WHERE school_id = p_school_id AND is_active = true
        );
$$;

-- ==========================================================
-- INDEXES FOR PERFORMANCE
-- ==========================================================

CREATE INDEX IF NOT EXISTS idx_profiles_auth_id ON profiles (id);
CREATE INDEX IF NOT EXISTS idx_schools_operational_status ON schools (operational_status);
CREATE INDEX IF NOT EXISTS idx_schools_current_session ON schools (current_session_id);
CREATE INDEX IF NOT EXISTS idx_schools_current_term ON schools (current_term_id);

COMMIT;