-- ==========================================================
-- CAPSTONE SOFTWARE SOLUTIONS LTD
-- Migration: 202607100005_rls.sql
-- Purpose: Row-Level Security policies for tenant isolation and secure access
-- ==========================================================

BEGIN;

-- ==========================================================
-- Enable RLS on business tables
-- ==========================================================

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- Public access helpers
-- ==========================================================

CREATE POLICY allow_authenticated_users ON schools
    FOR SELECT
    USING (current_school_id() = schools.id);

CREATE POLICY allow_authenticated_profiles ON profiles
    FOR SELECT
    USING (current_school_id() = profiles.school_id);

CREATE POLICY allow_authenticated_students ON students
    FOR SELECT, INSERT, UPDATE, DELETE
    USING (current_school_id() = students.school_id)
    WITH CHECK (current_school_id() = students.school_id);

CREATE POLICY allow_authenticated_ledger_entries ON ledger_entries
    FOR SELECT, INSERT
    USING (current_school_id() = ledger_entries.school_id)
    WITH CHECK (current_school_id() = ledger_entries.school_id);

CREATE POLICY allow_authenticated_notifications ON notifications
    FOR SELECT, INSERT
    USING (current_school_id() = notifications.school_id)
    WITH CHECK (current_school_id() = notifications.school_id);

CREATE POLICY allow_authenticated_audit_logs ON audit_logs
    FOR SELECT, INSERT
    USING (current_school_id() = audit_logs.school_id)
    WITH CHECK (current_school_id() = audit_logs.school_id);

CREATE POLICY allow_authenticated_sync_queue ON sync_queue
    FOR SELECT, INSERT, UPDATE, DELETE
    USING (current_school_id() = sync_queue.school_id)
    WITH CHECK (current_school_id() = sync_queue.school_id);

CREATE POLICY allow_authenticated_app_settings ON app_settings
    FOR SELECT, INSERT, UPDATE, DELETE
    USING (current_school_id() = app_settings.school_id)
    WITH CHECK (current_school_id() = app_settings.school_id);

-- ==========================================================
-- Restrict audit log visibility to tenant only
-- ==========================================================

CREATE POLICY allow_audit_by_school ON audit_logs
    FOR SELECT
    USING (current_school_id() = audit_logs.school_id);

COMMIT;
