# CAPFLUX Sandbox Release Verification Report

**Phase:** Sandbox Release Verification & Demo Readiness
**Date:** 2026-09-13 (UTC)
**Baseline:** seed v4 dataset (480 students, hash `fnv1a-38dda3bd`)
**Release decision: BLOCKED** (P0 items in §19; all are deployment/environment, not data)

---

## 1. Executive summary

- Seed v4 work was **separated from the in-progress auth refactor and committed cleanly** in two commits, pushed to `origin/main` without force.
- Data layer is **fully verified**: 35/35 seed/release tests, backend 259/259, typecheck and both builds green.
- **Live sandbox backend cannot log anyone in right now**: `POST /api/auth/demo-login` returns 401 for every valid persona because `DEMO_SESSION_SECRET` is missing/invalid on the `capflux-sandbox-api` Render service. Fix: set a ≥32-char sandbox-only secret on that service (never on production) and restart. No code change needed.
- Sandbox backend `/health` reports **database error** (sandbox Supabase unreachable). Data-plane endpoints depend on it.
- The reported **~26s login delay is explained by Render cold start**: measured 24.3s cold → ~1s warm on the sandbox API. No per-login seeding exists in code; no 401 retry loop exists. Warm-path ≤2s target is achievable once the service stays warm (keep-warm or paid instance), plus the secret fix above.
- The earlier **401 "Bearer token required" is expected unauthenticated behavior** (`GET /api/auth/demo-session` without a token), not a bug.
- Dashboard math is **derived from data** (`dashboardStore.fetchDashboardData`); seed v4 has zero negative balances and 178 students with balances, so the old contradictory dashboard symptoms cannot arise from v4 data.
- **Browser E2E was NOT performed** — this environment has no browser tooling (no clicks, console, or network capture). All browser-dependent gates are marked NOT VERIFIED.
- **Production was not modified** in any way (verified by commit range + read-only endpoint checks).

## 2. Deployment status

| Target | Status | Evidence |
|---|---|---|
| Seed commits pushed | **PASS** | `8796102..7cdc7c8 main -> main`, then `7cdc7c8..03b5b37 main -> main`, no force |
| Sandbox frontend reachable | **PASS** | `GET https://capflux-sandbox.vercel.app/auth` → 200 in 0.56s |
| Sandbox backend reachable | **PASS WITH P1** | `/health` responds, but 503 while DB errors; first hit took 24.3s (cold start), subsequent ~1s |
| Sandbox backend redeploy | NOT VERIFIED | No Render/Vercel dashboard access from here; backend uptime (~20s at 21:32 UTC) suggests a restart around push time |
| Vercel env (`VITE_API_BASE_URL` etc.) | NOT VERIFIED | Lives in Vercel dashboard; repo contains no hardcoded prod URLs in `frontend/src` |

## 3. Commits

1. `7cdc7c8` — `feat(sandbox): rebalance school population and demo data (seed v4, 480 students)`
   - `frontend/src/sandbox/seed/demoData.ts` (CLASS_POPULATIONS, 15 levels incl. Nursery 3, age ranges, family templates, extended names)
   - `frontend/src/sandbox/seed/seedSandbox.ts` (SEED_VERSION 4, class-first planner, family pass, NONE outcome, scaled payments/ledger/recon/notifications/audit)
   - `seedPopulation.spec.ts`, `seedFinancialIntegrity.spec.ts`, `seedRealism.spec.ts` (new)
   - `releaseGate.spec.ts` — **only the reseed-timeout hunk** (4 lines)
2. `03b5b37` — `fix(sandbox): reseed stale datasets via SEED_VERSION boot gate`
   - `seedSandbox.ts` (export `SEED_VERSION`), `sandbox/index.ts` (gate on `SEED_VERSION` instead of hardcoded 3), realism test pinning the contract

Separation method: staged/unstaged hunk surgery (`/tmp/mine.patch` 1 hunk vs `/tmp/theirs.patch` 3 hunks); `git diff 8796102..HEAD --stat` shows **only these 7 files**. A first attempt accidentally swept 3 auth-owned lines into the commit via `git commit -- <pathspec>` (which records worktree, not index); it was reset and redone correctly **before pushing** — pushed history is clean.

## 4. Sandbox URLs

- Frontend: https://capflux-sandbox.vercel.app (200)
- Backend: https://capflux-sandbox-api.onrender.com (health 503 w/ DB error; auth endpoints live)
- Production frontend: https://capflux.vercel.app (200, untouched)
- Production backend: https://capflux.onrender.com (healthy, DB connected)

## 5. Authentication architecture verified

- Code: browser → persona selector → `POST /api/auth/demo-login` → signed HS256 JWT (`DemoAuthService`, 4h TTL, `sandbox+demo` claims) → `Authorization: Bearer` → `requireAuthDemo` → sandbox API. Server allowlist is authoritative; browser never sets roles. **PASS (code + live endpoint shape)**.
- `GET /api/auth/demo-personas` on sandbox backend → 200 with exactly the 5 expected personas. **PASS**.
- `POST /api/auth/demo-login` on sandbox backend → **401 for all 5 valid personas**: `DEMO_SESSION_SECRET must be set and at least 32 characters`. Unknown persona correctly rejected (`Unknown demo persona`). **BLOCKED (P0, environment)**.
- No WorkOS in sandbox path; production demo endpoints return 404 (see §18). **PASS**.

## 6. Demo persona results

| Persona | demo-personas listing | demo-login (live backend) | UI login |
|---|---|---|---|
| Amaka Obi (proprietor/OWNER) | PASS | **BLOCKED (P0 secret)** | NOT VERIFIED (no browser) |
| Chinedu Bello (administrator/ADMIN) | PASS | **BLOCKED** | NOT VERIFIED |
| Ngozi Eze (bursar/ADMIN-as-BURSAR) | PASS | **BLOCKED** | NOT VERIFIED |
| Tunde Adebayo (teacher/STAFF) | PASS | **BLOCKED** | NOT VERIFIED |
| CAPFLUX Platform Ops (platformStaff) | PASS | **BLOCKED** | NOT VERIFIED |

Role boundaries: enforced server-side via persona-derived permissions (`PERSONA_PERMISSIONS`, `requireAuthDemo` + RBAC route guards) — code PASS, browser NOT VERIFIED.

## 7. Login latency measurements

| Measurement | Result |
|---|---|
| Sandbox API cold (first hit after sleep) | **24.3s** (`/health`, 503 w/ DB error) |
| Sandbox API warm | **~0.8–1.1s** (health, demo-personas, demo-login) |
| Production API cold | **23.8s** (first demo-personas hit) → 1.3s warm |
| Per-login seeding | **None** — `ensureSandboxSeeded` runs once at sandbox bootstrap per seed version, never in the auth flow |
| 401 retry loop | **None** — response interceptor rejects immediately, no auto-retry |
| Seed cost reference | Full v4 reseed ≈ 2s in-test (IndexedDB); one-time per version upgrade |

**Root cause of the ~26s persona→dashboard delay: Render free-tier cold start.** The 24.3s measured cold boot accounts for the reported ~26s. Warm-path ≤2s is realistic once (a) the service stays warm and (b) the P0 secret is set. If cold-start infra is retained, document it as a known limitation; do not add sleep/retry hacks.

## 8. 401 investigation

The earlier `401 Unauthorized / Bearer token required` came from `GET /api/auth/demo-session` **without a token** — that is the designed unauthenticated response (`backend/routes/auth.ts:501-504`), reproduced live. **Expected behavior, not a bug.** Token propagation: request interceptor attaches `Bearer` from `capflux_demo_session` synchronously per request; no pre-token race fix needed in code. Live race verification needs a browser → NOT VERIFIED.

## 9. Dashboard financial verification (code + seed data)

`dashboardStore.fetchDashboardData` derives everything from repositories: `totalCharges/totalPayments` from ledger `DEBIT/CREDIT`, `netBalance = charges − payments`, `collectionRate = payments/charges`, per-student `outstanding = charges − payments` filtered `> 0`, recent payments from actual CREDIT entries. Nothing hardcoded. With v4 data (assessed ₦67,121,000 = collected ₦49,177,940 + outstanding ₦17,943,060; zero negatives; 178 with balances; rate 73.3%): dashboard **must** render coherent values. The old negative/zero symptoms cannot arise from v4 data (they imply empty or over-credited inputs). Rendered-dashboard check → NOT VERIFIED (no browser).

## 10–11. Population verification (from seeded DB + tests)

Total **480**. Nursery 1:19, 2:21, 3:20 (60). Primary 1:28, 2:31, 3:29, 4:30, 5:32, 6:30 (180). JSS 1:38, 2:41, 3:40; SS 1:39, 2:42, 3:40 (240). Every class in range; 6 archived leavers sit in SS 3 (active roster 34, still in 30–60). Ages match classes; admission numbers `CAP/2024|2025/NNNN`; siblings share guardian surnames across grades. Enforced by `seedPopulation.spec.ts` (7 tests, green).

## 12–14. Financial / payment-state / ledger verification

- assessed = collected + outstanding **exactly** (test-enforced).
- 1,996 charge entries; payments 497 (FULL/MULTI/PARTIAL/NONE/PENDING/FAILED distribution); 8 reversals ↔ 8 REVERSAL entries; per-student SHA256_V1 chains intact; no negative balances.
- Open `AMOUNT_MISMATCH` references a real seeded payment (gateway ₦5,000 short); one resolved duplicate. 3 recon runs, 24 notifications, sandbox-labelled audit, synthetic KYC/settlement markers, 480 DVAs (CAPFLUX Demo Bank).
- Enforced by `seedFinancialIntegrity` (7), `seedRealism` (7), `seedDeterminism` (7, incl. identical-hash determinism), `releaseGate` (8).

## 15. Browser console/network results — NOT VERIFIED (no browser tooling here)

## 16. Responsive verification — NOT VERIFIED (no browser tooling here)

## 17. Test results

| Suite | Result |
|---|---|
| seedDeterminism, seedPopulation, seedFinancialIntegrity, seedRealism, releaseGate | **35/35 PASS** |
| Backend `npm test` | **259/259 PASS** |
| Backend `typecheck` + `build` | **PASS** |
| Frontend `npm run build` (committed tree) | **PASS** (~11s) |
| `compliance:audit` | 2 PASS / 6 PARTIAL / **2 FAIL — both pre-existing, unrelated** (hex literals in another workstream's doc; WorkOS webhook router; backend untouched by this phase) |
| `sandboxApi.spec.ts` | **12 failed / 1 passed — pre-existing auth-refactor breakage**, unchanged by seed work (spec doesn't import the seeder; fails on new `simulatorAuth` session scheme). Owned by the auth workstream. |

## 18. Production isolation verification

- Commit range `8796102..HEAD`: only the 7 seed/sandbox files. **No backend, migration, Supabase config, env, or domain changes.**
- Live: prod `demo-personas` → 404, prod `demo-login` → 404, prod health DB `connected`, `schoolsCount: 0`, prod frontend 200. **PASS**.
- Code: no hardcoded production URLs in `frontend/src`; sandbox/prod selected via `VITE_CAPFLUX_MODE`/`VITE_API_BASE_URL` (Vercel-side values NOT VERIFIED — confirm `VITE_API_BASE_URL=https://capflux-sandbox-api.onrender.com/api` on the sandbox project).
- Only intentional prod touchpoint remains the public homepage redirect (pre-existing behavior, unchanged).

## 19. Bugs discovered (this phase)

1. **[P0] `DEMO_SESSION_SECRET` missing on live sandbox backend** — demo login fails for all personas. Owner: sandbox Render service owner. Fix: set ≥32-char secret on `capflux-sandbox-api` only, restart. No code change.
2. **[P0] Sandbox backend database error** — `/health` 503, `database.status: error` (sandbox Supabase unreachable). Remote-transport data plane broken. Owner: sandbox service/DB owner.
3. **[P1] Stale-seed boot gate** (`sandbox/index.ts` checked `>= 3`) — returning visitors would never upgrade v3→v4. **FIXED in `03b5b37`** (gate on exported `SEED_VERSION` + test).
4. **[P1] Render cold starts (~24s)** explain the 26s login. Mitigate with keep-warm/paid instance or document; warm path ~1s already meets ≤2s.

## 20. Bugs fixed (this phase)

- Stale-seed boot gate (above). No other code fixes; no auth-refactor files touched; no latency hacks added.

## 21. Remaining P0/P1/P2 issues

- **P0:** Set `DEMO_SESSION_SECRET` on sandbox backend; restore sandbox Supabase connectivity. Then re-run live login per persona.
- **P0:** Full browser E2E still required (personas, dashboard values, rosters, bursar/proprietor/teacher/ops journeys, console/network audit, responsive) — needs a browser harness.
- **P1:** Cold-start strategy decision (keep-warm vs documented limitation).
- **P1:** `sandboxApi.spec.ts` repair belongs to the auth-refactor owner.
- **P2:** Confirm Vercel sandbox env vars; confirm Render picked up latest `main`.

## 22. Final release decision — **BLOCKED**

Authentication on the live sandbox backend is non-functional (P0 secret) and its database is erroring (P0), and browser E2E was not performed in this environment. The **data deliverable itself is release-ready** (deterministic, coherent, fully tested); unblock by fixing the two sandbox-service environment issues and running the browser pass. Re-classify to READY once: login succeeds per persona warm-path ≤2s (or cold-start documented), dashboard shows §9 values, rosters match §11 counts, console clean, isolation holds in captured traffic.

*Statuses used: PASS / PASS WITH P1 / BLOCKED / NOT VERIFIED. Nothing in §§15–16 is claimed as performed.*
