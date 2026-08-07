-- ==========================================================
-- CAPFLUX — FHILZAB NIG LTD
-- Migration: 202607100023_ledger_idempotency.sql
-- Purpose: Add ledger idempotency and missing constraints/indexes.
--
-- This is a NEW capability migration (not a repair of an earlier one):
--  1. ledger_entries.idempotency_key — guarantees a replayed payment event
--     never creates a duplicate financial entry.
--  2. source_document_type + source_document_id — idempotency for
--     journal-derived entries (charge/payment/waiver/refund/adjustment).
--  3. Missing onboarding/KYC/membership lookup indexes.
-- ==========================================================

BEGIN;

-- ==========================================================
-- LEDGER IDEMPOTENCY
-- ==========================================================

-- Deterministic idempotency key for ledger entries. Webhook/backend writes
-- set this to e.g. 'pay:<gateway_txn_ref>' or 'charge:<student_charge_id>'.
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- source document tracing for journal-derived entries.
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS source_document_type TEXT;
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS source_document_id TEXT;

-- A replay must never create a duplicate financial entry.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_idempotency_key
    ON ledger_entries (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- One entry per source document (charge/payment/refund/waiver/adjustment).
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_source_document
    ON ledger_entries (source_document_type, source_document_id)
    WHERE source_document_type IS NOT NULL AND source_document_id IS NOT NULL;

-- ==========================================================
-- MEMBERSHIP & LOOKUP INDEXES
-- ==========================================================

-- One active OWNER membership per organization.
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_members_one_active_owner
    ON public.organization_members (organization_id)
    WHERE is_active = true;

-- Fast onboarding lookup: active membership by user.
CREATE INDEX IF NOT EXISTS idx_school_members_user_active
    ON public.school_members (user_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_org_members_user_active
    ON public.organization_members (user_id, is_active) WHERE is_active = true;

-- KYC reviewer lookup + submission window.
CREATE INDEX IF NOT EXISTS idx_kyc_reviewed_by ON public.kyc_records (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_kyc_submitted_at ON public.kyc_records (submitted_at);

-- Reporting: ledger by (school, created_at) and (student, created_at).
CREATE INDEX IF NOT EXISTS idx_ledger_school_created ON ledger_entries (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_student_created ON ledger_entries (student_id, created_at DESC);

COMMIT;
