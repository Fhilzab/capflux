-- ==========================================================
-- CAPSTONE SOFTWARE SOLUTIONS LTD
-- Migration: 202607100023_fix_proprietor_owner_drift.sql
-- Purpose: Fix school_is_ready() to use OWNER instead of PROPRIETOR
-- ==========================================================

BEGIN;

-- ==========================================================
-- Fix: school_is_ready() references OWNER, not PROPRIETOR
-- This aligns with the role enum rename in migration 018
-- ==========================================================

CREATE OR REPLACE FUNCTION school_is_ready(p_school_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
    SELECT
        EXISTS (SELECT 1 FROM profiles WHERE school_id = p_school_id AND role = 'OWNER')
        AND EXISTS (
            SELECT 1 FROM academic_sessions 
            WHERE school_id = p_school_id AND is_current = true
        )
        AND EXISTS (
            SELECT 1 FROM academic_terms t 
            JOIN academic_sessions s ON t.session_id = s.id 
            WHERE s.school_id = p_school_id AND t.is_current = true
        )
        AND EXISTS (
            SELECT 1 FROM tuition_configuration 
            WHERE school_id = p_school_id
        )
        AND EXISTS (
            SELECT 1 FROM payment_gateway_config 
            WHERE school_id = p_school_id AND is_active = true
        );
$$;

-- ==========================================================
-- Fix: current_profile_role() also references PROPRIETOR in RLS
-- Migration 021 uses this in policies - update it too
-- ==========================================================

CREATE OR REPLACE FUNCTION current_profile_role()
RETURNS profile_role LANGUAGE SQL STABLE AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$;

COMMIT;