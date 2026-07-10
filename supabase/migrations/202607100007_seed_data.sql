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

COMMIT;
