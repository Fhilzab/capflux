# CAPFLUX PRODUCTION WORKOS CUTOVER REPORT

Branch: `main`
Commit(s):
- `5e05b87` feat(auth): enable WorkOS AuthKit production authentication
- `685852f` fix(auth): enforce revocation on sealed-cookie fallback path
- Working tree clean, no force-push, no history rewrite. Sandbox branch untouched.

## PRE-CUTOVER AUTH PATH (verified from code, matches Gate 1 audit)

- Frontend: `SupabaseAuthProvider` (default; `VITE_AUTH_PROVIDER` unset) → `supabase.auth.signInWithPassword()/signInWithOAuth()/getSession()/getUser()` → Supabase access-token JWT in `Authorization: Bearer`.
- Backend: every domain router (`payments`, `payment-accounts`, `dva`, `kyc`, `onboarding`, `admin`, `financial-admin`, `financial-operations`, `context`) + `/rpc` enforced **Supabase-only** via `requireAuthSupabase` → `supabase.auth.getUser(token)` → direct `public.users` UUID lookup.
- Token provider: Supabase Auth. Identity resolution: JWT `sub` (UUID) → `public.users.id`.
- Critical finding: `requireAuthWorkOS` existed but was **mounted on zero routes** — the primary cutover blocker. Deploying the frontend WorkOS flag alone would have bricked all financial endpoints.

## WORKOS PRODUCTION

- AuthKit: NEW `GET /api/auth/authkit-url` (issues hosted-UI URL + HttpOnly CSRF state cookie) and `GET /api/auth/authkit-callback` (verifies state timing-safe, consume-once, exchanges code). Frontend `AuthKitProvider.initiateAuthKit` now redirects to hosted UI; `handleOAuthCallback` targets the new endpoint.
- JWT/JWKS: `jose` `createRemoteJWKSet` (1h cache, 5m cooldown), verifies signature + `iss=https://api.workos.com` + `aud=WORKOS_CLIENT_ID` + expiry. `sub` remains `user_*`; no override, no UUID cast, no email fallback (strict ACTIVE-link hierarchy in `WorkOSIdentityService`).
- Redirect: backend honors `WORKOS_AUTHKIT_REDIRECT_URI`. Production MUST be `https://capflux.vercel.app/auth/callback` (HTTPS; localhost/sandbox forbidden). Frontend callback route `/auth/callback` → `/auth?code&state` unchanged.
- Webhook: signature via WorkOS SDK `constructEvent` (401 on failure), durable claim/complete/fail idempotency on `workos_webhook_events`, provider-neutral event IDs preserved.
- Revocation: NEW durable `workos_revoked_sessions` table + `is_workos_session_revoked` / `revoke_workos_session` RPCs (service-role only, deny-by-default RLS). `session.revoked` webhook writes it; Bearer, sealed-cookie, and signout paths all enforce it. Replaces the single-instance memory cache (which could not work across Render instances). F-001 closed in code.
- Production env status (from repo only — Render/Vercel/Supabase dashboards are NOT inspectable from here, secrets never printed): required backend vars `WORKOS_API_KEY` / `WORKOS_CLIENT_ID` / `WORKOS_CLIENT_SECRET` / `WORKOS_WEBHOOK_SECRET` / `WORKOS_COOKIE_PASSWORD` (≥32 chars) / `WORKOS_AUTHKIT_REDIRECT_URI` / `AUTH_PROVIDER_MODE` and frontend `VITE_AUTH_PROVIDER=workos` + `VITE_API_BASE_URL=https://capflux.onrender.com/api` are **UNVERIFIED — operator must confirm configured/malformed before cutover** (preflight checklist below).

## IDENTITY BRIDGE

- WorkOS identity: `sub` (`user_*`, TEXT). CAPFLUX identity: `public.users.id` (UUID) via `public.user_identity_links` (`identity_type=workos_authkit`, only `ACTIVE` resolves; REVOKED blocks resurrection; email never consulted).
- Existing-user mapping: `GET /api/auth/authkit-callback` JIT-links — if no identity link exists, it checks `legacy_identity_migrations` for the verified WorkOS email in PENDING/INVITED/CLAIMED state, verifies the legacy CAPFLUX user row exists, inserts an ACTIVE link (`migration_source=JIT_VERIFIED_EMAIL`), marks migration COMPLETED. No mass duplication, no UUID changes, no financial writes.
- Email fallback: NO. Only the explicit legacy-migration record (prior ownership proof) permits linking; otherwise `IDENTITY_NOT_PROVISIONED`.
- Result: AUTH PROVIDER MAY CHANGE → CAPFLUX USER IDENTITY MUST NOT (invariant holds).

## SESSION

- Login: AuthKit hosted UI → callback → in-memory tokens (never localStorage) + HttpOnly `workos_session` cookie set server-side.
- Refresh: `POST /auth/refresh` via memory refresh token, auto-retry on 401. Logout: WorkOS `revokeSession` + DB revoke + cookie clear.
- Expiration: JWT expiry enforced on every request. Revocation: immediate per DB check on all three paths (Bearer / cookie / signout), subject to migration `202609150001` being applied.

## AUTHORIZATION

- Roles / school isolation / financial authorization / KYC-payment readiness: UNCHANGED. `requirePaymentReady` / `requireStaff` read only `req.user` (provider-agnostic); RLS untouched; fail-closed preserved.

## LEGACY SUPABASE AUTH

- Remaining usage: `requireAuthSupabase.ts` retained; Supabase provider retained behind `VITE_AUTH_PROVIDER=supabase`.
- Production primary after cutover: WorkOS (requires `AUTH_PROVIDER_MODE=dual→workos_only` + `VITE_AUTH_PROVIDER=workos`).
- Routes still hybrid: all domain routers + `/rpc` run `requireAuthProvider` (temporary `dual` during transition); `/auth/session|me|signout` remain `requireAuthHybrid` (WorkOS transports).
- Routes retired: none deleted (fencing over deletion).
- Reason: reversible transition; Supabase path is the rollback lever, not the primary.

## TESTS

- WorkOS: new `requireAuthProvider.test.js` 9/9 (mode dispatch, invalid-mode 500 fail-closed, delegation, dual rejection, header-trust).
- Backend: **268/268** (259 baseline + 9 new), 59 suites.
- Frontend: auth suites 47/47; `vite build` passes (backend `tsc` build + typecheck pass).
- Typecheck: no new errors. Compliance audit: identical to Gate 1 baseline (PASS=2 PARTIAL=6 FAIL=2 — both FAILs pre-existing: dev cookie password in docs F-005, signature-verified webhook by design). No `any`/`ts-ignore` added.

## FINANCIAL SAFETY

- Financial data modified: NO. Seed modified: NO. Ledger modified: NO. Payment data modified: NO. User UUIDs changed: NO. (Diff touches auth/middleware/routes-config only.)

## BROWSER VERIFICATION

- NOT PERFORMED FROM HERE (no browser tooling in this environment; Supabase projects paused per Gate 1). REQUIRED post-deploy by operator: landing → AuthKit login → callback → dashboard → authenticated API → logout → re-login; console clean; no Supabase-auth login calls; API host `capflux.onrender.com` only.

## PRODUCTION SAFETY

- Production env changed: NO (only `.env.example` docs). Database schema changed: NO (one new additive migration file, NOT applied — operator applies). Production backend/frontend changed: code committed, NOT deployed.
- Deliberate: with defaults (`AUTH_PROVIDER_MODE` unset → `supabase_only`, `VITE_AUTH_PROVIDER` unset → Supabase), deploying these commits alone preserves pre-cutover behavior. Cutover happens only via the env changes below.

## ROLLBACK

- Procedure: (1) Frontend: redeploy with `VITE_AUTH_PROVIDER=supabase`. (2) Backend: set `AUTH_PROVIDER_MODE=supabase_only` (+ redeploy/restart). (3) Forward-fix preferred; no destructive SQL — identity links, webhook history, users, financials all preserved.
- Known rollback point: commit `367d649` (pre-cutover `main`).

## REMAINING ISSUES (operator preflight, in order)

1. Apply migrations to production Supabase (incl. `202609150001`); verify `user_identity_links`, webhook RPCs, `provision_workos_user`, `requesting_user_id` present. Remote state was already UNVERIFIED at Gate 1.
2. Configure Render backend env: `AUTH_PROVIDER_MODE=dual` (initial), all `WORKOS_*` vars, production `WORKOS_AUTHKIT_REDIRECT_URI`, 32+-char cookie password, `CORS_ORIGINS=https://capflux.vercel.app`, `CAPFLUX_DATABASE_ENV=production`.
3. Register `https://capflux.vercel.app/auth/callback` + webhook endpoint in WorkOS dashboard; confirm JWKS issuer/audience.
4. Deploy backend → set Vercel `VITE_AUTH_PROVIDER=workos` + production API URL → deploy frontend → run browser + security matrix (13 cases) + business workflow (login→dashboard→student→fee→payment→ledger→logout→login; invariant assessed ₦67,121,000 = collected ₦49,177,940 + outstanding ₦17,943,060).
5. After verification window: `AUTH_PROVIDER_MODE=workos_only`. Schedule COMP-009 RLS hardening (7 tables, pre-existing P1, out of scope).
6. Deviation note: repo `AGENTS.md` declares Supabase Auth canonical and "do not build new auth on WorkOS" — this task's explicit cutover order overrides it for auth files only; all other AGENTS.md invariants (money/RLS/offline/CEMDS) were honored.

## FINAL VERDICT

**CONDITIONAL PASS** — cutover code complete, tests green (268 backend / 47 frontend-auth), builds + typecheck + compliance-at-baseline, financially inert, reversible by config. Production traffic cutover is NOT yet executed: operator must complete preflight items 1–4 above, then promote `dual` → `workos_only`.
