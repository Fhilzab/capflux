-- ==========================================================
-- CAPFLUX — WorkOS AuthKit — Webhook Event Idempotency
-- Migration: 202608250001_workos_webhook_events.sql
--
-- Purpose: Persistent idempotency for WorkOS webhook events.
--
-- The WorkOS webhook endpoint receives events (user.created, user.updated,
 * user.deleted, session.revoked) that must be processed exactly once.
 * This table provides durable, database-backed idempotency to survive
 * process restarts, crashes, and horizontal scaling.
--
-- Design:
--   * WorkOS event ID (evt_...) is the natural unique key.
--   * Status tracks processing lifecycle: PENDING -> PROCESSING -> COMPLETED / FAILED.
--   * Retry count and last error support safe retries with backoff.
--   * created_at/updated_at for audit/debugging.
--   * Unique constraint on workos_event_id enforces idempotency at DB level.
--   * Status index supports operational queries.
--
-- Idempotency Protocol:
--   The workos_webhook_event_claim() function atomically claims an event for
--   processing. It returns a 'claimed' boolean indicating whether the caller
--   owns the processing right:
--     * claimed = true  -> caller owns the event, must process it
--     * claimed = false -> another request owns it or it's already done
--
-- Rollback: DROP TABLE IF EXISTS public.workos_webhook_events;
-- ==========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.workos_webhook_events (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workos_event_id  text NOT NULL
                     CHECK (workos_event_id ~ '^evt_[0-9A-Za-z]{10,}$'),
    event_type       text NOT NULL
                     CHECK (event_type IN ('user.created','user.updated','user.deleted','session.revoked')),
    status           text NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED')),
    attempts         integer NOT NULL DEFAULT 0,
    received_at      timestamptz NOT NULL DEFAULT now(),
    processed_at     timestamptz,
    failed_at        timestamptz,
    last_error       text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_wwe_workos_event_id UNIQUE (workos_event_id)
);

COMMENT ON TABLE  public.workos_webhook_events IS
  'Durable idempotency log for WorkOS webhook events. WorkOS event IDs are unique; only the first successful processing is recorded.';

COMMENT ON COLUMN public.workos_webhook_events.workos_event_id IS
  'WorkOS event ID (e.g., "evt_01EHWNC0FCBHZ3BJ7EGKYXK0E6"). Natural unique key for idempotency.';

COMMENT ON COLUMN public.workos_webhook_events.event_type IS
  'Type of WorkOS event: user.created, user.updated, user.deleted, session.revoked.';

COMMENT ON COLUMN public.workos_webhook_events.status IS
  'Processing lifecycle: PENDING (received), PROCESSING (handler running), COMPLETED (success), FAILED (retryable error).';

COMMENT ON COLUMN public.workos_webhook_events.attempts IS
  'Number of processing attempts. Incremented exactly once per processing claim.';

COMMENT ON COLUMN public.workos_webhook_events.last_error IS
  'Last error message on failure. Cleared on success.';

-- Unique constraint on workos_event_id enforces idempotency at the database level.
-- Already created via UNIQUE constraint on column.

-- Index for operational queries
CREATE INDEX IF NOT EXISTS idx_wwe_status ON public.workos_webhook_events (status);
CREATE INDEX IF NOT EXISTS idx_wwe_received_at ON public.workos_webhook_events (received_at DESC);

-- Keep updated_at fresh using existing project trigger function
DROP TRIGGER IF EXISTS trg_wwe_updated_at ON public.workos_webhook_events;
CREATE TRIGGER trg_wwe_updated_at
    BEFORE UPDATE ON public.workos_webhook_events
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- RLS: Deny by default, service-role only
ALTER TABLE public.workos_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workos_webhook_events FROM anon, authenticated;

-- Helper function for idempotent event processing
-- Returns a row with 'claimed' boolean indicating whether the caller owns processing
CREATE OR REPLACE FUNCTION public.workos_webhook_event_claim(
    p_workos_event_id TEXT,
    p_event_type TEXT
) RETURNS TABLE (
    id UUID,
    workos_event_id TEXT,
    event_type TEXT,
    status TEXT,
    attempts INTEGER,
    claimed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_result RECORD;
BEGIN
    -- Attempt to insert a new event record with PROCESSING status
    -- The unique constraint on workos_event_id ensures atomic claim
    BEGIN
        INSERT INTO public.workos_webhook_events (workos_event_id, event_type, status)
        VALUES (p_workos_event_id, p_event_type, 'PROCESSING')
        RETURNING id, workos_event_id, event_type, status, attempts, true AS claimed
        INTO STRICT v_result;
        RETURN QUERY SELECT v_result;
        RETURN;
    EXCEPTION
        WHEN unique_violation THEN
            -- Event already exists, fetch current state
            SELECT id, workos_event_id, event_type, status, attempts
            INTO STRICT v_result
            FROM public.workos_webhook_events
            WHERE workos_event_id = p_workos_event_id;

            IF v_result.status = 'COMPLETED' THEN
                -- Already successfully processed
                RETURN QUERY SELECT v_result.id, v_result.workos_event_id, v_result.event_type, v_result.status, v_result.attempts, false AS claimed;
            ELSIF v_result.status = 'PROCESSING' THEN
                -- Another request is currently processing this event
                RETURN QUERY SELECT v_result.id, v_result.workos_event_id, v_result.event_type, v_result.status, v_result.attempts, false AS claimed;
            ELSIF v_result.status = 'FAILED' THEN
                -- Failed event can be retried - increment attempts and claim ownership
                UPDATE public.workos_webhook_events
                SET status = 'PROCESSING',
                    attempts = attempts + 1,
                    last_error = NULL,
                    updated_at = now()
                WHERE id = v_result.id
                RETURNING id, workos_event_id, event_type, status, attempts, true AS claimed
                INTO STRICT v_result;
                RETURN QUERY SELECT v_result;
            ELSIF v_result.status = 'PENDING' THEN
                -- Should not happen (pending means not yet processing), but handle it
                UPDATE public.workos_webhook_events
                SET status = 'PROCESSING',
                    updated_at = now()
                WHERE id = v_result.id
                RETURNING id, workos_event_id, event_type, status, attempts, true AS claimed
                INTO STRICT v_result;
                RETURN QUERY SELECT v_result;
            END IF;
            RETURN;
    END;
END;
$$;

-- Helper function to mark event as completed
CREATE OR REPLACE FUNCTION public.workos_webhook_event_complete(
    p_workos_event_id TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.workos_webhook_events
    SET status = 'COMPLETED',
        processed_at = now(),
        last_error = NULL,
        updated_at = now()
    WHERE workos_event_id = p_workos_event_id;
END;
$$;

-- Helper function to mark event as failed
CREATE OR REPLACE FUNCTION public.workos_webhook_event_fail(
    p_workos_event_id TEXT,
    p_error TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.workos_webhook_events
    SET status = 'FAILED',
        failed_at = now(),
        last_error = p_error,
        attempts = attempts + 1,
        updated_at = now()
    WHERE workos_event_id = p_workos_event_id;
END;
$$;

-- Explicitly restrict execution privileges for SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.workos_webhook_event_claim(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.workos_webhook_event_complete(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.workos_webhook_event_fail(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workos_webhook_event_claim(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.workos_webhook_event_complete(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.workos_webhook_event_fail(TEXT, TEXT) TO service_role;

COMMIT;