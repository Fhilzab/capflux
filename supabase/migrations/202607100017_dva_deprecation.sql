-- ==========================================================
-- CAPSTONE SOFTWARE SOLUTIONS LTD
-- Migration: 202607100017_dva_deprecation.sql
-- Purpose: Deprecate dva_assignments table, superseded by payment_accounts
-- ==========================================================

BEGIN;

-- Add deprecation notice as a comment on the table
COMMENT ON TABLE dva_assignments IS 'DEPRECATED: Superseded by payment_accounts. This table will be dropped in a future migration. Use payment_accounts for all new development.';

-- Add deprecation notice on the provision_dva_for_student function
COMMENT ON FUNCTION provision_dva_for_student IS 'DEPRECATED: Superseded by payment_accounts table and GatewayFactory. This function will be removed in a future migration.';

-- Create a view for backward compatibility (reads from payment_accounts)
CREATE OR REPLACE VIEW dva_assignments AS
SELECT 
    id,
    school_id,
    student_id,
    provider,
    dva_account_number as virtual_account_number,
    dva_bank_name as bank_name,
    dva_account_name as account_name,
    is_active as account_status,
    created_at,
    updated_at
FROM payment_accounts;

COMMIT;

-- ==========================================================
-- Drop View (to replace dva_assignments)
-- ==========================================================

-- Note: The view above provides backward compatibility for code still reading from dva_assignments.
-- All new code should use payment_accounts directly.