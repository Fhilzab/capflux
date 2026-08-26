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

Independent stack, separate secrets:

```
Vercel  → CAPFLUX Sandbox Frontend   (VITE_CAPFLUX_MODE=sandbox; NO VITE_SUPABASE_* needed)
Render  → CAPFLUX Sandbox Backend    (CAPFLUX_MODE=sandbox; PAYMENTS_PROVIDER_MODE=sandbox;
                                      NODE_ENV≠production keeps sandbox gateway constructible)
Supabase → CAPFLUX Sandbox project   (never point sandbox at production tables)
```

Backend env additions are documented in `backend/.env.example`
(`CAPFLUX_MODE`). The frontend needs no Supabase or API vars in sandbox.

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
