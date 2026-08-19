# Phase 6: Purge Manifest

**Status**: LIVE DATABASE VERIFIED
**Date**: Phase 6 audit
**Supabase Project**: `ootrovtrpoztmooiirxo`

## Identities Inventory

21 WorkOS-style user IDs discovered in `public.users`, all beginning with `user_`.
All have `auth_provider = 'workos'`.

## Classification Results

### Category A: SAFE_TEST_IDENTITY (21 users — ALL)

| # | WorkOS ID | Email | Role |
|---|-----------|-------|------|
| 1 | `user_01KZFVZHBJMK1327MKXNGDX434` | smoketest_1786165313@capflux.demo | Test user, no deps |
| 2 | `user_01KZFWKDWSPVQB8SGEGRJM346T` | smoketest_1786165965@capflux.demo | Test user, no deps |
| 3 | `user_01KZG38NY1BPDQWWVKF7WCD02V` | sandbox-test-1786172953108@capflux.demo | Test user, no deps |
| 4 | `user_01KZG39TH57K0WZCSSG8V6DP73` | debug-onboard-1786172990564@capflux.demo | Test user, no deps |
| 5 | `user_01KZG3HCBPW8995SYZ4870BGGR` | onboard-fix-1786173238189@capflux.demo | Test user, no deps |
| 6 | `user_01KZG3Q4BFQ5RA5W9B4X2BQGYX` | onboard-fix2-1786173426451@capflux.demo | Test user, no deps |
| 7 | `user_01KZG4KSGMR42AKP9SJ2N1RF1Y` | onboard-final-1786174365536@capflux.demo | Test user, no deps |
| 8 | `user_01KZG4SAQKBFWZ30VR2QS5CF6W` | e2e-onboard-1786174547235@capflux.demo | Test, owns test school |
| 9 | `user_01KZG4TVG29R14N85NEGA1AMDA` | sandbox-test-1786174597277@capflux.demo | Test, owns test school |
| 10 | `user_01KZJY3NT6EN1DS9RVWWBCRNQJ` | smoketest2@capflux.demo | Test user, no deps |
| 11 | `user_01KZJZZ42FZBC4QRG2A5V6WJF2` | cookietest@capflux.demo | Test user, no deps |
| 12 | `user_01M02RXG3WXY9N32W1XJ9V3B1A` | smoketest1786799635@capflux.demo | Test user, no deps |
| 13 | `user_01M05GMDTBNT9MW1BWCJSKQA2R` | browser@capflux.demo | Test user, no deps |
| 14 | `user_01M05G9AS2Z2A3CEDXZEKX6YR4` | newuser@capflux.demo | Test user, no deps |
| 15 | `user_01M05VMFCJCMBSWHPQ7VJTQ3Q3` | capflux-diagnostic@example.com | Test user, no deps |
| 16 | `user_01M05XA3X6G2DSSHMSN9S1HQAH` | test2@capflux.diag | Test user, no deps |
| 17 | `user_01M05XR0VSTB2NSGPX6STYXX5G` | capflux-session-test@example.com | Test user, no deps |
| 18 | `user_01M05XZF6BWCYXVEEX88W77DQJ` | capflux-browser-full@example.com | Test user, no deps |
| 19 | `user_01M05YW1DGVVYHT018EKSWX6XY` | capflux-redirect-test@example.com | Test user, no deps |
| 20 | `user_01M05YX2F07VZ90ZKFJ0QF43A5` | capflux-direct-test@example.com | Test user, no deps |
| 21 | `user_01M05ZXE2JRGH4DECZ1RM4AGEQ` | pw17@capflux.diag | Test user, no deps |

### Category B: TEST_IDENTITY_WITH_DEPENDENCIES (2 users)

Users #8 and #9 have additional dependencies:

**User #8** (`user_01KZG4SAQKBFWZ30VR2QS5CF6W`):
- `user_profiles`: 1 row
- `school_members`: 1 row (school `96cffab8-bfb0-4c2b-afa3-b8c62068145c`, role `46bd2a34-...`, active)
- `organization_members`: 1 row (org `ec581f5d-968d-483b-b1b3-53da25bf5050`)
- Owns school "E2E School 1786174552432" (0 students, 0 fees, 0 payments)

**User #9** (`user_01KZG4TVG29R14N85NEGA1AMDA`):
- `user_profiles`: 1 row
- `school_members`: 1 row (school `222c0238-4107-47d4-b790-4e03981fa273`, role `46bd2a34-...`, active)
- `organization_members`: 1 row (org `96538b22-723a-49e0-96be-fbb9ebfa00ab`)
- Owns school "Sandbox Test School" (1 test student, 0 fees, 0 payments)

### Category C: UNKNOWN — 0 users

### Category D: PRODUCTION_OR_UNSAFE — 0 users

## Classification Summary

| Category | Count |
|---|---|
| A. SAFE_TEST_IDENTITY | 21 |
| B. TEST_IDENTITY_WITH_DEPENDENCIES | 2 (subset of A) |
| C. UNKNOWN | 0 |
| D. PRODUCTION_OR_UNSAFE | 0 |
| **All identities safe to purge** | **Yes** |

## Evidence of Test Status

For every identity:
- **Email domain**: `@capflux.demo`, `@capflux.diag`, or `@example.com` (all non-production test domains)
- **auth_provider**: `'workos'` (not `'supabase'` — these are WorkOS test users)
- **Creation dates**: All between 2026-08-08 and 2026-08-16 (development period)
- **Associated schools**: Test school names ("E2E School 1786174552432", "Sandbox Test School" — timestamp-based names)
- **Associated student**: "Test Student" with `device_id: "m8-test"`, `client_sequence: 999`
- **Onboarding data**: 2 incomplete, non-activated onboarding records
- **Payment/financial data**: 0 references in any financial table
- **DVA data**: 0 references
- **KYC data**: 0 records
- **Guardian data**: 0 links

## Rows to Delete

| Table | Rows | Reason |
|---|---|---|
| `public.users` | 21 | WorkOS test identities |
| `public.user_profiles` | 21 | 1:1 with test users |
| `public.school_members` | 2 | Test user school memberships |
| `public.organization_members` | 2 | Test user org memberships |

## Rows to NULLify (not delete)

| Table | Rows | Column | Reason |
|---|---|---|---|
| `schools` | 2 | `owner_user_id` | Remove orphaned ownership (FK NULLifiable, no constraint) |
| `organizations` | 2 | `owner_user_id` | Remove orphaned ownership |

## Rows Preserved (NOT deleted)

| Table | Reason |
|---|---|
| `schools` (2 test schools) | Preserving per "prefer removing membership over deleting school" rule |
| `organizations` (2 test orgs) | Preserving; memberships removed |
| `students` (1 test student) | Associated with test school; no financial data |
| `onboarding_progress` (2 records) | Associated with test schools |
| `roles` (0 roles) | Test orgs had no roles |
| `role_permissions` | None for test orgs |
| `profiles` (legacy) | 0 references |
| `audit_logs` | 0 references |
| `kyc_records` | 0 records total |
| `kyc_verifications` | 0 records |
| All payment/financial tables | 0 references |

## Rollback Artifact

`docs/auth-phase6-purge-rollback.sql` contains INSERT statements for all 48 rows (21 users + 21 profiles + 2 school_members + 2 organization_members) plus owner_user_id restoration SQL.

## Purge Order

1. DELETE from `user_profiles` (child of users)
2. DELETE from `school_members` (child of users)
3. DELETE from `organization_members` (child of users)
4. UPDATE `schools` SET `owner_user_id = NULL` WHERE `owner_user_id` IN (WorkOS IDs)
5. UPDATE `organizations` SET `owner_user_id = NULL` WHERE `owner_user_id` IN (WorkOS IDs)
6. DELETE from `users` WHERE `id LIKE 'user_%'`

**Transaction safety**: The purge is executed via PostgREST REST API. PostgreSQL transactions are not available via REST, so each step is individually verified before proceeding. The rollback artifact (`docs/auth-phase6-purge-rollback.sql`) is generated BEFORE any deletion.

## Auth.users Verification

**LIVE DATABASE VERIFIED**: `auth.users` contains **0 rows**. None of the 21 WorkOS IDs exist in `auth.users`. No Supabase Auth users have been created. The purge will not affect `auth.users`.
