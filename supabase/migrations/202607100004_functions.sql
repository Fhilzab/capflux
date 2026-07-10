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

COMMIT;
