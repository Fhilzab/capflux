-- ==========================================================
-- CAPFLUX — WorkOS AuthKit Migration — Phase 1 (identity bridge)
-- Migration: 202608230002_user_identity_links.sql
--
-- Purpose: additive mapping table between immutable WorkOS identities and
--          the CANONICAL CAPFLUX UUID identity (public.users.id).
--
-- Approved design: docs/security/WORKOS_AUTHKIT_PHASE_1_REPORT.md §5
-- (numbering resolved per SC-1; guardian migration 202608230001 untouched).
--
-- Invariants:
--   * One row per (workos_user_id, identity_type)  — no duplicate external maps
--   * One row per (capflux_user_id, identity_type) — no duplicate internal maps
--   * WorkOS IDs are TEXT; CAPFLUX IDs remain UUID (types never mixed)
--   * Only status='ACTIVE' may ever resolve (re-enforced in the shim function)
--   * Deny-by-default RLS: ENABLE + no policies ⇒ anon/authenticated see nothing
--   * No financial table touched; no existing row modified; no backfill here
-- Rollback: drop-only, see WORKOS_AUTHKIT_PHASE_1_EXECUTION_PACKAGE.md
-- ==========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_identity_links (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    capflux_user_id  uuid NOT NULL
                     REFERENCES public.users(id) ON DELETE CASCADE,
    workos_user_id   text NOT NULL
                     CHECK (workos_user_id ~ '^user_[0-9A-Za-z]{10,}$'),
    identity_type    text NOT NULL DEFAULT 'workos_authkit'
                     CHECK (identity_type IN ('workos_authkit')),
    status           text NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','REVOKED','REVIEW')),
    migration_source text NOT NULL DEFAULT 'PREIMPORT'
                     CHECK (migration_source IN ('PREIMPORT','JIT_VERIFIED_EMAIL','MANUAL','WEBHOOK')),
    verified_at      timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_uil_workos_per_type  UNIQUE (workos_user_id,  identity_type),
    CONSTRAINT uq_uil_capflux_per_type UNIQUE (capflux_user_id, identity_type),
    CONSTRAINT uq_uil_ids_distinct     CHECK (capflux_user_id::text <> workos_user_id)
);

COMMENT ON TABLE  public.user_identity_links IS
  'WorkOS-to-CAPFLUX identity bridge. Fail-closed: only ACTIVE rows may resolve. Service-role managed; no client policies by design.';
COMMENT ON COLUMN public.user_identity_links.status IS
  'Lifecycle: PENDING (not yet proven) / ACTIVE (resolvable) / SUSPENDED / REVOKED / REVIEW (manual adjudication queue). Non-ACTIVE never authenticates.';
COMMENT ON CONSTRAINT uq_uil_workos_per_type  ON public.user_identity_links IS
  'Invariant 2: one WorkOS identity maps to at most one CAPFLUX user per type.';
COMMENT ON CONSTRAINT uq_uil_capflux_per_type ON public.user_identity_links IS
  'Invariant 1: one CAPFLUX user has at most one WorkOS identity per type.';

-- Deny-by-default: ENABLE RLS and deliberately create NO policies.
ALTER TABLE public.user_identity_links ENABLE ROW LEVEL SECURITY;

-- Defense-in-depth on top of RLS (Supabase default privileges grant wide):
REVOKE ALL ON public.user_identity_links FROM anon, authenticated;
-- service_role retains its default grants: linking is service-controlled only.

-- Keep updated_at fresh using the existing project trigger function (021).
DROP TRIGGER IF EXISTS trg_uil_updated_at ON public.user_identity_links;
CREATE TRIGGER trg_uil_updated_at
    BEFORE UPDATE ON public.user_identity_links
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

COMMIT;
