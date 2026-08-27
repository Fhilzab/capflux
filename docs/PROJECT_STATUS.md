# CAPFLUX Project Status

> **Canonical living source of truth for CAPFLUX development status.**
>
> Last updated: 2026-08-27
>
> This document consolidates verified repository evidence — Git history, code, migrations, tests, and documentation — into a single status reference. It distinguishes what is **implemented and verified** from what is **designed only**, **partially implemented**, **deferred**, or **not yet implemented**.

---

## Status Legend

| Symbol | Meaning |
|---|---|
| ✅ | Implemented and verified |
| 🟡 | Partially implemented / recovery required |
| ⏳ | Not yet implemented |
| ⏸️ | Deliberately deferred |
| 🔴 | Blocked |

---

# Current Development Position

```
Current active work:
  Sandbox Release Gate — database migration release gate ✅ COMPLETE
  (complete fresh migration replay 001–038+0822–0828 via governed bootstrap;
   migration 028 native UUID RLS convergence; zero auth.uid()::text residuals;
   schema/RLS/integrity verification; deterministic reset; 241 backend tests,
   54 frontend sandbox tests; frontend build; backend typecheck/build;
   compliance audit PASS on financial controls; production untouched)
  Previous: Sandbox / Demo Environment — full-system simulation mode ✅ COMPLETE
  (docs/sandbox/SANDBOX_MODE.md — isolated execution mode: deterministic demo
   dataset, in-browser API/payment/KYC simulators, offline-first sync, reset)

Next recommended milestone:
  Phase 9 — Onboarding Analytics & Error Recovery

Previous completed work:
  Phase 8.3 — Setup Center Recovery, Verification UX & Offline-Resilient UI Hardening ✅ COMPLETE
  Phase 8.2 — Progressive Access & KYC-Gated Features ✅ COMPLETE
  Phase 8.1 — Onboarding UI/UX Hardening ✅ COMPLETE
  Phase 8 — Onboarding & School Activation Journey Recovery ✅ COMPLETE

  Supabase Auth Migration Phase 7 — Production Acceptance & Security Hardening
  Backend: 163/163 tests passing
  Frontend: 184/184 tests passing (81 existing auth + 38 onboarding store + 13 routing + 36 SchoolSetupView + 6 useModuleLock + 10 ModuleLockOverlay)
  Build: SUCCESS

Deferred:
  Phase 2 Milestone 8A–8I — Payment Provider Integration
  Reason: Payment provider selection pending.
```

**Phase 8, 8.1, & 8.2 Complete.** The onboarding recovery audit (`docs/onboarding-phase8-recovery-audit.md`), implementation completion report (`docs/phase8-onboarding-recovery-completion.md`), UI/UX hardening report (`docs/phase8.1-onboarding-uiux-hardening-completion.md`), and progressive-access report (`docs/phase8.2-progressive-access-completion.md`) are all complete.

## Progressive Access

CAPFLUX uses a progressive-access model for feature authorization:

- **Authentication** grants access to CAPFLUX (dashboard, students, guardians, school profile, settings, KYC dashboard).
- **Onboarding** is NOT a global application lock — users reach the dashboard immediately upon authentication. `/setup` is the voluntary Setup & Verification Center.
- **KYC** gates sensitive financial features at the page level via `ModuleLockOverlay` + `useModuleLock`.
- **Settlement** and **Payment Activation** are checked as progressively deeper gates for payment-sensitive features.
- **`useModuleLock` composable** is the single source of truth for capability checks (reads from `onboardingStore` and `financialActivationStore`).
- **Backend remains authoritative** — `requirePaymentReady` middleware and `PaymentActivationService` enforce payment readiness at the API layer.

---

# Feature Status Table

| Area | Status | Evidence | Remaining Work |
|---|---|---|---|
| Foundation | ✅ | Git `679cad1`–`2c4d04c`, README §5 | — |
| Supabase Auth | ✅ | Phase 6/7, 163 backend tests | — |
| Auth (OAuth, password reset, MFA, sessions) | ✅ / ⏳ | Phase 7 tests (email, Google OAuth, reset, logout, session) | MFA not implemented; device registration not implemented |
| RBAC | ✅ | `AuthorizationService.js`, `staffAuth.js`, 23 permissions seeded, 7d21805 | Role management UI not built |
| Organization Context | ✅ | `frontend/src/shared/organization/`, migrations 004–011 | — |
| School Lifecycle | ✅ | `frontend/src/shared/school/`, `school_members` table, migrations 020 | — |
| Students / Guardians | ✅ | `StudentListView`, `GuardianRepository.ts`, `Guardian` entity (645ea83) | — |
| Academic Sessions & Terms | ✅ | `frontend/src/shared/academic/`, migration 005+ | — |
| Fee Management | ✅ | `frontend/src/shared/fees/`, migrations 006–012 | — |
| Billing Service | ✅ | `backend/services/` (PaymentService, LedgerService, BillingService in frontend) | `billing.ts` types path may differ |
| Financial Ledger | ✅ | Append-only `ledger_entries`, `LedgerService.js`, idempotency test (1e11f44) | — |
| Payment State Machine | ✅ | `payment_transactions` PENDING/PROCESSING/SUCCESS/FAILED/REVERSED, `PaymentService.js` | — |
| Payment Architecture | ✅ | `PaymentGateway.js`, `GatewayFactory.js`, `MonnifyGateway.js`, `PaystackGateway.js` | — |
| DVA Architecture | ✅ | `DVAService.js`, `payment_accounts` table, migrations 017 | — |
| KYC | 🟡 | `IdentityVerificationService.js`, `kyc.js`, NIN/BVN/CAC validators | Production provider verification pending |
| Settlement | 🟡 | `SettlementService.js`, `SettlementVerificationService.js` | Production provider verification pending |
| Notifications | ✅ | `frontend/src/shared/notifications/`, Milestone 14 (701edf9) | Termii integration is "planned" per README |
| Offline Sync | ✅ | `localDb.ts` (Dexie), `DownloadSyncEngine`, `UploadSyncEngine`, `syncEngine.ts` | — |
| Offline Encryption | ⏳ | `crypto.ts` (AES-256-GCM) | Local DB encryption (Dexie) not implemented |
| Onboarding Flow | ✅ | `onboardingStore.ts`, `onboarding.js`, 4-step wizard, `onboarding_progress` | Phase 8/8.1/8.2 (2026-08-18) |
| School Activation | ✅ | `requirePaymentReady.js`, `PaymentActivationService.js`, activation gates | Phase 8 complete; progressive access enabled (8.2) |
| Payment Provider Integration | ⏸️ | Gateway architecture fully implemented, capability-matrix CODE_VERIFIED | DEFERRED — provider selection pending |
| MFA | ⏳ | Documented in `authentication.md` | Not implemented |
| Rate Limiting | ⏳ | Documented in `api_security.md` | Not implemented |
| Audit Logging | ✅ | `auditService.js`, `audit_log` table, Milestone 13 (19f68f3) | Advanced anomaly detection not implemented |
| Webhook Verification | ✅ | `WebhookVerifier.js`, `webhook-contract.test.js` | Production webhook secrets not configured |
| Disaster Recovery | ⏳ | Documented in `compliance_and_dr.md` | Not implemented |
| Compliance Reporting | ⏳ | Documented in `compliance_and_dr.md` | Not implemented |

---

# Detailed Area Status

## Foundation

```
Status: ✅ IMPLEMENTED AND VERIFIED
```

Git history (`679cad1` → `2c4d04c`):
- Ubuntu development environment
- Git & GitHub
- Vue 3 + Vite + TypeScript
- Tailwind CSS
- Vue Router (7+ route types)
- Pinia (5+ stores)
- Axios
- Dexie.js / IndexedDB
- Supabase SDK
- Project architecture (hybrid feature-based)
- VS Code Server

Evidence: `README.md` §36–46, `docs/architecture/ROADMAP.md`, Git `04b5966`.

## Supabase Authentication

```
Status: ✅ COMPLETE
```

Architecture: `auth.users.id` (UUID) → `public.users.id` (UUID) → `user_profiles.user_id` (UUID) → all user-reference foreign keys (UUID).

Verified functionality:
- ✅ Email/password signup and login
- ✅ Email verification
- ✅ Password reset (forgot → email → reset → new password)
- ✅ Google OAuth (callback: `https://ootrovtrpoztmooiirxo.supabase.co/auth/v1/callback`)
- ✅ Logout (session cleared, authStore cleared, protected routes blocked)
- ✅ Session persistence (refresh restores authenticated state)
- ✅ JWT-based backend authentication (`requireAuthSupabase`)
- ✅ User identity consistency (no duplicate users on repeated login)
- ✅ Cross-school access protection
- ✅ Invalid token rejection
- ✅ Expired token rejection
- ✅ Identity spoofing rejection (x-user-id, x-school-id, body.userId, raw user ID as Bearer)
- ✅ Supabase Auth provisioning (idempotent trigger)
- ✅ Delete cascade verified
- ✅ UUID identity chain verified

Verification: Backend 163/163 tests, Frontend 81/81 tests, Build SUCCESS.

See: `docs/auth-phase6-completion.md`, `docs/auth-phase7-completion.md`.

## Authorization (RBAC)

```
Status: ✅ IMPLEMENTED (role management UI: ⏳ NOT IMPLEMENTED)
```

Git: `7d21805` — "Production RBAC Hardening"
Evidence:
- `AuthorizationService.js` — RBAC with role/permission caching
- `staffAuth.js` / `requireStaff` — staff permission middleware
- `permission-engine.ts` in `frontend/src/shared/rbac/`
- 23 base permissions + 10 KYC/activation permissions seeded
- Roles: SUPER_ADMIN, OWNER, ADMIN, BURSAR, PARENT (+ STUDENT in schema)
- Platform scope (SUPER_ADMIN) + school scope (OWNER, ADMIN, BURSAR, PARENT)
- Tests: `require-AuthSupabase.test.js` (15 tests), `schoolIsolation.test.js` (5 tests), `security.test.js` (7 tests), `financial-authz.test.js` (19 tests)

Remaining:
- No admin UI for role management (grant/revoke permissions in a user interface)

## Organization Context

```
Status: ✅ IMPLEMENTED
```

Git: `4f1b53c` — "Phase 3 - Organization Context Foundation"
Evidence:
- `frontend/src/shared/organization/` — OrganizationProvider, DefaultOrganizationProvider
- `organizations` table (migration 004)
- `organization_members` table (migration 004, updated in 020/022)
- `OrganizationRepository.ts` in `frontend/src/shared/repositories/`
- Organization context integrated with auth store

## School Lifecycle

```
Status: ✅ IMPLEMENTED
```

Git: `65c4ed0` — "Phase 4 - School Lifecycle Foundation"
Evidence:
- `frontend/src/shared/school/` — SchoolProvider, SupabaseSchoolProvider
- `schools` table (migration 006) with division_id, owner_user_id
- `school_members` table (migration 004/020/021/027) with role_id, is_active
- `SchoolRepository.ts`
- `SchoolStore` with fault-tolerant initialization (recovery/phase2-stabilization Step 4)
- Multi-school support (school switching in authStore)

## Students & Guardians

```
Status: ✅ IMPLEMENTED
```

Git: `9e31b3e` — "Phase 7 - Student & Guardian Registry Foundation"
Commit: `645ea83` — "Implement a Guardian entity as a core part of the Capstone Fee-First architecture"
Evidence:
- `frontend/src/shared/students/` — StudentService, StudentRepository, StudentStore
- `frontend/src/shared/guardian/` — Guardian entity
- `GuardianRepository.ts`
- `StudentListView`, `StudentDetailView` (README §134-141)
- `students` table, `guardians` table (migrations)
- `docs/database/GUARDIAN_MIGRATION_NOTES.md`
- Multi-guardian relationships (2026-08-23): `student_guardians` join table with per-link
  relationship + one-primary invariant (partial unique index); atomic server RPC
  `set_student_primary_guardian` (demote→promote→mirror `students.guardian_id`, tenant-checked)
  used by online promotions and sync replay; consistency verify/repair RPCs; widened
  `guardian_relationship` enum; centralized relationship types in
  `shared/guardians/relationshipTypes.ts`; Student Detail Guardians card (add/link/edit/
  primary/remove), Guardians registry with add + single-scan counts, new `/guardians/:id`
  detail view with two-way navigation; offline via existing Dexie outbox.

## Academic Sessions & Terms

```
Status: ✅ IMPLEMENTED
```

Git: `ed9bf68` — "Phase 8 - Academic Session & Term Foundation"
Evidence:
- `frontend/src/shared/academic/` — AcademicProvider
- `academic_sessions` table, `academic_terms` table (migrations)
- Fees structured by term/session

## Fee Management

```
Status: ✅ IMPLEMENTED
```

Git: `b3c7c96` — "Phase 6 - Fee Management Foundation"
Evidence:
- `frontend/src/shared/fees/` — FeeService, FeeRuleEngine
- `tuition_configurations` table (migration 012)
- `fee_rules` table (migration 012)
- `FeeRuleRepository.ts`, `TuitionConfigurationRepository.ts`
- REFACTOR_TODOS.md items 9-10 (FeeRuleRepository, TuitionConfigurationRepository)

## Financial Ledger (Append-Only)

```
Status: ✅ IMPLEMENTED AND VERIFIED
```

Git: `94b3df0` — "Milestone 11 - Append-Only Financial Ledger"
Commit: `1e11f44` — "fix: enforce ledger idempotency"
Evidence:
- `ledger_entries` table — append-only, no UPDATE/DELETE grants
- `LedgerService.js` — immutable ledger operations
- `frontend/src/shared/ledger/` — LedgerEngine, LedgerService, LedgerProvider, SupabaseLedgerProvider
- Idempotency enforced (test: `security.test.js` — "DVA provisioning is idempotent")
- Correction via reversal entries (not destructive update)

Design principle: "FINANCIAL INTEGRITY — Financial mutations are represented through controlled/append-only financial records rather than destructive edits." This principle IS implemented in code.

## Payment Processing

```
Status: ✅ ARCHITECTURE IMPLEMENTED
Production provider verification: ⏸️ DEFERRED
```

Git: `7e647d2` — "Milestone 10 - Payment Processing & Receipt Generation"
Commit: `1c6f327` — "feat(payment): add provider abstraction, DVA routing, webhook verification, and settlement workflow"

Evidence — Payment Gateway Abstraction:
- `backend/services/PaymentGateway.js` — abstract interface
- `backend/services/gateways/` — GatewayFactory, MonnifyGateway, PaystackGateway, TestGateway
- `backend/services/GatewayAssignmentService.js` — provider selection per school
- `backend/routes/webhook.js` — webhook verification endpoint

Evidence — Payment State Machine:
- `payment_transactions` table with states: PENDING → PROCESSING → SUCCESS / FAILED / REVERSED
- `record_verified_payment()` SECURITY DEFINER RPC — atomic, idempotent payment + ledger update
- `PaymentService.js` — state transitions, amount validation
- Test: `payment-lifecycle.test.js` (7 tests) — state machine, amount validation, invalid transitions

Evidence — Receipt Generation:
- `frontend/src/shared/payments/ReceiptGenerator.ts`
- `ReceiptTemplate` component

Remaining:
- Production provider API verification (sandbox) — blocked by missing credentials

## DVA (Dedicated Virtual Accounts)

```
Status: ✅ ARCHITECTURE IMPLEMENTED
Production provider verification: ⏸️ DEFERRED
```

Git: `1c6f327` — "feat(payment): add provider abstraction, DVA routing, webhook verification, and settlement workflow"
Commit: `8cc5268` — "Architectural Refactor: Introduce a Dedicated Payment Accounts Domain"
Evidence:
- `backend/services/DVAService.js` — canonical idempotent DVA provisioning
- `payment_accounts` table with DVA lifecycle: PENDING / PROVISIONING / ACTIVE / FAILED / DISABLED
- `backend/routes/dva.js` — DVA routes
- `gateway_assignments` table — provider assignment per school
- Test: `security.test.js` — "DVA provisioning is idempotent"

Remaining:
- Production DVA provider verification — blocked by missing credentials

## KYC & Identity Verification

```
Status: 🟡 PARTIALLY IMPLEMENTED
```

Git: `dd3a6dd` — "Phase 2 Milestone 5 - Financial Activation & Payment Readiness"
Evidence:
- `backend/services/IdentityVerificationService.js` — NIN/BVN provider abstraction, capability-aware contract (`getCapabilities`, `verifiedFields`, `verificationStatus`)
- `backend/services/verification-matching.js` — capability-aware identity match + settlement-ownership eligibility + `sanitizeIdentityResult` (PII never reaches clients)
- `backend/routes/kyc.js` — KYC routes
- `backend/services/validators.js` — NIN (11 digits), BVN (11 digits), CAC (RC number), bank account, bank name enquiry
- `kyc_records` table, `kyc_verifications` table — verification history (extended m029: `verified_fields`/`comparison` JSON); `identity_verifications` is a doc inaccuracy — history lives in `kyc_verifications`
- `IdentityVerificationService` test suite: `verification-services.test.js` (30 tests — includes capability-aware matching, provider contract, failure normalization, PII non-leakage)

Status: Capability-aware verification contract implemented and tested (30/30). CAPFLUX matches only provider-verified fields (an unreturned field is `NOT_PROVIDED`, never `MISMATCH`); BVN verification and account-name enquiry are separate concepts, with CAPFLUX-ownership authorization applied on top. Provider verification remains PENDING_PROVIDER (Fincra pending credentials/API contract) — the mock is deliberately capability-conservative (identifier-only) so local dev never fabricates PII.

## Settlement Verification

```
Status: 🟡 PARTIALLY IMPLEMENTED
```

Git: `dd3a6dd` — "Phase 2 Milestone 5 - Financial Activation & Payment Readiness"
Evidence:
- `backend/services/SettlementService.js`
- `backend/services/SettlementVerificationService.js`
- `settlement_accounts` table, `settlement_account_verifications` table (migration 024; extended m029 with `verified_fields`/`comparison` + `settlement_accounts.ownership_match_status`)
- `backend/services/verification-matching.js` — `evaluateSettlementEligibility` (account-name ≠ BVN; capability-aware `NAME_MATCH`/`NAME_MISMATCH`/`NAME_NOT_VERIFIED`)
- Bank name enquiry (validator in `validators.js`)

Status: Settlement verification is capability-aware: account-name enquiry and BVN ownership are separate concepts, with CAPFLUX-ownership authorization applied on top (migration 029). Production provider verification remains PENDING_PROVIDER (Fincra pending credentials/API contract).

## Notifications

```
Status: ✅ IMPLEMENTED
```

Git: `701edf9` — "Milestone 14 - Multi-Channel Notification System"
Evidence:
- `frontend/src/shared/notifications/` — NotificationService
- `notification_queue` table (migration)
- Offline notification queueing (local queue persists during offline, syncs when online)
- README §29: "Offline billing and payment creation, Local notification logging, Background sync queue"
- Termii integration listed as "planned" in README §45 (external provider credential dependency)

## Audit Trail

```
Status: ✅ IMPLEMENTED
```

Git: `19f68f3` — "Milestone 13 - Audit Trail & Activity Logging"
Evidence:
- `backend/services/auditService.js`
- `audit_log` table (migration)
- Audit triggers on financial tables (RLS migration 028)
- Test: `security.test.js` — audit trail verification

## Offline-First Engine

```
Status: ✅ CORE IMPLEMENTED | Offline Security: ⏳ NOT IMPLEMENTED
```

Git: `f118ac4` — "Implement offline sync retry, notification queueing, and sync page updates"
Evidence:
- `frontend/src/offline/localDb.ts` — Dexie.js schema with stores: students, guardians, fee_configs, payments, ledger_entries, notifications, sync_queue, etc.
- `DownloadSyncEngine.ts` — periodic sync from Supabase
- `UploadSyncEngine.ts` — queue processing for offline→online sync
- `syncEngine.ts` — retry queue with visibility
- `crypto.ts` — AES-256-GCM encryption for sync queue entries
- README §126-131: "Local data is stored in IndexedDB via localDb.ts, Sync queue entries are kept in sync_queue, syncEngine processes pending items when online"

Not implemented (Security Phase 2 - Offline Security):
- ⏳ Dexie local database encryption (field-level)
- ⏳ Offline queue signing / tamper detection
- ⏳ Advanced conflict resolution (beyond simple retry)

## Onboarding Flow

```
Status: ✅ COMPLETE (Phase 8 — Onboarding & School Activation Journey Recovery)
         🟢 Phase 8.1 — Onboarding UI/UX Hardening ✅ COMPLETE (2026-08-18)
         🟢 Phase 8.2 — Progressive Access & KYC-Gated Features ✅ COMPLETE (2026-08-18)
         🟢 Phase 8.3 — Setup Center Recovery & Verification UX ✅ COMPLETE (2026-08-19)
```

Git: `cb684b0` — "Add fintech-inspired 3-stage onboarding flow" (original)
Phase 8 commit: `a27fa71` — "test(auth): harden phase 7 authentication acceptance"
Evidence:
- `backend/routes/onboarding.js` — onboarding routes (switched to `requireAuthSupabase` in Phase 4)
- `onboarding_progress` table (migration 019/022)
- `frontend/src/features/onboarding/` — onboarding views/steps
- `frontend/src/features/setup/SchoolSetupView.vue` — 4-step wizard (Profile → Organization → School → Owner Info), now the Setup & Verification Center (Phase 8.3)
- `frontend/src/stores/onboardingStore.ts` — TypeScript store with state-driven API contracts, error categorization
- `frontend/src/stores/financialActivationStore.ts` — KYC, settlement, and payment activation state
- `frontend/src/shared/services/api/errors.ts` — shared error categorization utility (NETWORK_ERROR, AUTH_ERROR, SERVER_ERROR, VALIDATION_ERROR, ONBOARDING_ERROR)
- `frontend/src/features/kyc/` — KYC dashboard, submission, and settlement views
- `frontend/src/features/dashboard/components/ActivationBanner.vue` — dashboard call-to-action
- `frontend/src/shared/rbac/RouteGuard.ts` — onboarding-aware routing guard
- `frontend/src/shared/services/api/client.ts` — axios instance with response interceptor (preserves HTTP status)
- `docs/onboarding-phase8-recovery-audit.md` — recovery audit
- `docs/phase8-onboarding-recovery-completion.md` — completion report

Onboarding journey (implemented):
```
User (signs up via Supabase Auth — email/password, Google OAuth)
  ↓
Profile (full_name, phone)
  ↓
Organization (create with owner)
  ↓
School (create with onboarding)
  ↓
Owner Information (phone, designation)
  ↓
Complete Setup → School ACTIVE, payment_status PENDING_KYC
  ↓
Dashboard + ActivationBanner ("Complete KYC to enable payments")
  ↓
KYC Submission → Settlement Account → Payment Readiness (DEFERRED)
```

Status: Phase 8 is COMPLETE. The onboarding journey is fully functional end-to-end:
- 4-step operational onboarding wizard with state restoration on refresh
- Onboarding-aware routing (incomplete → `/setup`, complete → `/dashboard`)
- Post-completion redirect to dashboard
- Error handling and network failure resilience
- 40 new frontend tests (30 store + 10 routing guard)

**SaaS onboarding completion** (profile, org, school setup) is distinguished from **financial/payment activation** (KYC, settlement, gateway, payment readiness). The gates exist and are tested. Payment provider activation remains DEFERRED (awaiting provider selection).

## School Activation (Financial)

```
Status: ✅ IMPLEMENTED — Activation gates verified by tests
```

Evidence:
- `backend/middleware/requirePaymentReady.js` — activation gate that checks:
  1. Active school membership (from `school_members`)
  2. Cross-school body.school_id rejection
  3. `schools.status === 'ACTIVE'`
  4. `schools.payment_status === 'READY'`
- `backend/services/PaymentActivationService.js` — activation evaluation
- `backend/routes/onboarding.js` — onboarding with financial activation gates
- Activation gates: School ACTIVE + KYC VERIFIED + Settlement VERIFIED + Gateway ASSIGNED + Payment READY
- Test: `activation.test.js` (7 tests), `financial-authz.test.js` (19 tests)

Status: Activation gates exist and are tested. Production verification requires payment provider integration (current blocker).

**SaaS onboarding completion** (profile, org, school setup) is distinguished from **financial/payment activation** (KYC, settlement, gateway, payment readiness). The gates exist but are not production-activated.

---

# Supabase Auth Migration (Phase 6–7)

```
Phase 6 — Supabase Auth Identity Migration: ✅ COMPLETE
Phase 7 — Production Acceptance & Security Hardening: ✅ COMPLETE
```

Completed work:
- ✅ Supabase Auth is the active authentication system
- ✅ UUID identity migration completed (migration 027)
- ✅ RLS migration completed (migration 028) — all policies use native `auth.uid()` (no `::text` casts)
- ✅ WorkOS test identities purged
- ✅ Supabase Auth provisioning trigger implemented (idempotent `ON CONFLICT DO UPDATE`)
- ✅ UUID identity chain: `auth.users.id` → `public.users.id` → `user_profiles.user_id` → all FKs
- ✅ Delete cascade verified
- ✅ `requireAuthSupabase` validates Supabase JWTs
- ✅ JWT-derived identity used by backend
- ✅ x-user-id spoofing rejected
- ✅ x-school-id spoofing rejected
- ✅ x-user-id spoofing rejected
- ✅ body.userId spoofing rejected
- ✅ query.userId spoofing rejected
- ✅ raw user IDs rejected as Bearer tokens
- ✅ Cross-school authorization tests
- ✅ Email signup/login/verification manually verified
- ✅ Google OAuth manually verified
- ✅ Provisioning idempotency verified
- ✅ Financial authorization boundary tested (401/403 at route level)
- ✅ Frontend secret audit passed (no SUPABASE_SERVICE_ROLE_KEY in frontend source or build output)
- ✅ Backend: 163/163 tests passing
- ✅ Frontend: 121/121 tests passing (81 existing + 40 new Phase 8 onboarding tests)
- ✅ Build: SUCCESS

**Migration Release-Gate Verification (2026-08-27):**
- ✅ Complete fresh migration replay 001–038 + 0822–0828 via governed bootstrap (`supabase/bootstrap/fresh-replay.cjs`)
- ✅ Migration 018/020/021/022 `auth.uid()::text = uuid` defects handled via explicit REPAIRS map (no historical edits)
- ✅ Migration 027 cursor syntax + dynamic SQL bugs fixed in REPAIRS
- ✅ Migration 028 executes and establishes final native-UUID RLS state
- ✅ Zero `auth.uid()::text` residuals in any policy
- ✅ All 18 user-reference columns are UUID with matching FKs
- ✅ 241 backend tests pass (including UUID identity consistency, provisioning idempotency, school isolation)
- ✅ 54 frontend sandbox tests pass

WorkOS code is **preserved for rollback** and must NOT be described as the active authentication provider:
- `backend/services/WorkOSAuthService.js` — preserved
- `backend/services/SessionService.js` — preserved
- `backend/middleware/requireAuth.js` — preserved (WorkOS)
- `backend/routes/auth.js` — preserved (WorkOS routes)
- `frontend/src/shared/auth/AuthKitProvider.ts` — preserved

See: `docs/auth-phase6-completion.md`, `docs/auth-phase7-completion.md`

---

# Historical Roadmap vs. Current Implementation

The original `docs/architecture/ROADMAP.md` defined 10 phases. The actual implementation (Git history) evolved beyond this plan. This table reconciles the two:

| ROADMAP.md Phase | Original Plan | Actual Implementation (Git) | Status |
|---|---|---|---|
| Phase 1 — Foundation | Environment setup | Git `679cad1`–`2c4d04c` (679cad1–f378b71–6a4e293) | ✅ COMPLETE |
| Phase 2 — Authentication | Auth setup | Superseded by Phase 1 Milestone 1 (`04b5966`) + Phase 2 Milestone 3 (WorkOS) + Auth Migration (022bc60–a27fa71) | ✅ COMPLETE (Supabase Auth) |
| Phase 3 — Dashboard | Dashboard views | `4f1b53c` Phase 3 + `fdfb2de` Financial Command Center | ✅ COMPLETE |
| Phase 4 — Students | Student registry | `65c4ed0` Phase 4 + `9e31b3e` Phase 7 (Student & Guardian Registry) | ✅ COMPLETE |
| Phase 5 — Billing | Billing system | `ec02f18` Phase 5 + `274ec13` Phase 9 (Billing Engine) | ✅ COMPLETE |
| Phase 6 — Payments | Payment integration | `b3c7c96` Phase 6 + `7e647d2` Milestone 10 (Payment Processing) | ✅ COMPLETE |
| Phase 7 — Notifications | Notification system | `9e31b3e` Phase 7 + `701edf9` Milestone 14 (Notifications) | ✅ COMPLETE |
| Phase 8 — Offline Engine | Offline operation | Original Phase 1 (`6a4e293`) + `f118ac4` sync + `localDb.ts` | ✅ COMPLETE |
| Phase 9 — Reports | Reporting | `274ec13` Phase 9 + `c510f30` Milestone 12 (Financial Reporting) | ✅ COMPLETE |
| Phase 10 — Production | Multi-school, RLS, audit, monitoring, backups | Milestones 11–14 + Phase 2 Milestones 1–7 | ✅ / 🟡 (some aspects) |

The ROADMAP.md status checkboxes (☐ for Phase 2+) are **outdated**. The implementation progressed through an expanded phase system: Phase 1 Milestone 1 → Phase 9, then Milestones 10–14, then Phase 2 Milestones 1–7. Do not treat ROADMAP.md checkboxes as authoritative — Git history is the source of truth.

---

# Implementation Milestone Status

All milestones verified via Git history:

| Milestone | Commit | Status | Notes |
|---|---|---|---|
| Phase 0 — Supabase Foundation | `f378b71` | ✅ | Migrations 001–011 |
| Phase 1 — Core Auth & Sync | `6a4e293` | ✅ | Auth + offline sync + backend |
| Phase 1 Critical Fixes | `79e81ae` | ✅ | UUID, RLS, RPC hardening |
| Phase 1 Milestone 1 — Auth Foundation | `04b5966` | ✅ | Authentication UI + store |
| Phase 2 — TypeScript Migration | `972e005` | ✅ | TS migration |
| Phase 3 — Organization Context | `4f1b53c` | ✅ | Organizations, divisions |
| Phase 4 — School Lifecycle | `65c4ed0` | ✅ | Schools, school_members |
| Phase 5 — School Division | `ec02f18` | ✅ | Divisions, class groups |
| Phase 6 — Fee Management | `b3c7c96` | ✅ | Tuition, fee rules |
| Phase 7 — Student & Guardian Registry | `9e31b3e` | ✅ | Students, guardians |
| Phase 8 — Academic Sessions & Terms | `ed9bf68` | ✅ | Academic context |
| Phase 9 — Billing Engine | `274ec13` | ✅ | Billing with academic context |
| Milestone 10 — Payment Processing & Receipts | `7e647d2` | ✅ | Payment state machine, receipts |
| Milestone 11 — Append-Only Financial Ledger | `94b3df0` | ✅ | Immutable ledger_entries |
| Milestone 11.5 — Ledger Integration | `d11372b` | ✅ | Ledger sync integration |
| Milestone 11.5.1 — Accounting Journal | `c2179c0` | ✅ | v1.1 accounting journal |
| Milestone 12 — Financial Reporting & Reconciliation | `c510f30` | ✅ | Reports, reconciliation |
| Milestone 13 — Audit Trail & Activity Logging | `19f68f3` | ✅ | Audit logging |
| Milestone 14 — Multi-Channel Notifications | `701edf9` | ✅ | Notifications |
| Phase 2 M1 — Frontend Integration | `1ac1b30` | ✅ | Legacy service migration |
| Phase 2 M2 — RBAC Hardening | `7d21805` | ✅ | DB-backed RBAC |
| Phase 2 M3 — WorkOS AuthKit Migration | `93e27a6` | ✅ → superseded | WorkOS auth (replaced by Supabase) |
| Phase 2 M4 — Foundation Repair | `6c15b4e` | ✅ → superseded | Session repair, data-plane |
| Phase 2 M5 — Financial Activation | `dd3a6dd` | ✅ | Payment readiness, KYC, settlement |
| Phase 2 M6 — Payment Infrastructure | `1085e62` | ✅ | DVA, reconciliation, state machine |
| Milestone 6.3 — Canonical Environment | `463c970` | ✅ | Env setup, DB deployment |
| Milestone 6.3.1 — Incremental | `463c970` | ✅ | Auth smoke test prep |
| Milestone 7 — Provider Integration Readiness | `463c970` | ✅ (partial) | Readiness verified; auth smoke test FAILED |
| Auth Smoke Test Fix | `ecc7cc4` | 🟡 | Attempted WorkOS fix (failed — led to migration) |
| **Phase 6 — Supabase Auth Identity Migration** | `2470a18` | ✅ | UUID migration, WorkOS purge |
| **Phase 7 — Production Acceptance & Security** | `a27fa71` | ✅ | 163 backend tests, 81 frontend tests, build SUCCESS |

### Phase 2 Milestone 8A–8I — Payment Provider Integration

```
Status: ⏸️ DEFERRED
Reason: Payment provider has not yet been finalized.
```

The payment provider architecture is fully implemented and code-verified:
- `PaymentGateway.js` (interface)
- `GatewayFactory.js` (provider factory)
- `MonnifyGateway.js`, `PaystackGateway.js`, `TestGateway.js`
- `PaymentService.js`, `DVAService.js`, `ReconciliationService.js`
- `GatewayAssignmentService.js`, `PaymentActivationService.js`
- `WebhookVerifier.js`
- Tests: `gateway.test.js`, `webhook-contract.test.js`, `provider-contract.test.js`

**Distinction:**
- Payment architecture: ✅ IMPLEMENTED
- Production provider integration: ⏸️ DEFERRED

The `docs/providers/capability-matrix.md` (updated Milestone 7) shows all capabilities as `CODE_VERIFIED` but production activation as `BLOCKED_PENDING_PROVIDER_ACCESS`.

Provider verification tests:
- `backend/tests/gateway.test.js` — Gateway factory/provider tests ✅
- `backend/tests/webhook-contract.test.js` — Webhook verification ✅
- `backend/tests/provider-contract.test.js` — Provider contract tests ✅

These tests verify the provider code but not production credentials.

---

# Onboarding Status

## Current State

```
Status: ✅ COMPLETE (Phase 8 — Onboarding & School Activation Journey Recovery)
         🟢 Phase 8.1 — Onboarding UI/UX Hardening ✅ COMPLETE (2026-08-18)
         🟢 Phase 8.2 — Progressive Access & KYC-Gated Features ✅ COMPLETE (2026-08-18)
         🟢 Phase 8.3 — Setup Center Recovery & Verification UX ✅ COMPLETE (2026-08-19)
```

Git: `cb684b0` — "Add fintech-inspired 3-stage onboarding flow" (original)
Phase 8 completion: 2026-08-18

### Audit Complete

The onboarding Phase 8 recovery audit is complete:
- `docs/onboarding-phase8-recovery-audit.md` — recovery audit findings
- `docs/phase8-onboarding-recovery-completion.md` — completion report

Phase 8.1 UI/UX hardening:
- `docs/phase8.1-onboarding-uiux-hardening-completion.md` — UI/UX completion report
- Error categorization (NETWORK_ERROR, AUTH_ERROR, SERVER_ERROR, VALIDATION_ERROR, ONBOARDING_ERROR)
- Onboarding-specific layout (no dashboard shell during /setup)
- Tests: 139/139 frontend (81 existing + 30 store + 10 routing + 18 SchoolSetupView)

Phase 8.2 Progressive Access:
- `docs/phase8.2-progressive-access-completion.md` — progressive access completion report
- Removed global redirect to /setup for incomplete onboarding/KYC
- Backend-authorized capability gates (setup → KYC → settlement → payment) at page level
- `ModuleLockOverlay` enhanced with KYC, settlement, and provider-readiness variants
- `useModuleLock` composable exposes granular capability checks
- BillingView KYC gate added
- Tests: 158/158 frontend (81 existing + 30 store + 10 routing + 18 SchoolSetupView + 16 Phase 8.2)

- ✅ Onboarding code audited end-to-end
- ✅ All transitions, edge cases, and production states verified
- ✅ School activation gates implemented and tested
- ✅ Payment provider activation DEFERRED (not a blocker)

### Existing Implementation

The onboarding architecture is implemented:

**Backend:**
- `backend/routes/onboarding.js` — onboarding API routes (switched to `requireAuthSupabase` in Phase 4)
- `onboarding_progress` table (migration 019/022) — tracks onboarding state per user
- Integration with `requireAuthSupabase`, `AuthorizationService`, `requirePaymentReady`

**Frontend:**
- `frontend/src/features/onboarding/` — onboarding views and steps
- `frontend/src/shared/organization/` — OrganizationProvider, DefaultOrganizationProvider
- `frontend/src/shared/school/` — SchoolProvider, SupabaseSchoolProvider
- `frontend/src/shared/rbac/` — RBACProvider, BackendRBACProvider
- AuthStore methods: `initialize()`, `restoreSession()`, `signOut()`, `forgotPassword()`, `resetPassword()`, `signInWithProvider('google')`, `handleOAuthCallback()`

### Onboarding Journey (Designed)

```
User (signs up via email or Google OAuth)
  ↓
Profile (full_name, phone, avatar_url)
  ↓
Organization (create new or join existing)
  ↓
School (create new or join existing)
  ↓
School Setup (grades, terms, fee structures)
  ↓
Activation (financial gates: KYC, settlement, gateway, payment readiness)
```

### Audit Status

The onboarding Phase 8 recovery audit document `docs/onboarding-phase8-recovery-audit.md` **exists** and is complete.

- ✅ Onboarding code audited end-to-end
- ✅ All transitions, edge cases, and production states verified
- ✅ School activation gates implemented and tested
- ✅ Progressive access architecture implemented (Phase 8.2)
- ✅ Payment provider activation DEFERRED (not a blocker)

---

## Progressive Access Philosophy

> **Authentication grants access to CAPFLUX. KYC and financial activation grant access to specific sensitive capabilities.**

- **Authentication ≠ KYC completion** — Any authenticated user can reach the dashboard and use normal school-management features (students, guardians, school profile, settings) regardless of whether KYC or onboarding is complete.
- **Onboarding is not a global application lock** — Users are no longer force-redirected to `/setup` when onboarding/KYC is incomplete. The `/setup` page is a voluntary **Setup & Verification Center** that users enter to complete outstanding requirements.
- **KYC is capability-specific** — Only sensitive financial features (billing, payments, settlements, virtual accounts, financial reports) are gated behind individual verification checks.
- **Sensitive features are individually gated** — Each protected page renders a contextual `ModuleLockOverlay` with the specific verification gate that is unsatisfied (setup → KYC → settlement → payment readiness).
- **Backend authorization remains authoritative** — The frontend gates are a UX/access-preflight layer. The backend (`requirePaymentReady`, KYC status checks, RLS) enforces all financial security.

---

## Route Capability Matrix

| Route / Feature | Auth | Onboarding | KYC | Settlement | Financial Activation |
|---|---|---|---|---|---|
| Dashboard | ✓ | — | — | — | — |
| Students | ✓ | — | — | — | — |
| Guardians | ✓ | — | — | — | — |
| School Profile | ✓ | — | — | — | — |
| Settings | ✓ | — | — | — | — |
| Billing (`/billing`) | ✓ | ✓ | ✓ | — | — |
| Payments (`/payments`) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Settlements (`/settlements`) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Virtual Accounts (`/virtual-accounts`) | ✓ | ✓ | ✓ | as required | ✓ |
| Revenue Dashboard (`/reports/revenue-dashboard`) | ✓ | ✓ | ✓ | — | ✓ |
| Daily Collections (`/reports/daily-collections`) | ✓ | ✓ | ✓ | as required | ✓ |
| Outstanding Fees (`/reports/outstanding-fees`) | ✓ | ✓ | ✓ | — | ✓ |
| KYC (`/kyc`) | ✓ | — | — | — | — |
| Setup & Verification (`/setup`) | ✓ | ✓ | ✓ | ✓ | ✓ |

> **Note (Phase 8.3):** The `/setup` route now hosts the full Setup & Verification Center (Account Setup, Identity Verification, Settlement, Payment Activation). The KYC/Settlement/Payment Activation columns reflect the voluntary verification sections exposed within the Center these are progressively-gated capabilities presented but not required to access the page.

**Gate chain applied:** Onboarding incomplete → KYC incomplete → Settlement incomplete → Payment not ready → ACCESS.

---

# Current Development Position

```
┌─────────────────────────────────────────────────────────┐
│  PREVIOUSLY COMPLETED: Phase 8.3                        │
│  Setup Center Recovery & Verification UX ✅ COMPLETE     │
│                                                          │
│  Also complete: Phase 8.2 (Progressive Access),        │
│  Phase 8.1 (UI/UX Hardening), Phase 8 (Recovery)        │
│                                                          │
│  No onboarding code audit pending — all phases         │
│  audited and implemented.                               │
│                                                          │
│  Backend 163/163 · Frontend 184/184 · Build SUCCESS    │
│                                                          │
│  Deferred:                                              │
│  • Phase 2 Milestone 8A–8I — Payment Provider           │
│    Integration (provider selection pending)              │
│                                                          │
│  Next recommended:                                      │
│  • Phase 9 — Onboarding Analytics & Error Recovery      │
└─────────────────────────────────────────────────────────┘
```

---

# Exact Resume Point

**Phase 8.3 — Setup Center Recovery & Verification UX — COMPLETE**

Phase 8.3 hardened the `/setup` page into a resilient Setup & Verification Center that survives network/API failures. The primary fix was correcting an error-masking bug in the axios response interceptor that caused ALL API failures (401, 403, 404, 500, genuine network) to be misclassified as `NETWORK_ERROR`, collapsing the page into a blank "Connection problem" screen. The interceptor now preserves `.response` while enriching errors with `isNetworkError`/`status`/`backendMessage`, so HTTP status codes flow through to `categorizeApiError()` for accurate categorization (NETWORK_ERROR, AUTH_ERROR, SERVER_ERROR, VALIDATION_ERROR, ONBOARDING_ERROR).

**Phase 8.2 — Progressive Access & KYC-Gated Features — COMPLETE**

## What Was Done

### Phase 8 — Onboarding Recovery (2026-08-18)
1. **Recovery Audit** — Confirmed all onboarding infrastructure already existed and was contract-aligned.
2. **Routing** — Added onboarding-aware routing (Phase 8.1): authenticated + incomplete → `/setup`; complete → `/dashboard`.
3. **State Restoration** — `restoreStepFromStatus()` in `onboardingStore.ts` resumes correct step on refresh.
4. **Post-Completion Redirect** — `SchoolSetupView.vue` redirects to `/dashboard` after `completeOnboarding()`.
5. **UI Fix** — `ProfileStep.vue` WorkOS reference → CAPFLUX.
6. **Error Categorization** — `contextualizeError()` with categories + retry in `onboardingStore.ts`.
7. **Tests** — 40 frontend tests (30 store + 10 routing).
8. **Documentation** — Audit + completion report created.

### Phase 8.1 — Onboarding UI/UX Hardening (2026-08-18)
1. Fixed duplicate heading (page title vs step title).
2. Fixed raw "Network Error" — contextual messages + duplicate `loadStatus` eliminated.
3. Redesigned layout (centered, comfortable width, horizontal stepper).
4. Added onboarding-specific layout (sidebar hidden).
5. Added `ProfileStep.vue` email display.
6. Enhanced `OnboardingChecklist` — horizontal stepper.
7. 18 SchoolSetupView tests + 16 enhanced store tests.
8. **Documentation** — `docs/phase8.1-onboarding-uiux-hardening-completion.md`.

### Phase 8.2 — Progressive Access (2026-08-18)
1. **Removed global redirect to `/setup`** — authenticated users now reach `/dashboard` regardless of onboarding/KYC state.
2. **Backend-authorized capability gates** at page level (setup → KYC → settlement → payment) via `useModuleLock` + `ModuleLockOverlay`.
3. **`ModuleLockOverlay`** enhanced with `kyc`, `settlement`, `provider` variants.
4. **`useModuleLock`** extended with KYC/settlement checks from `financialActivationStore`.
5. **7 protected views** updated with granular gates (BillingView KYC gate added).
6. **`/setup`** is now a voluntary Setup & Verification Center (no forced redirect).
7. 16 new tests (useModuleLock + ModuleLockOverlay).
8. **Tests** — 184/184 frontend (81 existing + 38 store + 13 routing + 36 SchoolSetupView + 6 useModuleLock + 10 ModuleLockOverlay + 26 Phase 8.3). Build: SUCCESS.
9. **Documentation** — `docs/phase8.2-progressive-access-completion.md`.

### Phase 8.3 — Setup Center Recovery & Verification UX (2026-08-19)
1. **Root cause: error masking** — axios response interceptor in `client.ts` reconstructed every error as `new Error(message)`, stripping the original `.response`. The local `apiCall` wrapper then checked `err.response` to categorize — but since `.response` was gone, ALL failures (401, 403, 404, 500, network) were classified as `NETWORK_ERROR` → "Connection problem".
2. **Blank screen fix** — `SchoolSetupView.vue` `v-else-if="storeError && !onboardingStore.status"` replaced the entire page with a centered error card. Redesigned into a resilient Setup & Verification Center that always renders the full shell (header, sections, CTAs) with the error as a contextual banner.
3. **Shared error categorization** — Extracted `categorizeApiError()` into `frontend/src/shared/services/api/errors.ts` (categories: NETWORK_ERROR, AUTH_ERROR, SERVER_ERROR, VALIDATION_ERROR, ONBOARDING_ERROR) with `CATEGORY_MESSAGES` for user-friendly text.
4. **Offline-first resilience** — cached `onboardingStore.status` preserved across errors; skeleton shown during initial load; "Status unavailable" labels when no cached data exists.
5. **Request deduplication** — module-level `_pendingLoadStatus` in onboardingStore and `_pendingLoads` + `_activeLoadCount` in financialActivationStore prevent concurrent duplicate API requests.
6. **Setup & Verification Center** — 4 sections (Account Setup, Identity Verification, Settlement, Payment Activation) using existing `onboardingStore` + `financialActivationStore`; no new state-management systems; progressive-access explanation included.
7. **Retry behavior** — `retryLoadStatus` calls both `loadStatus()` and `financialStore.loadAll()` via `Promise.allSettled`; retry button disabled while in-flight; never redirects to dashboard on failure.
8. **useModuleLock cleanup** — switched from individual `loadKycStatus`/`loadReadiness` calls to `financialStore.loadAll()` with `*Loaded` flags to prevent redundant re-fetches.
9. **Response normalization** — `normalizeStatus()` maps the flat `get_onboarding_status` RPC payload to the nested `OnboardingStatus` shape, handling both legacy and current API shapes.
10. **Tests** — 8 new store tests (error categorization: 401/403/404/422/500/timeout + dedup + cached-state preservation), 18 new SchoolSetupView tests (loading/blank-screen/error/retry/routing/responsive/sections). Total: 26 new tests.
11. **Documentation** — `docs/phase8.3-setup-verification-center-hardening.md`.

## Routing (Progressive Access)

- Authenticated users → `/dashboard` (NOT forced to `/setup`)
- Authenticated users can voluntarily enter `/setup` (Setup & Verification Center)
- Unauthenticated users → `/auth`
- Legacy `/onboarding/*` URL redirects to `/setup`
- Sensitive financial features individually gated at page level (`ModuleLockOverlay`)

## Next Recommended Milestone

**Phase 9 — Onboarding Analytics & Error Recovery**
- Onboarding funnel analytics (drop-off tracking)
- Form auto-save with Dexie persistence
- Server-side error message mapping
- Onboarding progress email notifications
- Backend unit tests for `/onboarding/*` endpoints---

**Phase 9 — Progressive Access Enhancement (Optional)**
- Capability-based route metadata (`requiresCapability`)
- Centralized verification gate service layer
- Cross-feature verification status dashboard
- Backend unit tests for `/onboarding/*` endpoints

---

# Protected Architecture — Do Not Reopen Without a Verified Defect

These systems have been designed, implemented, tested, and verified. They must not be modified, redesigned, or "improved" without a verified defect:

| System | Why Protected |
|---|---|
| **Supabase Auth** (Phase 7) | 163 backend tests, 81 frontend tests. Email/password, Google OAuth, password reset, session persistence all verified. UUID identity chain proven. |
| **UUID identity chain** (`auth.users.id` → `public.users.id` → `user_profiles.user_id` → all FKs) | Migration 027 completed. All 18 user-reference columns converted to UUID. Identity consistency verified. |
| **RLS policies** (migration 028) | All policies use native `auth.uid()` (no `::text` casts). School/tenant isolation enforced at database level. |
| **`requireAuthSupabase` middleware** | Validates Supabase JWTs via `supabase.auth.getUser()`. Rejects x-user-id, x-school-id, body.userId, raw user ID as Bearer. 15 tests covering all attack vectors. |
| **`AuthorizationService.js`** | RBAC with role/permission caching. Derives school from server-side `school_members`, not client headers. |
| **Financial state machine** (`payment_transactions`) | PENDING/PROCESSING/SUCCESS/FAILED/REVERSED. 7 tests verify only valid transitions. No destructive edits. |
| **Append-only ledger** (`ledger_entries`) | No UPDATE/DELETE grants. Corrections via reversal entries. Idempotency enforced. |
| **`PaymentGateway.js` + `GatewayFactory.js`** | Provider-agnostic gateway abstraction. Monnify/Paystack/Test gateways implemented. |
| **DVA architecture** (`DVAService.js`) | Canonical idempotent provisioning. DVA lifecycle tracked in `payment_accounts`. |
| **Offline architecture** (`localDb.ts`, `syncEngine.ts`) | Dexie.js IndexedDB schema with queue-based sync. AES-256-GCM crypto for queue integrity. |
| **Migrations 001–028** | Complete migration history. Do not modify or reset. |
| **`schema_migrations`** | Migration tracking table. Do not alter. |
| **WorkOS legacy code** (rollback only) | `WorkOSAuthService.js`, `SessionService.js`, `requireAuth.js`, `routes/auth.js`, `AuthKitProvider.ts` — preserved for rollback. Not active auth path. |
| **`requirePaymentReady.js`** | Financial activation gate. Checks ACTIVE + KYC VERIFIED + SETTLEMENT VERIFIED + GATEWAY ASSIGNED + READY. |
| **Financial state machine integrity** | `record_verified_payment()` SECURITY DEFINER RPC — atomic, idempotent payment + ledger update. |

---

# Deferred Work

| Item | Reason | Status |
|---|---|---|
| Phase 2 Milestone 8A–8I — Payment Provider Integration | "Payment provider has not yet been finalized" (explicit project decision) | ⏸️ DEFERRED |
| Production Monnify API verification | No production credentials | ⏸️ DEFERRED |
| Production Paystack API verification | No production credentials | ⏸️ DEFERRED |
| Production webhook secret configuration | No provider credentials | ⏸️ DEFERRED |
| Termii notification integration | "planned" per README §45 | ⏸️ DEFERRED |

All other deferred items are tracked as "not yet implemented" (⏳) rather than deferred, since there is no explicit project decision to postpone them.

---

# Not Yet Implemented

| Feature | Security Phase | Evidence |
|---|---|---|
| MFA (TOTP for admin/owner) | Security Phase 1, Control 3 | Documented in `authentication.md`: "MFA for owner/admin via supabase.auth.mfa" — not in code |
| Device registration | Security Phase 1, Control 5 | Documented: "New devices require MFA" — not in code |
| Auth rate limiting | Security Phase 1, Control 6 / Phase 5 | Documented in `api_security.md` — `rate_limit` table exists (migration 010) but enforcement not implemented |
| Password policy (12 chars) | Security Phase 1, Control 2 | `supabase/config.toml`: `minimum_password_length = 6` (docs say 12); `RegisterForm.spec.ts` shows password guidance UI but no backend enforcement |
| Offline DB encryption (Dexie) | Security Phase 4, Control 1 | `crypto.ts` has AES-256-GCM but Dexie encryption not implemented |
| Offline queue signing | Security Phase 4, Control 2 | Queue integrity via crypto field but no signing/tamper detection |
| Advanced conflict resolution | Security Phase 4, Control 3 | Basic retry exists; advanced resolution not implemented |
| Role management UI | Security Phase 2, Control 3 | RBAC engine exists; admin UI for role management not built |
| API rate limiting | Security Phase 5, Control 1 | Documented; not implemented |
| Webhook signature verification (production) | Security Phase 5, Control 2 | `WebhookVerifier.js` exists and tested; production webhook secrets not configured |
| Comprehensive input validation | Security Phase 5, Control 3 | `validators.js` exists (NIN, BVN, CAC, bank) but not all endpoints have full validation |
| Anomaly detection | Security Phase 6, Control 2 | Not started |
| Health checks | Security Phase 6, Control 3 | Not started |
| Disaster recovery | Security Phase 7, Control 2 | Documented in `compliance_and_dr.md`; not implemented |
| Compliance reporting | Security Phase 7, Control 3 | Documented; not implemented |

---

# Partially Implemented

| Feature | Status | Evidence | Gap |
|---|---|---|---|
| Onboarding flow | 🟡 | `cb684b0` 3-stage onboarding, `onboarding.js`, `onboarding_progress` table | Full end-to-end audit not complete; `docs/onboarding-phase8-recovery-audit.md` does not exist |
| School activation | 🟡 | `requirePaymentReady.js`, `PaymentActivationService.js`, activation gates | Not production-verified (awaiting provider credentials) |
| KYC/Settlement | 🟡 | `IdentityVerificationService.js`, validators, `kyc.js` | Production provider API verification pending |
| Security Phase 1 controls | 🟡 | Supabase Auth ✅, email verification ✅, JWT expiry ✅ (config.toml 3600s) | MFA ⏳, device reg ⏳, rate limiting ⏳, password policy mismatch (6 vs 12) |
| Security Phase 2 controls | 🟡 | RBAC ✅ | Cross-tenant prevention ✅ (RLS + auth migration), Role management UI ⏳ |
| Audit logging | 🟡 | `auditService.js`, audit triggers on financial tables | Anomaly detection ⏳, health checks ⏳ |
| Offline sync | ✅ core, 🟡 security | `localDb.ts`, sync engines, retry queue | DB encryption ⏳, queue signing ⏳, conflict resolution ⏳ |
| Payment provider integration | 🟡 architecture | Gateway abstraction + gateways code-verified | Production provider verification ⏸️ DEFERRED |

---

# Test Status

```
Backend:  163/163 tests passing  (0 failures)
Frontend:  184/184 tests passing  (0 failures)
Build:     SUCCESS
```

### Backend Test Suites (11 suites, 163 tests)

| Suite | Tests | Coverage |
|---|---|---|
| `auth.test.js` | 44+ | WorkOSAuthService error mapping, SessionService cookies, AuthKit URLs, OAuth state |
| `auth-security.test.js` | 3 | No WorkOS secrets in frontend, no @workos-inc/node import, no localStorage credentials |
| `crypto.test.js` | 7 | AES-256-GCM encryption, masking, queue integrity |
| `gateway.test.js` | 12+ | GatewayFactory, provider selection, error handling |
| `payment-lifecycle.test.js` | 7 | Payment state machine transitions, amount validation, invalid transitions |
| `provider-contract.test.js` | 2 | Provider contract compliance |
| `require-AuthSupabase.test.js` | 15 | JWT validation, identity spoofing rejection, cross-school isolation |
| `schoolIsolation.test.js` | 5 | AuthorizationService, cross-school access denial |
| `security.test.js` | 7 | Payment readiness, cross-school scope, webhook fail-closed, DVA idempotency |
| `validators.test.js` | 7+ | NIN, BVN, CAC, bank account, bank name enquiry validation |
| `verification-services.test.js` | 30 | Identity/settlement verification service logic + capability-aware matching, provider contract, failure normalization, PII non-leakage |
| `webhook-contract.test.js` | 5+ | Webhook verification, idempotency, fail-closed |
| `activation.test.js` | 7 | Payment activation gates and RBAC |
| `provisioning-regression.test.js` | 17 | Provisioning trigger idempotency, UUID chain, RLS pattern verification (NEW) |
| `financial-authz.test.js` | 19 | Financial route auth boundary, requirePaymentReady, requireStaff, cross-school (NEW) |

### Frontend Test Suites (10 suites, 184 tests)

| Suite | Tests | Coverage |
|---|---|---|
| `SupabaseAuthProvider.spec.ts` | 34 | initialize, restoreSession, onAuthStateChange, signUp, signIn, OAuth, signOut, forgotPassword, resetPassword |
| `LoginForm.spec.ts` | 12 | Form validation, password visibility, error display |
| `RegisterForm.spec.ts` | 15 | Password policy guidance, validation, UX states |
| `AuthView.spec.ts` | 7 | Mode routing (login/signup), OAuth callback, error states |
| `AuthError.spec.ts` | 13 | Error code mapping, user-friendly messages |
| `onboardingStore.spec.ts` | 38 | loadStatus (success/failure/8 error categories/dedup/cached-state), saveProfile, createOrganization, createSchool, saveOwnerInfo, completeOnboarding, getKycStatus |
| `onboardingRouting.spec.ts` | 13 | Progressive access routing, dashboard accessibility, setup voluntary access, redirect chains |
| `useModuleLock.spec.ts` | 6 | Module lock logic, capability flags, loading state |
| `ModuleLockOverlay.spec.ts` | 10 | KYC/settlement/provider overlay variants, navigation CTAs |
| `SchoolSetupView.spec.ts` | 36 | Shell rendering, loading skeleton, error banner (no blank screen), retry, step navigation, verification sections |

---

# Database Status

### Migration Status

| Migration | Purpose | Status |
|---|---|---|
| 001–011 | Foundation (tables, indexes, functions, RLS, views, seeds) | ✅ Applied |
| 012–016 | Tuition, fees, students, registration, data migration, RLS | ✅ Applied |
| 017–019 | Payment accounts, RBAC tables, onboarding progress | ✅ Applied |
| 020–025 | WorkOS auth, onboarding, ledger idempotency, financial activation, payment infrastructure | ✅ Applied |
| 026 | Identity migration tracking | ✅ Applied |
| 027 | UUID identity migration (auth.users → public.users → user_profiles) | ✅ COMPLETE |
| 028 | RLS / auth.uid() migration (native UUID, no ::text casts) | ✅ COMPLETE |

**Migration 027 — UUID Identity Migration: COMPLETE**
- All user-reference columns converted from TEXT to UUID
- `school_members.user_id` reverted from TEXT to UUID
- `public.users.id` is UUID matching `auth.users.id`
- Provisioning trigger uses `ON CONFLICT (id) DO UPDATE` — idempotent

**Migration 028 — RLS / auth.uid() Migration: COMPLETE**
- All RLS policies use `auth.uid() = column` (native UUID comparison)
- No `auth.uid()::text` casts in any policy
- Security DEFINER functions use `SECURITY DEFINER` with restricted `search_path`

### Schema Overview

```
auth.users                    (Supabase Auth — JWT source of truth)
    ↓ (UUID)
public.users                  (application user record)
    ↓ (UUID)
user_profiles                 (profile: name, phone, avatar)
    ↓
organizations                 (business entity)
    ↓
organization_members          (user → org membership with role)
    ↓
schools                       (school under organization)
    ↓
school_members                (user → school membership with role)
    ↓
academic_sessions / terms     (academic calendar)
    ↓
students                      (student records)
    ↓
guardians                     (guardian → student relationship)
    ↓
tuition_configurations        (fee structures)
    ↓
fee_rules                     (fee calculation rules)
    ↓
fee_rule_assignments          (rules → students)
    ↓
payment_transactions          (PENDING → PROCESSING → SUCCESS/FAILED/REVERSED)
    ↓
ledger_entries                (append-only immutable ledger)
    ↓
payment_accounts              (DVA lifecycle: PENDING/PROVISIONING/ACTIVE/FAILED/DISABLED)
    ↓
notifications                 (notification queue)
    ↓
audit_log                     (activity logging)
```

### Key Tables

| Table | Purpose |
|---|---|
| `auth.users` | Supabase Auth users (JWT source) |
| `public.users` | Application user records |
| `user_profiles` | Profile: full_name, phone, avatar_url |
| `profiles` | Legacy profile table (pre-migration 021) |
| `organizations` | School organizational entities |
| `organization_members` | User-org membership with roles |
| `schools` | School entities (status, payment_status, division_id, owner_user_id) |
| `school_members` | User-school membership (role_id, is_active) |
| `roles` | System roles (SUPER_ADMIN, OWNER, ADMIN, BURSAR, PARENT) |
| `permissions` | 23 base + 10 KYC/activation permissions |
| `role_permissions` | Role → permission mapping |
| `academic_sessions` | Academic session records |
| `academic_terms` | Term records (linked to sessions) |
| `students` | Student records (UUID, school_id) |
| `guardians` | Guardian → student relationships |
| `tuition_configurations` | Fee structures per school/class |
| `fee_rules` | Fee calculation rules |
| `payment_transactions` | Payment state machine |
| `payment_accounts` | DVA lifecycle |
| `ledger_entries` | Append-only immutable ledger |
| `notifications` | Notification queue |
| `audit_log` | Activity audit trail |
| `onboarding_progress` | Onboarding step tracking per user |
| `kyc_records` | KYC verification records |
| `kyc_verifications` | KYC verification attempts |
| `identity_verifications` | *(doc inaccuracy: does not exist — verification history lives in `kyc_verifications`, extended m029 with `verified_fields`/`comparison`)* |
| `settlement_records` | Settlement tracking |
| `settlement_verifications` | Settlement verification |
| `gateway_assignments` | Provider gateway assignment per school |
| `sync_queue` | Frontend offline sync queue |
| `legacy_identity_migrations` | Legacy Supabase → WorkOS → Supabase identity tracking |
| `schema_migrations` | Migration tracking |

### Triggers & Functions

| Trigger/Function | Table | Purpose |
|---|---|---|
| `handle_new_supabase_user` | `auth.users` (AFTER INSERT/UPDATE) | Provision `public.users` + `user_profiles` (idempotent ON CONFLICT) |
| `users_updated_at` | `users` | Timestamp on update |
| `user_profiles_updated_at` | `user_profiles` | Timestamp on update |
| `delete_user_cascade` | `auth.users` (AFTER DELETE) | Cascade delete from auth.users |
| Audit triggers | All financial tables | Track changes in `audit_log` |
| `school_is_ready()` | `schools` view/function | Check activation readiness |
| `record_verified_payment()` | SECURITY DEFINER RPC | Atomic, idempotent payment + ledger |

---

# Security Implementation Status

## Identity & Access (Security Phase 1)

| Control | Status | Evidence |
|---|---|---|
| 1. Supabase Auth integration | ✅ COMPLETE | Phase 7 auth migration, 163 tests |
| 2. Password policy (12 chars) | ⚠️ PARTIAL | `config.toml`: `minimum_password_length = 6` (docs say 12); RegisterForm has guidance but no backend enforcement |
| 3. MFA for admin/owner | ⏳ NOT IMPLEMENTED | Documented in `authentication.md` (`supabase.auth.mfa`); not in code |
| 4. Session token expiration | ✅ PARTIAL | `config.toml`: `jwt_expiry = 3600` (1 hour); refresh token rotation enabled; MFA-based session management not implemented |
| 5. Device registration | ⏳ NOT IMPLEMENTED | Documented: "New devices require MFA"; not in code |
| 6. Auth rate limiting | ⏳ NOT IMPLEMENTED | `rate_limit` table exists (migration 010) but enforcement not implemented |
| 7. Email verification | ✅ COMPLETE | Works with Supabase Auth (Phase 7 verified) |

## Authorization (Security Phase 2)

| Control | Status | Evidence |
|---|---|---|
| 1. RBAC implementation | ✅ COMPLETE | `AuthorizationService.js`, `staffAuth.js`, 23+10 permissions, Phase 2 M2 (`7d21805`) |
| 2. Cross-tenant access prevention | ✅ COMPLETE | RLS policies (migration 028) + `requireAuthSupabase` + `AuthorizationService.getSchoolMembership()` — 5 tests |
| 3. Role management interface | ⏳ NOT IMPLEMENTED | RBAC engine exists; no admin UI for role management |

## Financial Security (Security Phase 3)

| Control | Status | Evidence |
|---|---|---|
| 1. Append-only ledger | ✅ COMPLETE | `ledger_entries` table — no UPDATE/DELETE grants; `LedgerService.js`; idempotency test |
| 2. Transaction idempotency | ✅ COMPLETE | `record_verified_payment()` RPC with idempotency_key; `security.test.js` idempotency test |
| 3. Payment verification | ✅ COMPLETE | WebhookVerifier.js; webhook-contract tests; state machine enforces verification before SUCCESS |

## Offline Security (Security Phase 4)

| Control | Status | Evidence |
|---|---|---|
| 1. Local DB encryption | ⏳ NOT IMPLEMENTED | `crypto.ts` has AES-256-GCM; Dexie encryption not implemented |
| 2. Offline queue integrity | ⚠️ PARTIAL | Queue entries encrypted via crypto.ts; queue signing/tamper detection not implemented |
| 3. Conflict resolution | ⚠️ PARTIAL | Retry queue exists; advanced conflict resolution not implemented |

## API Security (Security Phase 5)

| Control | Status | Evidence |
|---|---|---|
| 1. Rate limiting | ⏳ NOT IMPLEMENTED | `rate_limit` table exists; enforcement not implemented |
| 2. Webhook signature verification | ✅ PARTIAL | `WebhookVerifier.js` exists and tested (`webhook-contract.test.js`); production webhook secrets not configured |
| 3. Input validation | ⚠️ PARTIAL | `validators.js` with NIN/BVN/CAC/bank validation; not all endpoints have comprehensive validation |

## Monitoring & Detection (Security Phase 6)

| Control | Status | Evidence |
|---|---|---|
| 1. Audit logging | ✅ PARTIAL | `auditService.js`, `audit_log` table, audit triggers on financial tables (Milestone 13 `19f68f3`); anomaly detection not implemented |
| 2. Anomaly detection | ⏳ NOT IMPLEMENTED | Not started |
| 3. Health checks | ⏳ NOT IMPLEMENTED | Not started |

## Compliance & DR (Security Phase 7)

| Control | Status | Evidence |
|---|---|---|
| 1. Backup strategy | ✅ PARTIAL | Supabase managed backups; documented in `compliance_and_dr.md` |
| 2. Disaster recovery | ⏳ NOT IMPLEMENTED | Documented; not implemented |
| 3. Compliance reporting | ⏳ NOT IMPLEMENTED | Documented; not implemented |

---

# How This Document Must Be Maintained

1. Update this file whenever a major phase or milestone is completed.
2. Never mark a feature COMPLETE based solely on design documentation.
3. COMPLETE requires implementation evidence (committed code, passing tests, or verified migrations).
4. Prefer tests, code, migrations, and Git history as evidence over documentation claims.
5. Mark provider-dependent functionality separately from provider-independent architecture.
6. Use DEFERRED only when the project owner explicitly postponed work (e.g., payment provider selection pending).
7. Never delete historical roadmap documents to make the status cleaner.
8. When a phase is completed, record the relevant commit hash.
9. When work resumes after a deferral, update the deferred status and resume point.
10. Keep the "Current Development Position" section accurate at all times.

---

# Project Status Change Log

**Date:** 2026-08-19

**Change:**
Completed Phase 8.3 (Setup Center Recovery, Verification UX & Offline-Resilient UI Hardening).

**Reason:**
The `/setup` page collapsed into a blank "Connection problem" error screen when the onboarding-status
API request failed. Root cause was error masking in the axios response interceptor (stripped `.response`,
causing all HTTP errors to be categorized as NETWORK_ERROR) combined with a full-page `v-else-if` error
branch that replaced the entire Setup Center shell.

**Fixes applied:**
- Fixed axios response interceptor to preserve `.response` and enrich errors with `isNetworkError`/`status`/`backendMessage` instead of replacing with `new Error()`.
- Extracted shared `categorizeApiError()` to `frontend/src/shared/services/api/errors.ts` (used by both stores).
- Rewrote `SchoolSetupView.vue` as a resilient Setup & Verification Center: shell always renders, error is a contextual banner, loading skeleton shown during fetch.
- Added `normalizeStatus()` to onboardingStore (flat RPC → nested `OnboardingStatus` shape).
- Added request deduplication to `onboardingStore.loadStatus()` and `financialActivationStore` load methods.
- Preserved cached state on error (status not nulled on failure).
- Integrated `financialActivationStore` sections (KYC, Settlement, Payment Activation) into the Setup Center.
- Added 400/404 tolerance for financial GET endpoints (expected "no school yet" state for new users).
- Added 26 new tests (8 store + 18 SchoolSetupView + useModuleLock updates).

**Results:** Backend 163/163 ✅ | Frontend 184/184 ✅ | Build SUCCESS ✅

---

**Date:** 2026-08-18

**Change:**
Created canonical `docs/PROJECT_STATUS.md` following the auth migration recovery audit.

**Reason:**
CAPFLUX has accumulated multiple historical roadmaps (`docs/architecture/ROADMAP.md`, `docs/security/implementation_roadmap.md`, `docs/security/security_architecture.md`) and phase completion documents. This document consolidates verified current state into one canonical source of truth.

**Summary of findings:**
- Original Phase 1 (Security: Identity & Access) had 7 controls — only 1 was truly completed (Supabase Auth integration, done via the auth migration)
- The implementation roadmap evolved through Phase 1 Milestone 1 → Phase 9, Milestones 10–14, Phase 2 Milestones 1–7
- Auth migration (Phase 6–7) is COMPLETE: 163 backend tests, 81 frontend tests, build SUCCESS
- Payment provider integration (Phase 2 Milestone 8A–8I) is DEFERRED per explicit project decision
- Onboarding (Phase 8) is 🟡 RECOVERY IN PROGRESS — audit document does not exist yet
- MFA, rate limiting, device registration, offline encryption, compliance reporting are ⏳ NOT IMPLEMENTED

**Current resume direction:**
Phase 8 — Onboarding & School Activation Recovery. The onboarding recovery audit must be completed before implementation resumes.

**Deferred:**
Phase 2 Milestone 8A–8I — Payment Provider Integration (provider selection pending).

---

# File References

### Key Documentation
- `docs/architecture/ROADMAP.md` — Original 10-phase development roadmap
- `docs/security/implementation_roadmap.md` — Security implementation roadmap (Phase 1–7)
- `docs/security/security_architecture.md` — Security architecture phases (MPV/Growth/Enterprise)
- `docs/security/authentication.md` — Original auth design (Supabase Auth model)
- `docs/security/authorization.md` — RBAC authorization model
- `docs/security/financial_integrity.md` — Financial integrity principles
- `docs/auth-migration-audit.md` — Auth migration audit (pre-migration baseline)
- `docs/auth-phase6-completion.md` — Phase 6 completion (UUID migration)
- `docs/auth-phase7-completion.md` — Phase 7 completion (production acceptance)
- `docs/auth-phase4-route-audit.md` — Route audit during Phase 4
- `docs/auth-rls-migration.md` — RLS migration plan
- `docs/database/ER_DIAGRAM.md` — Entity relationship diagram
- `docs/database/MIGRATION_REPORT.md` — Migration report
- `docs/database/GUARDIAN_MIGRATION_NOTES.md` — Guardian migration notes
- `docs/providers/capability-matrix.md` — Payment provider capability matrix
- `docs/providers/workos-authkit.md` — WorkOS AuthKit provider info (preserved)
- `docs/architecture/financial_lifecycle.md` — Financial lifecycle & milestones
- `REFACTOR_TODOS.md` — Fee-First billing & payment architecture refactor checklist (26 items)
- `ARCHITECTURE_MIGRATION_PLAN.md` — Hybrid feature-based architecture migration plan

### Key Source Files
- **Auth middleware:** `backend/middleware/requireAuthSupabase.js`, `requirePaymentReady.js`, `staffAuth.js`
- **Auth services:** `backend/services/AuthorizationService.js`, `backend/services/SessionService.js`
- **Financial services:** `backend/services/PaymentService.js`, `LedgerService.js`, `DVAService.js`, `PaymentGateway.js`
- **Financial routes:** `backend/routes/payments.js`, `dva.js`, `payment-accounts.js`, `financial-operations.js`, `financial-admin.js`
- **Frontend auth:** `frontend/src/stores/authStore.ts`, `frontend/src/shared/auth/SupabaseAuthProvider.ts`
- **Frontend offline:** `frontend/src/offline/localDb.ts`, `syncEngine.ts`, `DownloadSyncEngine.ts`, `UploadSyncEngine.ts`
- **Frontend financial:** `frontend/src/shared/payments/`, `frontend/src/shared/ledger/`, `frontend/src/shared/billing/`

### Test Files
- `backend/tests/` — 15 test suites (163 tests)
- `frontend/src/**/__tests__/` — 5 test suites (81 tests)
