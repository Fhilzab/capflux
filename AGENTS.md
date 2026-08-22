# AGENTS.md — CAPFLUX

Offline-first, multi-tenant school fee management SaaS for Nigerian schools (Vue 3 SPA + Express API + Supabase Postgres).

## Layout & commands

Three independent npm projects; the root `package.json` has no scripts — always run commands inside the project directory.

- `frontend/` — Vue 3 + Vite + Pinia + Tailwind v4 SPA (TypeScript), dev server port 5173
- `backend/` — Express API in plain JavaScript ESM (**never** convert to TypeScript), port 4000, health at `GET /health`
- `supabase/` — SQL migrations, RLS policies, triggers, one edge function

Frontend tests: `npm test` (= `NODE_ENV=test vitest run`).

- Full suite regularly exceeds 5 minutes / times out. Verify changes with targeted runs: `npx vitest run src/shared/__tests__` or explicit file paths.
- Keep `NODE_ENV=test`: under `production` Vue resolves to its production build and breaks `@vue/test-utils` emit recording.
- Student import/export specs use a dedicated node-env config: `npx vitest run --config vitest.students.config.ts`.

Backend tests: `npm test` (= `node --test 'tests/*.test.js'` — Node's built-in runner, not jest/vitest).

No lint/typecheck scripts exist anywhere. Verification = targeted tests + `cd frontend && npm run build`.

## Architecture invariants (do not violate)

- **Auth**: Supabase Auth. Backend validates the Bearer token in `middleware/requireAuthSupabase.js`; identity comes only from the verified JWT — never trust body/header IDs (`x-user-id`/`x-school-id` are legacy). WorkOS paths remain but are legacy; do not build new auth on WorkOS.
- **Data path**: the frontend never queries Supabase for domain data — all authoritative operations go through the Express API (`VITE_API_BASE_URL`); the backend uses the service-role client, and Postgres RLS enforces tenant isolation.
- **Money**: integer minor units only (`amount_minor`, kobo) — never float math. `ledger_entries` is append-only; balances are computed from ledger entries, never stored; corrections are reversing entries. Retries must be idempotent (UUIDs assigned before sync).
- **Payments**: status is a server-side state machine — clients can never set SUCCESS directly. Provider mode is env-controlled via `PAYMENTS_PROVIDER_MODE` (`disabled|sandbox|production`) and validated at startup (server exits if invalid).
- **Clock**: never trust the client clock; authoritative timestamps come from PostgreSQL.
- **Offline-first**: every mutation writes to Dexie/IndexedDB before the network; the sync queue reconciles when online.
- **Progressive access**: KYC/settlement/payment gating goes through the `useModuleLock` composable + `ModuleLockOverlay` (overlays, not redirects); the backend re-enforces it (`requirePaymentReady`, `requireAuthSupabase`).

## Conventions

- Use the CEMDS UI kit in `frontend/src/components/ui/*` (`CmButton`, `CmInput`, `CmSelect`, …) instead of raw `<button>`/`<input>`/`<select>`; never modify the kit itself.
- Vue tests select elements via `data-testid` and define store mocks with `vi.hoisted()` before module mocks.
- Migrations: `supabase/migrations/2026071000NN_*.sql`, additive only. Inspect the live schema first, extend what exists, never edit already-applied migrations, never paper over conflicts with `CREATE TABLE IF NOT EXISTS`.
- Backend route errors keep structured causes (stage/code/status); map HTTP failures to specific user-facing messages rather than a generic "temporarily unavailable".
- Sensitive values render masked as `******last4`; provider/gateway credentials are platform-level server env, never per-school, never frontend.
- Scope: every feature must serve billing, payment collection, financial reporting, parent communication, or reliability — otherwise defer it.

## Environment

- Per-project `.env` files exist; canonical variable lists are in each project's `.env.example` (backend: `SUPABASE_URL` + `SUPABASE_SECRET_KEY`, CORS, payment/KYC vars; frontend: `VITE_API_BASE_URL`, legacy `VITE_SUPABASE_*`).
- Without frontend Supabase vars the app still runs using local dev fallbacks.
- Never commit secrets (`.env*` patterns are gitignored except examples).

## Docs

- `docs/PROJECT_STATUS.md` — living status doc (current phase, implemented vs deferred).
- `docs/architecture/` — system/database architecture. Caution: `docs/architecture/environment.md` predates the Supabase auth migration and overstates WorkOS; trust code and `PROJECT_STATUS.md` over it.
- `.commandcode/taste/code/taste.md` — recorded owner preferences (UI density, testing habits; local/gitignored).
