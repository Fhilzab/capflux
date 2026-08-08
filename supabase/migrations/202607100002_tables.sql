-- ==========================================================
-- CAPFLUX — FHILZAB NIG LTD
-- Migration: 202607100002_tables.sql
-- Purpose: Core relational tables for the CAPFLUX platform
-- ==========================================================

BEGIN;

-- ==========================================================
-- CORE TENANT AND USER TABLES
-- ==========================================================

-- schools: the canonical tenant table. `status`/`payment_status` use the
-- school_status/payment_status enums (defined in migration 022). FKs to
-- organizations/users are added in migration 022 (after those tables exist).
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT,
    organization_id UUID,
    owner_user_id UUID,
    address TEXT,
    state TEXT,
    lga TEXT,
    country TEXT NOT NULL DEFAULT 'Nigeria',
    school_type TEXT,
    academic_calendar JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'PENDING_SETUP',
    payment_status TEXT NOT NULL DEFAULT 'NOT_READY',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The canonical CAPFLUX user profile. Backed by WorkOS identity (users.id).
-- `user_id` FK is added in migration 021 (after public.users is created).
-- `school_id` was originally NOT NULL; it is now optional because a user
-- belongs to an organization/school through memberships, not a profile field.
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE,
    school_id UUID REFERENCES schools (id) ON DELETE SET NULL,
    email TEXT,
    full_name TEXT NOT NULL,
    phone TEXT,
    role profile_role NOT NULL DEFAULT 'ADMIN',
    admin_status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    class_name TEXT NOT NULL,
    guardian_id UUID,
    guardian_phone TEXT,
    dva_account_number TEXT,
    dva_bank_name TEXT,
    status student_status NOT NULL DEFAULT 'ACTIVE',
    client_sequence INTEGER NOT NULL DEFAULT 0,
    device_id TEXT NOT NULL DEFAULT 'registration-flow',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (school_id, device_id, client_sequence)
);

-- ==========================================================
-- FINANCIAL LEDGER TABLE
-- ==========================================================

CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students (id) ON DELETE RESTRICT,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    entry_type ledger_entry_type NOT NULL,
    entry_category ledger_entry_category NOT NULL,
    reference_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    client_sequence INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (school_id, device_id, client_sequence)
);

-- ==========================================================
-- NOTIFICATIONS AND AUDIT HISTORY
-- ==========================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    student_id UUID REFERENCES students (id) ON DELETE RESTRICT,
    guardian_id UUID,
    recipient_phone TEXT NOT NULL,
    message_body TEXT NOT NULL,
    delivery_status notification_status NOT NULL DEFAULT 'PENDING',
    provider_msg_id TEXT,
    client_sequence INTEGER NOT NULL DEFAULT 0,
    device_id TEXT NOT NULL DEFAULT 'webhook-handler',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (school_id, device_id, client_sequence)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    actor_id UUID,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id UUID NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================
-- SYNCHRONIZATION AND SETTINGS
-- ==========================================================

CREATE TABLE IF NOT EXISTS sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    operation TEXT NOT NULL,
    payload JSONB NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    status sync_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS app_settings (
    school_id UUID PRIMARY KEY REFERENCES schools (id) ON DELETE CASCADE,
    currency TEXT NOT NULL DEFAULT 'NGN',
    timezone TEXT NOT NULL DEFAULT 'Africa/Lagos',
    settings JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMIT;
