-- ==========================================================
-- CAPSTONE SOFTWARE SOLUTIONS LTD
-- Migration: 202607100006_views.sql
-- Purpose: Read-only views for reporting and student balance lookups
-- ==========================================================

BEGIN;

-- ==========================================================
-- Student balance view
-- ==========================================================

CREATE OR REPLACE VIEW student_balances AS
SELECT
    s.id AS student_id,
    s.school_id,
    s.first_name,
    s.last_name,
    s.class_name,
    COALESCE(
        SUM(
            CASE
                WHEN le.entry_type = 'DEBIT' THEN le.amount
                ELSE -le.amount
            END
        ), 0
    ) AS balance,
    MAX(le.created_at) AS last_transaction_at
FROM students s
LEFT JOIN ledger_entries le
    ON le.student_id = s.id
GROUP BY s.id, s.school_id, s.first_name, s.last_name, s.class_name;

-- ==========================================================
-- School balance view
-- ==========================================================

CREATE OR REPLACE VIEW school_balances AS
SELECT
    school_id,
    COALESCE(
        SUM(
            CASE
                WHEN entry_type = 'DEBIT' THEN amount
                ELSE -amount
            END
        ), 0
    ) AS balance,
    COUNT(*) FILTER (WHERE entry_type = 'DEBIT') AS debit_count,
    COUNT(*) FILTER (WHERE entry_type = 'CREDIT') AS credit_count
FROM ledger_entries
GROUP BY school_id;

-- ==========================================================
-- Pending notifications view
-- ==========================================================

CREATE OR REPLACE VIEW pending_notifications AS
SELECT
    id,
    school_id,
    student_id,
    recipient_phone,
    message_body,
    delivery_status,
    provider_msg_id,
    created_at
FROM notifications
WHERE delivery_status = 'PENDING';

-- ==========================================================
-- Sync queue view
-- ==========================================================

CREATE OR REPLACE VIEW pending_sync_items AS
SELECT
    id,
    school_id,
    entity_type,
    entity_id,
    operation,
    payload,
    retry_count,
    status,
    created_at,
    processed_at
FROM sync_queue
WHERE status = 'PENDING';

COMMIT;
