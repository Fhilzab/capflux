# CAPFLUX WorkOS AuthKit Migration Audit

> **Status:** AUDIT + PLAN ONLY — no authentication code has been modified.
> **Date:** 2026-08-23
> **Branch audited:** `main` @ `d56a250` (clean working tree)
> **Compliance gate:** AGENTS.md mandatory compliance gate applied. Affected control namespaces: `AUTH-*`, `TENANT-*`, `AUDIT-*`, `SEC-*`, `WEBHOOK-*` (indirect). See §20/§21.
>
> **Context that makes this migration unusual:** CAPFLUX already migrated
> *from* WorkOS *to* Supabase Auth once (commits `6037acd`→`5acd4ca`, Phases 1–7,
> including a purge of 21 WorkOS test identities). The legacy WorkOS code path
> (`WorkOSAuthService.ts`, `SessionService.ts`, `middleware/requireAuth.ts`,
> `routes/auth.ts`, frontend `AuthKitProvider.ts`) is deliberately preserved
> in-tree as a rollback path. This migration reverses direction:
> **Supabase Auth → WorkOS AuthKit**. That history is both an asset (a proven,
> tested AuthKit integration exists in-tree) and a risk (stale identity
> artifacts such as `legacy_identity_migrations` must be reconciled, not reused).

---

## 1. Executive Summary

**Current state.** Authentication authority is **Supabase Auth**
(email/password + Google OAuth), validated per-request by the backend
(`requireAuthSupabase`) via `supabase.auth.getUser(token)`. The canonical
CAPFLUX user ID is the Supabase `auth.users.id` UUID, mirrored 1:1 into
`public.users.id`; every user-reference column in the database (18 columns,
16 FKs — including financial/KYC actor columns) is a UUID keyed to it. RLS
policies depend on `auth.uid()` in ~95 places. The browser still talks to
Supabase **directly** for the offline sync plane (`payment_transactions`,
`settlement_records`, `payment_accounts`, ledger realtime channels), so RLS
remains a live security boundary, not a formality.

**Target state.** WorkOS AuthKit becomes the user-facing authentication
authority (hosted UI, password policy, MFA-ready, email verification, Google
OAuth). The CAPFLUX business identity does **not** move: `public.users.id`
stays the canonical UUID; memberships, roles, permissions, KYC, settlements and
ledger references are untouched.

**Decisive technical finding (verified against current official docs, not
memory):**

- WorkOS user IDs are prefixed strings (`user_01H…`), **not UUIDs**.
- Supabase's `auth.uid()` casts the JWT `sub` claim to UUID; with a WorkOS token
  it raises `22P02 invalid input syntax for type uuid` (or silently breaks
  comparisons).
- Therefore WorkOS tokens **cannot** simply replace Supabase tokens against the
  current schema. An explicit identity bridge is mandatory.

**Recommended architecture ("bridge" design):**

1. **Identity link table** `user_identity_links` maps each WorkOS identity to
   the existing CAPFLUX UUID. Existing users are **pre-imported into WorkOS
   with their existing bcrypt password hashes ported from Supabase**
   (officially supported by WorkOS: bcrypt, argon2, scrypt, pbkdf2, ssha…),
   so users keep the same email **and the same password** — zero forced resets
   for the main cohort.
2. **Supabase third-party auth (native WorkOS integration)** keeps the browser's
   direct Supabase traffic (offline sync plane) working under RLS with WorkOS
   access tokens; a WorkOS **JWT template** injects `role: "authenticated"`
   (required by PostgREST role selection).
3. **RLS compatibility shim**: one SECURITY DEFINER function
   `public.requesting_user_id()` resolves `auth.jwt()->>'sub'` through the link
   table to the existing UUID, and passes native Supabase UUID subs through
   during the dual-auth window. All `auth.uid()` policy expressions are
   rewritten additively to use it. **No column types change. No financial
   tables change. RLS strength preserved/improved** (unknown/unlinked WorkOS
   identities resolve to NULL ⇒ zero rows, fail-closed).
4. **Backend dual-auth middleware** accepts either a valid Supabase Bearer JWT
   (today's path, retained through the transition window) or a WorkOS sealed
   session cookie/Bearer (revived legacy `SessionService` pattern on the
   current SDK), resolving both to the same `req.user` = `public.users` row.
   Everything downstream (`AuthorizationService`, all route handlers) is
   unchanged because it keys on the UUID.

**Existing-user continuity.** Scenarios A–L (§9) resolve without duplicate
accounts: pre-import creates the link before AuthKit signups open; JIT linking
(only for post-import newcomers whose WorkOS email is verified and matches
exactly one confirmed CAPFLUX user) is gated behind an explicit owner decision.

**Migration option chosen:** staged **Option D+E hybrid** (pre-migration import
+ just-in-time linking) inside a **dual-auth window**. Never big-bang. Rollback
at every stage is a config flip plus additive DB objects; nothing is deleted.

**Verdict:** feasible without duplicating users, weakening RLS, altering
payment/ledger semantics, or breaking tenant isolation. It hinges on owner
decisions in §21 (password-hash export approval, JIT-link policy, custom auth
domain).

---

## 2. Current Authentication Architecture

### 2.1 Active path (production)

```
Browser
  └─ SupabaseAuthProvider (frontend/src/shared/auth/SupabaseAuthProvider.ts)
       ├─ signIn/signUp/OAuth/reset directly against supabase-js v2
       └─ session persisted by supabase-js in localStorage (sb-*-auth-token);
          non-authoritative UI hint capflux_auth_ui_hint
  └─ apiClient interceptor (frontend/src/shared/services/api/client.ts:27-38)
       └─ Authorization: Bearer <SUPABASE_ACCESS_TOKEN> on every /api/* call
Express backend
  └─ requireAuthSupabase (backend/middleware/requireAuthSupabase.ts)
       ├─ supabase.auth.getUser(token)        ← network validation, fail-closed
       ├─ load public.users row WHERE id = supabaseUser.id
       └─ req.user = public.users row (UUID); req.supabaseUser; req.token
  └─ AuthorizationService.getSchoolMembership(req.user.id, schoolId)
       └─ school_members ⋈ roles ⋈ role_permissions → permission checks
  └─ Domain services run under SUPABASE_SECRET_KEY (service role); tenant scope
     enforced by query construction (school_id filters) + Postgres RLS.
```

Middleware mount map (all verified):

| Router | Middleware | File |
|---|---|---|
| `/api/webhook` | Provider HMAC signature (Monnify/Paystack), fail-closed in prod | routes/webhook.ts |
| `/api/dva`, `/api/payment-accounts`, `/api/payments`, `/api/operations`, `/api/kyc`, `/api/onboarding`, `/api/admin` (+ financial-admin) | `router.use(requireAuthSupabase)` (+ `requireStaff` where applicable) | index.ts:114–137 |
| `/api/auth/*` | Mixed: legacy `requireAuth` (WorkOS cookie) on `/session`,`/me`,`/signout`; public endpoints otherwise | routes/auth.ts |
| `POST /rpc` proxy | `requireAuthSupabase` + function allowlist + server-side param injection | index.ts:191–263 |

### 2.2 Legacy-but-preserved WorkOS path (dormant)

- `backend/services/WorkOSAuthService.ts` — full User Management proxy
  (password signup/signin, OAuth callback, refresh, password reset, email
  verification, AuthKit hosted-UI URL builder with `screenHint`, timing-safe
  state validation, error taxonomy incl. breached/weak-password mapping).
- `backend/services/SessionService.ts` — sealed-session cookie
  (`workos_session`: HttpOnly, SameSite=Lax, Path=/api, 30d max-age, Secure in
  production) via `sealSessionDataFromAuthenticationResponse` /
  `authenticateWithSessionCookie`; also accepts Bearer sealed-session for
  non-browser clients.
- `backend/middleware/requireAuth.ts` — cookie/Bearer sealed-session middleware.
- `backend/routes/auth.ts` — signin/signup/google/callback/session/me/signout/
  refresh/forgot/reset/resend-verification/**claim-account** (legacy
  Supabase→WorkOS claim flow over `legacy_identity_migrations`, enumeration-
  resistant generic responses). Not called by the current frontend.
- `frontend/src/shared/auth/AuthKitProvider.ts` — dormant frontend provider
  (backend-proxy style, `withCredentials: true`).
- `frontend/.env.example` carries client-safe-only `VITE_WORKOS_CLIENT_ID`.

### 2.3 Session & token storage today

| Item | Location | Authority |
|---|---|---|
| Supabase access/refresh JWTs | localStorage key managed by supabase-js (auto-refresh on) | Credential |
| `capflux_auth_ui_hint` | localStorage `{userId,email}` | Never a credential (flash-of-logged-out hint only) |
| `workos_session` | HttpOnly cookie (legacy path only) | Credential (sealed) |

No `document.cookie` reads/writes exist anywhere in frontend source. Legacy
identity headers (`x-user-id`/`x-school-id`) appear only in comments and
negative tests — zero acceptance paths remain.

### 2.4 Frontend auth surface

- `features/auth/` — AuthView + LoginForm / RegisterForm / ForgotPassword /
  ResetPassword / EmailVerification components; OAuth callback handled via
  `/auth/callback` redirect → AuthView watches `?code=` →
  `authStore.handleOAuthCallback`.
- `stores/authStore.ts` (Pinia) — session/user/org/membership state;
  organization loaded via `organizationService`.
- `shared/rbac/RouteGuard.ts` `authorizeRoute` — requires auth for
  `meta.requiresAuth` routes; soft-denies role/permission failures back to
  Home; KYC/settlement gating intentionally NOT router-level (per-page
  `useModuleLock` + `ModuleLockOverlay` overlays).
- Dual provider implementations activate on `VITE_API_BASE_URL`:
  organization (`DefaultOrganizationProvider` vs Supabase), school
  (`SupabaseSchoolProvider`), RBAC (`BackendRBACProvider` vs
  `SupabaseRBACProvider`).
- Offline plane hits Supabase **directly**: `offline/syncEngine.ts`,
  `UploadSyncEngine.ts` (RPC `set_student_primary_guardian`, generic entity
  CRUD), `DownloadSyncEngine.ts` (`payment_transactions`,
  `settlement_records`, `payment_accounts`), `RealtimeSyncService.ts`
  (channels on payments/accounts/settlements/ledger). All execute under RLS as
  `authenticated`.

### 2.5 Backend verification details

- Per-request, network-backed validation (`getUser(token)`); deleted/disabled
  users fail fast; costs one round-trip per request.
- Webhooks are payment-gateway-scoped: HMAC-SHA512 over raw body against
  `MONNIFY_WEBHOOK_SECRET` / `PAYSTACK_WEBHOOK_SECRET` (selected per provider),
  optional production IP allowlist, plus full gateway API re-verification
  ("NEVER trust webhook body"). There is **no WorkOS webhook receiver yet**.

---

## 3. Current Identity Model

### 3.1 Canonical chain (traced, not guessed)

```
auth.users.id (UUID, Supabase-managed)
   │  == public.users.id (UUID; UNIQUE email; auth_provider text)
   │  provisioning trigger handle_new_supabase_user() on INSERT/email-confirm
   │  delete trigger handle_supabase_user_delete() cascades public.users
   ▼
user_profiles.user_id (PK/FK CASCADE)        — profile metadata
school_members.user_id (FK CASCADE)          — membership + role_id (+ invited_by FK SET NULL)
organization_members.user_id (FK CASCADE)
organizations.owner_user_id (FK SET NULL)
profiles.user_id (legacy table; FK SET NULL)
schools.owner_user_id (FK SET NULL)
gateway_assignments.assigned_by              ┐
kyc_records.reviewed_by / cac_verified_by /  │ financial & KYC & audit actor columns:
  identity_verified_by                       │ all UUID FK → public.users(id),
kyc_verifications.verified_by                │ ON DELETE SET NULL
payment_transactions.reversed_by             │
reconciliation_issues.resolved_by            │
reconciliation_runs.started_by               │
settlement_accounts.submitted_by/verified_by ┘
audit_logs.actor_id (UUID; log_admin_status_change trigger resolves via auth.uid())
```

Answers to the Phase 2 questions:

- **Canonical user ID:** `auth.users.id` ≡ `public.users.id`. Confirmed by
  `requireAuthSupabase` (resolves `users` by token sub) and migration
  `202607100027_supabase_auth_uuid.sql`, which converted all 18 user-reference
  columns TEXT→UUID after purging 21 WorkOS-style `user_*` IDs.
- **profiles:** legacy table kept for compatibility; active profile data lives
  in `user_profiles` keyed by the same UUID. Both exist; neither dropped.
- **Authorization depending on `auth.uid()`:** all RLS policies (§6) plus the
  admin-status audit trigger function.
- **Financial dependence:** only actor/reviewer/reversal columns reference
  users. Balances derive from append-only `ledger_entries` which are
  student/school-scoped, not user-owned; payment transaction identity,
  idempotency keys, settlement records are NOT keyed by user id. **Changing the
  authentication provider therefore cannot corrupt ledger semantics** — but it
  can corrupt *who may act*, which is what the bridge protects.

### 3.2 Membership / RBAC model

- `roles(system_role)` includes OWNER, ADMIN, SUPER_ADMIN (+ others);
  `role_permissions ⋈ permissions(code)`; SUPER_ADMIN bypasses permission
  checks inside `AuthorizationService.checkPermission` (documented behavior).
- Multi-school users supported (`getPrimarySchoolMembership` orders by
  joined_at); platform staff cross-school review via
  `staffAuth.requireStaff` (SUPER_ADMIN across ALL active memberships).

### 3.3 Historical artifact requiring reconciliation

`legacy_identity_migrations` (migration 026): statuses
PENDING/INVITED/CLAIMED/COMPLETED/FAILED, UNIQUE(email), idempotency key — but
`workos_user_id UUID`, a **wrong type for genuine WorkOS IDs** (`user_…`
strings). Evidence it never held a real WorkOS ID. Decision needed (§21-D8):
retire it read-only in favor of correctly-typed `user_identity_links`.

---

## 4. Current Frontend Auth Flow

1. Boot → `RouteGuard.authorizeRoute` → `authStore.initialize()` →
   `AuthService.initialize()` → `supabase.auth.getSession()`.
2. Inline login/signup forms in `AuthView`; `initiateAuthKit` intentionally
   returns an empty URL under Supabase (no hosted UI).
3. Google: `signInWithOAuth({ redirectTo: origin+'/auth/callback' })`;
   `detectSessionInUrl` auto-exchanges; explicit `exchangeCodeForSession`
   fallback.
4. Recovery: `resetPasswordForEmail` → `/auth?mode=reset-password` →
   `verifyOtp({type:'email'})` + `updateUser({password})`.
5. Email verification: `resend({type:'email_confirmation'})`.
6. Logout: `signOut()` clears library storage + UI hint; RBAC cache cleared.
7. API calls: axios interceptor attaches Supabase bearer; HTTP 401 mapped to
   `SESSION_EXPIRED`.

All consumers depend only on the `AuthProvider` abstract class +
`AuthService` facade — the reason this migration can be frontend-minimal.

## 5. Current Backend Auth Flow

1. `requireAuthSupabase`: header parse → `supabase.auth.getUser(token)` → load
   `public.users` by sub → attach `req.user` (UUID identity).
2. Authorization: `AuthorizationService.getSchoolMembership(userId, schoolId)`
   (active membership + system_role), `checkPermission` via role_permissions,
   `assertPermission` → 403 INSUFFICIENT_PERMISSIONS;
   `staffAuth.requireStaff` platform-wide; `requirePaymentReady` /
   `requireProviderReady` progressive gates re-enforced server-side.
3. Tenant scoping: service-role queries filtered by school ids derived from the
   caller's memberships; RPC proxy allowlists functions and injects caller
   identity server-side (`complete_onboarding`, `get_onboarding_status`).
4. Errors keep structured causes (stage/code/status) and map to specific
   user-facing messages.

---

## 6. Current Supabase/RLS Model

- **~95 `auth.uid()` occurrences** across migrations (base policies superseded
  by `013_rls.sql` + `028_supabase_rls_migration.sql` rewrite ×41; plus 018,
  020, 022, 030 ×10, 027 ×1, 021 legacy ×4), plus
  `supabase/policies/rls_hardening.sql`, `supabase/triggers/audit_triggers.sql`,
  and the admin-status audit trigger (`log_admin_status_change` uses
  `v_actor_id := auth.uid()`).
- Policy shapes: self-access (`auth.uid() = id/user_id`), membership-scoped
  (`EXISTS (SELECT 1 FROM school_members sm WHERE sm.user_id = auth.uid() AND
  sm.school_id = … AND sm.is_active)`), org-scoped analogues, and
  `auth.uid() IS NOT NULL` authenticated-gates.
- **Critical mechanics (verified):** `auth.uid()` ≈
  `nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid`.
  - Native Supabase token: sub is a UUID ⇒ works today.
  - WorkOS token: sub = `user_01H…` ⇒ cast raises `22P02` ⇒ queries ERROR (not
    silently empty). With no sub at all it returns NULL.
- PostgREST assigns the Postgres role from the JWT `role` claim; third-party
  tokens must carry `"role":"authenticated"` (via the WorkOS JWT template) or
  every request degrades to anon (silent-empty failure mode).

## 7. WorkOS AuthKit Target Architecture

### 7.1 Verified platform facts (current official docs)

| Fact | Source (verified 2026-08) |
|---|---|
| AuthKit hosted UI handles password auth, MFA, email verification, breach checks, Google/Microsoft/Apple/GitHub OAuth | workos.com/docs/user-management |
| Access tokens are JWTs signed with asymmetric keys; JWKS at `https://api.workos.com/sso/jwks/<client_id>`; claims include `sub` (`user_…`), `sid`, `org_id`, `role`, `roles`, `permissions`, `jti` | workos.com/docs/reference/authkit/session-tokens |
| Node SDK (`@workos-inc/node`) provides `authenticateWithCode/Password`, `authenticateWithSessionCookie` (local unseal + JWT verify, no network), `refreshAndSealSessionData`, `sealResponse`-style sealing with a ≥32-char cookie password, `getJwksUrl`, revocation, password reset, email verification | workos.com/docs/reference/user-management/authentication |
| Official user migration path: export emails (+ optional **password hashes**: bcrypt, scrypt, firebase-scrypt, ssha, ssha256, pbkdf2, argon2) → import via Create User API or `npx workos migrations import --csv`; persist the returned WorkOS user id next to your app-local user; disable signups during the window; dual-write for new signups; trigger password resets only if hashes cannot be exported | workos.com/docs/migrate/other-services |
| Supabase natively supports WorkOS as a third-party auth provider: register issuer `https://api.workos.com/user_management/<client_id>` (or custom auth domain) in Supabase Auth settings; supabase-js accepts an async `accessToken()` callback; a WorkOS **JWT template** must set `"role": "authenticated"` (org role moved to `user_role`); asymmetric signing + `kid` required; key changes propagate ≤30 min; Supabase Auth itself cannot be disabled; third-party MAU billed beyond plan quota ($0.00325) | supabase.com/docs/guides/auth/third-party/{overview,workos}, workos.com/docs/integrations/supabase-authkit |
| WorkOS users do **not** exist in Supabase `auth.users`; `auth.uid()` breaks on non-UUID subs ⇒ RLS must read `auth.jwt()->>'sub'` as text or map to a local UUID | supabase third-party docs + auth.uid() definition |

**Conclusion:** WorkOS AuthKit can act as the authentication authority while
Supabase RLS continues to function — but only through an explicit identity
bridge. There is no automatic WorkOS→auth.users sync.

### 7.2 Target architecture diagram

```
                    ┌────────────────────────────┐
                    │ WorkOS AuthKit (hosted UI) │
                    │  passwords / Google / MFA  │
                    └──────────┬─────────────────┘
        code ?code=<auth code> │ redirect to /auth/callback
                               ▼
   Browser SPA ── GET /api/auth/callback?code ─────────────────┐
   (Vue 3)                                                     │
     │  capflux_session HttpOnly sealed cookie (canonical)     ▼
     │                                    Express: authenticateWithCode
     │                                          ├─ resolve/link identity:
     │                                          │    user_identity_links
     │                                          │    .workos_user_id → users.id (UUID)
     │                                          └─ seal session cookie (WORKOS_COOKIE_PASSWORD)
     │
     ├─ axios /api/* : Authorization: Bearer <WorkOS access token>   ← in-memory, short-lived
     │        ▼
     │   requireAuthAny middleware
     │        ├─ (a) Supabase JWT  → getUser() → public.users.id   [transition window]
     │        └─ (b) WorkOS token  → JWKS verify → sub → link table → public.users.id
     │        ▼
     │   AuthorizationService (unchanged; UUID-keyed)
     │        ▼
     │   Supabase service-role queries (school-scoped)
     │
     └─ supabase-js (offline sync plane, realtime)
              │ accessToken: async () => fetch('/api/auth/access-token')
              ▼
         Supabase Data API — validates WorkOS JWT via registered issuer (JWKS),
         role=authenticated via JWT template,
         RLS: requesting_user_id() maps sub → UUID (fail-closed)
```

### 7.3 Component decisions

| Concern | Decision | Rationale |
|---|---|---|
| Frontend login UX | Redirect browser to AuthKit hosted UI from AuthView (`initiateAuthKit` now returns a real URL); keep branded entry page | Matches existing AuthView flow; WorkOS owns forms/policy/MFA |
| Session credential | Sealed HttpOnly cookie `capflux_session` (rename away from `workos_session`; Path=/api) | Revives proven SessionService; keeps refresh tokens server-side |
| API bearer | Short-lived WorkOS access token handed to SPA in-memory via `GET /api/auth/access-token` (refreshed server-side via `refreshAndSealSessionData`) | Needed by supabase-js `accessToken()`; avoids localStorage tokens |
| Backend validation | `requireAuthAny`: try WorkOS (cookie or bearer, JWKS-verified) then legacy Supabase bearer during window | Zero-downtime transition; one `req.user` shape |
| Identity resolution | `user_identity_links.workos_user_id → capflux_user_id` lookup per request (cached in-process, TTL-bounded) | Never trust email or WorkOS ID alone |
| New-user provisioning | Backend provisions `public.users`+`user_profiles` on first successful WorkOS callback (JIT) and/or `user.created` webhook; **replaces reliance on the auth.users trigger**, which no longer fires for WorkOS users | Trigger only covers native signups |
| Email verification / reset / MFA | Delegated entirely to AuthKit (dashboard-configured) | Removes bespoke flows |
| Logout | Revoke WorkOS session (`userManagement.revokeSession`) + clear cookie | Server-authoritative |
| Webhooks | NEW receiver `/api/webhooks/workos` verifying `workos-webhook-signature` (HMAC-SHA256 via SDK `webhooks.constructEvent`); events: `user.created`, `user.updated`, `user.deleted`, `session.created/revoked` (subset) | Keeps DB in sync with suspensions/deletions |

### 7.4 What does NOT change

- `public.users.id` UUID canonical model; all FKs.
- `AuthorizationService`, `staffAuth`, `requirePaymentReady`,
  `requireProviderReady` semantics.
- All domain routes' contracts (`req.user.id` remains the CAPFLUX UUID).
- Payment state machine, ledger append-only rules, idempotency keys,
  settlement/reconciliation data paths.
- Offline-first Dexie/sync queue design.

---

## 8. Identity Mapping Strategy

### 8.1 Why a dedicated table is required

1. The existing schema has **no** WorkOS↔CAPFLUX mapping that is type-correct:
   `public.users.auth_provider` records provenance but not external IDs;
   `legacy_identity_migrations` has a wrongly-typed column and a
   claim-flow-specific status machine.
2. Modifying `auth.users` directly is inappropriate: it is Supabase-managed,
   has no schema extension point for external IDs, is excluded from logical
   dumps by default, and mutating it risks breaking GoTrue internals. The
   provisioning triggers on it remain useful for native signups during the
   transition and must not be repurposed.
3. Security requires a verified-link record with its own audit trail
   (who linked, when, how, status).

### 8.2 Design (migration `202608230001_user_identity_links.sql`)

```sql
CREATE TABLE IF NOT EXISTS public.user_identity_links (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capflux_user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    workos_user_id    TEXT NOT NULL,           -- 'user_01H...' (prefixed string)
    identity_type     TEXT NOT NULL DEFAULT 'workos_authkit'
                      CHECK (identity_type IN ('workos_authkit','supabase_native')),
    status            TEXT NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','REVOKED','REVIEW')),
    migration_source  TEXT NOT NULL DEFAULT 'PREIMPORT'
                      CHECK (migration_source IN ('PREIMPORT','JIT_VERIFIED_EMAIL','MANUAL','WEBHOOK')),
    verified_at       TIMESTAMPTZ,             -- when ownership proof completed
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_identity_link_workos UNIQUE (workos_user_id, identity_type),
    CONSTRAINT uq_identity_link_capflux UNIQUE (capflux_user_id, identity_type)
);
CREATE INDEX IF NOT EXISTS idx_uil_workos ON public.user_identity_links (workos_user_id);
CREATE INDEX IF NOT EXISTS idx_uil_capflux ON public.user_identity_links (capflux_user_id);
```

Uniqueness & takeover-prevention properties:

- **One active link per WorkOS user** and **one per CAPFLUX user** (per
  identity type): prevents duplicate identities and accidental merging.
  A second link attempt must UPSERT-with-guard: only allowed when the prior
  row is REVOKED, else goes to REVIEW.
- Cross-school access is structurally impossible via this table: links never
  carry school scope; membership resolution still flows exclusively through
  `school_members`.
- RLS: table is service-role/backend-managed only. Enable RLS with **no**
  anon/authenticated policies (deny-by-default), matching
  `legacy_identity_migrations`. The RLS shim reads it via SECURITY DEFINER.

### 8.3 The RLS shim (migration `202608230002_rls_identity_shim.sql`)

```sql
CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub text := nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '');
  mapped uuid;
BEGIN
  IF sub IS NULL THEN RETURN NULL; END IF;

  -- WorkOS identity: map through verified link (fail closed).
  IF left(sub, 5) = 'user_' THEN
    SELECT l.capflux_user_id INTO mapped
    FROM public.user_identity_links l
    WHERE l.workos_user_id = sub AND l.identity_type = 'workos_authkit'
      AND l.status = 'ACTIVE';
    RETURN mapped;  -- NULL for unknown/unlinked/suspended => zero rows
  END IF;

  -- Native Supabase UUID sub (dual-auth window). Invalid UUIDs -> NULL.
  BEGIN
    RETURN sub::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
  END;
END $$;
```

Policy rewrite rule (additive migration `202608230003_*`): every policy
predicate `auth.uid()` becomes `(select public.requesting_user_id())`
(InitPlan-wrapped per Supabase performance guidance); membership subqueries
keep their structure. The admin-status trigger switches to the same helper.
A verification query set (before/after row counts per role simulation)
gates deployment; see runbook §Verify.

Rollback of the shim: policies are recreated from the prior definitions
(captured in the migration's down-script comments / git history) — additive,
no destructive DDL.

---

## 9. Existing User Migration Strategy

### 9.1 Option comparison

| Option | Description | Verdict |
|---|---|---|
| A Big-bang | Cut over all at once; force resets | ❌ Unacceptable: offline-first school users, financial ops, no staged verification |
| B Dual-auth transition only (link at first login) | Keep both providers live; JIT link on first WorkOS login | ⚠️ Viable but leaves linking race windows and mass first-login support burden |
| C JIT-only linking | No pre-import; link purely at runtime | ❌ Email-collision/takeover surface too large for financial data |
| **D Pre-migration import** | Export from Supabase → create WorkOS users incl. bcrypt hash port → store links before cutover | ✅ Core of recommendation |
| E Invitation/recovery fallback | Password-reset emails for cohorts whose hashes can't be used | ✅ Fallback lane inside D |

**Recommendation: Option D+E hybrid inside a dual-auth window (B's mechanism,
D's preparation).** Ordering matters: import BEFORE opening AuthKit signups so
victim emails can't be claimed by attackers mid-window (WorkOS enforces email
uniqueness per environment).

### 9.2 Production sequence (first-login walkthrough)

```
Pre-window (T-14d):
  1. Export cohort: auth.users {id, email, encrypted_password(bcrypt),
     email_confirmed_at} via service-role script (read-only).
     Detect duplicate emails across auth.users → route to REVIEW queue.
  2. Import to WorkOS (API batch or CLI): createUser({email, passwordHash:
     {hash, algorithm:'bcrypt'}, emailVerified: <confirmed?>}) with retry/
     rate-limit handling; persist returned user_xxx into user_identity_links
     (status ACTIVE where supabase email confirmed, else PENDING+verification).
  3. Verify sample accounts can sign in with existing passwords (staging env).

Window (T0):
  4. Deploy backend dual-auth + shim; frontend flag VITE_AUTH_PROVIDER=workos.
  5. Existing user clicks "Sign in" → AuthKit hosted UI → same email +
     SAME PASSWORD (ported hash) → code callback → backend resolves link →
     SAME public.users UUID → profile/membership/role/permissions/financial
     access identical. No duplicate rows anywhere.
  6. New users: AuthKit signup → backend JIT provision public.users +
     user_profiles (trigger no longer applies) → link created
     (source JIT_VERIFIED_EMAIL n/a; source='WEBHOOK').

Post-window (T+N weeks):
  7. Disable Supabase Auth sign-in methods (KEEP project + RLS + auth.users
     intact forever); remove frontend Supabase login UI.
```

### 9.3 Scenario matrix (A–L)

| # | Scenario | Behavior |
|---|---|---|
| A | Same email/password login post-migration | Pre-imported link resolves 1:1; same UUID; zero duplication |
| B | Login via Google/OAuth | WorkOS binds OAuth identity to the SAME WorkOS user (email match within WorkOS after verification) → same link → same CAPFLUX account. No separate CAPFLUX row |
| C | User already exists in WorkOS (e.g., from old pilot) | Import detects existing WorkOS email: adopt existing ID into link (after confirming emailVerified) rather than creating duplicates; conflict → REVIEW |
| D | No WorkOS identity pre-import | Covered by pre-import; anything missed → JIT lane (§21-D3 policy) requiring WorkOS-verified email matching exactly ONE confirmed CAPFLUX user; else REVIEW |
| E | One WorkOS email ↔ multiple CAPFLUX rows | Impossible by UNIQUE(users.email) unless historical dupes exist; detection query runs in step 1; conflicts frozen in REVIEW; staff adjudicates (§21-D7). No auto-merge ever |
| F | Email changed | Link is keyed by immutable WorkOS user id, not email → unaffected; email updates flow via `user.updated` webhook to `users.email` (audited) |
| G | Two identities appear to be the same person | System never merges automatically; both may coexist as distinct CAPFLUX users until MANUAL review merges memberships explicitly (out-of-band, audited) |
| H | Multi-school user | Membership rows untouched; all schools continue to resolve from the single UUID |
| I | Admin with multiple roles | Roles live in school_members/organization_members; unchanged |
| J | Disabled/suspended user | Suspension enforced at WorkOS (session revocation) AND locally (`school_members.is_active=false` / future users.status); `session.revoked` webhook clears local sessions; fail-closed shim drops SUSPENDED links |
| K | Financial-permission holder | Pre-imported like anyone else; additionally flagged in the migration report for spot-check sign-in verification before cutover; JIT lane DISABLED for any account holding financial/KYC/staff permissions unless owner approves (§21-D3) |
| L | Takeover attempt via email match | Attacker paths: (i) signup with victim email — blocked because victim was imported first (email uniqueness) or, if attacker registered earlier, import conflict routes to REVIEW and victim keeps native access during window; (ii) JIT link abuse — blocked by verified-email-on-BOTH-sides rule + exclusion list for privileged accounts; (iii) forged tokens — blocked by JWKS signature + issuer/audience checks; all linking events audit-logged |

---

## 10. Security Threat Model (authentication-focused)

| Threat | Mitigation (target design) |
|---|---|
| Account takeover | Pre-import ordering + WorkOS email uniqueness + verification gates; privileged-account JIT exclusion; full audit trail of link creation |
| Email collision / enumeration | AuthKit generic error surfaces; claim-account endpoint already enumeration-resistant (pattern retained); import REVIEW queue for dupes |
| Identity confusion (two IdPs) | Single resolution point: link table keyed by immutable provider IDs; email NEVER used as join key at runtime |
| Session fixation | New session minted at each WorkOS code exchange; sealed cookie regenerated on refresh; `sid` tracked for revocation |
| JWT forgery | Backend verifies against WorkOS JWKS (asymmetric, `kid` rotation); issuer=`api.workos.com/user_management/<client_id>`, audience=clientId, exp/iat enforced; Supabase verifies via registered third-party issuer |
| Token replay | Access tokens short-lived (5 min default); refresh tokens single-use w/ rotation; sealed cookie refreshed server-side (`refreshAndSealSessionData`); `jti`/`sid` revocation via webhooks |
| CSRF | Cookie SameSite=Lax + Path=/api + state parameter (timing-safe compare, already implemented) on OAuth flows; JSON-only API |
| XSS token theft | Tokens never in localStorage under target design (in-memory access token + HttpOnly cookie); existing CSP/security headers retained |
| Open redirects | Fixed allowlist of post-auth redirect targets (RouteGuard Home/KYC paths); WorkOS redirect URIs pinned per environment |
| OAuth linking attacks | State cookie consume-once (exists); WorkOS verifies emails before completing auth; no silent provider-to-provider merging |
| Tenant breakout | Unchanged: RLS membership-scoped policies now via fail-closed `requesting_user_id()`; backend re-checks membership per request; service-role confined to backend |
| Privilege escalation | Role resolution still exclusively from DB roles; WorkOS `roles`/`permissions` claims are informational-only (never trusted for authorization) |
| Stale sessions | `session.revoked`/`user.deleted` webhooks revoke; shim returns NULL for REVOKED/SUSPENDED links immediately even without webhook delivery |
| Disabled/deleted users | Fail-closed: unknown/unmapped/revoked ⇒ NULL ⇒ zero rows + 401 at middleware |
| Service-role abuse | Unchanged posture (backend-only secret); RPC proxy allowlist stays |
| Webhook spoofing | `workos-webhook-signature` HMAC verify via SDK against `WORKOS_WEBHOOK_SECRET`; timestamp tolerance; raw-body handling |
| WorkOS↔Supabase mismatch | Shim treats mismatches as NULL (fail-closed); nightly reconciliation job compares WorkOS directory vs link table (report-only initially) |

Financial specifics: reversal/settlement/KYC endpoints keep
`requireStaff`/`requirePaymentReady` chains; audit_logs actor ids remain the
stable UUIDs, preserving non-repudiation across the migration.

---

## 11. Database Changes (design only — DO NOT execute yet)

Conventions: additive only, date-prefixed new series `20260823xxxx_*.sql`,
each with rollback notes. Never edit applied migrations.

| Migration | Purpose | Contents |
|---|---|---|
| `202608230001_user_identity_links.sql` | Identity bridge | Table + constraints + indexes + RLS deny-all (service-role managed) + COMMENT; rollback = DROP TABLE (safe pre-launch only; after go-live mark read-only instead) |
| `202608230002_rls_identity_shim.sql` | `requesting_user_id()` | Function (§8.3) + regression unit checks (set_config simulations); rollback = DROP FUNCTION (policies not yet referencing it) |
| `202608230003_rls_policies_rewrite.sql` | Swap `auth.uid()` → `(select public.requesting_user_id())` in ALL policies + audit trigger fn | Full policy DDL reproduced additively (CREATE OR REPLACE FUNCTION + DROP/CREATE POLICY pairs); includes before/after verification queries; rollback = previous policy DDL embedded in file header comment |
| `202608230004_backfill_identity_links.sql` | Backfill | INSERT links from auth.users⇔users⇒(to be populated with real workos ids by the import script, which UPDATEs rows here); includes duplicate-email detection view `v_identity_migration_review`; rollback: none needed (data-only, reversible by deleting rows) |
| `202608230005_retire_legacy_claim_table.sql` (optional, §21-D8) | Mark `legacy_identity_migrations` read-only (REVOKE writes; comment) | Deferred decision |

Explicitly NOT touched: `ledger_entries`, `payment_transactions`
(identity/idempotency columns), settlements, reconciliation tables,
idempotency constraints, payment state machine functions. Only *actor* FKs
already exist and remain as-is.

Backfill & verification queries:

```sql
-- Cohort size + duplicates
SELECT count(*), count(DISTINCT lower(email)) FROM auth.users;
SELECT lower(email), array_agg(id) FROM auth.users GROUP BY 1 HAVING count(*)>1;

-- Coverage check after import
SELECT (SELECT count(*) FROM public.users) AS capflux_users,
       (SELECT count(*) FROM user_identity_links WHERE status='ACTIVE') AS linked,
       (SELECT count(*) FROM public.users u
          WHERE NOT EXISTS (SELECT 1 FROM user_identity_links l
            WHERE l.capflux_user_id=u.id)) AS unlinked;

-- Shim behavior probes (run in SQL editor ONLY with set_config simulation)
SELECT public.requesting_user_id(); -- NULL without claims
SELECT set_config('request.jwt.claims','{"sub":"user_01HTEST","role":"authenticated"}', true);
SELECT public.requesting_user_id(); -- NULL until link inserted; UUID after
```

## 12. WorkOS Dashboard Configuration

> Names below follow the current WorkOS dashboard/docs; where UI labels shift
> between versions, the docs page is cited. Verify live names during setup.

[WORKOS DASHBOARD]
1. **Environments**: use separate Staging and Production environments (each
   has its own Client ID/Secret, users, and AuthKit config).
2. **API Keys** page: copy **Client ID** (`client_…`) and **Secret Key**
   (`sk_…`) → backend env only.
3. **Redirects**: create sign-in callback redirect URIs:
   - staging: `https://<staging-frontend>/auth/callback`
   - prod: `https://<prod-domain>/auth/callback`
   - local dev: `http://localhost:5173/auth/callback`
   Set the **app homepage URL** to each environment's frontend origin.
4. **Custom Auth Domain** (optional but recommended, §21-D6): e.g.
   `auth.<yourdomain>` — changes the issuer used by Supabase third-party
   integration; must be configured BEFORE registering the Supabase issuer.
5. **Authentication → Sessions → JWT Template** (per WorkOS Supabase
   integration guide): add template with
   `{ "role": "authenticated", "user_role": {{organization_membership.role}} }`.
   This is REQUIRED for RLS; without it every third-party request runs as anon
   (silent-empty results).
6. **AuthKit configuration**: enable Email+Password; Google OAuth (configure
   Google Cloud consent + redirect as prompted by the dashboard wizard);
   decide Microsoft/Apple/GitHub (§21-D4); email verification required;
   password strength + breached-password protection ON; MFA policy decision
   (§21-D10; AUTH-008 currently NOT_IMPLEMENTED — AuthKit makes it cheap).
7. **Signups**: keep a signup flag/block OFF→ON deliberately: disabled during
   import window, enabled at cutover.
8. **Webhooks**: add endpoint `https://<api-host>/api/webhooks/workos`;
   select events `user.created`, `user.updated`, `user.deleted`,
   `session.created` (optional), `session.revoked`; copy the **webhook signing
   secret** (`whsec_…`) → backend env only.
9. **Organizations/Roles**: NOT required for CAPFLUX tenancy (schools remain
   local tables). If left unused, ensure no organization requirement is set on
   authentication (otherwise tokens lack expected claims shape).
10. Record the **issuer URL** for the Supabase integration:
    `https://api.workos.com/user_management/<client_id>` (or custom domain).

[SUPABASE DASHBOARD]

## 13. Supabase Dashboard Configuration

| Setting | Action |
|---|---|
| Authentication → Sign In/Providers | **KEEP** email+password & Google enabled until Phase 12 retirement; then disable providers (never delete project) |
| Authentication → URL Configuration | **KEEP** Site URL + redirect allowlist (Google recovery still needs `/auth/callback` during window) |
| Authentication → Third-Party Auth | **ADD** WorkOS integration with issuer from §12.10. Verify JWKS fetch succeeds in dashboard status indicator |
| Authentication → JWT Keys (signing keys) | **DO NOT TOUCH** legacy JWT secret; asymmetric keys only matter for native tokens which remain valid in window |
| Authentication → Rate limits / email templates | **KEEP** (still used by native cohort in window); later REMOVE usage by disabling providers |
| Database → RLS | **CHANGE ONLY via migrations 0002/0003** — never via dashboard ad-hoc edits |
| Database → Roles | No new Postgres roles needed (`authenticated` reused) |
| Service role key (`SUPABASE_SECRET_KEY`) | **KEEP** backend-only; rotate if it ever left server env (COMP hygiene) |
| Edge Functions (`send-notification`) | **KEEP** unchanged; verify its auth assumptions still hold under third-party tokens before relying on it post-cutover |
| Environment variables | **ADD** none; third-party integration is dashboard config, not env |

Explicit list per requested vocabulary:
- KEEP: auth.users data, triggers (027), RLS enablement, service-role client,
  storage buckets/policies, realtime publications.
- CHANGE: policy bodies (via migration 0003 only), Third-Party Auth (add),
  provider toggles (Phase 12 only).
- ADD: nothing else.
- REMOVE: nothing until retirement phase.
- DO NOT TOUCH: JWT secrets, auth schema, existing applied migrations,
  financial tables.

## 14. Vercel/Netlify Configuration (frontend host)

No deployment configs exist in-repo today (verified). Required:

- SPA rewrites so `/auth/callback` deep-links serve index.html:
  - Netlify: `netlify.toml` redirect `/* → /index.html 200`;
  - Vercel: `vercel.json` rewrite same effect.
- Env vars (Project Settings → Environment Variables): `VITE_API_BASE_URL`,
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_PROVIDER=workos`
  (added in Phase 6 of implementation). Build command unchanged
  (`npm run build` in `frontend/`). Never mark VITE_ vars secret (they're public
  by design); never add WorkOS secrets here.

## 15. Render Configuration (backend host)

- Web service root `backend/`; Build `npm ci && npm run build`; Start
  `npm start` (runs `dist/index.js`); Health check path `/health`.
- Environment (all marked secret): `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`,
  `WORKOS_CLIENT_SECRET` (if used), `WORKOS_COOKIE_PASSWORD` (≥32 chars),
  `WORKOS_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
  `CORS_ORIGINS` (prod frontend origin(s)), `COOKIE_SECURE=true`,
  `NODE_ENV=production`, `PAYMENTS_PROVIDER_MODE`, gateway/KYC vars (unchanged).
- Autoscale note: sealed-cookie sessions are stateless ⇒ safe horizontally;
  in-process identity-link cache TTL ≤60s or disable if multi-instance.

## 16. Environment Variables

| Variable | Current | Target | Location | Secret? | Action |
|---|---|---|---|---|---|
| `WORKOS_API_KEY` | present (legacy) | keep (new values per env) | Render/local backend | YES | ROTATE on cutover (old pilot keys must die) |
| `WORKOS_CLIENT_ID` | present | keep | backend (+record for issuer URLs) | NO | UPDATE per environment |
| `WORKOS_CLIENT_SECRET` | present | keep-if-used by SDK config | backend | YES | VERIFY necessity against SDK version; drop if unsupported |
| `WORKOS_REDIRECT_URI` | legacy google callback | REMOVE after Phase 12 | backend | NO | RETIRE |
| `WORKOS_AUTHKIT_REDIRECT_URI` | localhost callback | keep, per-env values | backend | NO | UPDATE |
| `WORKOS_COOKIE_PASSWORD` | placeholder | REAL ≥32-char random per env | backend | YES | GENERATE; store in secret manager |
| `WORKOS_WEBHOOK_SECRET` | ABSENT | ADD `whsec_…` | backend | YES | NEW |
| `SUPABASE_URL` | present | keep | backend | NO | KEEP |
| `SUPABASE_SECRET_KEY` | present | keep (rotate at Phase 12 optional) | backend | YES | KEEP |
| `CORS_ORIGINS` | present | keep + verify prod origins | backend | NO | KEEP |
| `VITE_AUTH_PROVIDER` | ABSENT | ADD `supabase`→`workos` flip control | frontend host | NO | NEW (staged rollout lever) |
| `VITE_API_BASE_URL` | present | keep | frontend host | NO | KEEP |
| `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` | present | keep (sync plane) | frontend host | NO (public by design) | KEEP |
| `VITE_WORKOS_CLIENT_ID` | present (unused by code) | REMOVE | frontend | NO | DELETE (backend-proxy design needs no client id in browser) |

No secret ever enters git; `.env*` remains ignored; examples updated only with
placeholder names.

---

## 17. Implementation Phases

Order is mandatory; each phase has an explicit gate.

| # | Phase | Files to modify/create (expected) | DB | Dashboards/env | Tests (gate) | Rollback |
|---|---|---|---|---|---|---|
| 1 | Architecture sign-off | this doc + runbook reviewed | — | — | owner approval | n/a |
| 2 | Identity mapping | `supabase/migrations/202608230001_*.sql`,`...0002_*.sql`,`...0004_*.sql`; `backend/scripts/import-users-to-workos.ts`(NEW read-only export + importer); duplicate-review view | 0001/0002/0004 | WorkOS staging env created | SQL verification queries; importer dry-run report; typecheck/build | drop additive objects |
| 3 | WorkOS dashboard config | — | — | §12 checklist both envs | sample login in staging hosted UI | delete staging config |
| 4 | Supabase compatibility | — | — | Third-party Auth integration + JWT template | `select auth.jwt()` probe through real token; silent-empty check | remove integration |
| 5 | Backend adapter | NEW `middleware/requireAuthAny.ts`; EDIT `index.ts` mount; EDIT `routes/auth.ts` (revive callback/token/logout endpoints, rename cookie `capflux_session`); EDIT `SessionService.ts` (current SDK shapes); NEW `routes/workosWebhook.ts`; keep `requireAuthSupabase` intact | — | env additions | unit: middleware dual-path, spoof negatives, webhook signature; regression: full `npm test` | flag off → Supabase-only |
| 6 | Frontend AuthKit | NEW `shared/auth/AuthKitAuthProvider.ts` (implements AuthProvider); EDIT `AuthService` factory (env-flagged); EDIT api client interceptor (bearer strategy switch); EDIT `lib/supabase.ts` (`accessToken` async option when workos mode); AuthView hosted-UI redirect wiring; keep all other UI | — | `VITE_AUTH_PROVIDER` | vitest: provider contract tests, RouteGuard, LoginForm/RegisterForm specs adapted; targeted suites green | flip flag back |
| 7 | Existing-account migration | runbook procedures; REVIEW queue adjudication tooling (admin script) | 0004 updates | WorkOS import executed (staging→prod) | scenario matrix A–L scripted checks on staging copy | links table rows deleted = pre-import state; native auth still on |
| 8 | Authorization/RLS verification | migration `...0003_rls_policies_rewrite.sql` applied | 0003 | — | per-role row-count parity probes before/after; isolation suite (`schoolIsolation`, `financial-authz`) | embedded prior DDL |
| 9 | Testing (full) | see §18 | — | — | backend `npm test` + `typecheck(+tests)`; frontend targeted vitest; `compliance:audit` | — |
| 10 | Staging deployment | deploy configs (§14–15) | staging DB | all env vars | end-to-end smoke incl. offline sync + payments sandbox | redeploy previous image/config |
| 11 | Production migration | staged rollout: internal → pilot school → all; monitor auth error rates, sync queue depth | prod DB additive | flags flipped | live acceptance checklist (runbook) | flag flips; Supabase auth untouched |
| 12 | Legacy-auth retirement | remove Supabase login UI; disable Supabase providers; retire legacy endpoints (`claim-account` etc.); archive `legacy_identity_migrations` (0005) | optional 0005 | dashboards | regression suite re-run | re-enable providers (data intact) |

---

## 18. Testing Strategy

### Authentication
- signup / login / logout / session restoration / expired session /
  invalid session / password reset / email verification / OAuth — covered twice:
  (a) provider-contract vitest specs mirroring existing
  `SupabaseAuthProvider.spec.ts` against the new AuthKit provider;
  (b) backend node:test for `/api/auth/callback`, `/api/auth/access-token`,
  logout revocation, webhook events.

### Existing users (the non-negotiables)
- pre-imported user signs in with SAME password → same UUID;
- profile/membership/role/permissions/financial visibility byte-equal
  before-vs-after fixtures (snapshot `school_members`, `user_profiles`,
  permission resolution output);
- multi-school + multi-role users unaffected.

### Security
- duplicate email collision paths; takeover attempts (early-claim, JIT abuse);
  cross-school access probes (extend `schoolIsolation.test.js`);
  role escalation attempts; forged/foreign-issuer tokens; unknown WorkOS sub
  (shim NULL); stale/REVOKED link; suspended user; webhook spoof signatures;
  x-user-id/x-school-id negatives stay green.

### Financial integrity (must be untouched)
- ledger append-only + idempotency suites unchanged and green;
- payment state machine tests (clients cannot set SUCCESS) unchanged;
- settlement/reconciliation regressions unchanged;
- audit_logs actor continuity test (pre-migration actor id == post-migration
  actor id on a migrated admin performing a reversal in staging).

Commands (repo conventions): backend `cd backend && npm test &&
npm run typecheck && npm run typecheck:tests && npm run compliance:audit &&
npm run build`; frontend targeted
`npx vitest run src/shared/__tests__ <changed spec paths>` with
`NODE_ENV=test`.

---

## 19. Rollback Strategy

Principles: additive-only DB objects; flags over deletes; auth.users and all
business data are sacred.

| Layer | Rollback action | Data impact |
|---|---|---|
| Frontend | `VITE_AUTH_PROVIDER=supabase` + redeploy | none |
| Backend | unset/disable WorkOS routes via flag; `requireAuthSupabase` remains mounted throughout window | none |
| Identity mapping | stop reading links (middleware flag); optionally mark rows REVOKED | reversible |
| RLS | apply embedded prior-policy DDL from 0003 header | policies restored verbatim |
| WorkOS side | disable AuthKit app/signups; sessions die naturally | WorkOS users retained (free tier) |
| Supabase side | nothing was disabled yet during window ⇒ zero action | none |
| Worst case | revert deploys to pre-migration images; DB objects remain harmlessly unused | none |

No rollback step ever deletes `auth.users`, `public.users`, memberships, or
any financial record.

---

## 20. Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | ~95-policy rewrite introduces subtle drift | HIGH | mechanical sed-like transformation + automated row-count parity probes per role + isolation suites |
| R2 | Silent-empty RLS failures (missing `role:authenticated` claim) look like bugs not security errors | HIGH | JWT template verified BEFORE any policy swap; startup probe endpoint asserts authenticated claim |
| R3 | Password-hash port fails for some users (format edge cases) | MED | sample verification pre-cutover; fallback lane E (reset emails) ready |
| R4 | Duplicate historical emails freeze legitimate users | MED | detection first; REVIEW SLA; native access preserved during window |
| R5 | Offline sync plane breaks mid-window (token plumbing) | HIGH | supabase-js `accessToken` integration behind flag; offline regression suite; canary school |
| R6 | WorkOS outage = total lockout (single IdP) | MED | accept (same as Supabase today); status page + session longevity (30d) softens |
| R7 | Legacy dormant code resurrected with stale SDK assumptions | MED | update SessionService/WorkOSAuthService against current SDK types; typecheck gate |
| R8 | Compliance drift (AUTH controls) | MED | rerun `compliance:audit`; update `compliance-status.json` evidence pointers in implementation PRs |
| R9 | Third-party MAU cost | LOW | quantify at current user counts; $0.00325/MAU beyond quota |
| R10 | Realtime channels + third-party JWT edge cases | MED | dedicated realtime smoke test in staging before cutover |

Unresolved technical risks escalated: none blocking planning; R2 is the most
likely production incident if checklist order is violated.

---

## 21. OWNER DECISIONS REQUIRED

🔴 **OWNER DECISION REQUIRED — D1 Password-hash porting.** Export
`auth.users.encrypted_password` (bcrypt) via service-role script to seed
WorkOS users so existing users keep passwords. Alternative: forced reset
emails (lane E) for everyone. Security posture of handling hashes: script runs
server-side, never logs/stores hashes beyond the transient API call.

🔴 **OWNER DECISION REQUIRED — D2 Target architecture ratification.** Approve
"WorkOS AuthKit + Supabase third-party auth + link-table shim" (§7). The
rejected alternative (make backend exclusive proxy, kill browser↔Supabase)
would require rewriting the entire offline/realtime plane — high risk, deferred
unless owner prefers it.

🔴 **OWNER DECISION REQUIRED — D3 JIT-linking policy.** For accounts missed by
import: auto-link when WorkOS email is verified AND exactly one confirmed
CAPFLUX user matches? Proposed default: allowed for ordinary users; DISABLED
for holders of financial/KYC/staff permissions unless explicitly approved;
everything else → REVIEW queue.

🔴 **OWNER DECISION REQUIRED — D4 OAuth provider set.** Which providers in
AuthKit? Current product supports Google only. Proposal: Google only at
cutover.

🔴 **OWNER DECISION REQUIRED — D5 Dual-window length.** Proposal: 4 weeks
between cutover and Supabase-provider disablement.

🔴 **OWNER DECISION REQUIRED — D6 Custom auth domain** (`auth.capflux.*`):
purchase/configure now (recommended; stabilizes issuer) or proceed with
default WorkOS domain?

🔴 **OWNER DECISION REQUIRED — D7 Duplicate-email adjudication authority.**
Who resolves REVIEW entries and how are affected users contacted?

🔴 **OWNER DECISION REQUIRED — D8 Retire vs archive `legacy_identity_migrations`.**
Proposal: revoke writes now (0005), drop much later.

🔴 **OWNER DECISION REQUIRED — D9 MFA rollout timing** (AUTH-008): enforce MFA
for OWNER/SUPER_ADMIN at cutover or defer? AuthKit lowers cost substantially.

🔴 **OWNER DECISION REQUIRED — D10 Budget confirmations:** WorkOS pricing tier
(free ≤1M MU), Supabase third-party MAU billing acknowledgment.

*(Decisions D1/D2 block Phases 2–4; D3 blocks Phase 7; others block their
respective phases.)*

## 22. Final Recommendation

Proceed with the bridge architecture (§7) using Option D+E (§9), gated on
D1/D2 sign-off, executed strictly in the §17 phase order with the §18 gates.
The design preserves every existing account, every UUID reference, every RLS
guarantee (upgrading fail-closed behavior), and every financial invariant —
while moving the authentication surface to AuthKit with a one-flag rollback at
every stage. Do not begin implementation until §21 decisions are recorded.

---

## Appendix A — Final Repository Scan (post-audit inventory)

### Authentication files
| Layer | Active | Legacy/preserved |
|---|---|---|
| Frontend provider | `frontend/src/shared/auth/SupabaseAuthProvider.ts`, `AuthProvider.ts`, `AuthService.ts`, `AuthError.ts`, `types.ts` | `AuthKitProvider.ts` |
| Frontend glue | `stores/authStore.ts`, `shared/rbac/RouteGuard.ts`, `features/auth/**` (6 components + tests), `lib/supabase.ts`, `shared/services/api/client.ts` | `authStore` comments referencing workos_session |
| Backend middleware | `middleware/requireAuthSupabase.ts`, `staffAuth.ts`, `requirePaymentReady.ts`, `requireProviderReady.ts` | `requireAuth.ts` |
| Backend services | `AuthorizationService.ts` | `WorkOSAuthService.ts`, `SessionService.ts` |
| Backend routes | all domain routers (`context`,`onboarding`,`kyc`,`payments`,`payment-accounts`,`dva`,`operations`,`admin`,`financial-admin`,`webhook`) | `routes/auth.ts` |
| DB | migrations 027/028/030 (active identity+RLS), triggers 027 | migration 021, 026 artifacts |

### WorkOS references (grep-verified)
Backend: `SessionService.ts:22` cookie name; `WorkOSAuthService.ts` (env reads
95–110, AuthKit URL 336–354); `routes/auth.ts` (full legacy surface incl.
claim-account 305–423); `storage.ts:94,117` secret fallback chain includes
`WORKOS_COOKIE_PASSWORD` → flagged COMP-033; `package.json`
`@workos-inc/node ^10.9.0`. Frontend: `AuthKitProvider.ts`;
`.env.example` `VITE_WORKOS_CLIENT_ID`. Docs: `docs/providers/workos-authkit.md`,
`docs/auth-migration-audit.md` (+ a committed credential *lookalike* at
line ~250 tracked COMP-001 P0), PROJECT_STATUS §WorkOS. Supabase dir:
migration 021/026 only. **No deployment configs reference WorkOS (none exist).**

### Supabase auth references
`lib/supabase.ts` (single client), `SupabaseAuthProvider.ts` (all flows),
api client interceptor, backend `supabaseClient.ts` (service role),
`requireAuthSupabase`, provisioning/delete triggers (027), 95× `auth.uid()`
in SQL.

### RLS dependencies
All membership/self policies + admin-status audit trigger (§6). Sync-plane
tables touched from browser: `payment_transactions`, `settlement_records`,
`payment_accounts`, ledger realtime, guardian RPC, generic entity CRUD via
sync queue.

### Environment variables
backend `.env.example`: WORKOS×6, SUPABASE×2, server/CORS/cookies/rate,
payments (mode + Monnify + Paystack), KYC key, verification providers.
frontend `.env.example`: VITE_WORKOS_CLIENT_ID (unused), SUPABASE×2,
VITE_API_BASE_URL. Missing-but-referenced-in-code: `CAPFLUX_STORAGE_SIGNING_SECRET`
(pre-existing COMP-033 debt, out of scope but adjacent).

### Account-identity references
`public.users` ⇄ `auth.users` triggers; 18 UUID user-reference columns;
`legacy_identity_migrations`; localStorage `capflux_auth_ui_hint`.

### Security-sensitive routes (unchanged by design)
`/api/webhook/*` (HMAC fail-closed), `/rpc` allowlist proxy, financial-admin +
staff KYC review chains, payment readiness gates.

### Unresolved migration risks carried forward
1. R1–R10 above (esp. R2 ordering).
2. Pre-existing compliance gaps that intersect this work: AUTH-003 (legacy
   surface enumeration note — improves post-retirement), AUTH-005 session
   revocation PARTIAL → WorkOS revocation improves it, AUTH-007 invitation
   binding FAIL (COMP-003) — untouched here, must not regress,
   AUTH-010 frontend credential storage — IMPROVES (tokens leave localStorage),
   COMP-001 lookalike secret in docs — recommend purge in implementation phase.
3. `send-notification` Edge Function auth assumptions unaudited for
   third-party tokens (verify before relying on it post-cutover).



