# CAPFLUX Student Page — IA + UI/UX Refactor Report

- Scope: Student Page + directly related navigation/routing + shared components only
- Base: `main` (frontend-only change; no backend, env, or deployment changes)
- Principle: global sidebar = manage the school; `Students/:id` = operate on one student

## A. Information Architecture Changes

| What moved | Where | Why |
|---|---|---|
| Academic Structure tab | Removed from Students UI; canonical route is now `/settings/academic-structure`, reachable via Sidebar **Settings → Academic Structure** and a new card on the Settings page | School configuration, not student register |
| Daily Collections, Outstanding Fees | Sidebar **Reports** expandable group: Reports Overview / Daily Collections / Outstanding Fees; each report page cross-links the trio | School-wide reporting questions, not operational modules |
| Legacy `/students/academic-structure` | Kept as a redirect to the canonical Settings route | Route compatibility |
| `StudentsAreaNav.vue` (Student Register / Academic Structure peer tabs) | Deleted; usages removed from `StudentListView` and `AcademicStructureView` | Eliminates the duplication at the source |

Latent bug fixed: `/students/academic-structure` was declared *after* `/students/:id`, so it could be
captured as a student id. The canonical route now precedes the param route.

## B. Student Page Changes

- Removed tabs: the `Overview / Academic history / Guardians / Fees / Payments / Virtual account`
  tab bar is gone from `StudentDetailView.vue`; no tab state remains.
- New unified workspace (single scroll): 1. Identity (back link, name, admission ID, placement
  line, status chip, Edit/Archive-Restore — all preserved) → 2. Financial position → Student
  information → 3. Guardian (reused `StudentGuardiansCard`: link/add/edit preserved) + 6. Virtual
  account (side-by-side on desktop, stacked in priority order on mobile) → 4. Fees +
  5. Recent payments → Record transaction (preserved) → 7. Academic history (current placement +
  `AcademicHistoryList`).
- Student Register (`/students`): subtitle rewritten to student scope; empty state is now a compact
  bordered card ("Excel · CSV supported"; also fixed a latent `emit`-without-`defineEmits` bug);
  header Add/Import buttons hide while the empty state owns the CTAs so actions never compete.

## C. Navigation (all preserve student context)

- Guardian: existing card navigates to `GuardianDetail` (`/guardians/:id`) — unchanged.
- Billing: `Billing` route with `?student=<id>`; `BillingView` scopes its ledger summary +
  pre-fills the charge form, with a "back to student" link.
- Payments: `Payments` route with `?student=<id>`; `PaymentsDashboard` loads
  `loadPayments(studentId)` (existing `GET /payments/student/:id`) and filters, with a
  "back to student" link. No backend change needed.
- Virtual Account: `VirtualAccounts` route with `?student=<id>`; view filters/preselects and links
  back. Detail shows masked `•••• •••• last4` (previously rendered the full number) plus backend
  status when available; Provision button calls the existing `provisionDVA`.

## D. Financial UX

- Replaced the view's ad-hoc `Number(entry.amount)` float math with canonical
  `summarizeLedger` / `getEntryAmountMinor` / `formatNairaKobo` (integer kobo). Expected = CHARGE
  debits, Paid = PAYMENT credits net of reversal debits, Outstanding = difference. No stored
  semantics changed; append-only ledger untouched.
- Status is text + chip + icon, never color alone: Paid / Partially paid (+ % collected bar with
  `progressbar` semantics) / Outstanding / No billing records / Data unavailable. Empty states
  distinguish "No billing records available" from "No payments recorded yet".

## E. Responsive UX

Desktop: 3-up financial figures, 2-column Guardian/Virtual and Fees/Payments grids.
Tablet/mobile: sections stack in hierarchy order; existing responsive student table untouched; key
actions carry `min-h-[44px]`. No new wide tables.

## F. Accessibility

Semantic `h1`/`h2` with `aria-labelledby` sections, `dl` for identity facts, `aria-current` on
submenu items, `aria-expanded` on group headers, visible focus via existing CEMDS rings, no
div-buttons. Fixed two `CmStatusChip` misuses (`:status="student.status"` with no label).

## G. Test Results

- Baseline before changes: 56/56 pass (Sidebar, ledger semantics, guardians card).
- New: `Sidebar.ia.spec.ts` (8), `StudentDetailView.spec.ts` (7, incl. kobo math
  ₦250,000/₦205,000/₦45,000/82% and masked account), `studentIaRoutes.spec.ts` (5, incl. legacy
  redirect). One existing `Sidebar.spec` selector needed a compatible tweak (child labels now carry
  the same fade classes).
- After: **170/170 pass** across components, views, router, lib, guardian store, guardians card
  suites. `tsc --noEmit`: zero errors in touched files (remaining errors pre-existing in unrelated
  specs; repo has no typecheck script).
- Compliance gate: change is frontend display-only; backend tree untouched. Backend
  `compliance:audit` re-run: PASS=2 PARTIAL=6 FAIL=2 — both FAILs pre-existing and unrelated
  (`check-secrets` doc-scan hits in `docs/auth-migration-audit.md`; legacy unauthenticated
  `workos-webhook.ts` router). No legal compliance asserted.

## H. Build Result

`npm run build` — **passes** (~12s; only pre-existing chunk-size warnings).

## I. Production/Sandbox

Same source implementation for both; no env forks; Sandbox root redirect and all route
names/paths preserved. **Browser QA not performed** — no browser tooling in this environment.

## J. Remaining Issues

- FIXED: route-order capture bug; full-number account display; float-based balance math; duplicate
  Add/Import CTAs.
- PRE-EXISTING (unchanged): `tsc` noise in unrelated specs; `StudentTable` `:variant` vs
  `CmStatusChip` `:status` prop mismatch; backend audit FAILs above.
- INFRASTRUCTURE BLOCKER: live Production/Sandbox browser verification still needs a
  browser-capable environment.
- INTENTIONALLY UNCHANGED: backend APIs, ledger/payment architecture, auth, deployment, Sandbox
  redirect, Dashboard/Auth/Landing visuals beyond the required IA grouping.
