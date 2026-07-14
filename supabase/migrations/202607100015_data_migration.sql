-- ==========================================================
-- CAPSTONE SOFTWARE SOLUTIONS LTD
-- Migration: 202607100015_data_migration.sql
-- Purpose: Migrate existing DVA data from students table to payment_accounts table
-- ==========================================================

BEGIN;

-- ==========================================================
-- Migrate existing DVA assignments to payment_accounts
-- Students with dva_account_number and dva_bank_name get migrated
-- ==========================================================

INSERT INTO payment_accounts (
    id, school_id, student_id, provider_name,
    account_number, bank_name, account_reference,
    provider_student_reference, status, created_at, updated_at
)
SELECT 
    gen_random_uuid(),
    s.school_id,
    s.id AS student_id,
    'monnify'::TEXT, -- Default migration to monnify
    s.dva_account_number,
    s.dva_bank_name,
    s.dva_account_number, -- Use account number as reference
    s.id::TEXT, -- student_id as provider reference
    'ACTIVE'::TEXT,
    s.created_at,
    s.updated_at
FROM students s
WHERE s.dva_account_number IS NOT NULL 
  AND s.dva_account_number != '';

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
        WHEN s.class_name ILIKE '%nursery%' OR s.class_name ILIKE '%playgroup%' THEN 'NURSERY'
        WHEN s.class_name ILIKE '%primary%' OR s.class_name ILIKE '%basic%' THEN 'PRIMARY'
        WHEN s.class_name ILIKE '%secondary%' OR s.class_name ILIKE '%high school%' THEN 'SECONDARY'
        ELSE 'PRIMARY'
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