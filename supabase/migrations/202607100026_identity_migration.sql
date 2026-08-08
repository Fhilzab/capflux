-- ==========================================================
-- CAPFLUX — FHILZAB NIG LTD
-- Migration: 202607100026_identity_migration.sql
-- Purpose: Legacy Supabase → WorkOS identity migration tracking.
--
-- Records the migration state of legacy Supabase Auth users who are being
-- transitioned to WorkOS AuthKit. Stores NO passwords, NO password hashes,
-- and NO reset tokens — only email + legacy id + WorkOS user id + status.
--
-- Statuses:
--   PENDING  — legacy identity recorded, not yet invited
--   INVITED  — WorkOS password-reset email sent
--   CLAIMED  — user completed password setup (WorkOS user exists)
--   COMPLETED— CAPFLUX identity linked (public.users + memberships reconciled)
--   FAILED   — migration failed (failure_reason set)
-- ==========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.legacy_identity_migrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_user_id TEXT,                 -- old Supabase auth.users id (safe)
    email TEXT NOT NULL,
    workos_user_id UUID,                 -- set once claimed
    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'INVITED', 'CLAIMED', 'COMPLETED', 'FAILED')),
    idempotency_key TEXT,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    claimed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    UNIQUE (email)
);

-- Idempotency: a claim request for the same email must not duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS uq_legacy_identity_migrations_email
    ON public.legacy_identity_migrations (email);

CREATE UNIQUE INDEX IF NOT EXISTS uq_legacy_identity_migrations_idem
    ON public.legacy_identity_migrations (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_legacy_identity_migrations_status
    ON public.legacy_identity_migrations (status);

-- ==========================================================
-- SEED FROM LEGACY AUTH.USERS (metadata only: id + email)
-- Runs only if the legacy Supabase Auth project's users exist in this DB.
-- No passwords or hashes are ever read or stored.
-- ==========================================================

INSERT INTO public.legacy_identity_migrations (legacy_user_id, email, status, created_at)
SELECT au.id::TEXT, au.email, 'PENDING', COALESCE(au.created_at, now())
FROM auth.users au
WHERE au.email IS NOT NULL AND au.email != ''
ON CONFLICT (email) DO NOTHING;

COMMIT;
