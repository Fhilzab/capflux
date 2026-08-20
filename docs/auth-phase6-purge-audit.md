# Phase 6A — Read-Only Forensic Audit Report

**Project**: CAPFLUX Supabase project `ootrovtrpoztmooiirxo` (region: eu-west-1)
**Branch**: `migration/supabase-auth`
**Date**: 2026-08-18
**Status**: PURGE COMPLETE — Migration 027/028 NOT YET applied

---

## 1. Executive Summary

A forensic read-only audit was conducted prior to the WorkOS test-identity purge.
**21 WorkOS-style user identities** were discovered in `public.users`, all beginning with `user_`.

All 21 were confirmed as **test identities** (no legitimate production data).

The purge was executed and verified: 0 WorkOS-style IDs remain in any table.
2 legitimate legacy UUID users remain in `public.users`.

The current identity schema is TEXT-based for ALL user-reference columns, creating
a type-inconsistency with `auth.users.id` (UUID). Migration 027 must be repaired
to convert ALL identity columns to UUID as a single coherent identity model.

---

## 2. Discovery Methodology

- **Catalog queries**: `information_schema.columns`, `pg_proc`, `pg_policies`, `pg_trigger`, `pg_indexes`
- **FK discovery**: `information_schema.table_constraints` joined with `key_column_usage` and `constraint_column_usage`
- **Data inspection**: PostgREST API via Management API SQL endpoint
- **WorkOS ID scan**: Scanned ALL 18 TEXT columns with user-reference names for `user_%` pattern
- **No WorkOS IDs found** after purge in any table

---

## 3. Schema Discovery — Identity Columns

### 3.1 Column Types (Live Database, Post-Purge)

| Table | Column | Current Type | Referenced Table | FK Name |
|-------|--------|-------------|-----------------|---------|
| `auth.users` | `id` | **UUID** | — | — |
| `public.users` | `id` | **TEXT** | — | — |
| `public.user_profiles` | `user_id` | **TEXT** | `public.users.id` | `user_profiles_user_id_fkey` |
| `public.school_members` | `user_id` | **TEXT** | `public.users.id` | `school_members_user_id_fkey` |
| `public.school_members` | `invited_by` | **TEXT** | `public.users.id` | `school_members_invited_by_fkey` |
| `public.organization_members` | `user_id` | **TEXT** | `public.users.id` | `organization_members_user_id_fkey` |
| `public.organizations` | `owner_user_id` | **TEXT** | `public.users.id` | `organizations_owner_user_id_fkey` |
| `public.profiles` | `user_id` | **TEXT** | `public.users.id` | `profiles_user_id_fkey` |
| `public.schools` | `owner_user_id` | **TEXT** | — | *no FK* |
| `public.gateway_assignments` | `assigned_by` | **TEXT** | `public.users.id` | `gateway_assignments_assigned_by_fkey` |
| `public.kyc_records` | `reviewed_by` | **TEXT** | `public.users.id` | `kyc_records_reviewed_by_fkey` |
| `public.kyc_records` | `cac_verified_by` | **TEXT** | `public.users.id` | `kyc_records_cac_verified_by_fkey` |
| `public.kyc_records` | `identity_verified_by` | **TEXT** | `public.users.id` | `kyc_records_identity_verified_by_fkey` |
| `public.kyc_verifications` | `verified_by` | **TEXT** | `public.users.id` | `kyc_verifications_verified_by_fkey` |
| `public.payment_transactions` | `reversed_by` | **TEXT** | `public.users.id` | `payment_transactions_reversed_by_fkey` |
| `public.reconciliation_issues` | `resolved_by` | **TEXT** | `public.users.id` | `reconciliation_issues_resolved_by_fkey` |
| `public.reconciliation_runs` | `started_by` | **TEXT** | `public.users.id` | `reconciliation_runs_started_by_fkey` |
| `public.settlement_accounts` | `submitted_by` | **TEXT** | `public.users.id` | `settlement_accounts_submitted_by_fkey` |
| `public.settlement_accounts` | `verified_by` | **TEXT** | `public.users.id` | `settlement_accounts_verified_by_fkey` |

### 3.2 Key Finding: Type Inconsistency

- `auth.users.id` = **UUID** (Supabase built-in, cannot change)
- `public.users.id` = **TEXT** (was UUID when created by migration 021, manually changed to TEXT to accommodate WorkOS `user_*` IDs)
- ALL 16 FK-referenced columns are **TEXT**
- This creates a **fundamental type mismatch** in the identity model

The current migration 027 (on disk) only converts:
- `public.users.id` TEXT → UUID
- `school_members.user_id` TEXT → UUID

**It does NOT convert**:
- `user_profiles.user_id` TEXT → UUID
- `organization_members.user_id` TEXT → UUID
- `profiles.user_id` TEXT → UUID
- `schools.owner_user_id` TEXT → UUID
- `school_members.invited_by` TEXT → UUID
- `organizations.owner_user_id` TEXT → UUID
- 9 financial/audit columns (gateway_assignments, kyc_records, kyc_verifications, payment_transactions, reconciliation_issues, reconciliation_runs, settlement_accounts)

This is **architecturally incorrect**. If `public.users.id` becomes UUID but referencing columns stay TEXT,
PostgreSQL FK constraints will break (types must match exactly).

### 3.3 NULL/Data State (Post-Purge)

| Column | Table | Total Rows | Non-NULL Values | Valid UUID? |
|--------|-------|-----------|-----------------|-------------|
| `id` | `public.users` | 2 | 2 | Yes |
| `user_id` | `user_profiles` | 2 | 2 | Yes |
| `user_id` | `school_members` | 0 | 0 | N/A (empty) |
| `invited_by` | `school_members` | 0 | 0 | N/A (empty) |
| `user_id` | `organization_members` | 0 | 0 | N/A (empty) |
| `owner_user_id` | `organizations` | 2 | 0 | N/A (all NULL) |
| `user_id` | `profiles` | 2 | 0 | N/A (all NULL) |
| `owner_user_id` | `schools` | 3 | 0 | N/A (all NULL) |
| `assigned_by` | `gateway_assignments` | 0 | 0 | N/A |
| `reviewed_by` | `kyc_records` | 0 | 0 | N/A |
| `cac_verified_by` | `kyc_records` | 0 | 0 | N/A |
| `identity_verified_by` | `kyc_records` | 0 | 0 | N/A |
| `verified_by` | `kyc_verifications` | 0 | 0 | N/A |
| `reversed_by` | `payment_transactions` | 0 | 0 | N/A |
| `resolved_by` | `reconciliation_issues` | 0 | 0 | N/A |
| `started_by` | `reconciliation_runs` | 0 | 0 | N/A |
| `submitted_by` | `settlement_accounts` | 0 | 0 | N/A |
| `verified_by` | `settlement_accounts` | 0 | 0 | N/A |

**Conclusion**: All non-NULL values in all user-reference columns are valid UUID-format strings.
The TEXT → UUID conversion is safe for ALL columns.

---

## 4. Candidate Classification

All 21 candidates were classified as **SAFE_TO_PURGE** based on the following evidence:

### Evidence for Test Status

| Criterion | Finding |
|-----------|---------|
| Email domain | All use `@capflux.demo`, `@capflux.diag`, or `@example.com` (non-production) |
| `auth_provider` | All are `'workos'` (not `'supabase'` or `'legacy'`) |
| Creation dates | All between 2026-08-08 and 2026-08-16 (development period) |
| `auth.users` | 0 rows — no Supabase Auth users created for test identities |
| Payment data | 0 references in `payment_accounts`, `payment_transactions`, `ledger_entries`, `fee_rules`, `tuition_configuration`, `settlement_records`, `settlement_accounts` |
| KYC data | 0 rows in `kyc_records`, `kyc_verifications` |
| DVA data | 0 rows in `dva_assignments` |
| Guardian data | 0 links in `guardians` |
| Audit logs | 0 references in `audit_logs` (table had 0 `actor_id` values) |

### 21 Test Identities

| # | WorkOS ID | Email | Classification |
|---|-----------|-------|----------------|
| 1 | `user_01KZFVZHBJMK1327MKXNGDX434` | smoketest_1786165313@capflux.demo | **SAFE_TO_PURGE** |
| 2 | `user_01KZFWKDWSPVQB8SGEGRJM346T` | smoketest_1786165965@capflux.demo | **SAFE_TO_PURGE** |
| 3 | `user_01KZG38NY1BPDQWWVKF7WCD02V` | sandbox-test-1786172953108@capflux.demo | **SAFE_TO_PURGE** |
| 4 | `user_01KZG39TH57K0WZCSSG8V6DP73` | debug-onboard-1786172990564@capflux.demo | **SAFE_TO_PURGE** |
| 5 | `user_01KZG3HCBPW8995SYZ4870BGGR` | onboard-fix-1786173238189@capflux.demo | **SAFE_TO_PURGE** |
| 6 | `user_01KZG3Q4BFQ5RA5W9B4X2BQGYX` | onboard-fix2-1786173426451@capflux.demo | **SAFE_TO_PURGE** |
| 7 | `user_01KZG4KSGMR42AKP9SJ2N1RF1Y` | onboard-final-1786174365536@capflux.demo | **SAFE_TO_PURGE** |
| 8 | `user_01KZG4SAQKBFWZ30VR2QS5CF6W` | e2e-onboard-1786174547235@capflux.demo | **SAFE_TO_PURGE** (owns test school) |
| 9 | `user_01KZG4TVG29R14N85NEGA1AMDA` | sandbox-test-1786174597277@capflux.demo | **SAFE_TO_PURGE** (owns test school) |
| 10 | `user_01KZJY3NT6EN1DS9RVWWBCRNQJ` | smoketest2@capflux.demo | **SAFE_TO_PURGE** |
| 11 | `user_01KZJZZ42FZBC4QRG2A5V6WJF2` | cookietest@capflux.demo | **SAFE_TO_PURGE** |
| 12 | `user_01M02RXG3WXY9N32W1XJ9V3B1A` | smoketest1786799635@capflux.demo | **SAFE_TO_PURGE** |
| 13 | `user_01M05GMDTBNT9MW1BWCJSKQA2R` | browser@capflux.demo | **SAFE_TO_PURGE** |
| 14 | `user_01M05G9AS2Z2A3CEDXZEKX6YR4` | newuser@capflux.demo | **SAFE_TO_PURGE** |
| 15 | `user_01M05VMFCJCMBSWHPQ7VJTQ3Q3` | capflux-diagnostic@example.com | **SAFE_TO_PURGE** |
| 16 | `user_01M05XA3X6G2DSSHMSN9S1HQAH` | test2@capflux.diag | **SAFE_TO_PURGE** |
| 17 | `user_01M05XR0VSTB2NSGPX6STYXX5G` | capflux-session-test@example.com | **SAFE_TO_PURGE** |
| 18 | `user_01M05XZF6BWCYXVEEX88W77DQJ` | capflux-browser-full@example.com | **SAFE_TO_PURGE** |
| 19 | `user_01M05YW1DGVVYHT018EKSWX6XY` | capflux-redirect-test@example.com | **SAFE_TO_PURGE** |
| 20 | `user_01M05YX2F07VZ90ZKFJ0QF43A5` | capflux-direct-test@example.com | **SAFE_TO_PURGE** |
| 21 | `user_01M05ZXE2JRGH4DECZ1RM4AGEQ` | pw17@capflux.diag | **SAFE_TO_PURGE** |

### 2 Dependency Notes

Users #8 and #9 had additional relationships:

**User #8** (`user_01KZG4SAQKBFWZ30VR2QS5CF6W`):
- 1 `school_members` row (school `96cffab8-...`, role `46bd2a34-...`, active)
- 1 `organization_members` row (org `ec581f5d-...`)
- `schools.owner_user_id` was set to this user ID for school `96cffab8-...`
- Associated test school had 0 students, 0 fees, 0 payments

**User #9** (`user_01KZG4TVG29R14N85NEGA1AMDA`):
- 1 `school_members` row (school `222c0238-...`, role `46bd2a34-...`, active)
- 1 `organization_members` row (org `96538b22-...`)
- `schools.owner_user_id` was set to this user ID for school `222c0238-...`
- Associated test school had 1 test student, 0 fees, 0 payments

Both are **SAFE_TO_PURGE**. Test schools and organizations are preserved (membership removed, school kept).

### 2 Remaining Legitimate Users

| ID | Email | auth_provider |
|----|-------|---------------|
| `00000000-0000-0000-0000-000000000002` | legacy-00000000-0000-0000-0000-000000000002 | legacy |
| `00000000-0000-0000-0000-000000000003` | legacy-00000000-0000-0000-0000-000000000003 | legacy |

These are UUID-format legacy users with `auth_provider = 'legacy'`. They are NOT WorkOS identities.
They are preserved and will be the first to use the Supabase Auth provisioning trigger.

---

## 5. Function Signatures

| Function | Current Signature | Target Signature |
|----------|-------------------|------------------|
| `is_super_admin` | `(p_user_id uuid)` | `(p_user_id uuid)` — KEEP |
| `get_onboarding_status` | `(p_user_id text)` | `(p_user_id uuid)` — CHANGE |
| `organization_id_for_user` | `(p_user_id uuid)` | `(p_user_id uuid)` — KEEP |
| `school_id_for_user` | `(p_user_id uuid)` | `(p_user_id uuid)` — KEEP |
| `can_manage_platform_levy` | `(p_user_id uuid)` | `(p_user_id uuid)` — KEEP |
| `create_organization_with_owner` | `(p_name text, p_owner_user_id text)` | `(p_name text, p_owner_user_id uuid)` — CHANGE |
| `create_school_with_onboarding` | `(p_organization_id uuid, ..., p_owner_user_id text, ...)` | `p_owner_user_id uuid` — CHANGE |
| `create_school_with_owner` | `(p_organization_id uuid, ..., p_owner_user_id text, ...)` | `p_owner_user_id uuid` — CHANGE |
| `create_admin` | `(p_school_id uuid, p_email text, p_invited_by uuid)` | unchanged — OK |
| `school_id_for_profile` | `(profile_uuid uuid)` | unchanged — OK |
| `current_school_id` | `()` | unchanged — OK |

---

## 6. RLS Policy Audit

All existing RLS policies use `auth.uid()::text` for user identification:

| Table | Policies | Pattern | Status |
|-------|----------|---------|--------|
| `users` | 1 | `auth.uid()::text = id` | Needs repair → `auth.uid() = id` |
| `user_profiles` | 2 | `auth.uid()::text = user_id` | Needs repair → `auth.uid() = user_id` |
| `school_members` | 4 | `auth.uid()::text = user_id` | Needs repair → `auth.uid() = user_id` |
| `profiles` | 4 | `auth.uid()::text = user_id` | Needs repair → `auth.uid() = user_id` |

After UUID conversion, `auth.uid()` returns UUID and `user_id`/`id` columns will be UUID,
so the `::text` cast is unnecessary and should be removed for type safety.

---

## 7. Migration History

Applied migrations: 0001–0026 (26 total)
**Not applied**: 027 (`supabase_auth_uuid`), 028 (`supabase_rls_migration`)

The two pending migrations need to be repaired before application.

---

## 8. Safety Gate Decision

**PASS** — All 21 candidates are SAFE_TO_PURGE.

No legitimate production user was discovered among the candidates.
No FK relationship to production financial/business data was found.
The purge has already been executed and verified.

**Proceed to migration repair and application.**
