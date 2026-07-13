-- ==========================================================
-- CAPSTONE SOFTWARE SOLUTIONS LTD
-- Migration: audit_triggers.sql
-- Purpose: Automatic audit logging for all business tables
-- ==========================================================

-- ==========================================================
-- AUDIT TRIGGER FUNCTION
-- ==========================================================

CREATE OR REPLACE FUNCTION trigger_audit_log()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_actor_id UUID;
    v_action TEXT;
    v_entity TEXT;
    v_entity_id UUID;
    v_metadata JSONB;
BEGIN
    -- Determine actor from JWT claims
    v_actor_id := current_setting('jwt.claims.profile_id', true)::UUID;
    IF v_actor_id IS NULL THEN
        v_actor_id := '00000000-0000-0000-0000-000000000000'::UUID;
    END IF;

    v_entity := TG_TABLE_NAME;

    IF TG_OP = 'INSERT' THEN
        v_action := 'CREATE';
        v_entity_id := NEW.id;
        v_metadata := jsonb_build_object(
            'new_data', row_to_json(NEW)::jsonb
        );
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'UPDATE';
        v_entity_id := NEW.id;
        v_metadata := jsonb_build_object(
            'old_data', row_to_json(OLD)::jsonb,
            'new_data', row_to_json(NEW)::jsonb,
            'changed_fields', (
                SELECT jsonb_object_agg(key, value)
                FROM jsonb_each(row_to_json(NEW)::jsonb)
                WHERE row_to_json(OLD)::jsonb->>key IS DISTINCT FROM row_to_json(NEW)::jsonb->>key
            )
        );
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'DELETE';
        v_entity_id := OLD.id;
        v_metadata := jsonb_build_object(
            'deleted_data', row_to_json(OLD)::jsonb
        );
    ELSE
        RETURN NULL;
    END IF;

    INSERT INTO audit_logs (
        school_id,
        actor_id,
        action,
        entity,
        entity_id,
        metadata,
        created_at
    ) VALUES (
        COALESCE(NEW.school_id, OLD.school_id),
        v_actor_id,
        v_action,
        v_entity,
        v_entity_id,
        v_metadata,
        now()
    );

    RETURN NULL;
END;
$$;

-- ==========================================================
-- APPLY TRIGGERS TO BUSINESS TABLES
-- ==========================================================

DROP TRIGGER IF EXISTS audit_students ON students;
CREATE TRIGGER audit_students
    AFTER INSERT OR UPDATE OR DELETE ON students
    FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- Enforce ledger immutability: Only log INSERTs (no UPDATE/DELETE allowed)
DROP TRIGGER IF EXISTS audit_ledger_entries ON ledger_entries;
CREATE TRIGGER audit_ledger_entries
    AFTER INSERT ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

DROP TRIGGER IF EXISTS audit_notifications ON notifications;
CREATE TRIGGER audit_notifications
    AFTER INSERT OR UPDATE OR DELETE ON notifications
    FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

DROP TRIGGER IF EXISTS audit_profiles ON profiles;
CREATE TRIGGER audit_profiles
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();