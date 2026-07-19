-- ==========================================================
-- CAPSTONE SOFTWARE SOLUTIONS LTD
-- Migration: 202607100021_rls_hardening_v2.sql
-- Purpose: Centralized RLS using tenant_has_access() function
-- ==========================================================

BEGIN;

-- ==========================================================
-- CENTRALIZED TENANT ACCESS FUNCTION
-- ==========================================================

CREATE OR REPLACE FUNCTION tenant_has_access(target_school_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND school_id = target_school_id
    );
$$;

-- ==========================================================
-- RLS POLICY REFACTOR
-- Strategy: Audit each existing policy. Reuse and refactor.
-- Only replace when the policy cannot be adapted to use tenant_has_access().
-- ==========================================================

-- ==========================================================
-- SCHOOLS TABLE POLICIES
-- ==========================================================

DROP POLICY IF EXISTS allow_select_schools ON schools;
DROP POLICY IF EXISTS allow_update_schools ON schools;
DROP POLICY IF EXISTS allow_authenticated_users ON schools;

CREATE POLICY "school_select" ON schools
    FOR SELECT USING (tenant_has_access(schools.id));

CREATE POLICY "school_update" ON schools
    FOR UPDATE USING (
        current_profile_role() = 'PROPRIETOR'
        AND tenant_has_access(schools.id)
    );

-- ==========================================================
-- PROFILES TABLE POLICIES
-- ==========================================================

DROP POLICY IF EXISTS allow_select_profiles ON profiles;
DROP POLICY IF EXISTS allow_insert_profiles ON profiles;
DROP POLICY IF EXISTS "Owner can view all profiles in school" ON profiles;
DROP POLICY IF EXISTS "Admins and owner can view own profile" ON profiles;
DROP POLICY IF EXISTS "Owner can manage admins" ON profiles;
DROP POLICY IF EXISTS "Owner can insert admins" ON profiles;

CREATE POLICY "profile_select" ON profiles
    FOR SELECT USING (
        id = auth.uid()
        OR tenant_has_access(profiles.school_id)
    );

CREATE POLICY "profile_insert" ON profiles
    FOR INSERT WITH CHECK (tenant_has_access(profiles.school_id));

CREATE POLICY "profile_update_self" ON profiles
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY "profile_update_by_proprietor" ON profiles
    FOR UPDATE USING (
        current_profile_role() = 'PROPRIETOR'
        AND tenant_has_access(profiles.school_id)
    );

-- ==========================================================
-- STUDENTS TABLE POLICIES
-- ==========================================================

DROP POLICY IF EXISTS allow_authenticated_students ON students;

CREATE POLICY "student_select" ON students
    FOR SELECT USING (tenant_has_access(students.school_id));

CREATE POLICY "student_insert" ON students
    FOR INSERT WITH CHECK (tenant_has_access(students.school_id));

CREATE POLICY "student_update" ON students
    FOR UPDATE USING (tenant_has_access(students.school_id));

CREATE POLICY "student_delete" ON students
    FOR DELETE USING (
        current_profile_role() = 'PROPRIETOR'
        AND tenant_has_access(students.school_id)
    );

-- ==========================================================
-- LEDGER ENTRIES TABLE POLICIES (immutable)
-- ==========================================================

DROP POLICY IF EXISTS allow_authenticated_ledger_entries ON ledger_entries;
DROP POLICY IF EXISTS allow_insert_ledger_entries ON ledger_entries;

CREATE POLICY "ledger_select" ON ledger_entries
    FOR SELECT USING (tenant_has_access(ledger_entries.school_id));

CREATE POLICY "ledger_insert" ON ledger_entries
    FOR INSERT WITH CHECK (tenant_has_access(ledger_entries.school_id));

-- ==========================================================
-- GUARDIANS TABLE POLICIES
-- ==========================================================

DROP POLICY IF EXISTS allow_authenticated_guardians ON guardians;

CREATE POLICY "guardian_select" ON guardians
    FOR SELECT USING (tenant_has_access(guardians.school_id));

CREATE POLICY "guardian_insert" ON guardians
    FOR INSERT WITH CHECK (tenant_has_access(guardians.school_id));

CREATE POLICY "guardian_update" ON guardians
    FOR UPDATE USING (tenant_has_access(guardians.school_id));

-- ==========================================================
-- NOTIFICATIONS TABLE POLICIES
-- ==========================================================

DROP POLICY IF EXISTS allow_select_notifications ON notifications;
DROP POLICY IF EXISTS allow_insert_notifications ON notifications;
DROP POLICY IF EXISTS allow_update_notifications ON notifications;

CREATE POLICY "notification_select" ON notifications
    FOR SELECT USING (tenant_has_access(notifications.school_id));

CREATE POLICY "notification_insert" ON notifications
    FOR INSERT WITH CHECK (tenant_has_access(notifications.school_id));

CREATE POLICY "notification_update" ON notifications
    FOR UPDATE USING (tenant_has_access(notifications.school_id));

-- ==========================================================
-- AUDIT LOGS TABLE POLICIES
-- ==========================================================

DROP POLICY IF EXISTS allow_audit_log_access ON audit_logs;

CREATE POLICY "audit_select" ON audit_logs
    FOR SELECT USING (tenant_has_access(audit_logs.school_id));

-- ==========================================================
-- SYNC QUEUE TABLE POLICIES
-- ==========================================================

DROP POLICY IF EXISTS allow_sync_queue_access ON sync_queue;

CREATE POLICY "sync_queue_select" ON sync_queue
    FOR SELECT USING (tenant_has_access(sync_queue.school_id));

CREATE POLICY "sync_queue_insert" ON sync_queue
    FOR INSERT WITH CHECK (tenant_has_access(sync_queue.school_id));

CREATE POLICY "sync_queue_update" ON sync_queue
    FOR UPDATE USING (tenant_has_access(sync_queue.school_id));

CREATE POLICY "sync_queue_delete" ON sync_queue
    FOR DELETE USING (tenant_has_access(sync_queue.school_id));

-- ==========================================================
-- APP SETTINGS TABLE POLICIES
-- ==========================================================

DROP POLICY IF EXISTS allow_app_settings_access ON app_settings;

CREATE POLICY "app_settings_select" ON app_settings
    FOR SELECT USING (tenant_has_access(app_settings.school_id));

CREATE POLICY "app_settings_insert" ON app_settings
    FOR INSERT WITH CHECK (tenant_has_access(app_settings.school_id));

CREATE POLICY "app_settings_update" ON app_settings
    FOR UPDATE USING (tenant_has_access(app_settings.school_id));

-- ==========================================================
-- ONBOARDING PROGRESS TABLE POLICIES (MISSING RLS - NOW ADDED)
-- ==========================================================

ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onboarding_select" ON onboarding_progress
    FOR SELECT USING (tenant_has_access(onboarding_progress.school_id));

CREATE POLICY "onboarding_insert" ON onboarding_progress
    FOR INSERT WITH CHECK (tenant_has_access(onboarding_progress.school_id));

CREATE POLICY "onboarding_update" ON onboarding_progress
    FOR UPDATE USING (tenant_has_access(onboarding_progress.school_id));

-- ==========================================================
-- TUITION CONFIGURATION TABLE POLICIES
-- ==========================================================

DROP POLICY IF EXISTS allow_authenticated_tuition_config ON tuition_configuration;

CREATE POLICY "tuition_config_select" ON tuition_configuration
    FOR SELECT USING (tenant_has_access(tuition_configuration.school_id));

CREATE POLICY "tuition_config_insert" ON tuition_configuration
    FOR INSERT WITH CHECK (tenant_has_access(tuition_configuration.school_id));

CREATE POLICY "tuition_config_update" ON tuition_configuration
    FOR UPDATE USING (tenant_has_access(tuition_configuration.school_id));

-- ==========================================================
-- FEE RULES TABLE POLICIES
-- ==========================================================

DROP POLICY IF EXISTS allow_authenticated_fee_rules ON fee_rules;

CREATE POLICY "fee_rules_select" ON fee_rules
    FOR SELECT USING (tenant_has_access(fee_rules.school_id));

CREATE POLICY "fee_rules_insert" ON fee_rules
    FOR INSERT WITH CHECK (tenant_has_access(fee_rules.school_id));

CREATE POLICY "fee_rules_update" ON fee_rules
    FOR UPDATE USING (tenant_has_access(fee_rules.school_id));

-- ==========================================================
-- PAYMENT ACCOUNTS TABLE POLICIES
-- ==========================================================

DROP POLICY IF EXISTS allow_authenticated_payment_accounts ON payment_accounts;

CREATE POLICY "payment_accounts_select" ON payment_accounts
    FOR SELECT USING (tenant_has_access(payment_accounts.school_id));

CREATE POLICY "payment_accounts_insert" ON payment_accounts
    FOR INSERT WITH CHECK (tenant_has_access(payment_accounts.school_id));

CREATE POLICY "payment_accounts_update" ON payment_accounts
    FOR UPDATE USING (tenant_has_access(payment_accounts.school_id));

-- ==========================================================
-- PAYMENT GATEWAY CONFIG TABLE POLICIES
-- ==========================================================

DROP POLICY IF EXISTS allow_authenticated_payment_gateway_config ON payment_gateway_config;

CREATE POLICY "payment_gateway_select" ON payment_gateway_config
    FOR SELECT USING (tenant_has_access(payment_gateway_config.school_id));

CREATE POLICY "payment_gateway_insert" ON payment_gateway_config
    FOR INSERT WITH CHECK (tenant_has_access(payment_gateway_config.school_id));

CREATE POLICY "payment_gateway_update" ON payment_gateway_config
    FOR UPDATE USING (tenant_has_access(payment_gateway_config.school_id));

-- ==========================================================
-- DVA ASSIGNMENTS TABLE POLICIES
-- ==========================================================

DROP POLICY IF EXISTS allow_authenticated_dva_assignments ON dva_assignments;

CREATE POLICY "dva_assignments_select" ON dva_assignments
    FOR SELECT USING (tenant_has_access(dva_assignments.school_id));

CREATE POLICY "dva_assignments_insert" ON dva_assignments
    FOR INSERT WITH CHECK (tenant_has_access(dva_assignments.school_id));

CREATE POLICY "dva_assignments_update" ON dva_assignments
    FOR UPDATE USING (tenant_has_access(dva_assignments.school_id));

-- ==========================================================
-- PAYMENT TRANSACTIONS TABLE POLICIES
-- ==========================================================

DROP POLICY IF EXISTS allow_authenticated_payment_transactions ON payment_transactions;

CREATE POLICY "payment_transactions_select" ON payment_transactions
    FOR SELECT USING (tenant_has_access(payment_transactions.school_id));

CREATE POLICY "payment_transactions_insert" ON payment_transactions
    FOR INSERT WITH CHECK (tenant_has_access(payment_transactions.school_id));

-- ==========================================================
-- SETTLEMENT RECORDS TABLE POLICIES
-- ==========================================================

DROP POLICY IF EXISTS allow_authenticated_settlement_records ON settlement_records;

CREATE POLICY "settlement_records_select" ON settlement_records
    FOR SELECT USING (tenant_has_access(
        (SELECT school_id FROM payment_transactions WHERE id = settlement_records.payment_transaction_id)
    ));

CREATE POLICY "settlement_records_insert" ON settlement_records
    FOR INSERT WITH CHECK (tenant_has_access(
        (SELECT school_id FROM payment_transactions WHERE id = settlement_records.payment_transaction_id)
    ));

COMMIT;