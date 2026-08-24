# CAPFLUX WorkOS AuthKit Runbook

> **Audience:** future developers and AI agents touching authentication.
> **Status:** PLAN (companion to `WORKOS_AUTHKIT_MIGRATION_AUDIT.md`). Do not
> implement until the audit's §21 owner decisions are resolved.

---

## 0. The one rule

> **Authentication identity and CAPFLUX business identity are separate
> concerns. Never assume that changing the authentication provider means
> changing the CAPFLUX user identity.**

A person logging in is an *authentication subject* (today: Supabase Auth
UUID-in-JWT; target: WorkOS `user_…` string). A person *inside the product* is
a row in **`public.users`** whose UUID keys every profile, membership, role,
KYC review, settlement action and audit trail. The only thing that ever joins
the two worlds is the verified mapping in `public.user_identity_links`.

## 1. How authentication works (current → target)

### Today (Supabase Auth)
```
Browser supabase-js session (localStorage)
  → axios interceptor: Authorization: Bearer <supabase JWT>
  → backend requireAuthSupabase: supabase.auth.getUser(token)
  → public.users row WHERE id = token.sub   ← req.user (canonical UUID)
  → AuthorizationService: school_members ⋈ roles ⋈ permissions
```
Offline/realtime plane calls Supabase directly under RLS (`auth.uid()`).

### Target (WorkOS AuthKit)
```
AuthView → AuthKit hosted UI → /auth/callback?code=…
  → POST backend callback: authenticateWithCode(+session)
      ├─ user_identity_links.workos_user_id → public.users.id (UUID)
      └─ Set-Cookie: capflux_session (sealed, HttpOnly, Path=/api)
SPA keeps access token IN MEMORY via GET /api/auth/access-token
  → axios Bearer <workos JWT> → requireAuthAny:
       (a) workos token: JWKS-verify → sub → link table → users.id
       (b) supabase token (transition window): legacy path
Offline plane: supabase-js { accessToken: async () => fetch access-token }
  → Supabase validates issuer (third-party integration), role=authenticated
    via WorkOS JWT template, RLS uses requesting_user_id() shim.
```

### Never-changed invariants (memorize before editing auth)
1. `req.user.id` is ALWAYS the `public.users` UUID. Routes never see provider IDs.
2. Clients never set payment SUCCESS; state machine stays server-side.
3. Identity comes ONLY from a verified token — never body/header ids
   (`x-user-id`, `x-school-id` are dead; negative tests enforce this).
4. Ledger is append-only; balances computed from entries; corrections reverse.
5. RLS is never weakened to make auth easier; unknown identities ⇒ zero rows.
6. Service-role key lives only in the backend.
7. Authoritative timestamps come from Postgres, not client clocks.
8. No `any`, no `@ts-ignore`, no secrets in git or frontend env.

## 2. What must NEVER be changed

- `public.users.id` UUID semantics + all FKs (18 user-reference columns).
- The provisioning/delete triggers on `auth.users` (still valid for native
  cohort during transition).
- RLS policy *strength*. Policy *bodies* change exactly once, via migration
  `202608230003_rls_policies_rewrite.sql`, swapping `auth.uid()` for
  `(select public.requesting_user_id())`.
- Payment/ledger/settlement/idempotency schemas and flows.
- The enumeration-resistant patterns on pre-auth endpoints.
- Audit logging on auth-relevant actions (`audit_logs.actor_id` = UUID).

## 3. How WorkOS identities map to CAPFLUX users

Table: `public.user_identity_links`

```
capflux_user_id UUID  ↔  workos_user_id TEXT ('user_01H…')
status: PENDING | ACTIVE | SUSPENDED | REVOKED | REVIEW
migration_source: PREIMPORT | JIT_VERIFIED_EMAIL | MANUAL | WEBHOOK
UNIQUE(workos_user_id, identity_type); UNIQUE(capflux_user_id, identity_type)
```

Resolution rules (implemented in SQL shim + middleware):
1. Look up by immutable provider ID. **Email is never a join key at runtime.**
2. Only `status='ACTIVE'` resolves. Anything else ⇒ NULL ⇒ fail closed.
3. One active link per side. Conflicts go to REVIEW; humans adjudicate.
4. Link creation is always audit-logged with its migration_source.
5. Native Supabase subs (UUIDs) pass through during the dual-auth window so
   existing sessions keep working; after retirement this branch can be removed.

## 4. Adding authentication features safely

Checklist (every PR):
1. Does it touch payments/ledger/webhooks/auth/RLS? → compliance-sensitive;
   read `docs/compliance/CAPFLUX_COMPLIANCE_MASTER.md` first.
2. Extend the `AuthProvider` abstraction; never call provider SDKs from views.
3. New endpoint? Mount behind `requireAuthAny`; resolve scope via
   `AuthorizationService`; add spoof-negative tests.
4. New claim used for authorization? NO — DB roles remain the only authority.
   WorkOS `role(s)`/`permissions` claims are informational only.
5. New DB object? Additive migration `2026MMDDNNNN_*.sql` + rollback note +
   verification queries. Never edit applied migrations.
6. Update `docs/security/authentication.md` + compliance status evidence.
7. Gates: `cd backend && npm test && npm run typecheck &&
   npm run typecheck:tests && npm run compliance:audit && npm run build`;
   frontend targeted vitest with `NODE_ENV=test`.

## 5. Testing authentication

Backend (node:test over tsx):
```bash
cd backend && npm test                      # full local suite
npx tsx --test tests/requireAuthSupabase.test.js          # middleware core
npx tsx --test tests/schoolIsolation.test.js tests/financial-authz.test.js
```
Frontend (vitest):
```bash
cd frontend && NODE_ENV=test npx vitest run src/shared/__tests__ \
  src/features/auth src/shared/rbac
```
Scenario scripts (Phase 7 gate) live under `backend/scripts/`:
import dry-run, link coverage report, per-role RLS parity probes.

Manual staging smoke: sign in as (1) imported owner with OLD password,
(2) fresh signup, (3) suspended user (expect fail-closed), then verify offline
sync queue drains and a sandbox payment records with correct actor id.

## 6. Configuration per environment

| Item | Local dev | Staging | Production |
|---|---|---|---|
| Frontend origin | localhost:5173 | staging host | prod domain |
| WorkOS redirect URI | `http://localhost:5173/auth/callback` | `https://<staging>/auth/callback` | `https://<prod>/auth/callback` |
| `VITE_AUTH_PROVIDER` | `supabase` or `workos` | `workos` | `workos` |
| Backend cookie | Secure off (`COOKIE_SECURE=false`) | Secure on | Secure on |
| CORS_ORIGINS | localhost origins | staging origin | prod origin(s) |
| Secrets (backend env only) | placeholder-free local values | env group | secret manager |

Dashboard split: WorkOS settings live in the [WorkOS dashboard] per
environment (redirects, JWT template `{ "role": "authenticated",
"user_role": {{organization_membership.role}} }`, webhooks `whsec_…`,
AuthKit providers/MFA). Supabase side: Authentication → Third-Party Auth → add
WorkOS issuer `https://api.workos.com/user_management/<client_id>` (or custom
domain). Render hosts the backend (health `/health`); Vercel/Netlify host the
SPA and need SPA rewrites for `/auth/callback`. Full checklists: audit §12–§15.

## 7. Performing an account migration (operator procedure)

1. Freeze: disable AuthKit signups; keep native auth running.
2. Export cohort read-only from `auth.users` (id, email,
   encrypted_password, email_confirmed_at). Duplicate emails → REVIEW view.
3. Import into WorkOS (API batch; bcrypt hash port). Store returned IDs by
   updating `user_identity_links` (ACTIVE iff email confirmed).
4. Dry-run report: counts linked/unlinked/review; sample sign-ins with old
   passwords on staging.
5. Cutover: flip frontend flag; monitor auth error rate, sync queue depth,
   webhook delivery.
6. Post-window: disable native providers (never delete data); archive
   `legacy_identity_migrations`.
Rollback at any point: flip flags back; links stay; nothing deleted.

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Queries return EMPTY, no error (sync plane) | JWT lacks `role:"authenticated"` → requests run as anon | Verify WorkOS JWT template; re-login to mint token; probe `select auth.jwt()->>'role'` through a real request |
| `22P02 invalid input syntax for uuid` from RLS | Policy still calling `auth.uid()` with a WorkOS sub | Confirm policy rewrite applied; use `requesting_user_id()` |
| Everything 401 after cutover | Cookie not sent: wrong Path/domain or `COOKIE_SECURE` on HTTP | Check cookie options vs scheme; SameSite/Lax; `/api` path |
| User exists but gets empty data | Link missing/SUSPENDED/REVOKED | Inspect `user_identity_links`; fix status via MANUAL flow + audit |
| Login loop back to /auth | Redirect URI mismatch or state cookie lost | Match dashboard redirect exactly incl. trailing path; check cookie secure flags cross-site |
| Webhook events ignored | Bad signature/timestamp | Verify `WORKOS_WEBHOOK_SECRET`, raw-body handling, clock skew |
| Old password fails post-import | Hash format edge case | Trigger lane E reset email; investigate hash algorithm support list |

Diagnostics: backend logs emit structured stage/code/status; health at
`GET /health`; link coverage query in audit §11.

## 9. Verifying tenant isolation (recurring drill)

1. Two schools A/B; user U ∈ A only, authenticated via WorkOS.
2. API: request B-scoped resources → 403/404 expected (AuthorizationService).
3. Direct PostgREST with U's WorkOS token: select B rows → ZERO rows.
4. Spoof negatives: `x-user-id` of a B member + U's token → still A-only.
5. Shim fail-closed: set link REVOKED → step 3 returns zero AND API 401s.
6. Financial spot-check: reversal attempt on B ledger → denied; audit entry
   written with U's UUID on any allowed action in A.

Run this drill in CI (staging seeds) each time migrations 0002/0003 lineage
changes.

---
*Maintainers: update this runbook in the same PR as any auth-surface change.*
