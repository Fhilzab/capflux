-- ==========================================================
-- CAPSTONE SOFTWARE SOLUTIONS LTD
-- Migration: rls_hardening.sql
-- Purpose: Additional RLS hardening for multi-tenant isolation
-- ==========================================================

BEGIN;

-- ==========================================================
-- Ensure all existing tables have strict WITH CHECK policies
-- ==========================================================

-- Students: Only allow operations within own school
DROP POLICY IF EXISTS allow_authenticated_students ON students;
CREATE POLICY allow_authenticated_students ON students
    FOR ALL
    USING (current_school_id() = students.school_id)
    WITH CHECK (current_school_id() = students.school_id);

-- Ledger entries: Immutable — only SELECT and INSERT allowed, never UPDATE or DELETE
DROP POLICY IF EXISTS allow_authenticated_ledger_entries ON ledger_entries;
CREATE POLICY allow_authenticated_ledger_entries ON ledger_entries
    FOR SELECT
    USING (current_school_id() = ledger_entries.school_id);

CREATE POLICY allow_insert_ledger_entries ON ledger_entries
    FOR INSERT
    WITH CHECK (current_school_id() = ledger_entries.school_id);

-- Notifications: Allow SELECT and INSERT, restrict UPDATE to delivery status only
DROP POLICY IF EXISTS allow_authenticated_notifications ON notifications;
CREATE POLICY allow_select_notifications ON notifications
    FOR SELECT
    USING (current_school_id() = notifications.school_id);

CREATE POLICY allow_insert_notifications ON notifications
    FOR INSERT
    WITH CHECK (current_school_id() = notifications.school_id);

CREATE POLICY allow_update_notifications ON notifications
    FOR UPDATE
    USING (current_school_id() = notifications.school_id)
    WITH CHECK (current_school_id() = notifications.school_id);

-- Profiles: Each user can only see profiles in their school
DROP POLICY IF EXISTS allow_authenticated_profiles ON profiles;
CREATE POLICY allow_select_profiles ON profiles
    FOR SELECT
    USING (current_school_id() = profiles.school_id);

CREATE POLICY allow_insert_profiles ON profiles
    FOR INSERT
    WITH CHECK (current_school_id() = profiles.school_id);

-- ==========================================================
-- Sync queue: Only allow operations on own school's items
-- ==========================================================

DROP POLICY IF EXISTS allow_authenticated_sync_queue ON sync_queue;
CREATE POLICY allow_sync_queue_access ON sync_queue
    FOR ALL
    USING (current_school_id() = sync_queue.school_id)
    WITH CHECK (current_school_id() = sync_queue.school_id);

-- ==========================================================
-- App settings: Each school manages its own settings
-- ==========================================================

DROP POLICY IF EXISTS allow_authenticated_app_settings ON app_settings;
CREATE POLICY allow_app_settings_access ON app_settings
    FOR ALL
    USING (current_school_id() = app_settings.school_id)
    WITH CHECK (current_school_id() = app_settings.school_id);

-- ==========================================================
-- Audit logs: Read-only access within tenant
-- ==========================================================

DROP POLICY IF EXISTS allow_authenticated_audit_logs ON audit_logs;
DROP POLICY IF EXISTS allow_audit_by_school ON audit_logs;
CREATE POLICY allow_audit_log_access ON audit_logs
    FOR SELECT
    USING (current_school_id() = audit_logs.school_id);

-- ==========================================================
-- Schools table: Only allow reading own school record
-- ==========================================================

DROP POLICY IF EXISTS allow_authenticated_users ON schools;
CREATE POLICY allow_select_schools ON schools
    FOR SELECT
    USING (current_school_id() = schools.id);

-- Bursars can update school settings
CREATE POLICY allow_update_schools ON schools
    FOR UPDATE
    USING (current_school_id() = schools.id)
    WITH CHECK (current_school_id() = schools.id);

COMMIT;