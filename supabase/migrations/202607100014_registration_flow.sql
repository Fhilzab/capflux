-- ==========================================================
-- CAPSTONE SOFTWARE SOLUTIONS LTD
-- Migration: 202607100014_registration_flow.sql
-- Purpose: Atomic student registration with DVA provisioning and tuition billing
-- ==========================================================

BEGIN;

-- ==========================================================
-- Registration Flow Function
-- Encapsulates the complete student registration workflow
-- Used in offline-first sync to ensure consistent state
-- ==========================================================

CREATE OR REPLACE FUNCTION provision_student_dva_and_charges(
    p_school_id UUID,
    p_first_name TEXT,
    p_last_name TEXT,
    p_class_name TEXT,
    p_category student_category,
    p_guardian_full_name TEXT,
    p_guardian_primary_phone TEXT,
    p_guardian_secondary_phone TEXT DEFAULT NULL,
    p_guardian_email TEXT DEFAULT NULL,
    p_relationship TEXT DEFAULT 'GUARDIAN',
    p_academic_session TEXT DEFAULT '2025/2026',
    p_academic_term academic_term DEFAULT 'FIRST'
)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    v_guardian_id UUID;
    v_student_id UUID;
    v_tuition_amount NUMERIC(12,2);
    v_tuition_config_id UUID;
    v_ledger_id UUID;
    v_client_sequence INTEGER;
BEGIN
    -- Step 1: Find or create guardian (deduplication)
    SELECT id INTO v_guardian_id
    FROM guardians
    WHERE school_id = p_school_id AND primary_phone = p_guardian_primary_phone;

    IF NOT FOUND THEN
        INSERT INTO guardians (
            id, school_id, full_name, primary_phone, 
            secondary_phone, email, relationship, 
            created_at, updated_at
        ) VALUES (
            gen_random_uuid(), p_school_id, p_guardian_full_name, p_guardian_primary_phone,
            p_guardian_secondary_phone, p_guardian_email, p_relationship::guardian_relationship,
            now(), now()
        ) RETURNING id INTO v_guardian_id;
    END IF;

    -- Step 2: Get tuition configuration
    SELECT tuition_amount, id INTO v_tuition_amount, v_tuition_config_id
    FROM tuition_configuration
    WHERE school_id = p_school_id
      AND academic_session = p_academic_session
      AND academic_term = p_academic_term
      AND category = p_category;

    IF NOT FOUND THEN
        -- No tuition configured - return error (tuition must be configured first)
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No tuition configured for this category/session/term'
        );
    END IF;

    -- Step 3: Create student
    INSERT INTO students (
        id, school_id, first_name, last_name, class_name,
        category, guardian_id, status, device_id, client_sequence,
        created_at, updated_at
    ) VALUES (
        gen_random_uuid(), p_school_id, p_first_name, p_last_name, p_class_name,
        p_category, v_guardian_id, 'ACTIVE', 'registration-flow', 0,
        now(), now()
    ) RETURNING id INTO v_student_id;

    -- Step 4: Get next client sequence for ledger
    SELECT COALESCE(MAX(client_sequence), 0) + 1 INTO v_client_sequence
    FROM ledger_entries
    WHERE school_id = p_school_id AND device_id = 'registration-flow';

    -- Step 5: Create tuition DEBIT ledger entry (tuition charge)
    INSERT INTO ledger_entries (
        id, school_id, student_id, amount, entry_type,
        entry_category, metadata, client_sequence, device_id, created_at
    ) VALUES (
        gen_random_uuid(), p_school_id, v_student_id, v_tuition_amount, 'DEBIT',
        'TUITION',
        jsonb_build_object(
            'academic_session', p_academic_session,
            'academic_term', p_academic_term,
            'tuition_config_id', v_tuition_config_id
        ),
        v_client_sequence, 'registration-flow', now()
    ) RETURNING id INTO v_ledger_id;

    -- Step 6: Enqueue sync for offline-first propagation
    PERFORM enqueue_sync_payload(
        'students', v_student_id, 'UPSERT',
        jsonb_build_object(
            'id', v_student_id,
            'school_id', p_school_id,
            'first_name', p_first_name,
            'last_name', p_last_name,
            'class_name', p_class_name,
            'category', p_category,
            'guardian_id', v_guardian_id,
            'status', 'ACTIVE',
            'device_id', 'registration-flow',
            'client_sequence', 0
        )
    );

    -- Enqueue guardian sync
    PERFORM enqueue_sync_payload(
        'guardians', v_guardian_id, 'UPSERT',
        jsonb_build_object(
            'id', v_guardian_id,
            'school_id', p_school_id,
            'full_name', p_guardian_full_name,
            'primary_phone', p_guardian_primary_phone,
            'relationship', p_relationship
        )
    );

    -- Enqueue ledger sync
    PERFORM enqueue_sync_payload(
        'ledger_entries', v_ledger_id, 'INSERT',
        jsonb_build_object(
            'id', v_ledger_id,
            'school_id', p_school_id,
            'student_id', v_student_id,
            'amount', v_tuition_amount,
            'entry_type', 'DEBIT',
            'entry_category', 'TUITION',
            'client_sequence', v_client_sequence
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'student_id', v_student_id,
        'guardian_id', v_guardian_id,
        'tuition_amount', v_tuition_amount,
        'ledger_id', v_ledger_id
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

COMMIT;