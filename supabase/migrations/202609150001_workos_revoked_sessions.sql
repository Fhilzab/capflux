-- ==========================================================
-- CAPFLUX — WorkOS AuthKit — Revoked Session Tracking
-- Migration: 202609150001_workos_revoked_sessions.sql
--
-- Purpose: Durable, multi-instance storage for revoked WorkOS session IDs.
--          Enables immediate session revocation enforcement across all
--          backend instances.
--
-- Design:
--   * WorkOS session ID (sid claim from JWT) is the natural key
--   * Revoked at timestamp for audit and TTL cleanup
--   * Index on revoked_at for cleanup queries
--   * RLS: deny-by-default, service-role only
--
-- Usage:
--   * Webhook handler inserts session ID on session.revoked
--   * requireAuthWorkOS / requireAuthHybrid check this table
--   * Background job or cron cleans up expired entries
--
-- Rollback: DROP TABLE IF EXISTS public.workos_revoked_sessions;
-- ==========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.workos_revoked_sessions (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       text NOT NULL
                     CHECK (char_length(session_id) BETWEEN 1 AND 255),
    revoked_at       timestamptz NOT NULL DEFAULT now(),
    source           text NOT NULL DEFAULT 'webhook'
                     CHECK (source IN ('webhook', 'signout', 'admin')),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_wrs_session_id UNIQUE (session_id)
);

COMMENT ON TABLE public.workos_revoked_sessions IS
  'Durable store for revoked WorkOS session IDs. Checked by auth middleware to enforce immediate revocation.';

COMMENT ON COLUMN public.workos_revoked_sessions.session_id IS
  'WorkOS session ID (sid claim from JWT). Natural key for revocation checks.';

COMMENT ON COLUMN public.workos_revoked_sessions.revoked_at IS
  'Timestamp when the session was revoked.';

COMMENT ON COLUMN public.workos_revoked_sessions.source IS
  'Source of revocation: webhook (session.revoked event), signout (explicit signout), admin (manual).';

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_wrs_revoked_at ON public.workos_revoked_sessions (revoked_at DESC);

-- Keep updated_at fresh using existing project trigger function
DROP TRIGGER IF EXISTS trg_wrs_updated_at ON public.workos_revoked_sessions;
CREATE TRIGGER trg_wrs_updated_at
    BEFORE UPDATE ON public.workos_revoked_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- Deny-by-default: ENABLE RLS and deliberately create NO policies.
ALTER TABLE public.workos_revoked_sessions ENABLE ROW LEVEL SECURITY;

-- Defense-in-depth on top of RLS
REVOKE ALL ON public.workos_revoked_sessions FROM anon, authenticated;
-- service_role retains its default grants: revocation checks are service-controlled only.

-- Helper function to check if a session is revoked
-- Returns TRUE if revoked, FALSE if not found or expired (older than 30 days)
CREATE OR REPLACE FUNCTION public.is_workos_session_revoked(
    p_session_id TEXT
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_revoked_at timestamptz;
BEGIN
    -- Sessions older than 30 days are considered expired and not checked
    -- This prevents the table from growing indefinitely and matches WorkOS session max age
    SELECT revoked_at INTO v_revoked_at
    FROM public.workos_revoked_sessions
    WHERE session_id = p_session_id
      AND revoked_at > now() - interval '30 days';

    IF v_revoked_at IS NOT NULL THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.is_workos_session_revoked(TEXT) IS
  'Checks if a WorkOS session ID has been revoked within the last 30 days. Returns TRUE if revoked, FALSE otherwise. Only callable by service_role.';

-- Restrict execution to service_role only
REVOKE ALL ON FUNCTION public.is_workos_session_revoked(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_workos_session_revoked(TEXT) TO service_role;

-- Helper function to revoke a session (idempotent)
CREATE OR REPLACE FUNCTION public.revoke_workos_session(
    p_session_id TEXT,
    p_source TEXT DEFAULT 'webhook'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    INSERT INTO public.workos_revoked_sessions (session_id, source)
    VALUES (p_session_id, p_source)
    ON CONFLICT (session_id) DO UPDATE SET
        revoked_at = now(),
        source = EXCLUDED.source,
        updated_at = now();
END;
$$;

COMMENT ON FUNCTION public.revoke_workos_session(TEXT, TEXT) IS
  'Records a WorkOS session as revoked. Idempotent: safe to call multiple times. Only callable by service_role.';

-- Restrict execution to service_role only
REVOKE ALL ON FUNCTION public.revoke_workos_session(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_workos_session(TEXT, TEXT) TO service_role;

COMMIT;