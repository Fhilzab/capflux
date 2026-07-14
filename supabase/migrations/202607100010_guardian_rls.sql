-- ==========================================================
-- CAPSTONE SOFTWARE SOLUTIONS LTD
-- Migration: 202607100010_guardian_rls.sql
-- Purpose: RLS policies for guardians table
-- ==========================================================

BEGIN;

-- ==========================================================
-- RLS Policies for guardians
-- ==========================================================

CREATE POLICY allow_authenticated_guardians ON guardians
    FOR SELECT, INSERT, UPDATE
    USING (current_school_id() = guardians.school_id)
    WITH CHECK (current_school_id() = guardians.school_id);

COMMIT;