-- ==========================================================
-- CAPSTONE SOFTWARE SOLUTIONS LTD
-- Migration: 202607100001_foundation.sql
-- Purpose: Database foundation (extensions and shared types)
-- ==========================================================

BEGIN;

-- ==========================================================
-- EXTENSIONS
-- ==========================================================

-- Generates cryptographically secure UUIDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Case-insensitive text (emails, usernames, etc.)
CREATE EXTENSION IF NOT EXISTS citext;

-- ==========================================================
-- ENUM TYPES
-- ==========================================================

-- School subscription status
CREATE TYPE subscription_status AS ENUM (
    'ACTIVE',
    'SUSPENDED'
);

-- User roles
CREATE TYPE profile_role AS ENUM (
    'PROPRIETOR',
    'ADMIN',
    'BURSAR'
);

-- Student lifecycle
CREATE TYPE student_status AS ENUM (
    'ACTIVE',
    'GRADUATED',
    'LEFT'
);

-- Financial entry direction
CREATE TYPE ledger_entry_type AS ENUM (
    'DEBIT',
    'CREDIT'
);

-- Financial entry category
CREATE TYPE ledger_entry_category AS ENUM (
    'TUITION',
    'TECH_LEVY',
    'BOOKS',
    'UNIFORM',
    'TRANSPORT',
    'EXAM',
    'OTHER',
    'DISCOUNT',
    'REFUND',
    'ADJUSTMENT'
);

-- Notification delivery state
CREATE TYPE notification_status AS ENUM (
    'PENDING',
    'SENT',
    'FAILED'
);

-- Synchronization state
CREATE TYPE sync_status AS ENUM (
    'PENDING',
    'SYNCING',
    'SYNCED',
    'FAILED'
);

COMMIT;