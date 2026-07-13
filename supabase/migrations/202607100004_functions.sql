-- ==========================================================
-- CAPSTONE SOFTWARE SOLUTIONS LTD
-- Migration: 202607100004_functions.sql
-- Purpose: Helper functions for multi-tenant access, audit logging, and ledger calculations
-- ==========================================================

BEGIN;

-- ==========================================================
-- TENANT CONTEXT HELPERS
-- ==========================================================

CREATE OR REPLACE FUNCTION current_school_id()
RETURNS UUID LANGUAGE SQL STABLE AS $$
    SELECT current_setting('jwt.claims.school_id', true)::uuid;
$$;

CREATE OR REPLACE FUNCTION current_profile_id()
RETURNS UUID LANGUAGE SQL STABLE AS $$
    SELECT current_setting('jwt.claims.profile_id', true)::uuid;
$$;

CREATE OR REPLACE FUNCTION current_profile_role()
RETURNS profile_role LANGUAGE SQL STABLE AS $$
    SELECT current_setting('jwt.claims.role', true)::profile_role;
$$;

CREATE OR REPLACE FUNCTION tenant_matches_school(target_school_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
    SELECT current_school_id() = target_school_id;
$$;

-- ==========================================================
-- ENTITY LOOKUP HELPERS
-- ==========================================================

CREATE OR REPLACE FUNCTION school_id_for_profile(profile_uuid UUID)
RETURNS UUID LANGUAGE SQL STABLE AS $$
    SELECT school_id
    FROM profiles
    WHERE id = profile_uuid;
$$;

CREATE OR REPLACE FUNCTION school_id_for_student(student_uuid UUID)
RETURNS UUID LANGUAGE SQL STABLE AS $$
    SELECT school_id
    FROM students
    WHERE id = student_uuid;
$$;

-- ==========================================================
-- BUSINESS LOGIC HELPERS
-- ==========================================================

CREATE OR REPLACE FUNCTION student_balance(target_student_id UUID)
RETURNS NUMERIC(16,2) LANGUAGE SQL STABLE AS $$
    SELECT COALESCE(
        SUM(
            CASE
                WHEN entry_type = 'DEBIT' THEN amount
                ELSE -amount
            END
        ), 0
    )
    FROM ledger_entries
    WHERE student_id = target_student_id;
$$;

CREATE OR REPLACE FUNCTION school_balance(target_school_id UUID)
RETURNS NUMERIC(16,2) LANGUAGE SQL STABLE AS $$
    SELECT COALESCE(
        SUM(
            CASE
                WHEN entry_type = 'DEBIT' THEN amount
                ELSE -amount
            END
        ), 0
    )
    FROM ledger_entries
    WHERE school_id = target_school_id;
$$;

-- ==========================================================
-- AUDIT AND SYNC HELPERS
-- ==========================================================

CREATE OR REPLACE FUNCTION log_audit_action(
    actor_uuid UUID,
    action_text TEXT,
    entity_name TEXT,
    entity_uuid UUID,
    metadata_json JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID LANGUAGE SQL VOLATILE AS $$
    INSERT INTO audit_logs (
        id,
        school_id,
        actor_id,
        action,
        entity,
        entity_id,
        metadata,
        created_at
    ) VALUES (
        gen_random_uuid(),
        school_id_for_profile(actor_uuid),
        actor_uuid,
        action_text,
        entity_name,
        entity_uuid,
        metadata_json,
        now()
    );
$$;

CREATE OR REPLACE FUNCTION enqueue_sync_payload(
    entity_type_text TEXT,
    entity_uuid UUID,
    operation_text TEXT,
    payload_json JSONB
)
RETURNS UUID LANGUAGE SQL VOLATILE AS $$
    INSERT INTO sync_queue (
        id,
        school_id,
        entity_type,
        entity_id,
        operation,
        payload,
        retry_count,
        status,
        created_at
    ) VALUES (
        gen_random_uuid(),
        current_school_id(),
        entity_type_text,
        entity_uuid,
        operation_text,
        payload_json,
        0,
        'PENDING',
        now()
    ) RETURNING id;
$$;

-- ============================================================
-- AUTOMATIC BILLING: Apply student base fees
-- Creates DEBIT ledger entries for all ACTIVE students when called
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_apply_student_base_fees(
    tuition_amount NUMERIC(12,2) DEFAULT 25000.00,
    tech_levy_amount NUMERIC(12,2) DEFAULT 1000.00
)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    tuition_id UUID,
    tech_levy_id UUID
) LANGUAGE plpgsql AS $$
DECLARE
    v_school_id UUID := current_school_id();
    v_student RECORD;
    v_tuition_id UUID;
    v_tech_levy_id UUID;
    v_device_id TEXT := 'system-billing';
    v_client_seq INTEGER;
BEGIN
    -- Get next client sequence for this device
    SELECT COALESCE(MAX(client_sequence), 0) + 1 INTO v_client_seq
    FROM ledger_entries
    WHERE school_id = v_school_id AND device_id = v_device_id;

    -- Process all active students
    FOR v_student IN
        SELECT id, first_name, last_name FROM students
        WHERE school_id = v_school_id AND status = 'ACTIVE'
    LOOP
        -- Insert tuition fee
        INSERT INTO ledger_entries (
            id, school_id, student_id, amount, entry_type,
            entry_category, metadata, client_sequence, device_id, created_at
        ) VALUES (
            gen_random_uuid(), v_school_id, v_student.id, tuition_amount, 'DEBIT',
            'TUITION', jsonb_build_object('term', '2026_1'), v_client_seq, v_device_id, now()
        ) RETURNING id INTO v_tuition_id;
        v_client_seq := v_client_seq + 1;

        -- Insert tech levy
        INSERT INTO ledger_entries (
            id, school_id, student_id, amount, entry_type,
            entry_category, metadata, client_sequence, device_id, created_at
        ) VALUES (
            gen_random_uuid(), v_school_id, v_student.id, tech_levy_amount, 'DEBIT',
            'TECH_LEVY', jsonb_build_object('term', '2026_1'), v_client_seq, v_device_id, now()
        ) RETURNING id INTO v_tech_levy_id;
        v_client_seq := v_client_seq + 1;

        RETURN QUERY SELECT v_student.id, (v_student.first_name || ' ' || v_student.last_name)::TEXT, v_tuition_id, v_tech_levy_id;
    END LOOP;
END;
$$;

COMMIT;
