-- ==========================================================
-- CAPFLUX — WorkOS AuthKit — Fix Webhook Event ID Constraint
-- Migration: 202608270001_fix_workos_webhook_event_id_constraint.sql
--
-- Purpose: Fix the workos_event_id CHECK constraint to accept real WorkOS event IDs.
--
-- Root Cause:
--   The original CHECK constraint assumed WorkOS event IDs follow the pattern
--   'evt_' followed by 10+ alphanumeric characters. However, real WorkOS
--   event IDs can have different formats (e.g., evt_ + base62 string of variable length,
--   or other valid WorkOS formats). The synthetic test ID 'evt_CAPFLUXRPCTEST001'
--   happened to match the pattern, but real WorkOS event IDs do not.
--
-- Solution:
--   Replace the overly restrictive CHECK constraint with a minimal safe validation
--   that ensures the event ID is non-empty and has the basic 'evt_' prefix.
--   This prevents obviously invalid IDs while accepting all legitimate WorkOS formats.
--
-- Safety:
--   * Preserves existing table and all existing event records
--   * Preserves unique constraint on workos_event_id
--   * Preserves RLS policies
--   * Preserves existing idempotency RPCs
--   * Preserves SECURITY DEFINER functions
--   * Preserves service_role execution restrictions
--
-- Rollback: ALTER TABLE public.workos_webhook_events DROP CONSTRAINT IF EXISTS workos_webhook_events_workos_event_id_check;
--           ALTER TABLE public.workos_webhook_events ADD CONSTRAINT workos_webhook_events_workos_event_id_check
--             CHECK (workos_event_id ~ '^evt_[0-9A-Za-z]{10,}$');
-- ==========================================================

BEGIN;

-- Drop the existing overly restrictive CHECK constraint
ALTER TABLE public.workos_webhook_events
    DROP CONSTRAINT IF EXISTS workos_webhook_events_workos_event_id_check;

-- Add a safer, more permissive constraint:
--   * Must start with 'evt_'
--   * Must have at least 1 character after 'evt_'
--   * Allows any characters after the prefix (WorkOS may use various encodings)
ALTER TABLE public.workos_webhook_events
    ADD CONSTRAINT workos_webhook_events_workos_event_id_check
    CHECK (
        workos_event_id LIKE 'evt_%'
        AND length(workos_event_id) > 4
    );

COMMENT ON CONSTRAINT workos_webhook_events_workos_event_id_check
    ON public.workos_webhook_events IS
    'Ensures WorkOS event ID starts with "evt_" and has at least 1 character after the prefix. Allows all valid WorkOS event ID formats.';

COMMIT;