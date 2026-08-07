-- ==========================================================
-- CAPFLUX — FHILZAB NIG LTD
-- Migration: 202607100008_payment_routing.sql
-- Purpose: Payment gateway configuration, Dedicated Virtual Account (DVA)
--          management, and immutable payment transaction log.
--
-- IMPORTANT: Gateway credentials (api_key/secret_key) are CAPFLUX
-- infrastructure secrets and are NOT stored per school in production.
-- `payment_gateway_config` describes WHICH internally-assigned provider a
-- school is routed to. Credentials live in CAPFLUX server environment.
-- The legacy api_key/secret_key columns are retained for migration
-- compatibility but must never be populated for new schools.
-- ==========================================================

BEGIN;

-- ==========================================================
-- Extend ledger_entry_category enum to include PLATFORM_FEE
-- ==========================================================

ALTER TYPE ledger_entry_category ADD VALUE IF NOT EXISTS 'PLATFORM_FEE';

-- ==========================================================
-- Payment Gateway Configuration (Per-School Sub-merchant Setup)
-- Each school is routed to an internally-assigned provider.
-- Schools NEVER select Paystack/Monnify and NEVER read credentials.
-- ==========================================================

CREATE TABLE IF NOT EXISTS payment_gateway_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('monnify', 'flutterwave', 'remita')),
    -- CAPFLUX-infrastructure secrets: must be NULL for all new rows.
    -- Populated only for legacy seeded rows during migration; not exposed to tenants.
    api_key TEXT,
    secret_key TEXT,
    submerchant_code TEXT,
    settlement_account_number TEXT NOT NULL,
    settlement_account_bank TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (school_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_payment_gateway_config_school ON payment_gateway_config (school_id);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_config_provider ON payment_gateway_config (provider);

-- ==========================================================
-- Dedicated Virtual Account (DVA) Assignments
-- Maps DVA account numbers to students
-- ==========================================================

CREATE TABLE IF NOT EXISTS dva_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('monnify', 'flutterwave', 'remita')),
    dva_account_number TEXT NOT NULL,
    dva_bank_name TEXT NOT NULL,
    dva_account_name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (school_id, dva_account_number),
    UNIQUE (student_id)
);

CREATE INDEX IF NOT EXISTS idx_dva_assignments_school ON dva_assignments (school_id);
CREATE INDEX IF NOT EXISTS idx_dva_assignments_student ON dva_assignments (student_id);
CREATE INDEX IF NOT EXISTS idx_dva_assignments_provider ON dva_assignments (provider);

-- ==========================================================
-- Payment Transactions (Immutable Webhook Log)
-- Stores verified transaction references for idempotency
-- ==========================================================

CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students (id) ON DELETE RESTRICT,
    gateway_txn_ref TEXT NOT NULL,
    reference TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    entry_category TEXT NOT NULL CHECK (entry_category IN ('TUITION', 'TECH_LEVY', 'PLATFORM_FEE')),
    settlement_status TEXT NOT NULL CHECK (settlement_status IN ('PENDING', 'SUCCESS', 'FAILED')),
    verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key TEXT,
    CONSTRAINT chk_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_school ON payment_transactions (school_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference ON payment_transactions (reference);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_gateway_ref ON payment_transactions (gateway_txn_ref);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_settlement ON payment_transactions (settlement_status);
CREATE UNIQUE INDEX IF NOT EXISTS unique_transaction_reference ON payment_transactions (reference);
-- Ledger/payment idempotency: a gateway event with the same idempotency key
-- must never create a duplicate payment record.
CREATE UNIQUE INDEX IF NOT EXISTS unique_transaction_idempotency_key ON payment_transactions (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ==========================================================
-- Settlement Records
-- Tracks split settlement details from gateway webhooks
-- ==========================================================

CREATE TABLE IF NOT EXISTS settlement_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_transaction_id UUID NOT NULL REFERENCES payment_transactions (id) ON DELETE CASCADE,
    destination TEXT NOT NULL CHECK (destination IN ('school', 'capflux')),
    account_number TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    settled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    raw_response JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_settlement_records_transaction ON settlement_records (payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_settlement_records_destination ON settlement_records (destination);

-- ==========================================================
-- RLS Policies for Payment Tables
-- ==========================================================

ALTER TABLE payment_gateway_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE dva_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_authenticated_payment_gateway_config ON payment_gateway_config
    FOR SELECT, INSERT, UPDATE
    USING (current_school_id() = payment_gateway_config.school_id)
    WITH CHECK (current_school_id() = payment_gateway_config.school_id);

CREATE POLICY allow_authenticated_dva_assignments ON dva_assignments
    FOR SELECT, INSERT, UPDATE
    USING (current_school_id() = dva_assignments.school_id)
    WITH CHECK (current_school_id() = dva_assignments.school_id);

CREATE POLICY allow_authenticated_payment_transactions ON payment_transactions
    FOR SELECT, INSERT
    USING (current_school_id() = payment_transactions.school_id)
    WITH CHECK (current_school_id() = payment_transactions.school_id);

CREATE POLICY allow_authenticated_settlement_records ON settlement_records
    FOR SELECT, INSERT
    USING (
        current_school_id() = (
            SELECT school_id FROM payment_transactions WHERE id = settlement_records.payment_transaction_id
        )
    )
    WITH CHECK (
        current_school_id() = (
            SELECT school_id FROM payment_transactions WHERE id = settlement_records.payment_transaction_id
        )
    );

-- ==========================================================
-- Helper Functions
-- ==========================================================

-- DEPRECATED (legacy DVA flow). New code uses payment_accounts directly.
CREATE OR REPLACE FUNCTION provision_dva_for_student(
    p_school_id UUID,
    p_student_id UUID,
    p_provider TEXT,
    p_dva_number TEXT,
    p_dva_bank TEXT,
    p_dva_name TEXT,
    p_config_id UUID
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    v_dva_id UUID;
BEGIN
    -- Insert or update DVA assignment
    INSERT INTO dva_assignments (
        id, school_id, student_id, provider,
        dva_account_number, dva_bank_name, dva_account_name,
        is_active, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), p_school_id, p_student_id, p_provider,
        p_dva_number, p_dva_bank, p_dva_name,
        true, now(), now()
    ) ON CONFLICT (student_id) DO UPDATE SET
        dva_account_number = p_dva_number,
        dva_bank_name = p_dva_bank,
        dva_account_name = p_dva_name,
        is_active = true,
        updated_at = now()
    RETURNING id INTO v_dva_id;

    RETURN jsonb_build_object(
        'success', true,
        'dva_id', v_dva_id,
        'dva_account_number', p_dva_number,
        'provider', p_provider
    );
END;
$$;

COMMIT;