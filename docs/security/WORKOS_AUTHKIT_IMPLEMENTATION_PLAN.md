# CAPFLUX WorkOS AuthKit — Implementation Plan (Phased & Reversible)

> Planning artifact only. **Gate status (2026-08-23): IMPLEMENTATION READY.**
> D1–D10 CLOSED; C1–C4 CLOSED as ratified acceptance criteria whose artifacts
> remain mandatory pass/fail evidence in Phases 3/8 and continuous checks.
> D6: default WorkOS AuthKit-hosted domain for initial rollout — issuer/redirect
> configuration MUST stay env-driven (`AUTH_ISSUER`, `AUTH_REDIRECT_URI`,
> `WORKOS_*` vars, optional future `WORKOS_CUSTOM_AUTH_DOMAIN`); custom domain
> deferred, never a blocker; no WorkOS hostname hard-coded in source.
> Phase order is mandatory; every phase ends in a verifiable, reversible state.

Global conventions: additive migrations `2026MMDDNNNN_*.sql` with embedded
rollback notes; flags `AUTH_PROVIDER_MODE` (backend) / `VITE_AUTH_PROVIDER`
(frontend); verification = backend `npm test && npm run typecheck &&
npm run typecheck:tests && npm run compliance:audit && npm run build`,
frontend targeted vitest (`NODE_ENV=test`). Observability baseline for all
phases: structured logs (no secrets), auth error-rate metric, webhook delivery
log. Compliance checks each phase: rerun static auditor; update
`compliance-status.json` evidence pointers in the same PR.

---

## PHASE 0 — Preparation
- **Objective:** approvals, accounts, runbooks in place.
- **Files:** docs only (this set); ops calendar entries.
- **DB/Dashboards/Env:** none yet.
- **Tests:** none.
- **Acceptance:** gate matrix signed; staging WorkOS env exists; adjudicator named; domain decision recorded.
- **Rollback:** n/a.
- **Security:** credential-handling addendum stored with owner records.

## PHASE 1 — Identity-link schema
- **Objective:** bridge + shim exist, inert.
- **Files:** `supabase/migrations/202608230001_user_identity_links.sql`, `202608230002_rls_identity_shim.sql`.
- **DB:** new table (deny-all RLS), SECURITY DEFINER function; zero policy changes.
- **Dashboards/Env:** none.
- **Tests:** SQL probes (set_config simulations: NULL default; mapped UUID after insert; invalid-sub ⇒ NULL).
- **Acceptance:** function returns NULL without claims; table denies non-service access.
- **Rollback:** DROP FUNCTION/TABLE (pre-launch only).
- **Security checks:** deny-all RLS verified; no PII beyond ids/status.
- **Compliance:** TENANT-001 unaffected (no policy touched).

## PHASE 2 — WorkOS configuration
- **Objective:** both environments fully configured per checklist.
- **Files:** none (dashboard work).
- **DB:** none. **Env:** placeholders → real secret-store values.
- **Tests:** sample hosted-UI login in staging incl. Google path.
- **Acceptance:** JWT template saved; redirect URIs live; webhooks reachable.
- **Rollback:** delete/disable WorkOS config objects.
- **Security:** secrets never leave dashboard→secret store path.

## PHASE 3 — Supabase third-party auth
- **Objective:** Supabase validates WorkOS tokens (staging first).
- **Files:** none (dashboard). **DB:** none yet.
- **Env:** issuer registration only.
- **Tests:** real-token probe asserting Postgres role = `authenticated`; silent-empty check documented.
- **Acceptance:** probe green WITHOUT any policy change (policies still `auth.uid()` ⇒ expected empty sets until Phase 8 — probe must assert role claim only at this stage).
- **Rollback:** remove integration.
- **Ordering guard:** D2 condition C1 enforced here.

## PHASE 4 — Password migration (D1)
- **Objective:** hashes ported for entire cohort on staging, then production.
- **Files:** NEW `backend/scripts/import-users-to-workos.ts` (streaming export→import; counts-only logging).
- **DB:** read-only SELECT on `auth.users` (+ join `auth.identities` for provider awareness).
- **Env:** runner uses injected secrets on backend host/ephemeral CI only.
- **Tests:** dry-run report (counts, duplicates→REVIEW); N≥20 sample sign-ins incl. ALL privileged sample; bcrypt `$2a$…` format assertions pre-send.
- **Acceptance:** ≥99% ported or REVIEW-routed; zero plaintext/hash artifacts persisted.
- **Rollback:** delete created WorkOS users (staging/prod pre-cutover); native untouched.
- **Security checks:** no-hash-in-log grep gate; TLS endpoint pinned to api.workos.com; purge step executes.
- **Compliance:** NDPA minimization note satisfied; audit entry with counts.

## PHASE 5 — Identity pre-linking (D3/D7)
- **Objective:** every existing user linked BEFORE cutover; privileged first.
- **Files:** importer UPDATEs `user_identity_links`; REVIEW queue view `v_identity_migration_review` (in migration `202608230004_backfill_identity_links.sql`).
- **Tests:** coverage query (unlinked = 0 outside REVIEW); case-table scenarios 1–10 scripted against staging copy.
- **Acceptance:** privileged accounts 100% ACTIVE-linked or explicitly waived by owner; ordinary unlinked ⇒ documented reason.
- **Rollback:** mark links REVOKED / delete rows (data-only).
- **Security:** linking service enforces privileged exclusion; every link audited.

## PHASE 6 — Dual-auth middleware
- **Objective:** backend accepts both credentials; one `req.user` shape.
- **Files:** NEW `backend/middleware/requireAuthAny.ts`; EDIT `backend/index.ts` (mount), `backend/routes/auth.ts` (revive callback/access-token/logout endpoints; rename cookie `capflux_session`), `backend/services/SessionService.ts` + `WorkOSAuthService.ts` (current SDK shapes); NEW `backend/routes/workosWebhook.ts`; keep `requireAuthSupabase` mounted.
- **DB:** none.
- **Tests:** middleware dual-path unit tests; spoof/forgery negatives; webhook HMAC verify; full backend suite green.
- **Acceptance:** same UUID resolved from either token type for a dual-linked test user.
- **Rollback:** flag `AUTH_PROVIDER_MODE=supabase_only` bypasses WorkOS branch.
- **Security:** JWKS iss/aud/exp enforced; link-cache TTL ≤60s; revocation honored.

## PHASE 7 — Frontend AuthKit integration
- **Objective:** SPA authenticates via AuthKit behind flag.
- **Files:** NEW `frontend/src/shared/auth/AuthKitAuthProvider.ts`; EDIT `AuthService.ts` factory (env-flagged), `shared/services/api/client.ts` interceptor, `lib/supabase.ts` (`accessToken` async option when workos mode), `features/auth/AuthView.vue` (hosted redirect), router callback wiring.
- **Tests:** provider contract vitest suite mirroring Supabase specs; RouteGuard/LoginForm/RegisterForm suites green; offline sync smoke with WorkOS token in dev.
- **Acceptance:** flag flip changes login surface only; UI otherwise unchanged.
- **Rollback:** `VITE_AUTH_PROVIDER=supabase`.
- **Security:** token memory-only; no localStorage credentials; CSP unchanged.

## PHASE 8 — Authorization/RLS verification (D2 C1–C4)
- **Objective:** policies consume shim; parity proven.
- **Files:** migration `202608230003_rls_policies_rewrite.sql` (full prior-DDL header for rollback).
- **Tests:** per-role row-count parity before/after; isolation suites (`schoolIsolation`, `financial-authz`) green; fail-closed probes (unknown sub/REVOKED link ⇒ zero rows).
- **Acceptance:** C1–C4 all green; compliance auditor clean.
- **Rollback:** apply embedded prior DDL.
- **Compliance:** TENANT-001/002 evidence updated.

## PHASE 9 — Privileged-user migration
- **Objective:** OWNER/ADMIN/BURSAR/SUPER_ADMIN/staff verified on WorkOS.
- **Files:** runbook procedures; adjudication log template.
- **Tests:** mandatory sign-in proof per privileged account (or documented waiver); financial-action drill (sandbox reversal) with actor-UUID continuity check in `audit_logs`.
- **Acceptance:** 100% privileged cohort confirmed before general cutover.
- **Rollback:** LEGACY_FALLBACK flag; native credentials intact.

## PHASE 10 — MFA (D9 stages)
- **Objective:** optional enrollment open; staged mandates later.
- **Files:** none initially (AuthKit setting); composable/UI hint if needed post-cutover.
- **Tests:** enrollment flow; recovery-code redemption; break-glass dual-control drill.
- **Acceptance:** PHASE 2 mandate lands ≥30d into window without support spike.
- **Rollback:** relax mandate stage in dashboard.

## PHASE 11 — Production rollout (D5)
- **Objective:** LEGACY_ONLY → DUAL_AUTH → WORKOS_PRIMARY → WORKOS_ONLY with criteria gates and change records.
- **Files:** deploy configs (checklist §VERCEL/NETLIFY, §RENDER); canary school selection doc.
- **Tests:** production acceptance checklist (runbook §5 smoke ×3 personas + offline drain + sandbox payment).
- **Acceptance:** exit criteria met (≥95% active-cohort WorkOS logins; 14d clean; sync errors ≤ baseline).
- **Rollback:** single-flag LEGACY_FALLBACK ≤14d; then reassess.
- **Observability:** dashboards live BEFORE cutover; paging on auth-error anomaly.

## PHASE 12 — Legacy retirement
- **Objective:** single authority; artifacts frozen/archived.
- **Files:** remove frontend Supabase login UI paths; retire legacy endpoints (`claim-account` etc.) behind 410; migration `202608230005_retire_legacy_claim_table.sql` (freeze writes only); annotate historical docs; remove `VITE_WORKOS_CLIENT_ID`.
- **Dashboard:** disable Supabase Email+Google providers (KEEP project/data/triggers).
- **Tests:** full regression re-run; dormant-user login drill (ported password).
- **Acceptance:** WORKOS_ONLY stable 30 days.
- **Rollback:** re-enable providers (data intact) — still possible.
- **Compliance:** AUTH-003 evidence refresh; COMP-001 doc purge executed here.

---

## Stop conditions (any phase)
Exit criteria missed ⇒ halt + rollback per phase row. New blocker discovered ⇒
document in gate file; do NOT improvise. Owner re-approval required to resume
after any emergency rollback.
