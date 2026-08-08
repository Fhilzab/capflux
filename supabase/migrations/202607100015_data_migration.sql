-- ==========================================================
-- CAPFLUX — FHILZAB NIG LTD
-- Migration: 202607100015_data_migration.sql
-- Purpose: Idempotent data migration for legacy students into the canonical
--          payment_accounts schema, plus default tuition/fee rules.
-- ==========================================================

BEGIN;

-- ==========================================================
-- Migrate legacy students into payment_accounts (canonical schema)
-- Legacy dva fields were removed in 016; this migration runs BEFORE that
-- removal, so `dva_account_number`/`dva_bank_name` may still exist on
-- students. All inserts are idempotent (ON CONFLICT DO NOTHING).
-- ==========================================================

INSERT INTO payment_accounts (
    id, school_id, student_id, provider_name,
    account_number, bank_name, account_reference,
    provider_student_reference, status,
    provider, provider_account_id, provider_reference,
    virtual_account_number, account_name, account_status, is_primary,
    created_at, updated_at
)
SELECT
    gen_random_uuid(),
    s.school_id,
    s.id AS student_id,
    'monnify'::TEXT, -- Default legacy migration provider
    COALESCE(s.dva_account_number, ''),
    COALESCE(s.dva_bank_name, ''),
    COALESCE(s.dva_account_number, ''),
    s.id::TEXT, -- student_id as provider reference
    'ACTIVE'::TEXT,
    'monnify'::TEXT,
    s.dva_account_number, -- provider_account_id
    s.dva_account_number, -- provider_reference
    s.dva_account_number, -- virtual_account_number
    'ACTIVE'::TEXT,        -- account_name (unknown for legacy rows)
    'ACTIVE'::TEXT,        -- account_status
    true,                  -- is_primary
    s.created_at,
    s.updated_at
FROM students s
WHERE s.dva_account_number IS NOT NULL
  AND s.dva_account_number != ''
ON CONFLICT DO NOTHING;

-- ==========================================================
-- Create default tuition configuration for existing schools
-- Infer category from class_name, use default session and term
-- ==========================================================

INSERT INTO tuition_configuration (
    id, school_id, academic_session, academic_term, category, tuition_amount,
    created_at, updated_at
)
SELECT
    gen_random_uuid(),
    s.school_id,
    '2025/2026'::TEXT,
    'FIRST'::academic_term,
    CASE
        WHEN s.class_name ILIKE '%nursery%' OR s.class_name ILIKE '%playgroup%' THEN 'NURSERY'::student_category
        WHEN s.class_name ILIKE '%primary%' OR s.class_name ILIKE '%basic%' THEN 'PRIMARY'::student_category
        WHEN s.class_name ILIKE '%secondary%' OR s.class_name ILIKE '%high school%' THEN 'SECONDARY'::student_category
        ELSE 'PRIMARY'::student_category
    END,
    25000.00::NUMERIC(12,2), -- Default NGN 25,000 tuition
    now(),
    now()
FROM students s
GROUP BY s.school_id,
    CASE
        WHEN s.class_name ILIKE '%nursery%' OR s.class_name ILIKE '%playgroup%' THEN 'NURSERY'::student_category
        WHEN s.class_name ILIKE '%primary%' OR s.class_name ILIKE '%basic%' THEN 'PRIMARY'::student_category
        WHEN s.class_name ILIKE '%secondary%' OR s.class_name ILIKE '%high school%' THEN 'SECONDARY'::student_category
        ELSE 'PRIMARY'::student_category
    END
ON CONFLICT (school_id, academic_session, academic_term, category) DO NOTHING;

-- ==========================================================
-- Create default fee rules for existing schools
-- ==========================================================

INSERT INTO fee_rules (
    id, school_id, minimum_fee, percentage, maximum_fee,
    effective_date, is_active, created_at, updated_at
)
SELECT
    gen_random_uuid(),
    s.school_id,
    200.00::NUMERIC(12,2),
    1.50::NUMERIC(5,2),
    2000.00::NUMERIC(12,2),
    CURRENT_DATE,
    true,
    now(),
    now()
FROM students s
GROUP BY s.school_id
ON CONFLICT DO NOTHING;

-- ==========================================================
-- Update student categories based on existing class_name data
-- ==========================================================

UPDATE students s
SET category = CASE
    WHEN class_name ILIKE '%nursery%' OR class_name ILIKE '%playgroup%' THEN 'NURSERY'::student_category
    WHEN class_name ILIKE '%primary%' OR class_name ILIKE '%basic%' THEN 'PRIMARY'::student_category
    WHEN class_name ILIKE '%secondary%' OR class_name ILIKE '%high school%' THEN 'SECONDARY'::student_category
    ELSE category
END;

COMMIT;