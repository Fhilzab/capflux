-- ==========================================================
-- CAPFLUX — FHILZAB NIG LTD
-- Migration: 202607100030_phase84_kyc_onboarding.sql
-- Purpose: Phase 8.4 — KYC/Onboarding Consolidation backend support.
--
-- Additive ONLY. Does not modify migrations 001–029.
--
-- Adds:
--   1. School levels / category / gender columns on schools.
--   2. Personal identity columns on user_profiles (DOB, names, origin, address).
--   3. kyc_records: identity document type, match states, verification reference.
--   4. school_shareholders: school-scoped beneficial-owner records.
--   5. principal_invitations: secure, expiring, idempotent school invitations.
--   6. settlement_accounts: encrypted BVN, BVN last4, verification reference.
-- ==========================================================

BEGIN;

-- ==========================================================
-- 1. SCHOOL LEVELS / CATEGORY / GENDER
-- ==========================================================

ALTER TABLE schools
    ADD COLUMN IF NOT EXISTS school_levels TEXT[] DEFAULT '{}'::text[],
    ADD COLUMN IF NOT EXISTS school_category TEXT,
    ADD COLUMN IF NOT EXISTS gender TEXT;

COMMENT ON COLUMN schools.school_levels IS 'School levels served: any subset of {NURSERY, PRIMARY, SECONDARY}.';
COMMENT ON COLUMN schools.school_category IS 'School category: e.g. EDUCATIONAL, EARLY_YEAR, etc.';
COMMENT ON COLUMN schools.gender IS 'Gender composition: MIXED, BOYS, or GIRLS.';

-- ==========================================================
-- 2. PERSONAL IDENTITY ON user_profiles
-- ==========================================================

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS first_name TEXT,
    ADD COLUMN IF NOT EXISTS middle_name TEXT,
    ADD COLUMN IF NOT EXISTS last_name TEXT,
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS country TEXT,
    ADD COLUMN IF NOT EXISTS state_of_origin TEXT,
    ADD COLUMN IF NOT EXISTS lga_of_origin TEXT,
    ADD COLUMN IF NOT NULL DEFAULT 'Nigeria'::TEXT;

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS residential_address TEXT;

COMMENT ON COLUMN user_profiles.date_of_birth IS 'Personal date of birth. Stored for KYC matching (never sent to provider unverified).';
COMMENT ON COLUMN user_profiles.residential_address IS 'Residential address collected during KYC.';

-- ==========================================================
-- 3. KYC_RECORDS: identity document type + match states
-- ==========================================================

ALTER TABLE kyc_records
    ADD COLUMN IF NOT EXISTS identity_document_type TEXT
        CHECK (identity_document_type IS NULL
               OR identity_document_type IN ('NIN_SLIP', 'NIN_CARD', 'INTERNATIONAL_PASSPORT', 'VOTERS_CARD')),
    ADD COLUMN IF NOT EXISTS identity_match_states JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS verification_reference TEXT;

COMMENT ON COLUMN kyc_records.identity_document_type IS 'Type of identity document uploaded: NIN_SLIP, NIN_CARD, INTERNATIONAL_PASSPORT, VOTERS_CARD.';
COMMENT ON COLUMN kyc_records.identity_match_states IS 'Capability-aware per-field match states from IdentityVerificationService: MATCH/MISMATCH/NOT_PROVIDED/NOT_VERIFIED/PENDING/FAILED.';
COMMENT ON COLUMN kyc_records.verification_reference IS 'Idempotency reference for the identity verification run (provider ref or local nonce).';

-- ==========================================================
-- 4. SCHOOL_SHAREHOLDERS — school-scoped beneficial owners
-- ==========================================================

CREATE TABLE IF NOT EXISTS school_shareholders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    ownership_percentage NUMERIC(5,2) NOT NULL CHECK (ownership_percentage > 0 AND ownership_percentage <= 100),
    role TEXT NOT NULL,
    phone TEXT NOT NULL,
    date_of_birth_encrypted TEXT,
    identity_type TEXT NOT NULL CHECK (identity_type IN ('NIN', 'INTERNATIONAL_PASSPORT', 'VOTERS_CARD', 'NIN_CARD')),
    identity_document_type TEXT CHECK (identity_document_type IS NULL OR identity_document_type IN ('NIN_SLIP', 'NIN_CARD', 'INTERNATIONAL_PASSPORT', 'VOTERS_CARD')),
    identity_nin_last4 TEXT,
    identity_match_status TEXT CHECK (identity_match_status IS NULL OR identity_match_status IN ('MATCH', 'MISMATCH', 'NOT_PROVIDED', 'NOT_VERIFIED', 'PENDING', 'FAILED')),
    verification_reference TEXT,
    encrypted_identity_document BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shareholders_school ON school_shareholders(school_id);
CREATE INDEX IF NOT EXISTS idx_shareholders_match ON school_shareholders(identity_match_status)
    WHERE identity_match_status IS NOT NULL;

-- ==========================================================
-- 5. PRINCIPAL_INVITATIONS — secure, expiring, idempotent
-- ==========================================================

CREATE TABLE IF NOT EXISTS principal_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'PRINCIPAL'
        CHECK (role IN ('PRINCIPAL', 'ADMIN')),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_principal_invitations_school ON principal_invitations(school_id);
CREATE INDEX IF NOT EXISTS idx_principal_invitations_email ON principal_invitations(email);
CREATE INDEX IF NOT EXISTS idx_principal_invitations_token ON principal_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_principal_invitations_status ON principal_invitations(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_principal_invitations_active_email
    ON principal_invitations(school_id, email)
    WHERE status = 'PENDING';

COMMENT ON COLUMN principal_invitations.token_hash IS 'SHA-256 hash of the invitation token. Never store raw tokens.';
COMMENT ON COLUMN principal_invitations.expires_at IS 'Invitations expire and are not valid after this timestamp.';

-- ==========================================================
-- 6. SETTLEMENT ACCOUNTS: encrypted BVN, BVN last4, verification ref
-- ==========================================================

ALTER TABLE settlement_accounts
    ADD COLUMN IF NOT EXISTS bvn_encrypted TEXT,
    ADD COLUMN IF NOT EXISTS bvn_last4 TEXT,
    ADD COLUMN IF NOT EXISTS account_verification_reference TEXT;

COMMENT ON COLUMN settlement_accounts.bvn_encrypted IS 'AES-256-GCM encrypted BVN for settlement ownership verification. Only decryptable by backend compliance service.';
COMMENT ON COLUMN settlement_accounts.bvn_last4 IS 'Last four digits of the BVN, safe to expose to clients for display.';

-- ==========================================================
-- 7. RLS POLICIES for new tables
-- ==========================================================

-- School shareholders: only accessible to school members
ALTER TABLE school_shareholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view shareholders" ON school_shareholders
    FOR SELECT USING (
        auth.uid() IS NOT NULL
        AND school_id IN (
            SELECT school_id FROM school_members
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "School members can insert/update shareholders" ON school_shareholders
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL
        AND school_id IN (
            SELECT school_id FROM school_members
            WHERE user_id = auth.uid() AND is_active = true
        )
    )
    FOR UPDATE USING (
        auth.uid() IS NOT NULL
        AND school_id IN (
            SELECT school_id FROM school_members
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Principal invitations: only accessible to school members
ALTER TABLE principal_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view invitations" ON principal_invitations
    FOR SELECT USING (
        auth.uid() IS NOT NULL
        AND school_id IN (
            SELECT school_id FROM school_members
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "School owners can insert invitations" ON principal_invitations
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL
        AND school_id IN (
            SELECT sm.school_id FROM school_members sm
            JOIN roles r ON sm.role_id = r.id
            WHERE sm.user_id = auth.uid() AND sm.is_active = true AND r.system_role = 'OWNER'
        )
    );

-- kyc_records: add RLS for identity_match_states (already has masked view policy)
-- The existing policy on kyc_records allows SELECT for school members;
-- identity_match_states contains only capability-aware states, no raw PII.

COMMIT;
