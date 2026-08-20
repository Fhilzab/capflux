# Phase 8.4 — KYC & Onboarding Consolidation: Provider-Agnostic Verification Hardening

> **Scope of this pass:** the provider-agnostic *verification contract and matching* layer.
> The broader `/kyc/submit` wizard + `/setup` → `/kyc/submit` routing (the linear journey)
> remains the Phase 8.4 *implementation plan* and is **unchanged** by this hardening pass.
> This pass establishes, in concrete code, the capability-aware foundation the journey will
> depend on, so the consolidated KYC flow is built on contracts that never assume a
> provider returns a fixed set of fields.

## 1. What already existed (reused — not rewritten)

- `backend/services/IdentityVerificationService.js` + `SettlementVerificationService.js` —
  provider abstraction with `Mock*` (dev) + `Approved*` (production plug-in) via
  `IDENTITY_VERIFICATION_PROVIDER` / `SETTLEMENT_VERIFICATION_PROVIDER` env flags. `getProvider()`
  refuses production use of the mock. **Unchanged:** the env-driven selection, the mock
  checksum logic, the encryption of NIN/BVN (AES-256-GCM in `cryptoFields.js`), and the
  `Approved*` adapter seam.
- `backend/routes/financial-admin.js` — staff KYC/settlement verification route
  (decrypts BVN/NIN server-side, calls providers, records `kyc_verifications` /
  `settlement_account_verifications`, sets `kyc_records`/`settlement_accounts` status).
- `backend/services/validators.js` — `namesPlausiblyMatch`, NIN/BVN/CAC/account/bank code
  validators, `isValidCacNumber`, `isValidImageFile`.
- `supabase/migrations/022-025` — `kyc_records`, `kyc_verifications`,
  `settlement_accounts`, `settlement_account_verifications`, the `complete_onboarding` RPC
  (the only path to `school.status='ACTIVE'`). **Untouched** (m001-028 protected).
- `docs/providers/capability-matrix.md`, `docs/PROJECT_STATUS.md`.
- Frontend: untouched by this pass.

## 2. Assumptions found (and removed)

The existing provider contract exposed **only** `{ verified, reference, accountName,
failureReason, provider, verifiedAt }` — a single `accountName` treated as "the verified
identity name" with **no capability model**, **no per-field verification state**, and **no
distinction between "provider can't return phone" and "phone mismatched."** Had the journey
been wired to it per the original plan, KYC would have:

- assumed a name/DOB/phone is always returned by every identity provider;
- classified an unavailable phone as a `MISMATCH` instead of `NOT_PROVIDED`;
- treated `accountName` (a mock string) as an authoritative verified name with no capability
  gate;
- treated `verified === true` as an identity match with no comparison against the submitted
  personal information;
- assumed `BVN ⟹ account owner` for settlement (BVN is a *separate* verification);
- stored `raw_response: {}` (already sanitized — good) but never persisted *which fields*
  were verified.

`financial-admin.js` compounded these: `identityVerified = identityResults.some(r => r.verified)`
(no matching), and `namesPlausiblyMatch(result.accountName, schoolName)` (no capability gate;
treats any returned name as authoritative).

## 3. Files changed

| File | Change |
|------|--------|
| `backend/services/IdentityVerificationService.js` | Capability-aware contract (backward compatible). Adds `getCapabilities()`, `verificationStatus`, `verifiedFields` (per-field booleans actually returned), `capabilities`, `verifiedName/verifiedDob/verifiedPhone/verifiedIdentityNumber`, `providerMetadata`. Mock models conservative, realistic capabilities (NIN returns name+DOB; **not** phone; BVN returns name+phone; **not** DOB) — so it never claims a capability it can't prove. `Approved*` remains an unconfigured stub (Fincra seam). Exports `MockIdentityProvider`/`ApprovedIdentityProvider` + test hook `__setIdentityProviderForTest`. |
| `backend/services/SettlementVerificationService.js` | Capability-aware contract (backward compatible). Adds `getCapabilities()` (account-name + account-number enquiry; `canVerifyBvn:false` — BVN is separate), `verifiedFields`, `verificationStatus`. Mock returns a verified account name only where the cap is declared. `Approved*` unchanged stub. Exports provider classes. |
| `backend/services/verification-matching.js` (NEW) | Core domain matchers (provider-agnostic, pure, tested): `compareIdentityAgainstSubmission` → per-field `MATCH|MISMATCH|NOT_PROVIDED|NOT_VERIFIED` + overall `MATCH|MISMATCH|NOT_VERIFIED|PENDING|FAILED`; `evaluateSettlementEligibility` → `OWNERSHIP_MATCH|NAME_MISMATCH|NAME_NOT_VERIFIED|ACCOUNT_NOT_VERIFIED|PENDING|FAILED` with BVN treated as a **separate** factor (`BvnState`); `sanitizeIdentityResult` (allowlist) strips all `verified*` PII, `providerMetadata`, raw payloads. |
| `backend/routes/financial-admin.js` | Staff verify now computes + stores the capability-aware match. Identity approval requires a confirmed `MATCH` (rejects explicit `MISMATCH`/`FAILED`); `NOT_PROVIDED`/`NOT_VERIFIED` never produce false mismatches. `kyc_verifications` and `settlement_account_verifications` now persist `verified_fields` + `comparison`; `settlement_accounts` gets `ownership_match_status`. `accountName` is compared only when `canFetchAccountName`. PII (`verifiedName/Dob/Phone/IdentityNumber/providerMetadata`) is sanitized before any client response. |
| `backend/tests/verification-services.test.js` | Extended from 9 → **30 tests**: all 9 original kept; +21 new covering capability-aware matching, settlement eligibility, provider contract (mock capabilities, `Approved*` not configured, provider-failure normalization), and security (PII never reaches the sanitized result). |
| `supabase/migrations/202607100029_kyc_verification_fields.sql` (NEW) | Additive only (does not touch m001-028). Adds `verified_fields jsonb` + `comparison jsonb` to `kyc_verifications` and `settlement_account_verifications`; adds `ownership_match_status text` (CHECK on capability-aware outcomes) to `settlement_accounts`. No `identity_verifications` duplicate; no per-field assumption columns (e.g. `nin_verified_phone`). |

## 4. Schema changes

Migration `202607100029_kyc_verification_fields.sql` (additive, `IF NOT EXISTS`, idempotent):
- `kyc_verifications.verified_fields` JSONB — which identity fields the provider verified *this run*.
- `kyc_verifications.comparison` JSONB — CAPFLUX-computed per-field match states + overall.
- `settlement_account_verifications.verified_fields` / `comparison` JSONB — same for settlement.
- `settlement_accounts.ownership_match_status` TEXT (CHECK: `OWNERSHIP_MATCH|NAME_MISMATCH|NAME_NOT_VERIFIED|ACCOUNT_NOT_VERIFIED|PENDING|FAILED`, or NULL).

Design rules (in the migration header): no per-field assumption columns; no duplicate
`identity_verifications` table; BVN is separate from account-name ownership; `raw_response`
stays `{}` (no raw provider payload persisted). The auditable history is the **existing**
`kyc_verifications`/`settlement_account_verifications` tables (m024), now extended — matching
the correction's "do not create duplicate tables."

## 5. Provider contract (the authoritative change)

Before: `{ verified, reference, accountName, failureReason, provider, verifiedAt }` (assumed
`accountName` = verified name).

After (backward-compatible superset — existing fields preserved):
```
{
  verified, reference, accountName, failureReason, provider, verifiedAt,   // legacy clients still work
  verificationStatus: 'VERIFIED' | 'FAILED' | 'PENDING',
  verifiedFields: { name, dateOfBirth, phone, identityNumber },     // capability-gated booleans
  capabilities: { canVerifyIdentityNumber, canFetchName, canFetchDob, canFetchPhone },
  verifiedName, verifiedDob, verifiedPhone, verifiedIdentityNumber,     // PII — NEVER sent to frontend
  providerMetadata,                                                      // sanitized — NEVER sent to frontend
}
```
The domain never inspects `accountName` alone; it consults `verifiedFields` + `capabilities` to
decide whether a comparison is possible, and only then compares against submitted data.

## 6. Field-state semantics (correction §3)

- **MATCH** — provider returned the field *and* it equals the submission.
- **MISMATCH** — provider returned the field *and* it differs.
- **NOT_PROVIDED** — the provider *cannot* return this field (capability absent) → never a Mismatch.
- **NOT_VERIFIED** — provider *can* return it but did not this run / no value to compare.
- **PENDING** / **FAILED** — run-level (verification not done / failed).

## 7. Separation of concerns (correction §7/§8)

`Provider verification` → supplies evidence → `CAPFLUX matching rules` → `authorization decision`.
- Identity: provider verifies the NIN/BVN; CAPFLUX matches returned fields against submission.
- Settlement: provider does account-name enquiry; **BVN ownership is a separate identity
  verification**; CAPFLXX applies the ownership rule (account name matches verified owner) on
  top. A verified BVN whose name cannot be matched does **not** by itself prove ownership.

## 8. Tests

`backend/tests/verification-services.test.js` — **30/30 pass.** Coverage of the capability-aware
contract:
- Matcher: name+DOB compared, phone NOT_PROVIDED (not MISMATCH); name+DOB+phone all compared;
  name-only → DOB/phone NOT_PROVIDED; provider returns no phone → never a MISMATCH; mismatched
  DOB → MISMATCH; name MISMATCH → overall MISMATCH; no submitted name → NOT_VERIFIED (not MISMATCH);
  pending → PENDING; failed → FAILED; provider-specific keys ignored; identityNumber match/mismatch.
- Settlement: account+name match → OWNERSHIP_MATCH; name differs → NAME_MISMATCH;
  provider cannot fetch name → NOT_PROVIDED (not MISMATCH), overall NAME_NOT_VERIFIED;
  BVN name mismatch → NAME_MISMATCH (BVN separate); account not verified → not eligible.
- Provider contract: mock declares conservative capabilities; `ApprovedIdentityProvider`/
  `ApprovedSettlementProvider` are not configured (throw); provider-thrown failure is normalized
  to `FAILED` without leaking to the caller.
- Security: `sanitizeIdentityResult` strips `verifiedName/Dob/Phone/IdentityNumber/verifiedBvn`,
  `providerMetadata`, raw payloads; NIN/BVN never appear in the sanitized result.

### Other backend tests (unchanged)
The remaining backend test files (activation, auth, financial-authz, gateway,
payment-lifecycle, requireAuthSupabase, schoolIsolation, webhook-contract, security) are
Supabase-dependent: they `import supabaseClient.js`, which throws
`"Missing Supabase environment variables"` at import time in this sandbox (no `SUPABASE_URL`/
`SUPABASE_SECRET_KEY` configured — `backend/.env.local` only contains WorkOS keys, and
`dotenv.config()` loads `.env`, which is absent). These failures are **environmental and
pre-existing**; none of them import the modules changed by this correction. The only file
impacted by this correction — `verification-services.test.js` — passes 30/30.

## 9. Build / syntax

- `node --check` passes on all touched JS: `IdentityVerificationService.js`,
  `SettlementVerificationService.js`, `verification-matching.js`, `financial-admin.js`.
- Backend has no compile step (plain ESM; `node --test` is the verifier).
- Frontend is **untouched** by this pass; its build/tests are unaffected.
- Migration 029 is hand-authored `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (cannot be
  executed here without a live Supabase).

## 10. Fincra status — PENDING_PROVIDER

No Fincra code, no Fincra endpoints, no Fincra response fields assumed, no Fincra credentials
committed. `docs/providers/capability-matrix.md` is updated to state Fincra is PENDING_PROVIDER
for both identity and settlement verification. The `ApprovedIdentityProvider` /
`ApprovedSettlementProvider` stubs are the exact integration point: an adapter declares its real
`getCapabilities()` and implements `verify*`; CAPFLUX matches only returned fields. When Fincra
credentials and a verified API contract exist, plug in `FincraIdentityProvider`/
`FincraSettlementProvider` behind `IDENTITY_VERIFICATION_PROVIDER=approved` /
`SETTLEMENT_VERIFICATION_PROVIDER=approved`.

## 11. Security

- NIN/BVN remain encrypted at rest; decrypted only server-side (in `financial-admin.js`'s
  verify route) for provider calls — never persisted plaintext, never sent to frontend.
- `sanitizeIdentityResult` (allowlist) ensures no `verified*` PII / `providerMetadata` / raw
  provider payload reaches any client response (correction §10).
- `raw_response` stays `{}` on the audit tables (no raw provider payload persisted).
- The frontend never declares verification success; the provider + CAPFLAX rules are authoritative.

## 12. Remaining limitations / deferred to the full Phase 8.4 implementation

- **Routing & journey unification** (`/setup` → `/kyc/submit` redirect; the linear 11-step wizard
  shell; progressive-access overlay redirection) — Phase 8.4 implementation, not this pass.
- **`kyc.js` provider wiring** (calling the identity/settlement providers from the KYC flow so
  end-users experience capability-aware verification — the staff route is wired, the member flow
  is the plan). The hardened contract is ready for it.
- **Shareholders / principal invitations / school levels-category migration 030** — Phase 8.4
  schema, deferred (this pass only added the verification audit columns in m029).
- **Fincra** — PENDING_PROVIDER (production adapter + verified capabilities), not implemented.
- DB tests can't run in this sandbox (no Supabase configuration); run the suite in an
  environment with `SUPABASE_URL` + `SUPABASE_SECRET_KEY` and a reachable project.
