-- ==========================================================
-- CAPFLUX — WorkOS AuthKit Migration — Phase 1 (RLS identity shim)
-- Migration: 202608230003_rls_identity_shim.sql
--
-- Purpose: resolve the JWT subject to the CANONICAL CAPFLUX uuid for use by
--          FUTURE RLS policies (Phase 8). Fail-closed by construction:
--          every unresolvable/malformed/unauthorized input returns NULL.
--
-- Approved design: docs/security/WORKOS_AUTHKIT_PHASE_1_REPORT.md §6
--
-- Security model:
--   * SECURITY DEFINER; reads ONLY public.user_identity_links
--   * SET search_path = '' : caller search_path cannot hijack resolution;
--     pg_catalog remains implicitly first; all relations schema-qualified
--   * STRICT select: unknown => NO_DATA_FOUND => NULL (deny);
--     multiple rows (constraint corruption) => TOO_MANY_ROWS raised loudly
--   * Malformed claims/subjects return NULL (expected attack surface);
--     infrastructure errors RAISE (loud deny that surfaces corruption)
--   * STABLE: safe for RLS evaluation; no data mutation; no link creation
-- ==========================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_claims jsonb;
    v_sub    text;
    v_linked uuid;
BEGIN
    -- 1) Read JWT claims GUC. Unset/empty => anonymous => NULL.
    BEGIN
        IF current_setting('request.jwt.claims', true) IS NULL THEN
            RETURN NULL;
        END IF;
        v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL;                       -- malformed claims JSON => deny
    END;

    IF v_claims IS NULL OR jsonb_typeof(v_claims) <> 'object' THEN
        RETURN NULL;
    END IF;

    v_sub := btrim(coalesce(v_claims ->> 'sub', ''));
    IF v_sub = '' THEN RETURN NULL; END IF; -- missing/empty subject => deny

    -- 2) WorkOS subjects: prefixed strings ('user_...'), resolve via bridge.
    IF left(v_sub, 5) = 'user_' THEN
        IF v_sub !~ '^user_[0-9A-Za-z]{10,}$' THEN
            RETURN NULL;                   -- malformed WorkOS id => deny
        END IF;

        BEGIN
            SELECT l.capflux_user_id INTO v_linked
              FROM public.user_identity_links l
             WHERE l.workos_user_id  = v_sub
               AND l.identity_type   = 'workos_authkit'
               AND l.status          = 'ACTIVE';  -- PENDING/REVOKED/etc => no row
        EXCEPTION
            WHEN no_data_found THEN RETURN NULL;   -- unknown / non-ACTIVE => deny
            WHEN too_many_rows THEN
                RAISE;   -- constraint corruption: loud deny, never pick "first"
        END;
        RETURN v_linked;                   -- FK guarantees the user exists
    END IF;

    -- 3) Native Supabase subjects: must be a valid UUID (dual-auth window).
    BEGIN
        RETURN v_sub::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN NULL;                       -- invalid UUID claim => deny
    END;
END;
$$;

COMMENT ON FUNCTION public.requesting_user_id() IS
  'Fail-closed JWT-subject -> canonical CAPFLUX uuid resolver. NULL means DENY. Never infers from email; never creates links; never mutates data.';

-- Narrow privilege boundary: only roles that evaluate RLS need EXECUTE.
REVOKE ALL ON FUNCTION public.requesting_user_id() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.requesting_user_id() TO authenticated, service_role;

COMMIT;
