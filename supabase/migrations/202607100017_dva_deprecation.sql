-- ==========================================================
-- CAPFLUX — FHILZAB NIG LTD
-- Migration: 202607100017_dva_deprecation.sql
-- Purpose: Remove the legacy `dva_assignments` table.
--
-- A table cannot be replaced by a view. The prior migration attempted
-- `CREATE OR REPLACE VIEW dva_assignments`, which fails. The canonical
-- representation is `payment_accounts` (see migrations 012 and 016).
-- This migration:
--   1. Backfills any legacy dva_assignments rows into payment_accounts.
--   2. Drops the legacy `dva_assignments` table.
--   3. Repoints the deprecated `provision_dva_for_student` helper at
--      payment_accounts so any remaining legacy callers still function.
-- ==========================================================

BEGIN;

-- ==========================================================
-- 1. Backfill legacy rows into payment_accounts (idempotent)
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
-- 2. Drop the legacy table
-- ==========================================================

DROP TABLE IF EXISTS dva_assignments;

-- ==========================================================
-- 3. Repoint the deprecated DVA helper at payment_accounts
-- ==========================================================

CREATE OR REPLACE FUNCTION provision_dva_for_student(
    p_school_id UUID,
    p_student_id UUID,
    p_provider TEXT,
    p_dva_number TEXT,
    p_dva_bank TEXT,
    p_dva_name TEXT,
    p_config_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    v_account_id UUID;
BEGIN
    INSERT INTO payment_accounts (
        school_id, student_id, provider,
        provider_account_id, provider_reference,
        virtual_account_number, account_name, bank_name,
        account_status, is_primary, created_at, updated_at
    ) VALUES (
        p_school_id, p_student_id, p_provider,
        p_dva_number, p_dva_number,
        p_dva_number, p_dva_name, p_dva_bank,
        'ACTIVE', true, now(), now()
    )
    ON CONFLICT (school_id, student_id, is_primary) DO UPDATE SET
        provider = p_provider,
        provider_account_id = p_dva_number,
        provider_reference = p_dva_number,
        virtual_account_number = p_dva_number,
        account_name = p_dva_name,
        bank_name = p_dva_bank,
        account_status = 'ACTIVE',
        updated_at = now()
    RETURNING id INTO v_account_id;

    RETURN jsonb_build_object(
        'success', true,
        'dva_id', v_account_id,
        'dva_account_number', p_dva_number,
        'provider', p_provider
    );
END;
$$;

COMMIT;
