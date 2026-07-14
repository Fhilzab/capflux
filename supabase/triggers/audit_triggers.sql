-- ==========================================================
-- CAPSTONE SOFTWARE SOLUTIONS LTD
-- Migration: audit_triggers.sql
-- Purpose: Automatic audit logging for all financial operations
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
-- FINANCIAL EVENT LOGGING FUNCTION
-- For payments, settlements, and reconciliation - separate from audit
-- ==========================================================

CREATE OR REPLACE FUNCTION trigger_financial_event()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Log payment received event
    IF TG_TABLE_NAME = 'payment_transactions' AND TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (
            school_id,
            actor_id,
            action,
            entity,
            entity_id,
            metadata,
            created_at
        ) VALUES (
            NEW.school_id,
            NULL, -- System-generated event
            'PAYMENT_RECEIVED',
            'payment_transactions',
            NEW.id,
            jsonb_build_object(
                'reference', NEW.reference,
                'amount', NEW.amount,
                'gateway_txn_ref', NEW.gateway_txn_ref,
                'settlement_status', NEW.settlement_status
            ),
            now()
        );
        RETURN NEW;
    END IF;

    -- Log payment verified event (via webhook)
    IF TG_TABLE_NAME = 'ledger_entries' AND TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (
            school_id,
            actor_id,
            action,
            entity,
            entity_id,
            metadata,
            created_at
        ) VALUES (
            NEW.school_id,
            NULL, -- System-generated event
            CASE 
                WHEN NEW.entry_type = 'CREDIT' THEN 'PAYMENT_VERIFIED'
                WHEN NEW.entry_type = 'DEBIT' THEN 'TUITION_GENERATED'
            END,
            'ledger_entries',
            NEW.id,
            jsonb_build_object(
                'entry_type', NEW.entry_type,
                'entry_category', NEW.entry_category,
                'amount', NEW.amount,
                'metadata', NEW.metadata
            ),
            now()
        );
        RETURN NEW;
    END IF;

    -- Log settlement completed event
    IF TG_TABLE_NAME = 'settlement_records' AND TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (
            school_id,
            actor_id,
            action,
            entity,
            entity_id,
            metadata,
            created_at
        ) VALUES (
            (SELECT school_id FROM payment_transactions WHERE id = NEW.payment_transaction_id),
            NULL, -- System-generated event
            'SETTLEMENT_COMPLETED',
            'settlement_records',
            NEW.id,
            jsonb_build_object(
                'destination', NEW.destination,
                'amount', NEW.amount,
                'payment_transaction_id', NEW.payment_transaction_id
            ),
            now()
        );
        RETURN NEW;
    END IF;

    -- Log payment account created event
    IF TG_TABLE_NAME = 'payment_accounts' AND TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (
            school_id,
            actor_id,
            action,
            entity,
            entity_id,
            metadata,
            created_at
        ) VALUES (
            NEW.school_id,
            NULL, -- System-generated event
            'DVA_CREATED',
            'payment_accounts',
            NEW.id,
            jsonb_build_object(
                'provider', NEW.provider,
                'virtual_account_number', NEW.virtual_account_number,
                'student_id', NEW.student_id
            ),
            now()
        );
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$;

-- ==========================================================
-- APPLY TRIGGERS TO BUSINESS TABLES
-- ==========================================================

-- Students (operational data - can be updated)
DROP TRIGGER IF EXISTS audit_students ON students;
CREATE TRIGGER audit_students
    AFTER INSERT OR UPDATE OR DELETE ON students
    FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- Enforce ledger immutability: Only log INSERTs (no UPDATE/DELETE allowed)
DROP TRIGGER IF EXISTS audit_ledger_entries ON ledger_entries;
CREATE TRIGGER audit_ledger_entries
    AFTER INSERT ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- Financial events for ledger entries
DROP TRIGGER IF EXISTS financial_events_ledger ON ledger_entries;
CREATE TRIGGER financial_events_ledger
    AFTER INSERT ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION trigger_financial_event();

-- Notifications
DROP TRIGGER IF EXISTS audit_notifications ON notifications;
CREATE TRIGGER audit_notifications
    AFTER INSERT OR UPDATE OR DELETE ON notifications
    FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- Profiles
DROP TRIGGER IF EXISTS audit_profiles ON profiles;
CREATE TRIGGER audit_profiles
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- Payment transactions - financial events
DROP TRIGGER IF EXISTS financial_events_payments ON payment_transactions;
CREATE TRIGGER financial_events_payments
    AFTER INSERT ON payment_transactions
    FOR EACH ROW EXECUTE FUNCTION trigger_financial_event();

-- Settlement records - financial events
DROP TRIGGER IF EXISTS financial_events_settlements ON settlement_records;
CREATE TRIGGER financial_events_settlements
    AFTER INSERT ON settlement_records
    FOR EACH ROW EXECUTE FUNCTION trigger_financial_event();

-- Payment accounts - financial events
DROP TRIGGER IF EXISTS financial_events_payment_accounts ON payment_accounts;
CREATE TRIGGER financial_events_payment_accounts
    AFTER INSERT ON payment_accounts
    FOR EACH ROW EXECUTE FUNCTION trigger_financial_event();