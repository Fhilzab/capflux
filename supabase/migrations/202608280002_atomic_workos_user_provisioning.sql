-- ==========================================================
-- CAPFLUX — WorkOS AuthKit — Atomic User Provisioning RPC
-- Migration: 202608280002_atomic_workos_user_provisioning.sql
--
-- Purpose: Provide a single atomic operation to provision a new CAPFLUX user
--          from a WorkOS identity, creating the user, profile, and identity
--          link in one transaction.
--
-- Design:
--   * SECURITY DEFINER with restricted search_path
--   * All-or-nothing: either all three tables get rows, or none do
--   * Prevents orphaned users under concurrent provisioning
--   * Preserves existing ACTIVE identity (never overwrites capflux_user_id)
--   * Blocks REVOKED identity resurrection
--   * Only callable by service_role
--   * Validates inputs before writing
--
-- Concurrency:
--   * Uses advisory lock on WorkOS user ID to serialize provisioning
--   * Checks for existing identity BEFORE creating users
--   * UNIQUE constraints remain the ultimate guard
--
-- Rollback: DROP FUNCTION IF EXISTS public.provision_workos_user(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT);
-- ==========================================================

BEGIN;

-- Atomic provisioning function for WorkOS user identity
-- Returns the capflux_user_id (UUID) on success, or raises an exception on failure
CREATE OR REPLACE FUNCTION public.provision_workos_user(
    p_workos_user_id TEXT,
    p_email TEXT,
    p_first_name TEXT,
    p_last_name TEXT,
    p_email_verified BOOLEAN,
    p_profile_picture_url TEXT DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_capflux_user_id uuid;
    v_full_name TEXT;
    v_identity_id uuid;
    v_lock_key bigint;
BEGIN
    -- Validate WorkOS user ID format
    IF p_workos_user_id IS NULL OR p_workos_user_id !~ '^user_[0-9A-Za-z]{10,}$' THEN
        RAISE EXCEPTION 'Invalid WorkOS user ID format: %', p_workos_user_id
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- Validate email
    IF p_email IS NULL OR p_email = '' THEN
        RAISE EXCEPTION 'Email is required'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- Derive a deterministic advisory lock key from the WorkOS user ID
    -- This serializes concurrent provisioning for the same WorkOS identity
    v_lock_key := ('x' || substr(md5(p_workos_user_id), 1, 15))::bit(60)::bigint;

    -- Acquire session-level advisory lock (blocks other sessions for same WorkOS ID)
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Check for existing identity link BEFORE creating any user rows
    -- This prevents orphaned users under race conditions
    SELECT capflux_user_id INTO v_capflux_user_id
    FROM public.user_identity_links
    WHERE workos_user_id = p_workos_user_id
      AND identity_type = 'workos_authkit'
      AND status = 'ACTIVE'
    FOR SHARE;  -- Lock the row to prevent concurrent modification

    IF v_capflux_user_id IS NOT NULL THEN
        -- Existing ACTIVE identity found - return it, optionally sync profile data
        -- Update user/profile to match current WorkOS state (idempotent)
        UPDATE public.users
        SET email = p_email,
            email_verified = p_email_verified,
            auth_provider = 'workos',
            updated_at = now()
        WHERE id = v_capflux_user_id;

        v_full_name := TRIM(COALESCE(p_first_name, '') || ' ' || COALESCE(p_last_name, ''));
        IF v_full_name = '' THEN
            v_full_name := NULL;
        END IF;

        UPDATE public.user_profiles
        SET full_name = v_full_name,
            avatar_url = p_profile_picture_url,
            updated_at = now()
        WHERE user_id = v_capflux_user_id;

        RETURN v_capflux_user_id;
    END IF;

    -- Check for REVOKED link - revoked identities cannot be resurrected
    IF EXISTS (
        SELECT 1 FROM public.user_identity_links
        WHERE workos_user_id = p_workos_user_id
          AND identity_type = 'workos_authkit'
          AND status = 'REVOKED'
    ) THEN
        RAISE EXCEPTION 'WorkOS identity % has been revoked and cannot be resurrected', p_workos_user_id
            USING ERRCODE = 'check_violation';
    END IF;

    -- No existing identity - generate new canonical UUID and provision
    SELECT gen_random_uuid() INTO v_capflux_user_id;

    -- Build full name
    v_full_name := TRIM(COALESCE(p_first_name, '') || ' ' || COALESCE(p_last_name, ''));
    IF v_full_name = '' THEN
        v_full_name := NULL;
    END IF;

    -- Begin atomic provisioning (all in one transaction)
    -- 1. Create the canonical user record
    INSERT INTO public.users (id, email, auth_provider, email_verified, created_at, updated_at)
    VALUES (v_capflux_user_id, p_email, 'workos', p_email_verified, now(), now());

    -- 2. Create the user profile
    INSERT INTO public.user_profiles (user_id, full_name, avatar_url, created_at, updated_at)
    VALUES (v_capflux_user_id, v_full_name, p_profile_picture_url, now(), now());

    -- 3. Create the identity link (ACTIVE status)
    -- This FK-constrained insert happens after users row exists
    INSERT INTO public.user_identity_links (
        capflux_user_id,
        workos_user_id,
        identity_type,
        status,
        migration_source,
        verified_at,
        created_at,
        updated_at
    )
    VALUES (
        v_capflux_user_id,
        p_workos_user_id,
        'workos_authkit',
        'ACTIVE',
        'WEBHOOK',
        now(),
        now(),
        now()
    )
    RETURNING id INTO v_identity_id;

    RETURN v_capflux_user_id;

EXCEPTION
    WHEN unique_violation THEN
        -- Handle any unique constraint violation (email, capflux_user_id, or identity link)
        -- Check if another transaction already created the identity
        SELECT capflux_user_id INTO v_capflux_user_id
        FROM public.user_identity_links
        WHERE workos_user_id = p_workos_user_id
          AND identity_type = 'workos_authkit'
          AND status = 'ACTIVE';

        IF v_capflux_user_id IS NOT NULL THEN
            -- Another transaction succeeded - return the existing UUID
            RETURN v_capflux_user_id;
        END IF;

        -- Re-raise with context if we can't resolve
        RAISE EXCEPTION 'Failed to provision WorkOS user %: unique constraint violation', p_workos_user_id
            USING ERRCODE = 'unique_violation';
    WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'Failed to provision WorkOS user %: foreign key violation', p_workos_user_id
            USING ERRCODE = 'foreign_key_violation';
    WHEN check_violation THEN
        RAISE EXCEPTION 'Failed to provision WorkOS user %: check constraint violation', p_workos_user_id
            USING ERRCODE = 'check_violation';
END;
$$;

COMMENT ON FUNCTION public.provision_workos_user(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) IS
  'Atomically provisions a CAPFLUX user from WorkOS identity. Creates users, user_profiles, and user_identity_links in a single transaction. Uses advisory lock to prevent orphaned users under concurrency. Preserves existing ACTIVE identity. Blocks REVOKED identity resurrection. Returns the canonical CAPFLUX UUID. Only callable by service_role.';

-- Restrict execution to service_role only
REVOKE ALL ON FUNCTION public.provision_workos_user(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_workos_user(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO service_role;

COMMIT;