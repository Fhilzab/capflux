-- ==========================================================
-- CAPFLUX — FHILZAB NIG LTD
-- Migration: 202607100016_payment_accounts.sql
-- Purpose: Canonical provider-agnostic payment accounts domain.
--
-- The canonical payment_accounts schema is DEFINED in migration 012.
-- This migration ensures the canonical columns exist (idempotent), migrates
-- any legacy dva_assignments rows, drops legacy students.dva_* columns,
-- enables RLS, and defines helper functions.
-- ==========================================================

BEGIN;

-- ==========================================================
-- EXTEND ledger_entry_category enum to include PLATFORM_BANKING_FEE
-- NOTE: This was already added in 0008, included here for completeness
-- ==========================================================

ALTER TYPE ledger_entry_category ADD VALUE IF NOT EXISTS 'PLATFORM_BANKING_FEE';

-- ==========================================================
-- PAYMENT ACCOUNTS TABLE — CANONICAL (idempotent)
-- The full canonical definition lives in migration 012.
-- Ensure all canonical columns exist here in case 012 is ever refactored.
-- ==========================================================

ALTER TABLE payment_accounts
    ADD COLUMN IF NOT EXISTS provider TEXT,
    ADD COLUMN IF NOT EXISTS provider_account_id TEXT,
    ADD COLUMN IF NOT EXISTS provider_reference TEXT,
    ADD COLUMN IF NOT EXISTS virtual_account_number TEXT,
    ADD COLUMN IF NOT EXISTS account_name TEXT,
    ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (account_status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

-- Ensure one primary account per student (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_accounts_primary
    ON payment_accounts (school_id, student_id, is_primary) WHERE is_primary = true;

-- Indexes for efficient querying (idempotent)
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

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'dva_assignments'
    ) THEN
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
    END IF;
END $$;

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

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dva_assignments') THEN
        COMMENT ON TABLE dva_assignments IS 'DEPRECATED: Use payment_accounts table instead. This table will be removed in a future migration.';
    END IF;
END $$;

-- ==========================================================
-- ENABLE RLS ON PAYMENT ACCOUNTS TABLE
-- ==========================================================

ALTER TABLE payment_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only access records belonging to the current school.
-- (Migration 013 already creates allow_authenticated_payment_accounts;
-- drop it first so a fresh reset does not fail on a duplicate policy name.)
DROP POLICY IF EXISTS allow_authenticated_payment_accounts ON payment_accounts;
CREATE POLICY allow_authenticated_payment_accounts ON payment_accounts
    FOR ALL
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