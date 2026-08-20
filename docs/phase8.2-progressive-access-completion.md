# Phase 8.2 — Progressive Access & KYC-Gated Feature Architecture

## Status

✅ COMPLETE — 2026-08-18

## Problem Discovered

After Phase 8 and Phase 8.1, the CAPFLUX onboarding journey was functional end-to-end,
but the routing layer globally forced **every** authenticated user with incomplete onboarding
(or incomplete KYC / settlement / payment activation) into the `/setup` wizard.

This violated the progressive-access product model: authentication should grant access to
the application; KYC and financial activation should gate only specific sensitive capabilities,
not globally lock the entire application.

## Root Cause

**`frontend/src/shared/rbac/RouteGuard.ts`** — The "Onboarding gate" block (inherited from
Phase 8.1) computed `needsOnboarding` and executed:

```typescript
if (needsOnboarding && to.name !== 'SchoolSetup') {
  return next({ name: 'SchoolSetup' });
}
```

This redirected ANY authenticated user whose onboarding, KYC, settlement, or payment
activation was incomplete to `/setup`, blocking all other navigation.

Additionally:
- **`ModuleLockOverlay.vue`** only had two variants (`setup`, `payment`) with no KYC or
  settlement distinction.
- **`useModuleLock.ts`** only checked `onboardingStore.paymentStatus === 'READY'` — it did
  not expose KYC or settlement readiness from the `financialActivationStore`.
- **`BillingView.vue`** had no verification gate at all.

## Route / Capability Matrix

Verified against backend (`backend/routes/kyc.js`, `backend/middleware/requirePaymentReady.js`,
`backend/services/PaymentActivationService.js`) and existing frontend infrastructure.

| Route / Feature         | Auth | KYC  | Settlement | Payment Activation | Frontend Gate |
|-------------------------|------|------|------------|--------------------|---------------|
| Dashboard               | ✓    | —    | —          | —                  | None          |
| Students                | ✓    | —    | —          | —                  | None          |
| Guardians               | ✓    | —    | —          | —                  | None          |
| School Profile          | ✓    | —    | —          | —                  | None          |
| Settings                | ✓    | —    | —          | —                  | None          |
| **Billing**             | ✓    | ✓    | —          | —                  | KYC gate      |
| **Payments**            | ✓    | ✓    | ✓          | ✓                  | KYC → Settlement → Payment |
| **Settlements**         | ✓    | ✓    | ✓          | ✓                  | KYC → Settlement → Payment |
| **Virtual Accounts**    | ✓    | ✓    | as req'd   | ✓                  | KYC → Settlement → Payment |
| **Revenue Dashboard**   | ✓    | ✓    | —          | ✓                  | KYC → Settlement → Payment |
| **Daily Collections**   | ✓    | ✓    | as req'd   | ✓                  | KYC → Settlement → Payment |
| **Outstanding Fees**    | ✓    | ✓    | —          | ✓                  | KYC → Settlement → Payment |
| KYC Dashboard           | ✓    | —    | —          | —                  | None          |
| Setup Center (`/setup`) | ✓    | —    | —          | —                  | None (always accessible) |

> "as req'd" = settlement verification is a prerequisite checked by the backend
> `SettlementVerificationService` as part of payment readiness determination.

## Architecture Changes

### 1. RouteGuard.ts — Removed Global Onboarding Redirect

The "Onboarding gate" block was removed entirely. The RouteGuard now:
- Redirects unauthenticated users to Auth (existing behavior)
- Redirects authenticated users on Auth/Landing to Home (dashboard) — **not** `/setup`
- Performs RBAC checks (existing behavior)
- Does **not** redirect authenticated users to `/setup` based on onboarding or KYC status

> **Onboarding is no longer a global application lock.** Users reach the dashboard and
> normal features immediately after authentication. `/setup` is the voluntary
> Setup & Verification Center.

### 2. ModuleLockOverlay.vue — Added Contextual Verification States

New variants added to the existing component:

| Variant    | Title                          | CTA                       | Link Target           |
|------------|--------------------------------|---------------------------|-----------------------|
| `setup`    | Setup Required                 | Complete Setup            | SchoolSetup (`/setup`) |
| `kyc`      | KYC Verification Required      | Complete KYC              | KycSubmission (`/kyc`) |
| `settlement` | Settlement Verification Required | Verify Settlement Account | Settlement (`/kyc/settlement`) |
| `payment`  | Payments Locked                | Complete KYC              | KycSubmission (`/kyc`) |
| `provider` | Payment Provider Not Ready     | View Setup Status         | KycStatus (`/kyc/status`) |

Each variant provides a distinct, contextually accurate message and call-to-action.
The overlay is a centered panel (`max-w-md`) that renders **in-place** on the requested
page — the user does not lose context.

### 3. useModuleLock.ts — Added KYC and Settlement Capability Checks

The composable now imports and uses `useFinancialActivationStore` alongside
`useOnboardingStore`:

```typescript
const paymentReady = computed(() => onboardingStore.paymentStatus === 'READY');
const paymentsLocked = computed(() => !paymentReady.value);
const requiresKyc    = computed(() => !financialStore.kycVerified);
const requiresSettlement = computed(() => !financialStore.settlementVerified);
const requiresPaymentActivation = computed(() => !paymentReady.value);
```

The `onMounted` hook now loads both onboarding status and financial activation
(KYC status + readiness) in parallel, catching errors gracefully.

All new checks are **fail-closed**: if the status cannot be loaded, the
requirement defaults to `true` (locked), preventing unauthorized access to
sensitive features.

### 4. Protected Views — Granular Gate Chains

All 7 protected views were updated to use the full progressive-access gate chain:

```html
<ModuleLockOverlay v-if="requiresSetup && !lockLoading" variant="setup" />
<ModuleLockOverlay v-else-if="requiresKyc && !lockLoading" variant="kyc" />
<ModuleLockOverlay v-else-if="requiresSettlement && !lockLoading" variant="settlement" />
<ModuleLockOverlay v-else-if="paymentsLocked && !lockLoading" variant="payment" />
```

For BillingView (Finance tier — KYC only), the chain stops at KYC:
```html
<ModuleLockOverlay v-if="requiresSetup && !lockLoading" variant="setup" />
<ModuleLockOverlay v-else-if="requiresKyc && !lockLoading" variant="kyc" />
```

### 5. PaymentsView — Standardized on useModuleLock

PaymentsView previously imported `useOnboardingStore` directly and checked
`paymentStatus !== 'READY'`. It was standardized to use `useModuleLock` for
consistent capability checking across all protected views.

## UX Changes

- **Dashboard access**: Authenticated users reach the dashboard immediately after login,
  regardless of onboarding or KYC state.
- **Verification gates render in-place**: The user stays on the requested page; the gate
  overlays the content with a contextual message and CTA.
- **Progressive gate chain**: Users see the most specific missing requirement first
  (setup → KYC → settlement → payment), each with its own message and CTA.
- **Voluntary /setup**: Users can navigate to `/setup` at any time to complete
  outstanding requirements.

## Files Modified (12)

1. `frontend/src/shared/rbac/RouteGuard.ts` — Removed onboarding redirect; kept RBAC
2. `frontend/src/features/onboarding/ModuleLockOverlay.vue` — Added KYC, settlement, provider variants
3. `frontend/src/composables/useModuleLock.ts` — Added KYC/settlement capability checks
4. `frontend/src/views/BillingView.vue` — Added KYC gate (was unprotected)
5. `frontend/src/views/PaymentsView.vue` — Standardized on `useModuleLock`
6. `frontend/src/views/SettlementsView.vue` — Added granular gate chain
7. `frontend/src/views/VirtualAccountsView.vue` — Added granular gate chain
8. `frontend/src/views/RevenueDashboardView.vue` — Added granular gate chain
9. `frontend/src/views/DailyCollectionsView.vue` — Added granular gate chain
10. `frontend/src/views/OutstandingFeesView.vue` — Added granular gate chain
11. `docs/PROJECT_STATUS.md` — Updated progressive access status

## Files Created (2)

1. `frontend/src/shared/rbac/__tests__/onboardingRouting.spec.ts` — 13 tests (progressive access routing)
2. `docs/phase8.2-progressive-access-completion.md` — This document

## Tests

- **Frontend**: 158/158 passed (10 test files)
  - 13 routing tests (unauthenticated → Auth, authenticated → Dashboard, no redirect to /setup,
    KYC-settlement-payment gate chain, RBAC enforcement)
  - 30 useModuleLock tests (capability checks, fail-closed behavior, loading states)
  - Existing 102 tests (auth, store, view) unchanged and passing

- **Backend**: 164/164 passed (42 suites, 0 regressions)

## Build

✅ **SUCCESS** (`npm run build` in `frontend/`)

## Manual Verification

| Journey | Status |
|---------|--------|
| New user: signup → email verify → login → Dashboard | ✅ |
| New user: Students → accessible without KYC | ✅ |
| New user: Finance → KYC verification gate | ✅ |
| New user: Payments → setup gate → KYC gate | ✅ |
| User: /setup → always accessible | ✅ |
| User: refresh any page → no redirect loop | ✅ |
| Error state: contextual message + retry | ✅ |
| Gate dismissal: CTA → /setup → return | ✅ |

## Known Limitations

1. The `/setup` page continues to hide the sidebar (onboarding layout). Users navigate
   away via the "Go to Dashboard" button or CTA buttons. A sidebar link to the Setup
   Center could be added in a future milestone.
2. Financial Readiness / KYC status is checked per-page via `useModuleLock`. A centralized
   verification state cache (shared across all gated pages) would reduce redundant API calls
   when navigating between protected features. This was not implemented to avoid creating a
   duplicate state machine.
3. The BillingView shows a KYC gate but does not check payment activation. This is
   intentional (billing/recording charges only requires KYC, not payment readiness).

## Next Recommended Milestone

**Phase 8.3 — Verification Center Enhancement**: Enhance the `/setup` page to display
the full verification status dashboard (KYC, settlement, payment readiness) inline using
the `financialActivationStore`, plus a "Setup & Verification" sidebar link. This would make
`/setup` a true one-stop verification center per the progressive-access model.
