-- ============================================================================
-- Phase 8.4 (provider-agnostic verification hardening): capability-aware columns
-- ----------------------------------------------------------------------------
-- ADDITIVE ONLY. Does not modify or reset migrations 001-028. Extends the
-- existing verification audit tables so they can record *which fields the
-- provider actually verified* (verified_fields) and the *per-field match*
-- computed by CAPFLUX (comparison), instead of assuming a fixed field set.
--
-- Design rules enforced here:
--   * No per-field assumption columns (e.g. nin_verified_phone) — capability
--     and verification outcomes are stored as auditable JSON, so an absent
--     provider field is NOT_PROVIDED, never a fabricated MISMATCH.
--   * No duplicate identity_verifications table — kyc_verifications (m024) is
--     the single auditable verification-history table.
--   * BVN ownership is a SEPARATE concept from account-name ownership.
--   * Raw provider payloads are never stored here (raw_response stays {}).
-- ============================================================================

-- Record which identity fields the provider returned this verification run, e.g.
-- {"name":true,"dateOfBirth":true,"phone":false,"identityNumber":true}
alter table kyc_verifications
  add column if not exists verified_fields jsonb default '{}'::jsonb,
  add column if not exists comparison jsonb default '{}'::jsonb;

comment on column kyc_verifications.verified_fields is
  'Fields the identity provider actually verified this run (capability-aware). Never stores raw PII values.';
comment on column kyc_verifications.comparison is
  'CAPFLUX-computed per-field match states: MATCH/MISMATCH/NOT_PROVIDED/NOT_VERIFIED plus overall. No raw provider payload.';

-- Record which settlement-account fields the provider returned (accountName,
-- accountNumber, bvn) and the CAPFLUX ownership decision.
alter table settlement_account_verifications
  add column if not exists verified_fields jsonb default '{}'::jsonb,
  add column if not exists comparison jsonb default '{}'::jsonb;

comment on column settlement_account_verifications.verified_fields is
  'Fields the settlement provider actually verified this run (capability-aware).';
comment on column settlement_account_verifications.comparison is
  'CAPFLUX-computed ownership match states. raw_response stays empty (no raw payload).';

-- Capability-aware settlement ownership outcome on the account itself.
-- Distinct from a name MISMATCH: NOT_VERIFIED means the provider could not or
-- did not return a name to compare (ownership indeterminate, NOT a mismatch).
alter table settlement_accounts
  add column if not exists ownership_match_status text
    check (ownership_match_status is null
           or ownership_match_status in (
             'OWNERSHIP_MATCH','NAME_MISMATCH','NAME_NOT_VERIFIED',
             'ACCOUNT_NOT_VERIFIED',
             'PENDING','FAILED'));

comment on column settlement_accounts.ownership_match_status is
  'Capability-aware CAPFLUX ownership decision: provider evidence + matching rules. NULL = not assessed.';
