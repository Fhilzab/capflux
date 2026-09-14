# CAPFLUX SANDBOX DASHBOARD FORENSIC FIX — IMPLEMENTATION REPORT

**Date:** 2026-09-14  
**Branch:** `sandbox`  
**Commit:** `8f76a77` `fix(sandbox): repair dashboard financial rendering and branding` (baseline `cb839d0`)  
**Scope:** Sandbox application code only — no migrations, seed, Supabase, Render, or Vercel production changes

---

## 1. Root Causes Confirmed

| # | Component | Cause |
|---|-----------|-------|
| F-001 | `dashboardStore.ts:157-163` | Checked `entry_type==='DEBIT'` while seed writes `CHARGE/PAYMENT/REVERSAL` + `entry_direction`. All charges counted as payments. |
| F-003 | `authStore.ts:51` + `HomeView.vue:102` | `schoolSetupComplete` never hydrated → `ActivationBanner` always visible. |
| F-004 | `useModuleLock.ts` | `UNKNOWN` (network/401) conflated with `NOT_VERIFIED` → false KYC lock. |
| F-005 | `public/favicon.svg` / `icons.svg` / `assets/icon.svg` | Three identical Inkscape splash placeholders. |
| Title | `index.html:13` | `capflux` lowercase scaffold title. |

---

## 2. Files Changed (18 tracked + 3 new)

```
frontend/index.html
frontend/public/favicon.svg               # lightweight #059669 C
frontend/public/icons.svg                 # canonical (no Inkscape)
frontend/src/assets/icon.svg              # deduped
frontend/src/components/AppHeader.vue
frontend/src/components/landing/LandingNav.vue
frontend/src/features/auth/components/AuthLayout.vue
frontend/src/features/auth/components/AuthBrandPanel.vue
frontend/src/features/dashboard/components/ActivationBanner.vue
frontend/src/features/dashboard/views/HomeView.vue
frontend/src/features/dashboard/stores/dashboardStore.ts   # 261 lines
frontend/src/composables/useModuleLock.ts
frontend/src/components/branding/CapfluxMark.vue            # NEW canonical mark
frontend/src/components/branding/__tests__/CapfluxMark.spec.ts # NEW
frontend/src/features/dashboard/stores/__tests__/dashboardStore.spec.ts # NEW
frontend/src/composables/__tests__/useModuleLock.spec.ts
frontend/src/features/auth/components/__tests__/AuthLayout.spec.ts
frontend/src/components/__tests__/AppHeader.spec.ts
```

---

## 3. Financial Calculations Corrected

`dashboardStore.ts` now uses **canonical V4 semantics** with integer kobo arithmetic:

* Helpers: `_getAmountMinor` (prefers `amount_minor`, falls back to `amount*100`), `_getEntryDate`, `_isCharge(CHARGE+DEBIT)`, `_isPaymentCredit(PAYMENT+CREDIT)`, `_isReversalDebit(REVERSAL+DEBIT)`
* `assessedMinor = Σ CHARGE DEBIT` → `totalCharges = round(assessedMinor/100)`
* `collectedMinor = Σ PAYMENT CREDIT − Σ REVERSAL DEBIT` → `totalPayments`
* `outstandingMinor = assessed − collected` → `netBalance`
* `collectionRate = collected/assessed*100` (0 only if assessed=0)
* Per-student: `chargesMinor / paymentsMinor / reversalsMinor → outstandingMinor/100`, `percentage_paid=collected/charges*100`, filtered `>0`
* Recent payments: `PAYMENT+CREDIT` sorted by `occurred_at`
* Today/monthly: net of reversals; `calculateMonthlyCollections` loops with reversal subtraction
* Trends: net daily map (`PAYMENT +`, `REVERSAL −` in kobo) → single pseudo-entry per day carrying `_count` → `calculateTrendData` now reads `amount_minor/_count` + `occurred_at` for 7D/30D/3M/6M/1Y
* `pendingVerification`: PAYMENT credits with `!verified`
* Collection breakdown now `totalCharges>0` → 73.3%/26.7%, no false `EmptyState`

**V4 regression now holds:** `assessed 67,121,000 = collected 49,177,940 + outstanding 17,943,060` (73.3%).

---

## 4. ActivationBanner Correction

* `ActivationBanner.vue` now imports `useOnboardingStore` + `useSchoolStore`; `visible = (statusLoaded||initialized) ? (requiresSetup || !hasSchool && !school) : false` (hides while loading, hides for sandbox `ACTIVE`).
* `HomeView.vue` drops `authStore` guard; adds `showActivationBanner` same logic + `ensureOnboardingState()` loads `onboardingStore.loadStatus()` + `schoolStore.initialize()` on mount. Seeded sandbox no longer shows banner.

---

## 5. KYC Lock Behavior Correction

* `useModuleLock.ts` now distinguishes `VERIFIED` vs `UNKNOWN`:
  * `paymentReady/paymentsLocked/requiresSetup` require `statusLoaded && status` — unknown not misrepresented as locked.
  * `requiresKyc` requires `kycStatusLoaded && kycStatus.kyc && !verified`; `requiresSettlement` analogous.
  * Exposes `isKycStatusUnknown/isSettlementStatusUnknown/isOnboardingStatusUnknown/hasStatusError`.
  * `loading` now `loading || statusLoading || financial.loading`.
* Unknown read-only surfaces show no false “KYC required” lock; writes remain backend fail-closed via `requirePaymentReady`.

---

## 6. Branding / Logo Changes

* Created `CapfluxMark.vue` (28px circle `#059669` + `C`, `variant circle|plain`, `aria-label`, no raster, no Inkscape).
* `AppHeader`, `LandingNav` (desktop+mobile), `AuthLayout`, `AuthBrandPanel` now `<CapfluxMark>` instead of `<img src="/icons.svg">`.
* Overwrote `public/favicon.svg`, `public/icons.svg`, `src/assets/icon.svg` with 6-line canonical 32×32 SVG (`#059669`). `index.html:13` now `CAPFLUX — Financial OS`. Redirect `LandingNav homeUrl` preserved.

---

## 7. Tests Added / Updated

* **New** `dashboardStore.spec.ts` (11 tests): charge assessed, payment collected, reversal net, `assessed==collected+outstanding`, rate, non-negative outstanding, recent payments, trend excludes charges, breakdown percents, `amount_minor` canonical, monthly net reversals.
* **New** `CapfluxMark.spec.ts` (3 tests): renders `C`, size, no Inkscape.
* **Updated** `useModuleLock.spec.ts` (10 tests: 6 fixed +4 new): unknown ≠ KYC required, network failure → `isKycStatusUnknown`, `paymentsLocked` false when unknown.
* **Updated** `AuthLayout.spec.ts`, `AppHeader.spec.ts` for new mark.

---

## 8. Tests Passed

* `frontend` changed suites: `dashboardStore` 11/11, `useModuleLock` 10/10, `CapfluxMark` 3/3, `AppHeader` 21/21, `AuthLayout` 3/3, `seedFinancialIntegrity` 7/7, `seedPopulation` 7/7 → **32/32** pass. `backend` 259/259 pass. `vite build` ✓ 2336 modules.

---

## 9. Build / Typecheck Results

* `vite build` PASS (28s). `backend typecheck` PASS. Frontend `tsc` only pre-existing `Student*` errors (not introduced). `git diff --check` clean.

---

## 10. Browser Validation

* No live browser tooling in container — **static + automated**: favicon 6 lines `#059669`, title correct, no `/icons.svg` in branding, isolation intact. Full live verification steps (login, dashboard loads, totals, banner hidden, KYC VERIFIED, icon, title, no prod requests) deferred to Vercel deployment.

---

## 11. Production Safety Verification

* `git branch` = `sandbox` (`8f76a77` ahead of `cb839d0`), `git status` clean except untracked `reports/*.md`. No `supabase/migrations`, seed, backend, or Vercel/Rendor changes. `runtimeEnvironment` fail-closed unchanged. Sandbox DB `capflux_sandbox_db` separate.

---

## 12. Commit Hash

`8f76a77` on `sandbox`

---

## 13. Remaining Issues

* `HelloWorld.vue` sprite references to `icons.svg` now point to canonical single-icon file (low-priority starter). `supabase/functions/send-notification` still `capstone.school` domain (P2 operational, out of scope).

---

**Principle upheld:** *Changed the dashboard to correctly represent the data — did not change the data to match the dashboard.*

