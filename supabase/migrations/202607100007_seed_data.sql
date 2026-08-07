-- ==========================================================
-- CAPFLUX — FHILZAB NIG LTD
-- Migration: 202607100007_seed_data.sql
-- Purpose: Idempotent demo tenant seed. Safe to re-run on repeated resets.
--
-- The demo school uses a FIXED id so re-running never duplicates it.
-- All inserts are ON CONFLICT DO NOTHING.
-- ==========================================================

BEGIN;

-- Fixed demo school id (deterministic across resets)
DO $$
DECLARE
    v_school_id UUID := '00000000-0000-0000-0000-000000000001';
    v_owner_profile_id UUID := '00000000-0000-0000-0000-000000000002';
    v_bursar_profile_id UUID := '00000000-0000-0000-0000-000000000003';
BEGIN
    INSERT INTO schools (id, name, status, payment_status, country, created_at, updated_at)
    VALUES (v_school_id, 'CAPFLUX Demo School', 'ACTIVE', 'READY', 'Nigeria', now(), now())
    ON CONFLICT (id) DO NOTHING;

    -- Demo profiles (legacy profiles table; role enum is OWNER/ADMIN post-018)
    INSERT INTO profiles (id, school_id, full_name, role, admin_status, created_at, updated_at)
    VALUES
        (v_owner_profile_id, v_school_id, 'Demo Owner', 'OWNER', 'ACTIVE', now(), now()),
        (v_bursar_profile_id, v_school_id, 'Head Bursar', 'ADMIN', 'ACTIVE', now(), now())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO app_settings (school_id, currency, timezone, settings)
    VALUES (
        v_school_id,
        'NGN',
        'Africa/Lagos',
        jsonb_build_object(
            'invoice_prefix', 'CAP',
            'term_technology_levy', 1000
        )
    )
    ON CONFLICT (school_id) DO NOTHING;

    -- Demo students (idempotent via fixed ids)
    INSERT INTO students (id, school_id, first_name, last_name, class_name, guardian_phone, status, client_sequence, device_id, created_at, updated_at)
    VALUES
        ('00000000-0000-0000-0000-000000000101', v_school_id, 'Amina',   'Okafor',    'JSS 1', '+2348120000001', 'ACTIVE', 1, 'demo-device-1', now(), now()),
        ('00000000-0000-0000-0000-000000000102', v_school_id, 'Chinedu',  'Ibe',       'JSS 2', '+2348120000002', 'ACTIVE', 2, 'demo-device-2', now(), now()),
        ('00000000-0000-0000-0000-000000000103', v_school_id, 'Halima',   'Abdullahi', 'SSS 1', '+2348120000003', 'ACTIVE', 3, 'demo-device-3', now(), now()),
        ('00000000-0000-0000-0000-000000000104', v_school_id, 'Tunde',    'Adejumo',   'SSS 2', '+2348120000004', 'ACTIVE', 4, 'demo-device-4', now(), now()),
        ('00000000-0000-0000-0000-000000000105', v_school_id, 'Ngozi',    'Nwosu',     'JSS 3', '+2348120000005', 'ACTIVE', 5, 'demo-device-5', now(), now()),
        ('00000000-0000-0000-0000-000000000106', v_school_id, 'Fatima',   'Suleiman',  'SSS 3', '+2348120000006', 'ACTIVE', 6, 'demo-device-6', now(), now())
    ON CONFLICT (id) DO NOTHING;

    -- Demo ledger entries (idempotent via fixed ids)
    INSERT INTO ledger_entries (id, school_id, student_id, amount, entry_type, entry_category, reference_id, metadata, client_sequence, device_id, created_at)
    VALUES
        ('00000000-0000-0000-0000-000000000201', v_school_id, '00000000-0000-0000-0000-000000000101', 25000.00, 'DEBIT',  'TUITION',    NULL, '{"term":"2026_1"}', 1, 'fee-demo-1', now()),
        ('00000000-0000-0000-0000-000000000202', v_school_id, '00000000-0000-0000-0000-000000000101', 1000.00,  'DEBIT',  'TECH_LEVY',  NULL, '{"term":"2026_1"}', 2, 'fee-demo-1', now()),
        ('00000000-0000-0000-0000-000000000203', v_school_id, '00000000-0000-0000-0000-000000000101', 13000.00, 'CREDIT', 'TUITION',    NULL, '{"term":"2026_1"}', 3, 'fee-demo-1', now()),
        ('00000000-0000-0000-0000-000000000204', v_school_id, '00000000-0000-0000-0000-000000000102', 28000.00, 'DEBIT',  'TUITION',    NULL, '{"term":"2026_1"}', 1, 'fee-demo-2', now()),
        ('00000000-0000-0000-0000-000000000205', v_school_id, '00000000-0000-0000-0000-000000000102', 1000.00,  'DEBIT',  'TECH_LEVY',  NULL, '{"term":"2026_1"}', 2, 'fee-demo-2', now()),
        ('00000000-0000-0000-0000-000000000206', v_school_id, '00000000-0000-0000-0000-000000000103', 30000.00, 'DEBIT',  'TUITION',    NULL, '{"term":"2026_1"}', 1, 'fee-demo-3', now()),
        ('00000000-0000-0000-0000-000000000207', v_school_id, '00000000-0000-0000-0000-000000000104', 29000.00, 'DEBIT',  'TUITION',    NULL, '{"term":"2026_1"}', 1, 'fee-demo-4', now()),
        ('00000000-0000-0000-0000-000000000208', v_school_id, '00000000-0000-0000-0000-000000000104', 1000.00,  'DEBIT',  'TECH_LEVY',  NULL, '{"term":"2026_1"}', 2, 'fee-demo-4', now()),
        ('00000000-0000-0000-0000-000000000209', v_school_id, '00000000-0000-0000-0000-000000000105', 26000.00, 'DEBIT',  'TUITION',    NULL, '{"term":"2026_1"}', 1, 'fee-demo-5', now()),
        ('00000000-0000-0000-0000-000000000210', v_school_id, '00000000-0000-0000-0000-000000000105', 1000.00,  'DEBIT',  'TECH_LEVY',  NULL, '{"term":"2026_1"}', 2, 'fee-demo-5', now()),
        ('00000000-0000-0000-0000-000000000211', v_school_id, '00000000-0000-0000-0000-000000000105', 5000.00,  'CREDIT', 'TUITION',    NULL, '{"term":"2026_1"}', 3, 'fee-demo-5', now()),
        ('00000000-0000-0000-0000-000000000212', v_school_id, '00000000-0000-0000-0000-000000000106', 31000.00, 'DEBIT',  'TUITION',    NULL, '{"term":"2026_1"}', 1, 'fee-demo-6', now()),
        ('00000000-0000-0000-0000-000000000213', v_school_id, '00000000-0000-0000-0000-000000000106', 1000.00,  'DEBIT',  'TECH_LEVY',  NULL, '{"term":"2026_1"}', 2, 'fee-demo-6', now())
    ON CONFLICT (id) DO NOTHING;
END $$;

COMMIT;
