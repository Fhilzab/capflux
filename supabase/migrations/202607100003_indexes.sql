-- ==========================================================
-- CAPSTONE SOFTWARE SOLUTIONS LTD
-- Migration: 202607100003_indexes.sql
-- Purpose: Performance indexes for core Capstone tables
-- ==========================================================

BEGIN;

-- ==========================================================
-- TENANT AND LOOKUP INDEXES
-- ==========================================================

CREATE INDEX IF NOT EXISTS idx_profiles_school_id
    ON profiles (school_id);

CREATE INDEX IF NOT EXISTS idx_students_school_id
    ON students (school_id);

CREATE INDEX IF NOT EXISTS idx_students_device_seq
    ON students (school_id, device_id, client_sequence);

-- ==========================================================
-- LEDGER INDEXES
-- ==========================================================

CREATE INDEX IF NOT EXISTS idx_ledger_entries_school_id
    ON ledger_entries (school_id);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_student_id
    ON ledger_entries (student_id);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_entry_type
    ON ledger_entries (school_id, entry_type);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_device_seq
    ON ledger_entries (school_id, device_id, client_sequence);

-- ==========================================================
-- NOTIFICATION AND AUDIT INDEXES
-- ==========================================================

CREATE INDEX IF NOT EXISTS idx_notifications_school_id
    ON notifications (school_id);

CREATE INDEX IF NOT EXISTS idx_notifications_student_id
    ON notifications (student_id);

CREATE INDEX IF NOT EXISTS idx_notifications_device_seq
    ON notifications (school_id, device_id, client_sequence);

CREATE INDEX IF NOT EXISTS idx_audit_logs_school_id
    ON audit_logs (school_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id
    ON audit_logs (actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON audit_logs (created_at DESC);

-- ==========================================================
-- SYNC AND SETTINGS INDEXES
-- ==========================================================

CREATE INDEX IF NOT EXISTS idx_sync_queue_school_id
    ON sync_queue (school_id);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status
    ON sync_queue (status);

CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at
    ON sync_queue (created_at DESC);

COMMIT;
