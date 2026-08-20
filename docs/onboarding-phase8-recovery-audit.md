# Phase 8 Recovery Audit

> **Status:** COMPLETE
> **Date:** 2026-08-18
> **Purpose:** Audit the existing onboarding architecture before implementing Phase 8.

---

## 1. What Already Exists

### 1.1 Frontend Infrastructure

| Component/File | Path | Status |
|---|---|---|
| Onboarding Store | `frontend/src/stores/onboardingStore.ts` | ✅ Exists (483 lines TS) |
| Auth Store | `frontend/src/stores/authStore.ts` | ✅ Exists (Supabase JWT) |
| School Store | `frontend/src/stores/schoolStore.ts` | ✅ Exists |
| Financial Activation Store | `frontend/src/stores/financialActivationStore.ts` | ✅ Exists |
| RBAC Store | `frontend/src/stores/rbacStore.ts` | ✅ Exists |
| School Setup View | `frontend/src/features/setup/SchoolSetupView.vue` | ✅ Exists (4-step wizard) |
| ProfileStep | `frontend/src/features/onboarding/steps/ProfileStep.vue` | ✅ Exists |
| OrganizationStep | `frontend/src/features/onboarding/steps/OrganizationStep.vue` | ✅ Exists |
| SchoolStep | `frontend/src/features/onboarding/steps/SchoolStep.vue` | ✅ Exists |
| OwnerInfoStep | `frontend/src/features/onboarding/steps/OwnerInfoStep.vue` | ✅ Exists |
| OnboardingChecklist | `frontend/src/features/onboarding/OnboardingChecklist.vue` | ✅ Exists |
| ModuleLockOverlay | `frontend/src/features/onboarding/ModuleLockOverlay.vue` | ✅ Exists |
| KYC Dashboard | `frontend/src/features/kyc/KycDashboard.vue` | ✅ Exists |
| KYC Submission | `frontend/src/features/kyc/KycSubmission.vue` | ✅ Exists |
| KYC Status | `frontend/src/features/kyc/KycStatus.vue` | ✅ Exists |
| Settlement View | `frontend/src/features/kyc/SettlementView.vue` | ✅ Exists |
| Auth API Client | `frontend/src/shared/services/api/client.ts` | ✅ Exists (cookie-authenticated) |
| Route Guard | `frontend/src/shared/rbac/RouteGuard.ts` | ✅ Exists (needs onboarding gate) |
| Router | `frontend/src/router/index.ts` | ✅ Exists (has `/setup` route, no onboarding decision) |
| Activation Banner | `frontend/src/features/dashboard/components/ActivationBanner.vue` | ✅ Exists |

### 1.2 Backend Infrastructure

| Component/File | Path | Status |
|---|---|---|
| Onboarding Routes | `backend/routes/onboarding.js` | ✅ Exists |
| KYC Routes | `backend/routes/kyc.js` | ✅ Exists |
| Context Routes | `backend/routes/context.js` | ✅ Exists |
| PaymentActivationService | `backend/services/PaymentActivationService.js` | ✅ Exists |
| AuthorizationService | `backend/services/AuthorizationService.js` | ✅ Exists |
| requireAuthSupabase | `backend/middleware/requireAuthSupabase.js` | ✅ Exists |
| IdentityVerificationService | `backend/services/IdentityVerificationService.js` | ✅ Exists |
| SettlementVerificationService | `backend/services/SettlementVerificationService.js` | ✅ Exists |

### 1.3 Database Infrastructure

| Object | Type | Status |
|---|---|---|
| `onboarding_progress` | Table | ✅ Migration 023 |
| `organizations` | Table | ✅ Migration 004/010 |
| `organization_members` | Table | ✅ Migration 010 |
| `schools` | Table | ✅ Migration 020 |
| `school_members` | Table | ✅ Migration 020 |
| `kyc_records` | Table | ✅ Migration 019 |
| `kyc_verifications` | Table | ✅ Migration 019 |
| `settlement_records` | Table | ✅ Migration 019 |
| `gateway_assignments` | Table | ✅ Migration 019 |
| `get_onboarding_status()` | RPC | ✅ Migration 022 |
| `create_organization_with_owner()` | RPC | ✅ Migration 022 |
| `create_school_with_onboarding()` | RPC | ✅ Migration 022 |
| `complete_onboarding()` | RPC | ✅ Migration 022 |

### 1.4 Git History Analyzed

| Commit | Description | Relevance |
|---|---|---|
| `cb684b0` | "Add fintech-inspired 3-stage onboarding flow" | Original OnboardingView.vue, StageActivate.vue, StageSchoolProfile.vue, StageFinancialSetup.vue, OnboardingProgress.vue, OnboardingComplete.vue — all DELETED |
| `9130e3b` | "Replace legacy onboarding with state-driven auth system" | Deleted old onboarding UI components; introduced current architecture |
| `6c15b4e` | "Phase 2 Milestone 4: Foundation repair" | Backend onboarding infrastructure |
| `022bc60` | "Phase 2: Supabase Auth foundation" | Supabase Auth migration began |
| `ab0ca8f` | "Phase 4: Supabase Auth backend integration" | Backend auth integration |
| `2470a18` | "db: revise supabase auth migrations" | Migration 027/028 refinements |
| `a27fa71` | "test(auth): harden phase 7" | Final Phase 7 hardening |

---

## 2. What Is Missing

### 2.1 Critical: Routing Decision Logic

**Problem:** The `authorizeRoute` guard does NOT redirect based on onboarding completion state. Authenticated users are always sent to the dashboard after login, bypassing onboarding entirely.

**Current behavior:**
- `AuthView` → redirects to `{ name: 'Home' }` after OAuth callback
- `LoginForm` → redirects to `{ name: 'Home' }` after sign-in
- `RegisterForm` → redirects to `{ name: 'Home' }` after sign-up
- `authorizeRoute` guard → only checks `requiresAuth` and RBAC, no onboarding awareness
- Comment in guard explicitly states: "Do not force-redirect users to a SchoolSetup route"

**Required behavior:**
- Authenticated user with incomplete onboarding → redirect to `/setup`
- Authenticated user with complete onboarding → redirect to `/dashboard`
- Unauthenticated user → redirect to `/auth` (already works)

### 2.2 Post-Completion Redirect

**Problem:** `SchoolSetupView.vue` calls `onboardingStore.completeOnboarding()` but does not redirect to the dashboard afterward.

**Required behavior:** After `completeOnboarding()` succeeds, redirect to `/dashboard`.

### 2.3 State Restoration on Refresh

**Problem:** `onboardingStore.loadStatus()` does not restore `currentStep` based on backend state. On page refresh, `currentStep` resets to 1, even if the user has completed steps 2-4.

**Required behavior:** After `loadStatus()`, restore `currentStep` to the first incomplete step (or step 4 if all complete).

### 2.4 Text References

**Problem:** `ProfileStep.vue` references "WorkOS" (line 57): "Your name and email are pre-filled from your WorkOS account."

**Fix:** Changed to "CAPFLUX account".

### 2.5 No Onboarding Dashboard Bridge

**Problem:** After onboarding completion, there is no intermediate "Onboarding Complete" screen connecting operational setup to financial activation (KYC).

**Resolution:** `ActivationBanner.vue` on the dashboard already shows the next-step call-to-action for KYC. The `KycDashboard.vue` provides the financial activation journey. No separate `OnboardingComplete.vue` screen is needed — the dashboard + ActivationBanner serves this role.

### 2.6 Backend Tests for Onboarding

**Problem:** No backend tests cover the onboarding endpoints (`/onboarding/status`, `/onboarding/profile`, etc.).

**Note:** Adding backend tests requires a live Supabase instance (the tests use real RPC calls). The existing test infrastructure mocks via `SupabaseClientFactory` which is complex. Existing backend tests focus on auth/security — onboarding tests would require integration testing infrastructure.

**Decision:** Documented as a known gap. The onboarding backend is covered by the existing `security.test.js` (cross-school isolation) and `activation.test.js` (activation gates) tests, which indirectly exercise onboarding paths.

---

## 3. Contract Alignment

### 3.1 Store ↔ Backend ↔ DB Contracts

**Result: ALREADY ALIGNED. No contract mismatches found.**

The `onboardingStore.ts` uses the `apiClient` (cookie-authenticated Axios instance) to call the backend's REST endpoints, which in turn call the Supabase RPCs.

| Store Method | API Endpoint | Backend Handler | DB Function |
|---|---|---|---|
| `loadStatus()` | `GET /onboarding/status` | `onboarding.js` → `get_onboarding_status()` | `get_onboarding_status` (RPC) |
| `saveProfile()` | `POST /onboarding/profile` | `onboarding.js` → `update_user_profile()` | `update_user_profile` |
| `createOrganization()` | `POST /onboarding/organization` | `onboarding.js` → `create_organization_with_owner()` | `create_organization_with_owner` (RPC) |
| `createSchool()` | `POST /onboarding/school` | `onboarding.js` → `create_school_with_onboarding()` | `create_school_with_onboarding` (RPC) |
| `saveOwnerInfo()` | `POST /onboarding/owner-info` | `onboarding.js` | Inserts into `schools` (owner fields) |
| `completeOnboarding()` | `POST /onboarding/complete` | `onboarding.js` → `complete_onboarding()` | `complete_onboarding` (RPC) |
| `getKycStatus()` | `GET /kyc/status` | `kyc.js` → queries `kyc_records` | `kyc_records` table |
| `submitKyc()` | `POST /kyc/submit` | `kyc.js` → `IdentityVerificationService.validate()` | `kyc_records` insert |
| `getSettlementInfo()` | `GET /kyc/settlement` | `kyc.js` | `settlement_records` table |
| `saveSettlementInfo()` | `POST /kyc/settlement` | `kyc.js` → `SettlementVerificationService` | `settlement_records` insert |

### 3.2 Identity Flow

**Result: ALREADY SECURE. No issues found.**

- User identity: Supabase JWT → `req.user.id` (UUID) → `auth.uid()` in RLS
- No `x-user-id` trust
- No `x-school-id` trust
- No user ID in request body treated as authenticated identity
- UUID foreign keys throughout

---

## 4. What Can Be Restored vs Adapted

### 4.1 Restored As-Is

The following existing components work correctly against the current store and API:

- `SchoolSetupView.vue` — 4-step wizard (Profile → Organization → School → Owner Info)
- `ProfileStep.vue`, `OrganizationStep.vue`, `SchoolStep.vue`, `OwnerInfoStep.vue`
- `OnboardingChecklist.vue` — progress sidebar
- `ModuleLockOverlay.vue` — module lock overlay
- `KycDashboard.vue` — financial activation dashboard
- `KycSubmission.vue` — KYC form
- `SettlementView.vue` — settlement account form
- `ActivationBanner.vue` — dashboard activation call-to-action
- `onboardingStore.ts` — full state management

### 4.2 Adapted

- **`authorizeRoute` guard** — Added onboarding-aware routing decisions
- **`SchoolSetupView.vue`** — Added post-completion redirect + query param step restoration
- **`onboardingStore.ts`** — Added `restoreStepFromStatus()` method
- **`ProfileStep.vue`** — Fixed "WorkOS" → "CAPFLUX" text

### 4.3 What Must NOT Be Changed

- Supabase Auth system (JWT identity, email verification, Google OAuth)
- Backend onboarding routes (`backend/routes/onboarding.js`)
- Database migrations 001–028
- `onboardingStore.ts` core logic (only added `restoreStepFromStatus`)
- Payment gateway architecture (MonnifyGateway, PaystackGateway, GatewayFactory)
- DVA architecture
- Settlement architecture
- KYC verification infrastructure
- Append-only ledger
- `requireAuthSupabase` middleware
- WorkOS legacy code (rollback only)

---

## 5. Onboarding State Machine

```
[Authenticated User]
       │
       ▼
┌─────────────────┐     No
│ Onboarding Done? │ ────────▶ [Dashboard]
│ (all 4 steps +   │
│  activatedAt)    │
       │ Yes
       ▼
[SchoolSetup Wizard]
Step 1: Profile          →  saveProfile()  →  profileCompleted = true
Step 2: Organization     →  createOrganization()  →  organizationCompleted = true
Step 3: School           →  createSchool()  →  schoolCompleted = true
Step 4: Owner Info       →  saveOwnerInfo()  →  ownerCompleted = true
       │
       ▼  All 4 steps complete?
   [Complete Setup button]
       │
       ▼  completeOnboarding()
[School ACTIVE, PENDING_KYC]
       │
       ▼
   [Dashboard]
       │
       ▼  ActivationBanner shows:
   "Complete KYC to enable payments"
       │
       ▼
   [KYC Dashboard] → KycSubmission → KycStatus → SettlementView
       │
       ▼  KYC + Settlement verified
   [Payment Activation — DEFERRED]
```

---

## 6. Routing Behavior

| Scenario | Source Route | Destination Route |
|---|---|---|
| Unauthenticated user | Any `requiresAuth` route | `/auth` |
| Authenticated, onboarding incomplete | `/dashboard` or `/auth` | `/setup` |
| Authenticated, onboarding complete | `/setup` | `/dashboard` |
| Authenticated, onboarding complete | `/dashboard` | `/dashboard` (allowed) |
| New user after signup | (redirect to `/dashboard`) | `/setup` (via guard) |
| User after OAuth callback | (redirect to `/dashboard`) | `/setup` or `/dashboard` (via guard) |
| User refreshes during onboarding | (any URL) | `/setup` (resumes at last step) |
| Old `/onboarding/*` URL | `/onboarding/financial-setup` etc. | `/setup` (legacy redirect) |

---

## 7. Security Considerations

1. **JWT identity only** — User ID always derived from Supabase JWT (`req.user.id`), never from client headers or body.
2. **No duplicate school creation** — `create_school_with_onboarding()` uses idempotency checks on the backend.
3. **Multi-tenant isolation** — RLS policies enforce school-level isolation using `auth.uid()`.
4. **KYC data security** — Sensitive data (BVN/NIN/CAC) submitted to backend, never stored in frontend state.
5. **Payment activation not client-controllable** — `PaymentActivationService` runs on backend; frontend only displays readiness status.
6. **Network failure handling** — Onboarding status defaults to "incomplete" on error (safe-fail).
7. **Refresh recovery** — Onboarding step state is restored from backend `get_onboarding_status()`, not from client-side storage.

---

## 8. Audit Conclusion

The onboarding frontend components and backend infrastructure already exist and are fully functional. The primary gap was **routing integration** — the application had no logic to route authenticated users between onboarding and dashboard based on completion state.

**Implementation required:**
1. Add onboarding-aware routing to `authorizeRoute` guard
2. Add post-completion redirect in `SchoolSetupView`
3. Add state restoration (`restoreStepFromStatus`) in `onboardingStore`
4. Fix "WorkOS" text reference in `ProfileStep`
5. Add `/onboarding` legacy URL redirects
6. Add tests
7. Create completion documentation

No backend changes, database changes, or auth system changes are required.
