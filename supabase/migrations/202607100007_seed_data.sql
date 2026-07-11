-- ==========================================================
-- CAPSTONE SOFTWARE SOLUTIONS LTD
-- Migration: 202607100007_seed_data.sql
-- Purpose: Seed data for initial tenant and admin setup
-- ==========================================================

BEGIN;

INSERT INTO schools (id, name, subscription_status, created_at)
VALUES (
    gen_random_uuid(),
    'Capstone Demo School',
    'ACTIVE',
    now()
)
ON CONFLICT (id) DO NOTHING;

WITH school AS (
    SELECT id AS school_id
    FROM schools
    WHERE name = 'Capstone Demo School'
    LIMIT 1
)
INSERT INTO profiles (id, school_id, full_name, role, created_at)
VALUES (
    gen_random_uuid(),
    (SELECT school_id FROM school),
    'Super Admin',
    'ADMIN',
    now()
),
(
    gen_random_uuid(),
    (SELECT school_id FROM school),
    'Head Bursar',
    'BURSAR',
    now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO app_settings (school_id, currency, timezone, settings)
SELECT
    school_id,
    'NGN',
    'Africa/Lagos',
    jsonb_build_object(
        'invoice_prefix', 'CAP',
        'term_technology_levy', 1000
    )
FROM school
ON CONFLICT (school_id) DO NOTHING;

WITH inserted_students AS (
    INSERT INTO students (
        school_id,
        first_name,
        last_name,
        class_name,
        guardian_phone,
        dva_account_number,
        dva_bank_name,
        status,
        client_sequence,
        device_id,
        created_at,
        updated_at
    )
    VALUES
        ((SELECT school_id FROM school), 'Amina', 'Okafor', 'JSS 1', '+2348120000001', '1234567890', 'First Bank', 'ACTIVE', 1, 'demo-device-1', now(), now()),
        ((SELECT school_id FROM school), 'Chinedu', 'Ibe', 'JSS 2', '+2348120000002', '2345678901', 'GTBank', 'ACTIVE', 2, 'demo-device-2', now(), now()),
        ((SELECT school_id FROM school), 'Halima', 'Abdullahi', 'SSS 1', '+2348120000003', '3456789012', 'Zenith Bank', 'ACTIVE', 3, 'demo-device-3', now(), now()),
        ((SELECT school_id FROM school), 'Tunde', 'Adejumo', 'SSS 2', '+2348120000004', '4567890123', 'UBA', 'ACTIVE', 4, 'demo-device-4', now(), now()),
        ((SELECT school_id FROM school), 'Ngozi', 'Nwosu', 'JSS 3', '+2348120000005', '5678901234', 'EcoBank', 'ACTIVE', 5, 'demo-device-5', now(), now()),
        ((SELECT school_id FROM school), 'Fatima', 'Suleiman', 'SSS 3', '+2348120000006', '6789012345', 'Access Bank', 'ACTIVE', 6, 'demo-device-6', now(), now())
    ON CONFLICT (school_id, device_id, client_sequence) DO NOTHING
    RETURNING id, first_name
), all_students AS (
    SELECT id, first_name
    FROM inserted_students
    UNION ALL
    SELECT id, first_name
    FROM students
    WHERE school_id = (SELECT school_id FROM school)
      AND device_id IN ('demo-device-1', 'demo-device-2', 'demo-device-3', 'demo-device-4', 'demo-device-5', 'demo-device-6')
)
INSERT INTO ledger_entries (
    school_id,
    student_id,
    amount,
    entry_type,
    entry_category,
    reference_id,
    metadata,
    client_sequence,
    device_id,
    created_at
)
VALUES
    ((SELECT school_id FROM school), (SELECT id FROM all_students WHERE first_name = 'Amina'), 25000.00, 'DEBIT', 'TUITION', NULL, '{"term":"2026_1"}', 1, 'fee-demo-1', now()),
    ((SELECT school_id FROM school), (SELECT id FROM all_students WHERE first_name = 'Amina'), 1000.00, 'DEBIT', 'TECH_LEVY', NULL, '{"term":"2026_1"}', 2, 'fee-demo-1', now()),
    ((SELECT school_id FROM school), (SELECT id FROM all_students WHERE first_name = 'Amina'), 13000.00, 'CREDIT', 'TUITION', NULL, '{"term":"2026_1"}', 3, 'fee-demo-1', now()),
    ((SELECT school_id FROM school), (SELECT id FROM all_students WHERE first_name = 'Chinedu'), 28000.00, 'DEBIT', 'TUITION', NULL, '{"term":"2026_1"}', 1, 'fee-demo-2', now()),
    ((SELECT school_id FROM school), (SELECT id FROM all_students WHERE first_name = 'Chinedu'), 1000.00, 'DEBIT', 'TECH_LEVY', NULL, '{"term":"2026_1"}', 2, 'fee-demo-2', now()),
    ((SELECT school_id FROM school), (SELECT id FROM all_students WHERE first_name = 'Halima'), 30000.00, 'DEBIT', 'TUITION', NULL, '{"term":"2026_1"}', 1, 'fee-demo-3', now()),
    ((SELECT school_id FROM school), (SELECT id FROM all_students WHERE first_name = 'Tunde'), 29000.00, 'DEBIT', 'TUITION', NULL, '{"term":"2026_1"}', 1, 'fee-demo-4', now()),
    ((SELECT school_id FROM school), (SELECT id FROM all_students WHERE first_name = 'Tunde'), 1000.00, 'DEBIT', 'TECH_LEVY', NULL, '{"term":"2026_1"}', 2, 'fee-demo-4', now()),
    ((SELECT school_id FROM school), (SELECT id FROM all_students WHERE first_name = 'Ngozi'), 26000.00, 'DEBIT', 'TUITION', NULL, '{"term":"2026_1"}', 1, 'fee-demo-5', now()),
    ((SELECT school_id FROM school), (SELECT id FROM all_students WHERE first_name = 'Ngozi'), 1000.00, 'DEBIT', 'TECH_LEVY', NULL, '{"term":"2026_1"}', 2, 'fee-demo-5', now()),
    ((SELECT school_id FROM school), (SELECT id FROM all_students WHERE first_name = 'Ngozi'), 5000.00, 'CREDIT', 'TUITION', NULL, '{"term":"2026_1"}', 3, 'fee-demo-5', now()),
    ((SELECT school_id FROM school), (SELECT id FROM all_students WHERE first_name = 'Fatima'), 31000.00, 'DEBIT', 'TUITION', NULL, '{"term":"2026_1"}', 1, 'fee-demo-6', now()),
    ((SELECT school_id FROM school), (SELECT id FROM all_students WHERE first_name = 'Fatima'), 1000.00, 'DEBIT', 'TECH_LEVY', NULL, '{"term":"2026_1"}', 2, 'fee-demo-6', now())
ON CONFLICT (school_id, device_id, client_sequence) DO NOTHING;

COMMIT;
