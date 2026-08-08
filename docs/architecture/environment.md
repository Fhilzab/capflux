# CAPFLUX — Canonical Environment

> Status: Milestone 6.3 — environment reconciliation.
> This file documents the SINGLE canonical runtime environment. Never guess;
> confirm before changing. Never commit secrets here.

## Canonical Supabase project

- **Project ref**: `ootrovtrpoztmooiirxo`
- **Project name**: Capflux
- **Organization**: `cclfoqlgzzegwcqvktcl`
- **Region**: West EU (Ireland)
- **Status**: canonical CAPFLUX database. Migrations 0001–0026 apply here.

### Backend

- `SUPABASE_URL=https://ootrovtrpoztmooiirxo.supabase.co`
- `SUPABASE_SECRET_KEY=<service-role key — never commit>`
- The backend service-role client is the ONLY database access path for domain
  operations. The frontend never talks to Supabase directly for domain data.

### Frontend

- `VITE_API_BASE_URL=http://localhost:4000/api` (points at the backend).
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are **legacy** (Supabase Auth
  era) and must be removed once offline/sync paths are confirmed not to depend
  on them. Offline uses Dexie/IndexedDB, not Supabase anon.

## WorkOS environment

- Credentials in `backend/.env`: `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`,
  `WORKOS_CLIENT_SECRET`, `WORKOS_REDIRECT_URI`, `WORKOS_COOKIE_PASSWORD`.
- Confirmed as the intended environment (Milestone 6.3).
- User directory currently empty (0 users) — legacy identities are migrated
  via the account-claim flow (`POST /api/auth/claim-account`), which creates a
  WorkOS user without a password and emails a password-setup link.

## Authentication architecture (unchanged)

```
Vue → Axios /api/* → Express → requireAuth → WorkOS AuthKit sealed-session
cookie → authorization → Supabase service-role client
```

- The frontend never imports WorkOS, never calls `supabase.auth.*`, never uses
  a user-id bearer or `x-user-id`/`x-school-id` as authentication, and never
  treats localStorage as a credential.
- Session cookie: `workos_session`, HttpOnly, Secure in production,
  SameSite=Lax, Path=/api, 30-day max-age.

## Legacy identity migration

- Tracking table: `public.legacy_identity_migrations` (migration 026).
- Flow: email → eligibility check (non-enumerating) → WorkOS user created
  without password → password-setup email → user sets new WorkOS password →
  WorkOS login → `public.users` + `user_profiles` upserted → memberships
  reconciled by email (unambiguous only).
- No passwords, hashes, or reset tokens are ever stored or migrated.

## Migration application

- Apply migrations 0001–0026 in order to the canonical project.
- `supabase db push` requires a valid database connection string (project DB
  password, not the service-role API key). Direct connection may be blocked on
  the free tier; the transaction pooler is required.
- `supabase/config.toml` `db.seed.sql_paths = ["./seed.sql"]` references a
  missing file — create an empty `supabase/seed.sql` or set `sql_paths = []`
  before `supabase db reset`.

## Cleanup ledger

- Legacy frontend Supabase consumers to trace before removal:
  `offline/syncEngine.ts`, `offline/DownloadSyncEngine.ts`,
  `offline/UploadSyncEngine.ts`, `offline/RealtimeSyncService.ts`,
  `shared/{academic,rbac,fees,billing,students,divisions,ledger}/Supabase*Provider.ts`.
- Remove `Bearer <user-id>`, `x-user-id`, `x-school-id`, `DEFAULT_SCHOOL_ID`,
  `Capstone` references only after tracing consumers.
