-- ==========================================================
-- CAPFLUX — WorkOS AuthKit — Finalize WorkOS Event ID Constraint
-- Migration: 202608270003_finalize_workos_event_id_constraint.sql
--
-- Purpose: Replace the prefix-dependent event-ID constraint with a
-- provider-neutral length-based constraint.
--
-- Root Cause:
--   Previous migrations incorrectly assumed WorkOS event IDs begin with
--   "evt_" and used prefix-based validation. Real WorkOS event IDs use
--   various formats (e.g., "event_..."). The database must not couple
--   its integrity constraints to a specific provider's ID format.
--
-- Solution:
--   Replace the prefix-based CHECK constraint with a minimal, provider-
--   neutral validation: non-empty string with reasonable maximum length.
--   The unique constraint on workos_event_id remains the authoritative
--   uniqueness guarantee.
--
-- Safety:
--   * Preserves existing table and all existing event records
--   * Preserves unique constraint on workos_event_id (uq_wwe_workos_event_id)
--   * Preserves RLS policies
--   * Preserves existing idempotency RPCs
--   * Preserves SECURITY DEFINER functions
--   * Preserves service_role execution restrictions
--
-- Rollback: ALTER TABLE public.workos_webhook_events DROP CONSTRAINT IF EXISTS workos_webhook_events_workos_event_id_check;
--           ALTER TABLE public.workos_webhook_events ADD CONSTRAINT workos_webhook_events_workos_event_id_check
--             CHECK (workos_event_id LIKE 'evt_%' AND length(workos_event_id) > 4);
-- ==========================================================

BEGIN;

-- Drop the existing prefix-dependent CHECK constraint
ALTER TABLE public.workos_webhook_events
    DROP CONSTRAINT IF EXISTS workos_webhook_events_workos_event_id_check;

-- Add a provider-neutral length constraint
--   * Non-empty (length >= 1)
--   * Reasonable maximum length (255 chars)
--   * No prefix assumptions
ALTER TABLE public.workos_webhook_events
    ADD CONSTRAINT workos_webhook_events_workos_event_id_check
    CHECK (char_length(workos_event_id) BETWEEN 1 AND 255);

COMMENT ON CONSTRAINT workos_webhook_events_workos_event_id_check
    ON public.workos_webhook_events IS
    'Ensures WorkOS event ID is non-empty and has reasonable length. Does not assume any specific prefix or format.';

COMMIT;