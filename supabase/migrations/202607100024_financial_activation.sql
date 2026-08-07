-- ==========================================================
-- CAPFLUX — FHILZAB NIG LTD
-- Migration: 202607100024_financial_activation.sql
-- Purpose: Financial Activation & Payment Readiness foundation.
--
-- Extends the existing repaired chain (0001-0023). Adds ONLY the structures
-- missing for the financial activation pipeline:
--   1. kyc_records: CAC document metadata columns (private storage).
--   2. settlement_accounts: school settlement accounts (masked in APIs).
--   3. settlement_account_verifications: idempotent verification history.
--   4. gateway_assignments: CAPFLUX-internal gateway assignment per school.
--   5. kyc_verifications: per-verification record (NIN/BVN/CAC) + provider refs.
--   6. RBAC permissions for staff review / settlement / gateway / activation.
--   7. activate_payments() SECURITY DEFINER RPC: the ONLY backend path that
--      may set payment_status = 'READY'.
-- ==========================================================

BEGIN;

-- ==========================================================
-- 1. EXTEND KYC_RECORDS — CAC document metadata
-- CAC certificate is stored in PRIVATE object storage; never binary in PG.
-- ==========================================================

ALTER TABLE public.kyc_records
    ADD COLUMN IF NOT EXISTS cac_document_path TEXT,
    ADD COLUMN IF NOT EXISTS cac_document_mime_type TEXT,
    ADD COLUMN IF NOT EXISTS cac_document_file_size BIGINT,
    ADD COLUMN IF NOT EXISTS cac_document_checksum TEXT,
    ADD COLUMN IF NOT EXISTS cac_document_uploaded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cac_document_status kyc_status DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS cac_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cac_verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS identity_verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- ==========================================================
-- 2. SETTLEMENT ACCOUNTS
-- One active settlement account per school.
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.settlement_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    bank_code TEXT NOT NULL,
    bank_name TEXT,
    account_number TEXT NOT NULL,               -- full number stored server-side
    account_name TEXT,                           -- name returned by verification provider
    status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION'
        CHECK (status IN ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED')),
    submitted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settlement_accounts_school
    ON public.settlement_accounts (school_id);
CREATE INDEX IF NOT EXISTS idx_settlement_accounts_status
    ON public.settlement_accounts (status);

-- One active settlement account per school.
CREATE UNIQUE INDEX IF NOT EXISTS uq_settlement_accounts_one_active
    ON public.settlement_accounts (school_id)
    WHERE status IN ('PENDING_VERIFICATION', 'VERIFIED');

-- ==========================================================
-- 3. SETTLEMENT ACCOUNT VERIFICATIONS (idempotent history)
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.settlement_account_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_account_id UUID NOT NULL REFERENCES public.settlement_accounts(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_reference TEXT,
    account_number_last4 TEXT NOT NULL,
    account_name_returned TEXT,
    status TEXT NOT NULL CHECK (status IN ('VERIFIED', 'FAILED')),
    failure_reason TEXT,
    idempotency_key TEXT,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settlement_verifications_account
    ON public.settlement_account_verifications (settlement_account_id);
CREATE INDEX IF NOT EXISTS idx_settlement_verifications_school
    ON public.settlement_account_verifications (school_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_settlement_verifications_idempotency
    ON public.settlement_account_verifications (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- ==========================================================
-- 4. GATEWAY ASSIGNMENTS (CAPFLUX-internal)
-- Schools NEVER select a gateway. CAPFLUX assigns one server-side.
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.gateway_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('paystack', 'monnify')),
    status TEXT NOT NULL DEFAULT 'ASSIGNED'
        CHECK (status IN ('ASSIGNED', 'ACTIVE', 'DISABLED')),
    assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT,
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gateway_assignments_school
    ON public.gateway_assignments (school_id);
CREATE INDEX IF NOT EXISTS idx_gateway_assignments_provider
    ON public.gateway_assignments (provider);

-- One active gateway assignment per school.
CREATE UNIQUE INDEX IF NOT EXISTS uq_gateway_assignments_one_active
    ON public.gateway_assignments (school_id)
    WHERE status IN ('ASSIGNED', 'ACTIVE');

CREATE UNIQUE INDEX IF NOT EXISTS uq_gateway_assignments_idempotency
    ON public.gateway_assignments (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- ==========================================================
-- 5. KYC VERIFICATIONS (identity + CAC verification history)
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.kyc_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kyc_record_id UUID NOT NULL REFERENCES public.kyc_records(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    verification_type TEXT NOT NULL
        CHECK (verification_type IN ('NIN', 'BVN', 'CAC')),
    provider TEXT,
    provider_reference TEXT,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'VERIFIED', 'FAILED')),
    failure_reason TEXT,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    idempotency_key TEXT,
    raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_verifications_record
    ON public.kyc_verifications (kyc_record_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_school
    ON public.kyc_verifications (school_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_type_status
    ON public.kyc_verifications (verification_type, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_kyc_verifications_idempotency
    ON public.kyc_verifications (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- ==========================================================
-- 6. RBAC PERMISSIONS (financial activation staff operations)
-- Canonical plural convention. SUPER_ADMIN and OWNER mappings below.
-- ==========================================================

INSERT INTO public.permissions (code, description, resource, action) VALUES
    ('kyc.view', 'View KYC records', 'kyc', 'view'),
    ('kyc.review', 'Review KYC records', 'kyc', 'review'),
    ('kyc.verify', 'Verify KYC records', 'kyc', 'verify'),
    ('kyc.reject', 'Reject KYC records', 'kyc', 'reject'),
    ('identity.verify', 'Verify NIN/BVN identity', 'identity', 'verify'),
    ('settlement.view', 'View settlement accounts', 'settlement', 'view'),
    ('settlement.verify', 'Verify settlement accounts', 'settlement', 'verify'),
    ('gateway.assign', 'Assign payment gateway', 'gateway', 'assign'),
    ('payment.activate', 'Activate payment readiness', 'payment', 'activate')
ON CONFLICT (code) DO NOTHING;

-- SUPER_ADMIN receives all new permissions (their role already has all existing ones).
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
    'kyc.view', 'kyc.review', 'kyc.verify', 'kyc.reject',
    'identity.verify', 'settlement.view', 'settlement.verify',
    'gateway.assign', 'payment.activate'
)
WHERE r.system_role = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

-- OWNER (school user): view-only KYC + settlement view (cannot self-approve).
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN ('kyc.view', 'settlement.view')
WHERE r.system_role = 'OWNER'
ON CONFLICT DO NOTHING;

-- ==========================================================
-- 7. ACTIVATE PAYMENTS RPC
-- The ONLY backend path that may set payment_status = 'READY'.
-- All conditions are enforced server-side; idempotent.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.activate_payments(p_school_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_school RECORD;
    v_kyc RECORD;
    v_settlement RECORD;
    v_gateway RECORD;
BEGIN
    SELECT status, payment_status INTO v_school
    FROM public.schools WHERE id = p_school_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'School not found';
    END IF;

    -- Idempotent: already READY is a success, not an error.
    IF v_school.payment_status = 'READY' THEN
        RETURN jsonb_build_object('success', true, 'already_ready', true,
            'payment_status', 'READY');
    END IF;

    -- School must be ACTIVE.
    IF v_school.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'PAYMENT_ACTIVATION_REQUIRED: school must be ACTIVE';
    END IF;

    -- KYC must be VERIFIED.
    SELECT status INTO v_kyc FROM public.kyc_records WHERE school_id = p_school_id;
    IF NOT FOUND OR v_kyc.status <> 'VERIFIED' THEN
        RAISE EXCEPTION 'PAYMENT_ACTIVATION_REQUIRED: KYC must be VERIFIED';
    END IF;

    -- Settlement account must be VERIFIED.
    SELECT status INTO v_settlement FROM public.settlement_accounts
    WHERE school_id = p_school_id AND status = 'VERIFIED'
    ORDER BY updated_at DESC LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PAYMENT_ACTIVATION_REQUIRED: settlement account must be VERIFIED';
    END IF;

    -- Gateway must be assigned.
    SELECT status INTO v_gateway FROM public.gateway_assignments
    WHERE school_id = p_school_id AND status IN ('ASSIGNED', 'ACTIVE')
    ORDER BY updated_at DESC LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PAYMENT_ACTIVATION_REQUIRED: gateway must be ASSIGNED';
    END IF;

    -- Transition.
    UPDATE public.schools SET payment_status = 'READY' WHERE id = p_school_id;

    INSERT INTO public.audit_logs (school_id, actor_id, action, entity, entity_id, metadata)
    VALUES (p_school_id, NULL, 'PAYMENT_ACTIVATED', 'school', p_school_id,
        jsonb_build_object('payment_status', 'READY'));

    RETURN jsonb_build_object('success', true, 'already_ready', false,
        'payment_status', 'READY');
END;
$$;

COMMIT;
