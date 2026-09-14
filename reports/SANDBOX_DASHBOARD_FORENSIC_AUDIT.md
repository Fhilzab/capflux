# CAPFLUX SANDBOX DASHBOARD FORENSIC AUDIT
**Date:** 2026-09-14 · **Branch:** `sandbox` (`cb839d0`) · **Mode:** READ-ONLY — no files modified, no DB writes, no commits

---

## 1. Executive Verdict

**`FAIL` — Dashboard financial pipeline is broken at the STORE layer; branding is degraded; ActivationBanner gating is mis-wired. Sandbox seed V4 data is correct and API simulator is correct — defects are frontend rendering/domain logic only.**

`FAIL` not `BLOCKED` because sandbox login, seed, and API simulator all function; the dashboard loads but displays **zeroed / inverted financials** and a **permanent banner** due to two deterministic frontend bugs. Fixable without data migrations.

| Category | Count |
|---|---|
| P0 isolation / security | 0 |
| P1 major functional / financial mis-representation | 3 |
| P2 visual / branding / usability | 5 |
| P3 cosmetic | 2 |

---

## 2. Live Environment

| Item | Evidence | Result |
|---|---|---|
| Frontend URL | `https://capflux-sandbox.vercel.app` (Vite SPA, `frontend/vercel.json:1-11` rewrites `/(.*)->/index.html`) | Assumed live — no build-time env embedded in repo (`frontend/.env` points to `localhost:4000/api`) — Vercel project env **not verified** locally |
| API URL | `VITE_API_BASE_URL` expected = `https://capflux-sandbox-api.onrender.com/api` on Vercel (doc `reports/SANDBOX_RELEASE_VERIFICATION_REPORT.md:168`) | Cannot verify from repo; `frontend/src/shared/services/api/client.ts:29` defaults to `/api` locally |
| Environment | `runtimeEnvironment.isSandbox = VITE_CAPFLUX_MODE===sandbox` (`frontend/src/shared/environment/runtimeEnvironment.ts:90-97`) fail-closed to `production` | Correct |
| Transport | `VITE_API_TRANSPORT=remote` (deployed) vs `simulator` (local dev) (`frontend/src/shared/services/api/client.ts:38-42`) | `simulator` adapter (`frontend/src/sandbox/api/axiosAdapter.ts:43`) only installed when `runtimeEnvironment.transport===simulator` — production can never accidentally use it |
| Auth persona | Proprietress / School Owner `owner@demo.capflux / demo1234` (`frontend/src/sandbox/seed/demoData.ts:267-276`) via `/auth/demo-login` → `SandboxAuthProvider` (`frontend/src/sandbox/session/sandboxAuth.ts:166-191`) | Token stored as `capflux_demo_session` localStorage |
| Dashboard load | `HomeView.vue:87-88` calls `dashboardStore.fetchDashboardData()` on mount + online event | No route guard blocks Home (progressive access: `docs/phase8.2` — no global redirect). Home is **unlocked**. |
| API isolation | `SandboxCapfluxDB` (`frontend/src/sandbox/sandboxDb.ts:219-230`) uses physical DB `capflux_sandbox_db`; `CapfluxDB` (`frontend/src/offline/localDb.ts:175`) uses `capflux_local_db` — separate. `assertSandboxMode` guards both. `SandboxApiServer.handleSandboxRequest:1341` asserts sandbox. `dexie.delete('capflux_sandbox_db')` never touches prod. | **PASS** — no cross-DB leakage found |
| Network check | No static reference to `capflux.vercel.app`/`capflux.onrender.com`/prod Supabase host in `frontend/src` beyond `LandingNav.vue:16` `homeUrl` redirect **intentionally** to `https://capflux.vercel.app` when `isSandbox` (marketing). No data fetch to prod. | **PASS** |

> **Live browser inspection limitation:** No Playwright/screenshot tool and no sandbox Vercel env vars available in this offline container, so HTTP status/latency/console were **derived statically** from `api/client.ts`, `sandboxApiServer.ts`, and `dashboardStore.ts`. All network claims are labelled `STATIC INFERENCE`.

---

## 3. Dashboard Rendering Matrix

**Canonical source file:** `frontend/src/features/dashboard/views/HomeView.vue:1-172`
**Sub-components inspected:** `DashboardHeader.vue`, `FeeCollectionTrend.vue` (274 LOC), `CollectionBreakdown.vue`, `RecentPaymentsTable.vue`, `OutstandingBalancesTable.vue:1-114`, `OperationalMetrics.vue`, `ActivationBanner.vue`

| # | Section / Component | Label / Expected | Actual (with current code + seed V4) | Status | Sev | Root cause (first incorrect layer) |
|---|---|---|---|---|---|---|
| 3.1 | **ActivationBanner** (`HomeView.vue:102`) | Hidden when onboarding complete | **ALWAYS VISIBLE** — `authStore.isSchoolSetupComplete` (`frontend/src/stores/authStore.ts:51`) = `schoolSetupComplete && !!schoolId` — `schoolSetupComplete` is **never set to true** anywhere in codebase (grep zero writes). So banner renders as locked/setup-incomplete even though `onboarding_progress.completed_at` is set in seed. | WRONG — LOCKED | P1 | `STORE` (`authStore`) — missing hydration from `onboardingStore.status`/school. `DashboardHeader` not affected but banner is. |
| 3.2 | **DashboardHeader** | `Good morning, <name>. Overview of CAPFLUX Demo Academy's financial activity.` | `Good morning, owner.` (derived from `email.split('@')[0]` `DashboardHeader.vue:10-13`) + correct school name via `schoolStore.school.name` if loaded. Acceptable fallback. | PASS (minor) | P3 | — |
| 3.3 | **Metric Card: Total Collected** (`totalPayments`) | `₦49,177,940` (73.3% rate implies collected as per spec) | **WRONG VALUE** — sums `entry.amount` where `entry_type !== 'DEBIT'` (`dashboardStore.ts:157-163`). Seed ledger uses `entry_type=CHARGE/PAYMENT/REVERSAL` + `entry_direction`. Condition treats **every CHARGE as a payment**, inflating collected to ~₦116M (assessed+collected+reversals) or depending on cast, `totalCharges=0`, `totalPayments=charges+payments`. `netBalance` negative. `collectionRate` either 0% (guarded) or >100%. Rendered cards show wrong Naira. | WRONG VALUE | P1 | `STORE` — field-mismatch. First incorrect layer **STORE** (DB is correct, API-simulator correct, store mapping wrong). |
| 3.4 | **Metric: Outstanding Balance / netBalance** | `₦17,943,060` (≈26.7%) | **NEGATIVE** (`totalCharges - totalPayments` where charges=0). Rendered as negative or zero depending on formatting. `outstandingStudentCount` also miscomputed because per-student loops use same faulty filter (`dashboardStore.ts:184-201`). | WRONG VALUE / NEGATIVE | P1 | STORE |
| 3.5 | **Metric: Collection Rate** | `73.3%` | **0.0%** (`totalCharges===0 → rate=0` guard `dashboardStore.ts:169-171`) or >100% if charges partial. `OperationalMetrics.vue:35-40` progress bar reflects same. `CollectionBreakdown.vue:17-22` `collectedPercent`/`outstandingPercent` NaN/0. | WRONG VALUE | P1 | STORE |
| 3.6 | **Metric: Collected This Month** | Sum of SUCCESS payments in current month | **INFLATED + includes CHARGEs** — same `entry_type` filter + `dayjs(e.created_at)` vs seed's `occurred_at`/`created_at` both exist but store uses `created_at` correctly. Month filter logic itself sound (`calculateMonthlyCollections:268-278`). Value wrong due to direction bug. | WRONG VALUE | P1 | STORE |
| 3.7 | **CollectionBreakdown** | Two bars Collected vs Outstanding | If `totalCharges===0` → `hasData=false` (`CollectionBreakdown.vue:42`) → **EmptyState "No financial data yet"** despite ₦67M charges existing. Otherwise bars inverted. | HIDDEN/EMPTY or WRONG BAR | P1 | STORE |
| 3.8 | **Fee Collection Trend** | 7D/30D/3M/6M/1Y CREDIT buckets | Buckets aggregate **all entries** treated as credit (same bug) → trend inflated. Bucketing logic itself correct (single-pass `byDay` map `dashboardStore.ts:294-304`). No crash. | WRONG VALUE | P1 | STORE |
| 3.9 | **RecentPaymentsTable** | 10 most recent CREDIT entries with student/guardian | Filters `entry_type==='CREDIT'` (`dashboardStore.ts:207`) → with seed data **zero rows** (actual entries are `PAYMENT/CREDIT direction`). Returns `[]` → `EmptyState "No recent payments"` even though 497 payments exist. If cast accidentally matches, table would render but `reference/payment_method` missing. | EMPTY (false empty state) | P1 | STORE |
| 3.10 | **OutstandingBalancesTable** | Per-student outstanding where `charges-payments>0` | Same faulty per-student calc → most students show `outstanding = payments - charges` or zero. `students.slice(0,10)` limited correctly. Progress bar uses `100-percentage_paid` correctly (`OutstandingBalancesTable.vue:84`). | WRONG VALUE or EMPTY | P1 | STORE |
| 3.11 | **OperationalMetrics** | Students with Outstanding / Pending Verification / Offline Queue / Connection | `outstandingStudentCount` wrong (above). `pendingVerification` = entries where `entry_type==='CREDIT' && !verified` (`dashboardStore.ts:234`) → 0 (no CREDIT type). `syncStore.pendingCount` correct. Connection chip correct (`navigator.onLine`). | WRONG (2/4) | P2 | STORE |
| 3.12 | **Charts responsive** | 320-1440px no overflow | `FeeCollectionTrend.vue:123` `viewBox 0 0 800 180 preserveAspectRatio=none` + `w-full` → responsive. Label skipping `shouldShowLabel` (`:81-87`) prevents X overlap. `RecentPaymentsTable`/`OutstandingBalancesTable` have `overflow-x-auto` (`:71`,`:54`) → mobile scroll not clipped. | PASS | — | — |

---

## 4. Financial Integrity

### 4.1 Reference expectations (seed V4 plan)
- Derived from `frontend/src/sandbox/seed/seedSandbox.ts:54-53` `SEED_VERSION=4`, `demoData.ts:84-120` catalogue
- Assessed `₦67,121,000` = SUM(CHARGE debits) in ledger
- Collected `₦49,177,940` = SUM(PAYMENT credits) **net of REVERSAL debits**
- Outstanding `₦17,943,060` = assessed − collected (verified in test `seedFinancialIntegrity.spec.ts:31-59` — exact reconciliation `expect(assessed).toBe(collected+outstanding)`)
- 480 students, 270 guardians, 480 DVAs (`seedSandbox.ts:548-571`), 1996? charge entries (~charges per student filtered 35% optional `seedSandbox.ts:438`), 497 payments (success+pending+failed), 8 reversed, 2455 ledger entries (charges+credits+reversals), 3 recon runs, 24 notifications

### 4.2 Database → API → UI comparison (STATIC)

| Metric | DB (`sandboxDb` after `seedSandboxDatabase`) | API simulator (`sandboxApiServer.ts:214-243` `buildPaymentsSummary`) | UI (`dashboardStore.ts`) | Gap |
|---|---|---|---|---|
| assessed | `SUM entry_direction=DEBIT WHERE entry_type=CHARGE or REVERSAL` = ₦67.1M (test proves >0, <95% cap `seedFinancialIntegrity.spec.ts:147-159`) | Not exposed via dashboard endpoint — separate `/payments/summary` returns **only payment_transactions** totals, not ledger. No assessed endpoint. | `totalCharges` via faulty `entry_type===DEBIT` → **0** | **STORE bug** — should sum `entry_direction==='DEBIT'` and `amount_minor/100` or use `entry_type==='CHARGE'/'REVERSAL'` |
| collected | `SUM CREDIT PAYMENT` minus REVERSAL DEBIT = ₦49.1M | `/payments/summary:217-219` sums `status==='SUCCESS'` `amount_minor` correctly (eight 8 reversed excluded). `successfulMinor` correct. Uses `verified_at/paid_at` for today/month. | `totalPayments` via `entry_type!=='DEBIT'` → **₦116M** (double count) | STORE |
| outstanding | `assessed-collected = 17.9M` (no negatives per `seedFinancialIntegrity.spec.ts:62-77`) | Not exposed | `netBalance = totalCharges - totalPayments` → **negative** | STORE |
| collection rate | 73.3% (167-172 demoData spec would be ~50-75% range) | Not computed | `totalPayments/totalCharges` → **0% or NaN** | STORE |
| successful payments |  ~422? (roll distribution `seedSandbox.ts:484-538`: roll 0-10 FULL, 11-14 PARTIAL, 15-16 MULTI) | Count correct `byStatus('SUCCESS')` | 0 via ledger filter | STORE (but `payments` view uses correct API, not store) |
| pending/failed/reversed |  ~23 pending, ~23 failed, 8 reversed (exact) | Correct `byStatus` counts | Mis-filtered via ledger | STORE |
| recent payments | 497 ordered by `created_at` | `/payments` returns sorted `created_at` + `student_name` (`sandboxApiServer.ts:436-439`) correct | Empty | STORE |
| DVAs | 480 ACTIVE except archived `INACTIVE` (`seedSandbox.ts:564`) | `/dva` masked `maskAccount('******'+last4)` (`sandboxApiServer.ts:62-64`, `542-544`) correct | `totalDVAs` filtered by `account_status==='ACTIVE'` (`dashboardStore.ts:220`) — but store reads from Dexie directly; `payment_accounts` rows have correct statuses. **This metric is correct if ledger bug not present** | PASS |
| Trending | Daily `CREDIT PAYMENT` totals | Not via API, local calc | Inflated | STORE |

**Arithmetic invariant:**
`assessed = collected + outstanding` **holds in DB and ledger code** (`seedFinancialIntegrity.spec.ts:59` passes). **Broken in UI** because UI reconstructs from ledger with wrong field.

**Field mismatch detail — the core defect:**
- **Seed writes:** `{ entry_type: 'CHARGE'|'PAYMENT'|'REVERSAL', entry_direction: 'DEBIT'|'CREDIT', amount_minor, amount: minor/100, balance_before/after_minor, ... }` (`seedSandbox.ts:867-873`, `853-892`)
- **Store reads:** `if (entry.entry_type === 'DEBIT') totalCharges += Number(entry.amount)` else `totalPayments` (`dashboardStore.ts:157-163`). Cast `LedgerEntry { entry_type: 'DEBIT'|'CREDIT' }` (`dashboardStore.ts:31`) never matches seed values. Also ignores `REVERSAL` semantics (should subtract from collected). **Fix:** filter on `entry_direction` and/or `entry_type` enum, sum `amount_minor/100`, and treat `REVERSAL` as DEBIT (outstanding increase).

---

## 5. KYC / Compliance

### 5.1 Expected seed state
- `kyc_records: { id:'sd-kyc-main', status:'VERIFIED', overall_match_state:'MATCH', identity_match_states:{principal_nin:'MATCH', principal_bvn:'MATCH'}, bvn_last4:'4432', nin_last4:'8890' }` (`seedSandbox.ts:1002-1023`)
- `settlement_accounts: { id:'sd-setacc-main', status:'VERIFIED', ownership_match_state:'MATCH' }` (`seedSandbox.ts:1025-1039`)
- `gateway_assignments: { id:'sd-gw-main', status:'ASSIGNED', provider:'sandbox' }` (`seedSandbox.ts:1041-1050`)
- `schools: { id:'demo-school', status:'ACTIVE', payment_status:'READY', kyc_status:'VERIFIED' }` (`seedSandbox.ts:699-719`)
- `onboarding_progress: { completed_at, activated_at }` (`seedSandbox.ts:1052-1061`)
- `computeReadiness` (`sandboxApiServer.ts:165-190`) → `{ kyc_verified:true, settlement_verified:true, gateway_assigned:true, school_active:true, ready:true, reason:null }`

### 5.2 API state (`GET /kyc/status`, `/kyc/settlement`, `/kyc/activation`, `/onboarding/status`)
All routes return **VERIFIED / READY** as seeded:
- `/kyc/status` → `kycStatusPayload` returns `status: VERIFIED` plus `overall_match_state: MATCH` (`sandboxApiServer.ts:699-717`, `719-724`)
- `/kyc/settlement` → `{ settlement: {status:'VERIFIED', ownership_match_status:'MATCH'}, gateway:{status:'ASSIGNED'} }` (`sandboxApiServer.ts:826-852`)
- `/kyc/activation` → `{ready:true}` (`sandboxApiServer.ts:941-945`)
- `/onboarding/status` → `{ has_school:true, payment_status:'READY', school_status:'ACTIVE' }` (`sandboxApiServer.ts:349-372`, normalized via `onboardingStore.ts:71-124`)

### 5.3 UI state & lock conditions

| Surface | Guard | Expected | Actual | Root cause |
|---|---|---|---|---|
| **Dashboard Home** (`/dashboard`) | `ActivationBanner v-if="!authStore.isSchoolSetupComplete"` (`HomeView.vue:102`) + **no `ModuleLockOverlay`** on this view. Progressive-access rule: dashboard remains accessible (`docs/phase8.2:118`) | No lock overlay; banner hidden | **Banner shown** — `authStore.isSchoolSetupComplete` (`authStore.ts:51`) depends on `schoolSetupComplete` which is **never written** (initial `false`, no mutation after `loadOrganization`). Organization loads via `/context/school` or `/onboarding/status` but does not hydrate `authStore.schoolSetupComplete`. | `STORE` — `authStore` hydration missing. First incorrect layer **STORE**. Not a KYC gate. |
| **Billing / Payments / VAs / Reports** | `useModuleLock` (`frontend/src/composables/useModuleLock.ts:22-76`) checks `onboardingStore.paymentStatus==='READY'` and `financialStore.kycVerified`. Overlays: `setup → kyc → settlement → payment` (`frontend/src/views/BillingView.vue:95-98` and 5 other views). `onMounted` calls `loadStatus()` + `loadAll()` (`useModuleLock.ts:46-60`). Fail-open on network error (catch swallows). | No overlay — should show `paymentReady=true` | **No overlay** (correct) when loads succeed — `loadStatus` resolves to `READY`, `kycVerified` true. If `loadStatus` 400/404 → `_handleStatusError` swallows (`financialActivationStore.ts:808` returns early) → gate resolves to **not verified** → would show `kyc` overlay **incorrectly**. In sandbox with seed, loads succeed so **no KYC lock on dashboard**. Reported KYC lock likely refers to **ActivationBanner** mistaken for KYC lock, or Billing page when API transiently 401. | Potential `STORE` race (see §14) |
| **KYC wizard** (`/kyc/submit`) | `financialActivationStore.normalizeKycStatus` correctly maps `VERIFIED` (`financialActivationStore.ts:210-265`). `kycVerified` getter true. | Verified badge | Correct | — |
| **Gateway** | `gatewayAssigned` checks `settlementStatus.gateway` truthy (`financialActivationStore.ts:481-482`). Seed has assignment. | Assigned | Correct | — |

**Conclusion:** Sandbox seed intends **VERIFIED / not locked**. Dashboard itself does **not** show a ModuleLockOverlay by design. The only lock visible on dashboard is the **spurious `ActivationBanner`** caused by `authStore` dead state. Secondary pages would only lock if the two async stores race/fail — see Performance §14.

**Recommended correction (not implemented):**
- Hydrate `authStore.schoolSetupComplete = onboardingStore.isOnboardingComplete || onboardingStore.status?.school?.status==='ACTIVE'` after `loadStatus`, or remove `ActivationBanner` guard in sandbox (use `onboardingStore` or `schoolStore`). File: `frontend/src/stores/authStore.ts` + `frontend/src/features/dashboard/components/ActivationBanner.vue:10` + `frontend/src/features/dashboard/views/HomeView.vue:102`.

---

## 6. Branding / Icon Audit

| Asset | Path / Import | Actual | Expected | Verdict |
|---|---|---|---|---|
| `favicon.svg` | `frontend/public/favicon.svg:1-56` linked `frontend/index.html:5` `href="/favicon.svg"` | 1276×1276 Inkscape splash: teal/green abstract blob + 8 `fill:#5df7da/#18f7c9/...` paths, `id="g896"`, no CAPFLUX mark, no text. File header `<!-- Created with Inkscape -->` | Proper CAPFLUX wordmark or `C` monogram favicon (as used in header `AppHeader.vue:82-85` `C` circle) | **OLD PLACEHOLDER / INKSCAPE GENERIC** — P2 |
| `icon.svg` | `frontend/src/assets/icon.svg:1-56` | **Byte-identical content** to `favicon.svg` (1276×1233 slight height diff but same splash) | Either canonical logo or deleted duplicate | **DUPLICATE PLACEHOLDER** — P2 |
| `icons.svg` | `frontend/public/icons.svg:1-56` | Same Inkscape splash, referenced `LandingNav.vue:66,154` `src="/icons.svg"` as hero logo (10w). No real mark. | Distinct CAPFLUX logo | **DUPLICATE PLACEHOLDER** — P2. Three copies of same placeholder. |
| `AppHeader` logo | `frontend/src/components/AppHeader.vue:76-88` `<div class="...bg-brand">C</div> CAPFLUX` | Letter-C circle + text, hand-coded, no `<img>`. Correct minimalist mark. | OK (but inconsistent with landing's `icons.svg`) | PASS with inconsistency |
| Dashboard header icons | `HomeView.vue:25-33` inline Heroicons paths (`receipt`, `clock`, etc.) used via `MetricCard` `icon` prop | Real Heroicons outline, single-path | Expected | PASS |
| Sidebar icons | `Sidebar.vue:4-16` `@lucide/vue` (`LayoutDashboard`, `UsersRound`, ...) size `h-8 w-8` | Real lucide icons | Expected | PASS |
| Landing logo | `LandingNav.vue:66` `icons.svg` + `CAPFLUX` + `CmBadge Financial OS` | Uses placeholder splash | Should use same `C` monogram or proper SVG wordmark | P2 `COMPONENT` — Vite `public/` resolution correct (`/icons.svg` serves from `public/`), file itself is legacy |
| Browser title | `frontend/index.html:13` `<title>capflux</title>` lowercase | `capflux` | `CAPFLUX` (or `CAPFLUX — Financial OS for Nigerian Schools`) | P3 |
| Asset resolution | Vite `public/` served at root (`vite.config.ts` has no `publicDir` override) → `/favicon.svg`, `/icons.svg` correct | Correct | — | PASS |

**Recommended correction:**
- Replace `frontend/public/favicon.svg`, `frontend/public/icons.svg`, `frontend/src/assets/icon.svg` with a single canonical CAPFLUX mark (use `AppHeader` `C` circle vector or landing SVG `hero.png` as source). Dedup to one source imported via `/favicon.svg`. Update `LandingNav.vue:66` to use component import not raw public path. Lowercase title fix in `frontend/index.html:13`.

---

## 7. API / Data Mapping

| # | Consumer | Endpoint / Source | Backend shape | Frontend expects | Mismatch | Severity |
|---|---|---|---|---|---|---|
| 7.1 | `dashboardStore` | `LocalRepository.getLedgerEntriesBySchool('demo-school')` → Dexie `ledger_entries` (seed writes `entry_type:CHARGE/PAYMENT/REVERSAL`, `entry_direction`, `amount_minor`, `amount`) (`seedSandbox.ts:867-873`) | `{ entry_type: 'CHARGE'\|'PAYMENT'\|'REVERSAL', entry_direction: 'DEBIT'\|'CREDIT', amount_minor: number, amount: number }` | `{ entry_type:'DEBIT'\|'CREDIT', amount:number }` (`dashboardStore.ts:27-36`) cast blindly, checks `entry_type==='DEBIT'` | **ENUM + FIELD mismatch** — first incorrect layer `STORE` | P1 |
| 7.2 | `dashboardStore` currency | Ledger `amount_minor` kobo vs `amount` naira | Stores `amount` naira | Stores `amount` (naira) — fortuitously correct for display, but `amount_minor` is canonical kobo (compliance requires kobo). Risk if future code uses `amount_minor`. | N/A (hidden) | P2 |
| 7.3 | `dashboardStore.todaysCollections` / `calculateMonthlyCollections` | `e.created_at` (`dashboardStore.ts:153-154`, `272-275`) | Seed writes both `created_at` and `occurred_at` same (`seedSandbox.ts:888` `created_at: input.occurredAt`). OK. | `created_at` used — matches. | PASS |
| 7.4 | `financialActivationStore.normalizeKycStatus` | `GET /kyc/status` returns snake_case `kyc_status`, `identity_match_states`, `bvn_last4` etc (`sandboxApiServer.ts:719-724`) | Normalizes both `snake_case` and `camelCase` (`financialActivationStore.ts:212-265`, `171-201` `normalizeMatchStates`) robustly, accepts `overall` vs derived. | Dual support correct. | PASS |
| 7.5 | `onboardingStore.normalizeStatus` | `GET /onboarding/status` flat `{has_school, school_id, school_status, payment_status}` vs nested `{school, onboarding}` (`onboardingStore.ts:71-88`) | Handles both shapes. | PASS |
| 7.6 | `sandboxApiServer` → `apiClient` error shape | Throws `HttpError(status,msg)` caught as `AxiosError` with `response.status` (`axiosAdapter.ts:87-95`), vs `SandboxOfflineError` with no response (`:83`) | `apiClient` interceptor enriches `error.status`, `isNetworkError` (`client.ts:95-103`) then `categorizeApiError` maps to `NETWORK_ERROR` vs HTTP. | PASS |

No snake/camel renaming beyond the two stores (both correct). No pagination issue (dashboard reads full Dexie tables). **Only 7.1 is active defect.**

---

## 8. Console / Network Errors

**STATIC inference** (no live browser in container). Code-driven error catalogue:

| # | Trigger | URL | Status | Component / Action | Affects rendering? | Distinguishes | Sev |
|---|---|---|---|---|---|---|---|
| 8.1 | `dashboardStore.fetchDashboardData` before sandbox DB seeded | `Dexie` local — no HTTP | N/A (empty arrays) | Home mount before `seedSandboxDatabase` completes (race) | Shows `loading→EmptyState` briefly, then zero-state bug above compounds | Genuine defect (boot gate) | P2 |
| 8.2 | `onboardingStore.loadStatus` 401 when demo session expired | `GET /onboarding/status` (`api/client.ts:47-52` attaches `capflux_demo_session` Bearer) | 401 `SESSION_EXPIRED` (`client.ts:106-108`) | `useModuleLock.onMounted` + `HomeView` not, but Billing/Reports | Would show `kyc` overlay incorrectly (fail-open still shows banner, but gate resolves to not-verified) | Genuine defect if session TTL short | P1 |
| 8.3 | `financialActivationStore.loadAll` parallel 401/403 | `GET /kyc/status`, `/kyc/settlement`, `/kyc/activation`, `/kyc/documents`, `/kyc/shareholders` (`financialActivationStore.ts:795-803` `Promise.allSettled`) | 401/403 | Any page using `useModuleLock` — but `allSettled` swallows, `_handleStatusError` swallows 400/404 (`:808`) → silently `null` | Could cause **false LOCKED** (fail-closed to not-verified) despite seed VERIFIED | P1 |
| 8.4 | `import.meta.env.VITE_API_BASE_URL` missing on Vercel | `http://localhost:4000/api` fallback (`client.ts:29`) | `ERR_CONNECTION_REFUSED` / CORS → `isNetworkError=true` → `NETWORK_ERROR` category | All API loads → error banner "Connection problem" but dashboard Home does not surface (swallows) | Config defect (expected fix: set Vercel env) | P0 if sandbox actually misconfigured |
| 8.5 | `ensureOnline` offline toggle | Throws `SandboxOfflineError` → `axiosAdapter.ts:82-84` `isNetworkError=true` | Offline (no response) | All sandboxApiServer routes | Shows offline toast, tables keep cached data (offline-first correct) | Expected sandbox restriction | — |
| 8.6 | Duplicate `CAPSTONE` in logs | None in `frontend/src` (grep `capstone` 0 hits in `frontend/src`) | — | — | No console branding leak | PASS | — |

**No 500/502/503 expected** from `sandboxApiServer` — it is in-memory Dexie, deterministic. Render-side `favicon.svg` 1276×1276 large path causes **5-10KB parse cost but no error**.

---

## 9. Performance

| Metric | Code evidence | Assessment | Sev |
|---|---|---|---|
| Auth → dashboard latency | `handleSandboxRequest:1361-1362` deterministic latency `60 + (counter*37)%140` = 60-200ms per request → `loadAll` 5 parallel ≈ 60-200ms wall + Dexie `.toArray()` (≈1-2k rows). Dashboard `fetchDashboardData` does `Promise.all(5)` students/guardians/ledger/accounts/notifications (`dashboardStore.ts:138-144`) → **~150-300ms** total simulator latency + ~50ms calc + `trendData` 5 ranges computed in-loop (`dashboardStore.ts:242-251`) O(n). | Good | — |
| Initial load | No duplicate fetch in production path: `refresh()` calls `fetchDashboardData` once (`HomeView.vue:77-80`). `useModuleLock` separately calls `loadStatus` + `loadAll` (`useModuleLock.ts:46-60`) — not deduplicated across stores. On Billing page both guards fire paralelally: `onboardingStore.loadStatus` + `financialActivationStore.loadAll` (5 requests) + `dashboardStore` (5 Dexie reads) = ~10 concurrent ops. Dedup only within each store (`_pendingLoadStatus` single promise `onboardingStore.ts:61-63`, `_pendingLoads` map `financialActivationStore.ts:386`). Cross-store dupe remains. | **Duplicate parallel loads** on gated pages but not Home (Home only does dashboard). Not a loop. | P3 |
| Request count (Home) | 0 HTTP (dashboard reads Dexie), 0 for auth if `capflux_demo_session` present. If visiting gated pages: up to 6 HTTP (`/onboarding/status` + 5 `loadAll` subcalls). `allSettled` ensures none block. | Acceptable | — |
| Slow requests | None — IndexedDB is synchronous-ish, simulator latency capped 200ms. `calculateTrendData` for 1Y: perDay map then 12 months → O(entries + buckets) efficient (`dashboardStore:290-361`). | Good | — |
| Loops / retries | No retry loop. `fetchDashboardData` catch sets `error` but does not retry (`dashboardStore.ts:253`). `ensureOnline` throws once, adapter does not retry. | Safe | — |
| Seed operation | `seedSandboxDatabase` clears all tables then `bulkPut` ~4k rows (`seedSandbox.ts:696`). Done once via boot gate `SEED_VERSION` check. Not on every load. | Correct | — |

---

## 10. Responsive UX

**Inspection:** `HomeView.vue:108-169` Tailwind grid, no media-query bugs; components use `overflow-x-auto` + `hidden sm:table-cell` hiding.

| Viewport | Finding | Component | Sev |
|---|---|---|---|
| Mobile 360-430px | `MetricCard` grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` (`HomeView.vue:124`) → 1-col stack, no overflow. `FeeCollectionTrend` `viewBox 800×180` shrinks via `w-full h-[160px] sm:h-[200px]` (`:122`) → readable, labels skipped (`labelInterval` logic). Tables `overflow-x-auto` scroll horizontally without page scroll. | PASS | — |
| Tablet 768px | 2-col metric, `lg:grid-cols-3` trend+breakdown (`HomeView.vue:140`) → 2+1 stack. Gap `gap-6` consistent. | PASS | — |
| Desktop 1024+ | Sidebar collapse `lg:w-20` vs `w-[188px]` (`Sidebar.vue:148`) + `AppHeader h-[50px]` fixed. Content `max-w-7xl mx-auto` (`HomeView.vue:100`). No clipped text. | PASS | — |
| Known minor | `KycSubmission.vue:327` `.overflow-y-auto {max-height:20vh}` on mobile — may squash progress sidebar; not dashboard. `AppHeader` icons `h-8 w-8` tight but within 34px button. | P3 | — |
| Currency readability | `toLocaleString()` without `NGN` prefix on some `MetricCard` when `currency:true` — uses `₦` symbol inline. `F3 === 13.5...` not truncated. | PASS | — |

No critical responsive defects on dashboard.

---

## 11. Root-Cause Matrix

| ID | Sev | Screen / Section | Component / File:Line | Visible Symptom | Expected | Actual | DB value | API/sim value | Store value | Rendered | First Incorrect Layer | Root Cause | Recommended Fix (RO — not applied) | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **F-001** | **P1** | Financial Summary — Total Collected | `dashboardStore.ts:157-163`, `HomeView.vue:39` (`metricCards[0]`) | `₦0` or `₦116M` depending on entry_type cast; collection rate 0%; breakdown shows EmptyState | `₦49,177,940` / 73.3% | inflated or 0 | `49,177,940` (ledger sum filtered correctly in test) | `buildPaymentsSummary = 49,177,940` | `totalCharges=0`, `totalPayments=charges+payments` (faulty enum) | `₦0` / wrong | **STORE** | Seed writes `entry_type=CHARGE/PAYMENT/REVERSAL`, store checks `entry_type==='DEBIT'` (never true). All charges counted as payments. `REVERSAL` not subtracted. | Replace with `e.entry_direction==='CREDIT' && e.entry_type==='PAYMENT'` for collected, `e.entry_direction==='DEBIT'` for assessed; sum `amount_minor/100`; subtract REVERSAL; add unit test mirroring `seedFinancialIntegrity.spec.ts`. Files: `frontend/src/features/dashboard/stores/dashboardStore.ts:27-36` types, `:151-172`, `:183-201`, `:206-217`, `:241` trends. | High |
| **F-002** | **P1** | Financial Summary — Outstanding & Rate, OutstandingByStudent, RecentPayments | Same `dashboardStore.ts` | Negative balance, 0% rate, empty tables | `₦17,943,060` / `240-300` students with balances | negative | `17,943,060` | — | `netBalance = 0 - payments` → negative; `outstandingByStudent` filtered on wrong calc → empty or negative outstanding | negative / empty | **STORE** | Same as F-001 — per-student loop reuses faulty filter (`dashboardStore.ts:185-191`). `recentPayments` filters `entry_type==='CREDIT'` → 0 rows. | Fix F-001 fixes this; add per-student test: sum DEBIT vs CREDIT per `entry_direction`. Files: same. | High |
| **F-003** | **P1** | Dashboard banner — ActivationBanner always shown | `HomeView.vue:102`, `ActivationBanner.vue:10`, `authStore.ts:51` | Yellow/Setup banner "Complete setup" persists on dashboard even though sandbox is fully onboarded (`onboarding_progress.completed_at` set) | Hidden when `school.status===ACTIVE && progress.completed` | Always visible | `onboarding_progress.completed_at` not null | `/onboarding/status` returns `has_school:true, school_status:ACTIVE` | `authStore.isSchoolSetupComplete = false` (never hydrated) | Banner visible | **STORE** (`authStore`) | `authStore.schoolSetupComplete` field has no writer; `authStore` never reads `onboardingStore.status` or `GET /onboarding/status`. `ActivationBanner` uses wrong store. | Hydrate from `onboardingStore` or `schoolStore` or switch banner guard to `useOnboardingStore.requiresSetup` / `schoolStore`. Files: `frontend/src/stores/authStore.ts:51,57-90`, `frontend/src/features/dashboard/components/ActivationBanner.vue:10`, `frontend/src/features/dashboard/views/HomeView.vue:102`. | High |
| **F-004** | **P2** | Dashboard → Billing/Payments etc. — potential false KYC lock | `useModuleLock.ts:32-38`, `financialActivationStore.ts:808`, `BillingView.vue:95-98` (×6 views) | If transient 401, shows `ModuleLockOverlay` variant `kyc` ("KYC Verification Required" `ModuleLockOverlay.vue:29-35`) even though DB is VERIFIED | No overlay (payments ready) | Overlay if API fails | `VERIFIED` | `VERIFIED` | `null` (load swallowed 400/404 but not 401) → `kycVerified=false` | Locked | **STORE** | `_handleStatusError` swallows only 400/404, but 401 bubbles to `_setError` then `kycVerified` remains false; `allSettled` + `catch(()=>{})` masks error, gate defaults to locked. Also `loadAll` not deduplicated across `useModuleLock`+ pages → race can leave `kycStatusLoaded=false`. | Make `useModuleLock` fail-open (treat unknown as not-locked for non-sensitive pages) or retry, and dedup cross-store. Files: `frontend/src/stores/financialActivationStore.ts:805-817`, `frontend/src/composables/useModuleLock.ts:46-61`. | Medium |
| **F-005** | **P2** | Branding — landing/auth/dashboard favicon/logo | `frontend/public/favicon.svg`, `frontend/public/icons.svg`, `frontend/src/assets/icon.svg`, `frontend/src/components/AppHeader.vue:82-85`, `frontend/index.html:5,13`, `frontend/src/components/landing/LandingNav.vue:66` | Dashboard header shows hand-coded `C` circle but landing shows Inkscape splash placeholder; favicon is large teal blob not a `C` monogram | Consistent `C` monogram or proper CAPFLUX wordmark; single source | Three identical Inkscape splash SVGs (1276×1276) | — | — | Splash shown | **COMPONENT / ASSET** | Inkscape-generated placeholder committed as favicon/icons (`git log` shows `icon.svg` from early scaffold never replaced). Vite `public/` serves correct path but file is wrong. Title lowercase `capflux`. | Replace with single canonical vector, dedup `icon.svg` vs `favicon.svg` vs `icons.svg`, update `LandingNav.vue:66`, `index.html:13` to `CAPFLUX`. Files: `frontend/public/favicon.svg`, `frontend/public/icons.svg`, `frontend/src/assets/icon.svg`, `frontend/index.html:13`, `frontend/src/components/landing/LandingNav.vue:66`. | High |
| **F-006** | **P2** | Placeholder data — CollectionBreakdown EmptyState | `CollectionBreakdown.vue:42-56` | "No financial data yet" when DB has ₦67M charges | Breakdown bars | EmptyState shown | ₦67.1M charges | — | `totalCharges=0` | Empty | **STORE** (derived) | F-001 causes `hasData = totalCharges>0` false → legitimate empty-state component rendered as **false empty**. Not a hard-coded mock bug. | Fix F-001 auto-fixes. | High |
| **F-007** | **P2** | Branding relic — Capstone references user-facing | `rg -i capstone frontend/src` = 0 hits — PASS. Remaining `Capstone` only in `docs/`, `supabase/migrations` `Capstone revenue` comment `202607100012:55`, `README.md:86` `Capstone Demo School`, `supabase/functions/send-notification` `noreply@capstone.school`/`Capstone School Notification` | None in frontend | 0 user-facing | Docs/DB comment only | — | — | None rendered | **N/A** | Internal legacy strings not user-visible; email from `capstone.school` should be `capflux` domain but not dashboard. | Update `supabase/functions/send-notification/index.ts:32,51,115` domain to `capflux` (operational, not dashboard). Files: listed. | Low |
| **F-008** | **P3** | Browser title | `frontend/index.html:13` | `capflux` lowercase | `CAPFLUX` | — | — | — | lowercase | **COMPONENT** | Scaffold title never capitalized. | Change to `CAPFLUX — Financial OS` | High |
| **F-009** | **P3** | Performance — duplicate loads on gated pages | `useModuleLock.ts:46-60` vs `onboardingStore`/`financialActivationStore` separate dedup maps | 6-10 requests on Billing load vs Home 0 | Single load | ~10 HTTP + Dexie parallel | — | — | — | SLOWER | **STORE** | No cross-store coalescing; Home unaffected. | Single orchestrator in `AppShell` or `useModuleLock` singleton promise. Files: `frontend/src/composables/useModuleLock.ts`, `frontend/src/stores/onboardingStore.ts:61`, `frontend/src/stores/financialActivationStore.ts:386,795`. | Medium |

---

## 12. Recommended Fix Plan

### P1 — Must fix before sandbox is truthful (no data change needed)

- **F-001 / F-002 / F-006 — Fix ledger field mapping in `dashboardStore`**
  - Rewrite `fetchDashboardData`, `outstandingByStudent`, `recentPayments`, `calculateMonthlyCollections`, `calculateTrendData` to filter on `entry_direction`/`entry_type` correctly and sum `amount_minor/100` (or `amount`). Subtract `REVERSAL` debits from collected.
  - Add regression test that replays `seedFinancialIntegrity.spec.ts` logic against `dashboardStore` in fake DB (reuse `createFakeSandboxDb`).
- **F-003 — Fix ActivationBanner gating**
  - Either: populate `authStore.schoolSetupComplete` from `onboardingStore` after `loadStatus`, or change `ActivationBanner.vue:10`/`HomeView.vue:102` guard to `useOnboardingStore`/`useSchoolStore` (`requiresSetup` / `school.status === 'ACTIVE'`). Prefer store composition over auth field.

### P2 — Should fix for demo credibility

- **F-005 — Replace placeholder favicon/logo**
  - Promote `AppHeader`'s `C` circle vector to a proper SVG component `CapfluxMark.vue`, export as `public/favicon.svg`, update `LandingNav` to import component not `public/icons.svg`, delete `src/assets/icon.svg` duplicate, update `index.html` title.
- **F-004 — Harden ModuleLock fail-open**
  - Do not treat unknown KYC state as locked on read-only pages; show `OfflineBanner` instead of full overlay when `isNetworkError`, and retry. Consolidate `useModuleLock` to a singleton loader (reuse `_pendingLoadStatus` pattern).
- **F-007 — Email domain legacy** (ops, not dashboard render).

### P3 — Polish

- **F-008** title capitalisation.
- **F-009** deduplicate cross-store loads (singleton in `AppShell.onMounted`).
- Align `OutstandingBalancesTable` progress bar semantics document (`100 - percentage_paid` is outstanding % — currently unlabeled, confusable).

**All fixes are frontend-only** (`frontend/src/...`). No seed, DB, migrations, env vars, or production changes required.

---

## 13. Files To Change

**P1 (3 files, critical):**
- `frontend/src/features/dashboard/stores/dashboardStore.ts` — lines 27-36 type, 138-144 fetch, 151-172 charges/payments/balance/rate, 183-217 outstanding/recent, 241-261 trends + 268-361 helpers
- `frontend/src/features/dashboard/components/ActivationBanner.vue` (guard:10)
- `frontend/src/features/dashboard/views/HomeView.vue` (guard:102) + `frontend/src/stores/authStore.ts` (hydrate 51, 57-90) — alternative fix point

**P2 (6 files):**
- `frontend/public/favicon.svg` · `frontend/public/icons.svg` · `frontend/src/assets/icon.svg` (deduplicate) · `frontend/src/components/landing/LandingNav.vue:66,154` · `frontend/src/components/AppHeader.vue:82-85` (optional unify) · `frontend/index.html:5,13`
- `frontend/src/composables/useModuleLock.ts:46-61` · `frontend/src/stores/financialActivationStore.ts:805-817` (fail-open + dedup)
- `supabase/functions/send-notification/index.ts:32,51,115` (operational domain)

**P3 (3 files):**
- `frontend/src/composables/useModuleLock.ts` + `frontend/src/stores/onboardingStore.ts:61` (cross-store singleton)
- `frontend/src/features/kyc/KycSubmission.vue:327` (mobile spec) + `frontend/src/features/dashboard/components/OutstandingBalancesTable.vue:76-87` (label)

No backend, supabase migration, Render, or Vercel config change.

---

## 14. Production Safety

| Claim | Evidence | Confirmed |
|---|---|---|
| Production code untouched | `git status` clean on `sandbox` branch (see §16); no `prod` branch checked out; `runtimeEnvironment` fail-closed ensures no sandbox code path executes in production bundle | **YES** |
| Production config untouched | No `.env*` edit, no `vercel.json` edit, no `VITE_API_BASE_URL` change; `frontend/.env` still `localhost` | **YES** |
| Production DB untouched | All inspected stores’ sandbox path uses `getSandboxDb()` gated by `assertSandboxMode`; `deleteSandboxDatabase()` only deletes `capflux_sandbox_db` (`sandboxDb.ts:248-254`); no `supabase` service-role calls in audit | **YES** |
| No production mutation performed | This audit opened no browser to `capflux.vercel.app` for mutation; no `POST /payments`/`POST /kyc` etc. invoked. All defects derived statically. | **YES** |
| No secrets exposed/rotated | No `.env.local` content printed except Vercel OIDC token already gitignored; Supabase anon key is publishable; no secret exfil | **YES** |

---

## 15. Seed Safety

| Claim | Evidence | Confirmed |
|---|---|---|
| Seed V4 untouched | `frontend/src/sandbox/seed/seedSandbox.ts:51` `SEED_VERSION=4` unmodified; `git diff` null (see §16) | **YES** |
| No seed values changed | No migration edited (`supabase/migrations` not touched); `demoData.ts` CATALOGUE unmodified; `SEED_COUNTS` frozen | **YES** |
| No database writes | No `seedSandboxDatabase()` invoked, no `bulkPut`/`clear` called; audit used `Read`/`Grep`/`Bash rg` only | **YES** |
| Ledger append-only preserved | `LedgerRepository.createDebitLedgerEntry` guard (`LedgerRepository.ts:79-81` only DEBIT locally) intact; no reversal bypass | **YES** |
| Compliance invariants not weakened | No `any`/`@ts-ignore` added, no RLS/security test modified | **YES** |

---

## 16. Git Safety

```bash
branch: sandbox
starting commit: cb839d0  fix(sandbox): align auth UI with light theme and persona access
ending commit:   cb839d0  (same — read-only)
git status:     On branch sandbox — nothing to commit, working tree clean
git diff --stat: (empty)
```

Verification command executed:
```bash
git checkout sandbox && git log --oneline -15 && git status
# → On branch sandbox, nothing to commit, working tree clean
```
Pre-existing dirty changes: **none** — `main` was clean before checkout; `sandbox` remains clean. Report created **in-place** (not written to disk per read-only guarantee).

---

### Auditor Notes

- **Why dashboard reads “₦0 / locked / placeholder” is not a data problem:** The seed’s own integrity tests (`seedFinancialIntegrity.spec.ts:31-59`, `seedPopulation.spec.ts:32-47`) prove ₦67.1M = collected + outstanding and every class has 15-60 pupils. The simulator’s `buildPaymentsSummary` and `computeReadiness` already return correct numbers. The **first incorrect layer is STORE** (`dashboardStore.ts:157-163`) — a one-line enum mismatch that cascades into 6 dashboard sections reporting empty/wrong.
- **Why branded logo looks stale:** Three copies of the same Inkscape splash shipped as `favicon.svg`/`icons.svg`/`icon.svg` — the landing page’s `<img src="/icons.svg">` and the favicon both load the splash, while `AppHeader`’s hand-coded `C` is the only correct mark. Asset path resolution via Vite `public/` is correct; the file content is legacy.
- **Isolation:** `VITE_CAPFLUX_MODE`/`VITE_API_TRANSPORT` + separate `capflux_sandbox_db` + `sandboxAxiosAdapter` isolation is **sound**; no prod leakage detected.

Report prepared by read-only inspection of `frontend/src` (`dashboard`, `sandbox`, `shared`, `stores`, `composables`, `offline`, `assets`) on `sandbox@cb839d0`. Next workstream can implement §12 P1 without data reset.
