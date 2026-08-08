-- ==========================================================
-- CAPSTONE SOFTWARE SOLUTIONS LTD
-- Migration: 202607100013_rls.sql
-- Purpose: Row Level Security policies for tuition_configuration, fee_rules, and payment_accounts tables
-- ==========================================================

BEGIN;

-- ==========================================================
-- RLS on new tables
-- ==========================================================

ALTER TABLE tuition_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_accounts ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- Tuition Configuration Policies
-- Schools can only access tuition configs for their own school_id
-- ==========================================================

CREATE POLICY allow_authenticated_tuition_config ON tuition_configuration
    FOR ALL
    USING (current_school_id() = tuition_configuration.school_id)
    WITH CHECK (current_school_id() = tuition_configuration.school_id);

-- ==========================================================
-- Fee Rules Policies
-- Schools can only access fee rules for their own school_id
-- ==========================================================

CREATE POLICY allow_authenticated_fee_rules ON fee_rules
    FOR ALL
    USING (current_school_id() = fee_rules.school_id)
    WITH CHECK (current_school_id() = fee_rules.school_id);

-- ==========================================================
-- Payment Accounts Policies
-- Schools can only access payment accounts for their own students
-- ==========================================================

CREATE POLICY allow_authenticated_payment_accounts ON payment_accounts
    FOR ALL
    USING (current_school_id() = payment_accounts.school_id)
    WITH CHECK (current_school_id() = payment_accounts.school_id);

-- ==========================================================
-- Helper Functions for New Tables
-- ==========================================================

CREATE OR REPLACE FUNCTION get_tuition_for_student(
    p_school_id UUID,
    p_academic_session TEXT,
    p_academic_term academic_term,
    p_category student_category
)
RETURNS NUMERIC(12,2) LANGUAGE SQL STABLE AS $$
    SELECT tuition_amount
    FROM tuition_configuration
    WHERE school_id = p_school_id
      AND academic_session = p_academic_session
      AND academic_term = p_academic_term
      AND category = p_category;
$$;

CREATE OR REPLACE FUNCTION calculate_platform_fee(
    p_amount NUMERIC(12,2),
    p_school_id UUID
)
RETURNS NUMERIC(12,2) LANGUAGE SQL STABLE AS $$
    SELECT 
        CASE 
            WHEN (p_amount * f.percentage / 100) < f.minimum_fee THEN f.minimum_fee
            WHEN (p_amount * f.percentage / 100) > f.maximum_fee THEN f.maximum_fee
            ELSE (p_amount * f.percentage / 100)::NUMERIC(12,2)
        END
    FROM fee_rules f
    WHERE f.school_id = p_school_id AND f.is_active = true;
$$;

COMMIT;