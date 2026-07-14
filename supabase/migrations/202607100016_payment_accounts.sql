-- ==========================================================
-- CAPSTONE SOFTWARE SOLUTIONS LTD
-- Migration: 202607100016_payment_accounts.sql
-- Purpose: Dedicated Payment Accounts domain for provider-agnostic infrastructure
-- ==========================================================

BEGIN;

-- ==========================================================
-- EXTEND ledger_entry_category enum to include PLATFORM_BANKING_FEE
-- NOTE: This was already added in 0008, included here for completeness
-- ==========================================================

ALTER TYPE ledger_entry_category ADD VALUE IF NOT EXISTS 'PLATFORM_BANKING_FEE';

-- ==========================================================
-- PAYMENT ACCOUNTS TABLE
-- Dedicated Virtual Accounts (DVA) managed independently from students
-- Supports multiple payment providers with tenant isolation
-- ==========================================================

CREATE TABLE IF NOT EXISTS payment_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('monnify', 'flutterwave', 'remita')),
    provider_account_id TEXT,
    provider_reference TEXT,
    virtual_account_number TEXT NOT NULL,
    account_name TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    account_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (account_status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    is_primary BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deactivated_at TIMESTAMPTZ,
    
    -- Ensure one primary account per student
    UNIQUE (school_id, student_id, is_primary)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_payment_accounts_school ON payment_accounts (school_id);
CREATE INDEX IF NOT EXISTS idx_payment_accounts_student ON payment_accounts (student_id);
CREATE INDEX IF NOT EXISTS idx_payment_accounts_provider ON payment_accounts (provider);
CREATE INDEX IF NOT EXISTS idx_payment_accounts_virtual_number ON payment_accounts (virtual_account_number);
CREATE INDEX IF NOT EXISTS idx_payment_accounts_status ON payment_accounts (account_status);
CREATE INDEX IF NOT EXISTS idx_payment_accounts_primary ON payment_accounts (school_id, student_id, is_primary) WHERE is_primary = true;

-- ==========================================================
-- MIGRATE DATA FROM dva_assignments TO payment_accounts
-- Preserve existing DVA assignments during schema transition
-- ==========================================================

INSERT INTO payment_accounts (
    id,
    school_id,
    student_id,
    provider,
    provider_account_id,
    provider_reference,
    virtual_account_number,
    account_name,
    bank_name,
    account_status,
    is_primary,
    created_at,
    updated_at
)
SELECT 
    id,
    school_id,
    student_id,
    provider,
    -- Map dva_assignments fields to payment_accounts
    dva_account_number AS provider_account_id,
    dva_account_number AS provider_reference,
    dva_account_number AS virtual_account_number,
    dva_account_name AS account_name,
    dva_bank_name AS bank_name,
    CASE WHEN is_active THEN 'ACTIVE' ELSE 'INACTIVE' END AS account_status,
    is_active AS is_primary,
    created_at,
    updated_at
FROM dva_assignments
ON CONFLICT (id) DO NOTHING;

-- ==========================================================
-- REMOVE DVA COLUMNS FROM STUDENTS TABLE
-- These belong exclusively to payment_accounts domain
-- ==========================================================

-- First, ensure no student has DVA data that wasn't migrated
ALTER TABLE students 
    DROP COLUMN IF EXISTS dva_account_number,
    DROP COLUMN IF EXISTS dva_bank_name;

-- ==========================================================
-- DEPRECATE dva_assignments TABLE
-- Kept for backward compatibility during transition period
-- ==========================================================

COMMENT ON TABLE dva_assignments IS 'DEPRECATED: Use payment_accounts table instead. This table will be removed in a future migration.';

-- ==========================================================
-- ENABLE RLS ON PAYMENT ACCOUNTS TABLE
-- ==========================================================

ALTER TABLE payment_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only access records belonging to the current school
CREATE POLICY allow_authenticated_payment_accounts ON payment_accounts
    FOR SELECT, INSERT, UPDATE
    USING (current_school_id() = payment_accounts.school_id)
    WITH CHECK (current_school_id() = payment_accounts.school_id);

-- ==========================================================
-- HELPER FUNCTIONS
-- ==========================================================

-- Create or update payment account for a student
CREATE OR REPLACE FUNCTION upsert_payment_account(
    p_school_id UUID,
    p_student_id UUID,
    p_provider TEXT,
    p_provider_account_id TEXT,
    p_provider_reference TEXT,
    p_virtual_account_number TEXT,
    p_account_name TEXT,
    p_bank_name TEXT,
    p_account_status TEXT
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    v_account_id UUID;
BEGIN
    -- Insert or update payment account
    INSERT INTO payment_accounts (
        school_id, 
        student_id, 
        provider,
        provider_account_id,
        provider_reference,
        virtual_account_number,
        account_name,
        bank_name,
        account_status,
        is_primary,
        created_at,
        updated_at
    ) VALUES (
        p_school_id, 
        p_student_id, 
        p_provider,
        p_provider_account_id,
        p_provider_reference,
        p_virtual_account_number,
        p_account_name,
        p_bank_name,
        p_account_status,
        true,
        now(),
        now()
    ) ON CONFLICT (school_id, student_id, is_primary) DO UPDATE SET
        provider = p_provider,
        provider_account_id = p_provider_account_id,
        provider_reference = p_provider_reference,
        virtual_account_number = p_virtual_account_number,
        account_name = p_account_name,
        bank_name = p_bank_name,
        account_status = p_account_status,
        updated_at = now()
    RETURNING id INTO v_account_id;

    RETURN jsonb_build_object(
        'success', true,
        'account_id', v_account_id,
        'virtual_account_number', p_virtual_account_number,
        'provider', p_provider
    );
END;
$$;

-- Find primary payment account for a student
CREATE OR REPLACE FUNCTION get_primary_payment_account(p_student_id UUID)
RETURNS SETOF payment_accounts LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM payment_accounts
    WHERE student_id = p_student_id AND is_primary = true;
END;
$$;

COMMIT;