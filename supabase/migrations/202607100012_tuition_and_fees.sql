-- ==========================================================
-- CAPSTONE SOFTWARE SOLUTIONS LTD
-- Migration: 202607100012_tuition_and_fees.sql
-- Purpose: Tuition configuration by category/session/term and platform fee rules
-- ==========================================================

BEGIN;

-- ==========================================================
-- ENUM TYPES FOR TUITION CATEGORY, SESSION, AND TERM
-- ==========================================================

-- Student category: Nursery, Primary, Secondary
CREATE TYPE student_category AS ENUM (
    'NURSERY',
    'PRIMARY',
    'SECONDARY'
);

-- Academic term: First, Second, Third (for 3-term Nigerian schools)
CREATE TYPE academic_term AS ENUM (
    'FIRST',
    'SECOND',
    'THIRD'
);

-- ==========================================================
-- TUITION CONFIGURATION
-- Schools configure tuition once per (session, term, category)
-- This enables the fee-first architecture where tuition is looked up during registration
-- ==========================================================

CREATE TABLE IF NOT EXISTS tuition_configuration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    academic_session TEXT NOT NULL, -- e.g., '2025/2026', '2024/2025'
    academic_term academic_term NOT NULL,
    category student_category NOT NULL,
    tuition_amount NUMERIC(12,2) NOT NULL CHECK (tuition_amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (school_id, academic_session, academic_term, category)
);

-- Index for fast tuition lookup during registration
CREATE INDEX IF NOT EXISTS idx_tuition_config_school_session_term_category
    ON tuition_configuration (school_id, academic_session, academic_term, category);

CREATE INDEX IF NOT EXISTS idx_tuition_config_school_active
    ON tuition_configuration (school_id, academic_session, academic_term);

-- ==========================================================
-- PLATFORM & BANKING SERVICE FEE RULES
-- Configurable fee policy (not hardcoded)
-- Covers gateway costs, banking operations, SMS, WhatsApp, infrastructure, Capstone revenue
-- ==========================================================

CREATE TABLE IF NOT EXISTS fee_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    minimum_fee NUMERIC(12,2) NOT NULL DEFAULT 200.00,
    percentage NUMERIC(5,2) NOT NULL DEFAULT 1.50, -- Percentage of payment amount
    maximum_fee NUMERIC(12,2) NOT NULL DEFAULT 2000.00,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure only one active fee rule per school at a time
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_fee_rule_per_school
    ON fee_rules (school_id)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_fee_rules_school_active
    ON fee_rules (school_id, is_active);

-- ==========================================================
-- PAYMENT ACCOUNTS (DEDICATED VIRTUAL ACCOUNTS)
-- Dedicated table for DVA management, decoupled from student records
-- Every student receives one DVA issued by the payment provider.
--
-- NOTE: This is the CANONICAL schema. Migration 016 extends it with the
-- provider-agnostic columns (virtual_account_number, account_status,
-- is_primary). 012 and 016 must be kept in sync.
-- ==========================================================

CREATE TABLE IF NOT EXISTS payment_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
    provider_name TEXT NOT NULL CHECK (provider_name IN ('monnify', 'flutterwave', 'remita')),
    account_number TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    account_reference TEXT NOT NULL, -- Provider's reference for this account
    provider_student_reference TEXT, -- Provider's reference for the student
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    -- Canonical provider-agnostic columns (aligned with 016)
    provider TEXT,
    provider_account_id TEXT,
    provider_reference TEXT,
    virtual_account_number TEXT,
    account_name TEXT,
    account_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (account_status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    is_primary BOOLEAN NOT NULL DEFAULT true,
    deactivated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (school_id, account_number),
    UNIQUE (student_id),
    -- One primary virtual account per student
    UNIQUE (school_id, student_id, is_primary)
);

CREATE INDEX IF NOT EXISTS idx_payment_accounts_school
    ON payment_accounts (school_id);

CREATE INDEX IF NOT EXISTS idx_payment_accounts_student
    ON payment_accounts (student_id);

CREATE INDEX IF NOT EXISTS idx_payment_accounts_provider
    ON payment_accounts (provider_name);

CREATE INDEX IF NOT EXISTS idx_payment_accounts_status
    ON payment_accounts (status);

CREATE INDEX IF NOT EXISTS idx_payment_accounts_virtual_number
    ON payment_accounts (virtual_account_number);

CREATE INDEX IF NOT EXISTS idx_payment_accounts_primary
    ON payment_accounts (school_id, student_id, is_primary) WHERE is_primary = true;

-- ==========================================================
-- STUDENT CATEGORY COLUMN
-- Add category to students for tuition lookup
-- ==========================================================

ALTER TABLE students 
ADD COLUMN IF NOT EXISTS category student_category NOT NULL DEFAULT 'PRIMARY';

COMMIT;