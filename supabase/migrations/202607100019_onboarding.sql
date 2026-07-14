-- ==========================================================
-- CAPSTONE SOFTWARE SOLUTIONS LTD
-- Migration: 202607100019_onboarding.sql
-- Purpose: Onboarding state tracking for new schools
-- ==========================================================

BEGIN;

-- ==========================================================
-- ONBOARDING STATE TRACKING
-- ==========================================================

-- Track onboarding progress for each school
CREATE TABLE IF NOT EXISTS onboarding_progress (
    school_id UUID PRIMARY KEY REFERENCES schools (id) ON DELETE CASCADE,
    stage INTEGER NOT NULL DEFAULT 1 CHECK (stage >= 1 AND stage <= 3),
    completed_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    business_verified BOOLEAN NOT NULL DEFAULT false,
    settlement_verified BOOLEAN NOT NULL DEFAULT false,
    payment_service_ready BOOLEAN NOT NULL DEFAULT false,
    activated BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to update timestamp
CREATE OR REPLACE FUNCTION update_onboarding_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS onboarding_progress_updated_at ON onboarding_progress;
CREATE TRIGGER onboarding_progress_updated_at
    BEFORE UPDATE ON onboarding_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_onboarding_progress_timestamp();

-- ==========================================================
-- BUSINESS VERIFICATION FIELDS
-- ==========================================================

-- Add business verification fields to schools table
ALTER TABLE schools ADD COLUMN IF NOT EXISTS proprietor_bvn TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS proprietor_nin TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS business_type TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS cac_number TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS tax_identification_number TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS settlement_bank TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS settlement_account_number TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS settlement_account_name TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS settlement_verified BOOLEAN DEFAULT false;

-- ==========================================================
-- ONBOARDING FUNCTIONS
-- ==========================================================

-- Create school with owner in one transaction
CREATE OR REPLACE FUNCTION create_school_with_owner(
    p_school_name TEXT,
    p_proprietor_name TEXT,
    p_email TEXT,
    p_phone TEXT,
    p_address TEXT,
    p_school_type TEXT DEFAULT 'MIXED',
    p_academic_session TEXT DEFAULT '2024/2025',
    p_current_term TEXT DEFAULT 'FIRST'
) RETURNS UUID AS $$
DECLARE
    v_school_id UUID;
    v_owner_id UUID;
BEGIN
    -- Create the school
    INSERT INTO schools (
        id, name, type, academic_session, current_term, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), p_school_name, p_school_type, 
        p_academic_session, p_current_term, now(), now()
    ) RETURNING id INTO v_school_id;

    -- Create owner profile
    INSERT INTO profiles (
        id, school_id, email, full_name, phone, role, admin_status, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), v_school_id, p_email, p_proprietor_name, p_phone,
        'OWNER', 'ACTIVE', now(), now()
    ) RETURNING id INTO v_owner_id;

    -- Update school with owner reference
    UPDATE schools SET owner_id = v_owner_id WHERE id = v_school_id;

    -- Create onboarding progress
    INSERT INTO onboarding_progress (school_id, stage) VALUES (v_school_id, 1);

    RETURN v_school_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update onboarding stage
CREATE OR REPLACE FUNCTION update_onboarding_stage(
    p_school_id UUID,
    p_stage INTEGER,
    p_completed_steps JSONB
) RETURNS VOID AS $$
BEGIN
    INSERT INTO onboarding_progress (school_id, stage, completed_steps)
    VALUES (p_school_id, p_stage, p_completed_steps)
    ON CONFLICT (school_id) DO UPDATE SET
        stage = p_stage,
        completed_steps = p_completed_steps;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Complete business verification
CREATE OR REPLACE FUNCTION complete_business_verification(
    p_school_id UUID,
    p_bvn TEXT,
    p_nin TEXT,
    p_business_type TEXT,
    p_cac_number TEXT,
    p_tin TEXT
) RETURNS VOID AS $$
BEGIN
    UPDATE schools SET
        proprietor_bvn = p_bvn,
        proprietor_nin = p_nin,
        business_type = p_business_type,
        cac_number = p_cac_number,
        tax_identification_number = p_tin
    WHERE id = p_school_id;

    UPDATE onboarding_progress SET
        business_verified = true
    WHERE school_id = p_school_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify settlement account
CREATE OR REPLACE FUNCTION verify_settlement_account(
    p_school_id UUID,
    p_bank TEXT,
    p_account_number TEXT,
    p_account_name TEXT
) RETURNS VOID AS $$
BEGIN
    UPDATE schools SET
        settlement_bank = p_bank,
        settlement_account_number = p_account_number,
        settlement_account_name = p_account_name,
        settlement_verified = true
    WHERE id = p_school_id;

    UPDATE onboarding_progress SET
        settlement_verified = true
    WHERE school_id = p_school_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Activate collections
CREATE OR REPLACE FUNCTION activate_collections(p_school_id UUID) RETURNS VOID AS $$
BEGIN
    -- Mark payment service as ready and activated
    UPDATE onboarding_progress SET
        payment_service_ready = true,
        activated = true,
        stage = 4
    WHERE school_id = p_school_id;

    -- Log activation
    INSERT INTO audit_logs (
        school_id, actor_id, action, entity, entity_id, metadata
    ) VALUES (
        p_school_id, NULL, 'ONBOARDING_COMPLETED', 'school', p_school_id,
        jsonb_build_object('activated_at', now())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;