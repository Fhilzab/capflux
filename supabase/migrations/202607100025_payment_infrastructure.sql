-- ==========================================================
-- CAPFLUX — FHILZAB NIG LTD
-- Migration: 202607100025_payment_infrastructure.sql
-- Purpose: Production Payment Infrastructure reconciliation.
--
-- Builds on 0008/0012/0016/0023/0024. Establishes the canonical payment
-- runtime without rewriting constitutional migrations:
--   1. payment_accounts: add idempotency key + DVA lifecycle status
--      (PENDING/PROVISIONING/ACTIVE/FAILED/DISABLED) + unique provider ref.
--   2. payment_transactions: add canonical payment state machine
--      (PENDING/PROCESSING/SUCCESS/FAILED/REVERSED) + amount_minor + provider
--      event id uniqueness (webhook idempotency beyond reference).
--   3. Atomic payment + ledger posting RPC (record_verified_payment).
--   4. reconciliation_runs + reconciliation_issues tracking.
--   5. settlement tracking on top of verified settlement_accounts.
--   6. Constraints/indexes for tenant isolation and idempotency.
-- ==========================================================

BEGIN;

-- ==========================================================
-- 1. PAYMENT_ACCOUNTS — DVA lifecycle + idempotency
-- ==========================================================

-- Canonical DVA lifecycle status.
DO $$ BEGIN
    CREATE TYPE dva_status AS ENUM (
        'PENDING',       -- intent created
        'PROVISIONING',  -- gateway call in flight
        'ACTIVE',        -- provisioned, ready to receive
        'FAILED',        -- provisioning failed
        'DISABLED'       -- deactivated
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE payment_accounts
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
    ADD COLUMN IF NOT EXISTS status dva_status NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS provisioning_error TEXT,
    ADD COLUMN IF NOT EXISTS provider_event_ref TEXT;

-- A retried provision request must never create a second row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_accounts_idempotency
    ON payment_accounts (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- A provider account/reference must be globally unique (protects against
-- gateway-succeeded-but-db-write-failed retries discovering a duplicate).
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_accounts_provider_ref
    ON payment_accounts (provider, provider_account_id)
    WHERE provider IS NOT NULL AND provider_account_id IS NOT NULL;

-- Index for status-driven queries.
CREATE INDEX IF NOT EXISTS idx_payment_accounts_status
    ON payment_accounts (status);

-- ==========================================================
-- 2. PAYMENT_TRANSACTIONS — payment state machine + minor units
-- ==========================================================

DO $$ BEGIN
    CREATE TYPE payment_txn_status AS ENUM (
        'PENDING',
        'PROCESSING',
        'SUCCESS',
        'FAILED',
        'REVERSED'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE payment_transactions
    ADD COLUMN IF NOT EXISTS status payment_txn_status NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS amount_minor BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'NGN',
    ADD COLUMN IF NOT EXISTS provider_event_id TEXT,
    ADD COLUMN IF NOT EXISTS payment_method TEXT,
    ADD COLUMN IF NOT EXISTS failure_reason TEXT,
    ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Backfill amount_minor from existing amount (naira -> kobo).
UPDATE payment_transactions
SET amount_minor = (amount * 100)::BIGINT
WHERE amount_minor = 0;

-- Webhook idempotency: one provider event per payment transaction.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_transactions_provider_event
    ON payment_transactions (provider_event_id) WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_status
    ON payment_transactions (status);

-- ==========================================================
-- 3. ATOMIC PAYMENT + LEDGER POSTING RPC
-- ==========================================================
-- A verified payment produces EXACTLY ONE payment_transactions row AND EXACTLY
-- ONE CREDIT ledger entry, atomically. Idempotent via idempotency_key on both
-- tables. Never callable by clients (only the backend webhook/reconciliation
-- path invokes it with the service-role client).
CREATE OR REPLACE FUNCTION public.record_verified_payment(
    p_school_id UUID,
    p_student_id UUID,
    p_reference TEXT,
    p_gateway_txn_ref TEXT,
    p_provider_event_id TEXT,
    p_amount_minor BIGINT,
    p_entry_category TEXT DEFAULT 'TUITION',
    p_currency TEXT DEFAULT 'NGN',
    p_payment_method TEXT DEFAULT NULL,
    p_raw_payload JSONB DEFAULT '{}'::jsonb,
    p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_payment_id UUID;
    v_ledger_id UUID;
    v_ledger_meta JSONB;
BEGIN
    -- Idempotency: if the payment already exists, return it.
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_payment_id FROM payment_transactions
        WHERE idempotency_key = p_idempotency_key;
        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true, 'already_processed', true,
                'payment_transaction_id', v_payment_id
            );
        END IF;
    END IF;

    -- Insert the verified payment (status SUCCESS).
    INSERT INTO payment_transactions (
        school_id, student_id, gateway_txn_ref, reference, provider_event_id,
        amount, amount_minor, currency, entry_category, settlement_status,
        status, payment_method, raw_payload, idempotency_key, verified_at
    ) VALUES (
        p_school_id, p_student_id, p_gateway_txn_ref, p_reference, p_provider_event_id,
        (p_amount_minor / 100.0), p_amount_minor, p_currency, p_entry_category,
        'SUCCESS', 'SUCCESS', p_payment_method, p_raw_payload, p_idempotency_key, now()
    ) RETURNING id INTO v_payment_id;

    -- Insert the corresponding CREDIT ledger entry (append-only).
    v_ledger_meta := jsonb_build_object(
        'gateway_reference', p_reference,
        'gateway_txn_ref', p_gateway_txn_ref,
        'payment_transaction_id', v_payment_id,
        'provider_event_id', p_provider_event_id
    );

    INSERT INTO ledger_entries (
        school_id, student_id, amount, entry_type, entry_category,
        reference_id, metadata, client_sequence, device_id, created_at,
        idempotency_key, source_document_type, source_document_id
    ) VALUES (
        p_school_id, p_student_id, (p_amount_minor / 100.0), 'CREDIT',
        p_entry_category, v_payment_id, v_ledger_meta,
        0, 'payment-webhook', now(),
        COALESCE(p_idempotency_key, 'ledger:pay:' || p_reference),
        'PAYMENT', p_reference
    ) RETURNING id INTO v_ledger_id;

    RETURN jsonb_build_object(
        'success', true, 'already_processed', false,
        'payment_transaction_id', v_payment_id,
        'ledger_entry_id', v_ledger_id
    );
EXCEPTION
    WHEN unique_violation THEN
        -- A concurrent retry won the race; return the existing record.
        IF p_idempotency_key IS NOT NULL THEN
            SELECT id INTO v_payment_id FROM payment_transactions
            WHERE idempotency_key = p_idempotency_key;
            IF FOUND THEN
                RETURN jsonb_build_object(
                    'success', true, 'already_processed', true,
                    'payment_transaction_id', v_payment_id
                );
            END IF;
        END IF;
        RAISE;
END;
$$;

-- ==========================================================
-- 4. RECONCILIATION TRACKING
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.reconciliation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'RUNNING'
        CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_school
    ON public.reconciliation_runs (school_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.reconciliation_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_run_id UUID NOT NULL REFERENCES public.reconciliation_runs(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    issue_type TEXT NOT NULL
        CHECK (issue_type IN (
            'DUPLICATE_TRANSACTION',
            'MISSING_PAYMENT',
            'MISSING_LEDGER',
            'AMOUNT_MISMATCH',
            'UNKNOWN_PROVIDER_TRANSACTION',
            'INCORRECT_DVA',
            'WRONG_SCHOOL',
            'UNEXPECTED_STATUS'
        )),
    status TEXT NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN', 'RESOLVED')),
    reference TEXT,
    amount_minor BIGINT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_issues_school
    ON public.reconciliation_issues (school_id, status);
CREATE INDEX IF NOT EXISTS idx_reconciliation_issues_run
    ON public.reconciliation_issues (reconciliation_run_id);

-- ==========================================================
-- 5. SETTLEMENT TRACKING (on verified settlement_accounts)
-- ==========================================================

ALTER TABLE public.settlement_records
    ADD COLUMN IF NOT EXISTS settlement_account_id UUID
        REFERENCES public.settlement_accounts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
    ADD COLUMN IF NOT EXISTS failure_reason TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_settlement_records_idempotency
    ON public.settlement_records (idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_settlement_records_status
    ON public.settlement_records (status);

-- ==========================================================
-- 6. TENANT ISOLATION / AUDIT INDEXES
-- ==========================================================

CREATE INDEX IF NOT EXISTS idx_payment_transactions_student
    ON payment_transactions (student_id, verified_at DESC);

COMMIT;
