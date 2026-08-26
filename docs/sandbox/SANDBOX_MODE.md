# CAPFLUX Sandbox / Demo Mode

An **execution mode** of the existing CAPFLUX application — not a second app.
One codebase, one build pipeline; the mode is selected at build/bootstrap time
and swaps only external dependencies for deterministic, isolated simulators.

---

## 1. What it is

| | Production mode | Sandbox mode |
|---|---|---|
| Selection | `VITE_CAPFLUX_MODE=production` (default) | `VITE_CAPFLUX_MODE=sandbox` |
| Domain data | Dexie cache ⇄ Supabase (RLS) via Express API | Dexie **sandbox database** (`capflux_sandbox_db`) |
| Backend API | Express on Render (`VITE_API_BASE_URL`) | In-browser `SandboxApiServer` (custom axios adapter) |
| Auth | Supabase Auth JWT | `SandboxAuthProvider` — demo personas (authorization still enforced) |
| Payments | Licensed PSPs → webhook → `record_verified_payment` RPC | `SandboxGateway` + simulator endpoint posting through the same ledger rules |
| KYC | Encrypted BVN/NIN + mock/approved identity provider | State-machine simulation (`NOT_STARTED→UNDER_REVIEW→VERIFIED/REJECTED`) |
| Notifications | SMS/email providers | Demo inbox provider (nothing leaves the browser) |
| Sync | Outbox → Supabase engines | Outbox → `SandboxSyncEngine` (same table, same statuses) |

Everything else is shared unchanged: Vue 3 SPA, Pinia stores, domain services,
validators, offline-first repositories/outbox, RBAC + RouteGuard, module-lock
gating (`useModuleLock` + overlay), UI kit.

## 2. The five seams

Only these places know the mode exists:

1. **Runtime environment** — `frontend/src/shared/environment/runtimeEnvironment.ts`.
   Reads `VITE_CAPFLUX_MODE`, fail-closed: unknown values ⇒ production.
   Provider factories (`src/sandbox/providers/providerFactories.ts`) resolve
   `Supabase*Provider` vs `Sandbox*Provider`; no component branches on the flag.
2. **Local database instance** — `offline/localDb.ts` instantiates the SAME
   schema under a separate physical DB name (`capflux_sandbox_db`) when sandbox
   (see `src/sandbox/sandboxDb.ts`, schema shared via `offline/dbSchema.ts`).
   Every service/store/repository works unchanged against it.
3. **HTTP client adapter** — `shared/services/api/client.ts` installs
   `sandboxAxiosAdapter`, dispatching all `/api/*` traffic to the in-browser
   `SandboxApiServer` (`src/sandbox/api/sandboxApiServer.ts`), which mirrors the
   backend contract: auth (401s), tenant checks (403 cross-school),
   `requirePaymentReady` gating, KYC/settlement/payment state machines,
   idempotency keys, masked egress (`******last4`), audit trail.
4. **Sync engine** — `main.ts` starts the production Supabase sync engines only
   in production; sandbox runs `SandboxSyncEngine`, draining the same
   `sync_queue` outbox with server-side realism (append-only enforcement,
   duplicate admission-number rejection, transient failures, retry).
5. **Auth provider** — `shared/auth/AuthService.ts` resolves
   `SandboxAuthProvider` in sandbox; `/context/org|rbac` handlers derive each
   persona's role + permission codes so RouteGuard/rbacStore enforce real RBAC.

## 3. Isolation & safety (fail-closed)

- Sandbox-only constructs (`SandboxGateway`, `SandboxAuthProvider`,
  `getSandboxDb`, `installSandboxMode`, `handleSandboxRequest`) throw
  `SandboxIsolationError` if ever resolved outside sandbox mode.
- Sandbox adapters refuse to bind live provider names (`monnify`, `paystack`).
- `getSupabase()` throws while sandbox mode is active — even if Supabase env
  vars are present in the build. Production Supabase engines are never started.
- Reset Sandbox deletes ONLY `capflux_sandbox_db`
  (+ `capflux_sandbox_notifications_db` and the demo session key).
- Backend mirror: `services/gateways/SandboxGateway.ts` extends `TestGateway`
  with CAPFLUX Demo Bank naming; constructor AND every operation throw when
  `NODE_ENV === 'production'`; registered in `GatewayFactory` behind the same
  guard; gateway assignment accepts `'sandbox'` explicitly (no silent fallback).

## 4. Demo dataset

Seeded deterministically by `src/sandbox/seed/seedSandbox.ts`
(seed version 3): **120 students**, **64 guardians**, 4 sections
(Nursery/Primary/JSS/SS), 14 levels, active session 2025/2026 + completed
2024/2025, terms, enrollments incl. movement history, realistic fee catalogue
(tuition, development levy, exams, ICT, uniform, transport…), ~170 payments
across SUCCESS (full/partial/multi)/PENDING/FAILED/REVERSED with
`DEMO-PAY-NNNNNN` references, DVAs (`100xxxxxxx`, *CAPFLUX Demo Bank*),
append-only hash-chained ledger built with the production hashing scheme,
notifications, VERIFIED KYC + settlement + assigned gateway (school READY),
reconciliation history and audit trail.

Reset Sandbox restores this exact dataset (content digest verified by tests).

## 5. Demo walkthrough

Login (persona buttons on the auth screen, password `demo1234`)
→ dashboard metrics derived from sandbox data
→ students CRUD/import/export · academic structure · enrollment/promotion
→ billing · virtual accounts · simulate parent payment (control panel)
→ receipt/notification · ledger · reports
→ KYC → settlement → staff review (platform persona) → activation
→ go OFFLINE, mutate, reconnect, Sync Now, inspect outbox/idempotency
→ audit trail · Reset Sandbox.

The control panel (`/#/sandbox`, sidebar entry) exposes: ONLINE/OFFLINE toggle,
Sync Now / Retry failed, payment simulation (success/failed/pending/reversed),
error scenarios (payment failed/pending, sync failure, KYC reject,
settlement delayed), role switching, progressive-access reset, Reset Sandbox
with confirmation + progress.

## 6. Deployment

### 6.1 Environment variable classification

| Variable | Class | Where | Notes |
|---|---|---|---|
| `VITE_CAPFLUX_MODE` | **Required · Publishable** | Frontend | `production` \| `sandbox`; invalid explicit values fail startup |
| `VITE_CAPFLUX_DATABASE_ENV` | **Required (deployed) · Publishable** | Frontend | must agree with mode (`MODE_DATABASE_MISMATCH` otherwise) |
| `VITE_API_BASE_URL` | **Required · Publishable** | Frontend | sandbox frontend → sandbox Render URL `/api` |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Optional in sandbox · **Publishable** | Frontend | SANDBOX project values only; publishable by design |
| `VITE_GOOGLE_CLIENT_ID` | Optional · Publishable | Frontend | public OAuth client id; bypassed by the simulated Sheets source in sandbox |
| `CAPFLUX_MODE` | **Required** | Backend | same two values; unset ⇒ production, invalid ⇒ exit(1) |
| `CAPFLUX_DATABASE_ENV` | **Required when NODE_ENV=production** | Backend | must agree with `CAPFLUX_MODE`; mismatch ⇒ exit(1) |
| `SUPABASE_URL` + `SUPABASE_SECRET_KEY` | **Required · Secret** | Backend | SANDBOX project for the sandbox Render service — service-role key NEVER reaches the browser |
| `CORS_ORIGINS` | **Required (deployed) · Config** | Backend | exactly the sandbox frontend origin |
| `PAYMENTS_PROVIDER_MODE` | Required | Backend | sandbox deployments keep `sandbox`; `production` value is rejected while CAPFLUX_MODE=sandbox |
| `PAYSTACK_*` / `MONNIFY_*` (keys & webhook secrets) | **Production-only · Secret** | Backend | presence while CAPFLUX_MODE=sandbox ⇒ startup REJECTED |
| `IDENTITY_VERIFICATION_PROVIDER` / `SETTLEMENT_VERIFICATION_PROVIDER` | Config | Backend | sandbox requires `mock` (`approved` ⇒ rejected); deployed production refuses `mock` |
| `KYC_ENCRYPTION_KEY`, `CAPFLUX_STORAGE_SIGNING_SECRET`, `WORKOS_CLIENT_SECRET`, `WORKOS_COOKIE_PASSWORD`, `WORKOS_WEBHOOK_SECRET` | Production-only · Secret | Backend | never set on the sandbox service unless that flow is intentionally exercised there |
| `SANDBOX_DATABASE_URL`, `SANDBOX_API_BASE_URL` | **Sandbox-only** | Backend | their presence on a production process ⇒ startup REJECTED |
| Development-only: `CORS_ALLOW_ALL`, `COOKIE_SECURE=false` | Dev-only | Backend | `CORS_ALLOW_ALL=true` forbidden on a deployed sandbox |

### 6.2 Sandbox stack

```
Vercel  "CAPFLUX Sandbox Frontend"
  Build:   npm ci && npm run build      Output: dist
  Env:     VITE_CAPFLUX_MODE=sandbox
           VITE_CAPFLUX_DATABASE_ENV=sandbox
           VITE_API_BASE_URL=https://<sandbox-render-app>.onrender.com/api
           VITE_SUPABASE_URL=<sandbox-project-url>            # optional in sandbox
           VITE_SUPABASE_ANON_KEY=<sandbox-anon-key>          # publishable

Render  "CAPFLUX Sandbox Backend"
  Build:   npm ci && npm run build       Start: npm start
  Env:     NODE_ENV=production
           CAPFLUX_MODE=sandbox
           CAPFLUX_DATABASE_ENV=sandbox
           PORT=<Render-managed>
           SUPABASE_URL=<sandbox-project-url>        SUPABASE_SECRET_KEY=<sandbox-service-role>  # SECRET
           CORS_ORIGINS=https://<sandbox-frontend-domain>
           PAYMENTS_PROVIDER_MODE=sandbox
           IDENTITY_VERIFICATION_PROVIDER=mock       SETTLEMENT_VERIFICATION_PROVIDER=mock
           # NO Paystack/Monnify keys. Their presence fails startup.

Supabase "CAPFLUX Sandbox" project — physically separate from production.
```

Startup validation (backend `services/RuntimeConfiguration.ts`, wired in `index.ts`
before the server accepts traffic) enforces every rule above **fail-closed**
(`process.exit(1)`); the GatewayFactory additionally throws
`SANDBOX_CONFIGURATION_ERROR` if sandbox code ever attempts to initialize a
live provider and `PRODUCTION_CONFIGURATION_ERROR` if a deployed production
process attempts to initialize test/sandbox adapters.

### 6.3 Mode-mismatch protection

`GET /api/providers/runtime-info` returns the non-secret descriptor
`{ mode, paymentsMode }`. A production frontend compares it against its own
mode after boot and blocks rendering with `CAPFLUX_ENVIRONMENT_MISMATCH` if
they differ (frontend `shared/environment/backendModeConsistency.ts`). Client-side
checks are UX only — isolation is enforced at the backend/database boundary.

### 6.4 CORS

Deployed sandbox sets `CORS_ORIGINS=https://<sandbox-frontend-domain>` only.
`CORS_ALLOW_ALL=true` is rejected at startup when the sandbox runs with
`NODE_ENV=production`. The production frontend origin is deliberately NOT
included.

### 6.5 Deployment smoke tests

Sandbox (after deploy): open URL → demo login → dashboard → student register →
student detail → guardian → academic structure → promotion → import → export →
payment simulation → ledger → reports → OFFLINE mutate → Sync → Reset.
Every step must function against demo data only.

Production (immediately after): login → dashboard → students → guardians →
academic structure → financial pages → payments → reports. No behaviour change;
production env vars untouched; `capflux.vercel.app` / `capflux.onrender.com`
never repointed to sandbox.

## 7. Tests

Frontend (`npx vitest run src/sandbox`):
`runtimeEnvironment.spec` (fail-closed mode resolution),
`securityGuards.spec` (production refusal, live-provider ban, factory wiring,
Supabase tripwire), `seedDeterminism.spec` (volumes ≥ spec minimums,
identical reset hashes, all payment statuses, academic structure, DVA shape,
per-student hash-chain coherence), `ledgerIntegrity.spec` (idempotent posting,
partial/multiple/over payment balances, reversal semantics, duplicate
source-document rejection), `sandboxSync.spec` (outbox drain, replay
idempotency, append-only rejection, transient failure + retry, offline
queueing), `sandboxApi.spec` (401/403, KYC state machine, activation gating,
ledger+notification+audit on simulated success, reference idempotency,
masking, offline network-error shape, kobo integer guard).

Backend: `tests/sandbox-gateway.test.ts` (18-method contract, deterministic
demo references/DVAs, webhook signature verify/forgery rejection, production
construction refusal, status normalization). `auth-security.test.ts` now also
allowlists the non-secret `VITE_CAPFLUX_MODE`.

## 8. Compliance notes

This change preserves every financial-integrity control: kobo integers,
idempotency keys/constraints, append-only ledger semantics, the payment state
machine (clients never set SUCCESS), masked egress, tenant isolation, and the
audit trail. Affected control families: PAY-* (sandbox posture only — no new
live-provider path), LEDGER-*/FIN-* (unchanged semantics, exercised by tests),
TENANT-* (isolation strengthened by physical DB separation + guards),
AUTH-* (demo personas exercise the existing RBAC; no weakening of production
auth), AUDIT-* (sandbox audit trail). No legal-status changes; no new
REQUIRES_LEGAL_REVIEW items.
