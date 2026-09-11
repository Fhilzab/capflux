# CAPFLUX Authentication Sandbox Verification Report

## 1. Executive Summary

**Phase 3 Status: NOT READY FOR PRODUCTION DEPLOYMENT**

The Phase 2 WorkOS AuthKit migration source code is complete and tested (259 backend + 86 frontend tests pass, typecheck passes, builds pass). However, **sandbox verification cannot be completed** due to missing sandbox environment configuration and the inability to deploy and test the end-to-end authentication flow.

**Sandbox verification is BLOCKED** until:
1. Sandbox Supabase service role key is configured
2. Sandbox WorkOS AuthKit credentials and redirect URIs are configured
3. Sandbox backend and frontend are deployed
4. End-to-end authentication tests can be executed

## 2. Environment

- **Git branch**: main (bf5e2fe)
- **Sandbox frontend**: Not deployed (blocked on configuration)
- **Sandbox backend**: Not deployed (blocked on configuration)
- **Sandbox Supabase project**: `capflux-sandbox` (ref: `jwvwetwlexvgbtzamxvb`) — **ACCESSIBLE** (returns 401, not paused)
- **Production Supabase project**: `Capflux` (ref: `ootrovtrpoztmooiirxo`) — **ACCESSIBLE** (returns 401, not paused)
- **WorkOS environment**: Cannot verify (requires sandbox configuration)
- **WorkOS AuthKit configuration**: Cannot verify (requires sandbox redirect URIs)
- **Local Supabase CLI**: Cannot link due to CLI v2.112.0 bug (schema validation error on `inserted_at` field)

## 3. Phase 2 Verification

### Source Code Verification ✅ VERIFIED FROM CODE

**Backend Components (New):**
- `middleware/requireAuthWorkOS.ts` — WorkOS JWT validation via JWKS
- `middleware/requireAuthHybrid.ts` — Hybrid auth (Bearer token + cookie fallback) with revocation cache
- `services/WorkOSIdentityService.ts` — Centralized WorkOS→CAPFLUX resolution

**Backend Components (Modified):**
- `middleware/requireAuthHybrid.ts` — Session revocation cache + REVOKED blocking
- `services/WorkOSWebhookService.ts` — `session.revoked` → revocation cache
- `routes/auth.ts` — Uses `requireAuthHybrid` for `/session`, `/me`, `/signout`
- `types/http.ts` — Added `workosUserId`, `capfluxUserId` to Express Request

**Frontend Components (New):**
- `shared/auth/tokenStore.ts` — In-memory token storage

**Frontend Components (Modified):**
- `shared/auth/AuthService.ts` — WorkOS primary, Supabase fallback
- `shared/auth/AuthKitProvider.ts` — JWT Bearer flow, in-memory tokens, auto-refresh
- `shared/services/api/client.ts` — WorkOS token priority, Supabase fallback
- `frontend/.env.example` — Added `VITE_AUTH_PROVIDER=workos`

**Database Migrations:** No new migrations needed. All identity infrastructure already exists:
- `public.user_identity_links` — Identity bridge with proper constraints
- `public.provision_workos_user()` — Atomic provisioning RPC with advisory lock
- `public.requesting_user_id()` — Fail-closed JWT→CAPFLUX resolver
- `public.workos_webhook_events` — Durable webhook idempotency

### Architecture Verification ✅ VERIFIED FROM CODE

```
WorkOS JWT (sub: user_...)
  → WorkOS JWKS validation
  → WorkOSIdentityService → user_identity_links (ACTIVE only)
  → CAPFLUX UUID (canonical)
  → Authorization/RLS
```

**Confirmed: NO email fallback, NO WorkOS ID in UUID columns, REVOKED blocking enforced, advisory lock for atomicity**

## 4. Authentication Architecture

| Route | Auth Method | Status |
|-------|-------------|--------|
| `/api/auth/session` | `requireAuthHybrid` | ✅ Hybrid (Bearer + cookie) |
| `/api/auth/me` | `requireAuthHybrid` | ✅ Hybrid |
| `/api/auth/signout` | `requireAuthHybrid` | ✅ Hybrid |
| `/api/auth/*` (legacy) | `requireAuth` | ⚠️ Legacy cookie-only |
| `/api/context/*` | `requireAuthSupabase` | ⚠️ Supabase Auth fallback |
| `/api/admin/*` | `requireAuthSupabase` | ⚠️ Supabase Auth fallback |
| `/api/dva`, `/api/payment-accounts`, `/api/payments` | `requireAuthSupabase` | ⚠️ Supabase Auth fallback |
| `/api/kyc`, `/api/onboarding`, `/api/financial-*` | `requireAuthSupabase` | ⚠️ Supabase Auth fallback |
| `/api/webhooks/workos` | Signature verification | ✅ Webhook signature |
| `/rpc` | `requireAuthSupabase` | ⚠️ Supabase Auth fallback |

**Current Active Authority**: Supabase Auth (production) via `requireAuthSupabase`  
**Migration Target**: WorkOS AuthKit via `requireAuthHybrid` (Bearer token primary)

## 5. Identity Bridge Verification

### Verified Invariants (Static Analysis) ✅

| Property | Status | Evidence |
|----------|--------|----------|
| `workos_user_id` TEXT | ✅ | Migration 202608230002: `workos_user_id text NOT NULL CHECK (...)` |
| `capflux_user_id` UUID | ✅ | Migration 202608230002: `capflux_user_id uuid NOT NULL REFERENCES public.users(id)` |
| FK to public.users | ✅ | `ON DELETE CASCADE` |
| Unique (workos_user_id, identity_type) | ✅ | `uq_uil_workos_per_type` |
| Unique (capflux_user_id, identity_type) | ✅ | `uq_uil_capflux_per_type` |
| CHECK distinct IDs | ✅ | `capflux_user_id::text <> workos_user_id` |
| RLS enabled | ✅ | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` |
| No client policies | ✅ | `REVOKE ALL FROM anon, authenticated` |
| Service role access | ✅ | Default grants retained |

### Atomic Provisioning RPC ✅ VERIFIED FROM CODE

| Property | Status | Evidence |
|----------|--------|----------|
| `SECURITY DEFINER` | ✅ | Migration 202608280002: `SECURITY DEFINER SET search_path = 'public'` |
| Advisory lock | ✅ | `pg_advisory_xact_lock(v_lock_key)` deterministic key |
| ACTIVE re-check | ✅ | `SELECT ... WHERE status = 'ACTIVE' FOR SHARE` |
| REVOKED blocking | ✅ | `IF EXISTS ... status = 'REVOKED' THEN RAISE EXCEPTION` |
| Transaction atomicity | ✅ | All INSERTs in single PL/pgSQL block with EXCEPTION handler |
| Identity link after users | ✅ | Users/profiles created first, then identity link |
| Unique violation handling | ✅ | Catches `unique_violation`, re-checks ACTIVE link |
| Service-role only execute | ✅ | `REVOKE ALL FROM PUBLIC, anon, authenticated; GRANT TO service_role` |

## 6. WorkOS Login Test

**STATUS: CANNOT TEST — Sandbox environment not configured**

Cannot perform end-to-end login test until sandbox Supabase credentials, WorkOS credentials, and redirect URIs are configured and sandbox backend/frontend deployed.

**Expected Flow (Verified from Code):**
```
Browser
  ↓
WorkOS AuthKit hosted UI
  ↓
OAuth callback / email-password
  ↓
WorkOS access token (JWT)
  ↓
Authorization: Bearer <WorkOS access token>
  ↓
CAPFLUX backend requireAuthHybrid
  ↓
WorkOS JWKS validation → sub claim (user_...)
  ↓
WorkOSIdentityService → user_identity_links (ACTIVE only)
  ↓
CAPFLUX UUID (canonical)
  ↓
Authorization/RLS
```

## 7. JWT Validation Tests

**STATUS: CANNOT TEST — Requires deployed sandbox**

**Verified from Code:**
- JWKS validation via `createRemoteJWKSet` (https://api.workos.com/sso/jwks)
- Issuer verification: `https://api.workos.com`
- Audience verification: `WORKOS_CLIENT_ID`
- Expiration check (`exp` claim)
- `sub` claim format validation: `^user_[0-9A-Za-z]{10,}$`
- `sid` claim checked against revocation cache

## 8. Hybrid Authentication Tests

**Verified from Code:**

| Scenario | Expected Behavior |
|----------|------------------|
| Valid WorkOS Bearer token | ✅ WorkOS JWT authentication |
| Valid Bearer token + revoked `sid` | ❌ Rejected (revocation cache) |
| Valid Bearer token + REVOKED identity link | ❌ Rejected (401) |
| Valid Bearer token + NOT_FOUND identity | ❌ Rejected (401, IDENTITY_NOT_PROVISIONED) |
| No Bearer + valid legacy cookie | ✅ Legacy cookie fallback |
| Invalid Bearer + valid cookie | ❌ Must NOT downgrade (security-critical) |

**Security-Critical Behavior Confirmed:** `requireAuthHybrid` tries Bearer token FIRST, only falls back to cookie if Bearer is absent/invalid. Does NOT silently downgrade on invalid Bearer.

## 9. Session / Logout Tests

**Verified from Code:**

| Endpoint | Auth | Behavior |
|----------|------|----------|
| `GET /api/auth/session` | `requireAuthHybrid` | Returns safe session payload |
| `GET /api/auth/me` | `requireAuthHybrid` | Returns user profile |
| `POST /api/auth/signout` | `requireAuthHybrid` | Revokes session + clears cookie |
| `POST /api/auth/refresh` | Legacy cookie | Refreshes WorkOS tokens |

**Frontend Token Storage:** In-memory only (`tokenStore.ts`), no localStorage/sessionStorage for tokens.

## 10. Session Revocation Test

**STATUS: CANNOT TEST — Requires deployed sandbox with live WorkOS**

### Current Implementation (Verified from Code)

| Event | Mechanism | Immediate? |
|-------|-----------|------------|
| `session.revoked` webhook | In-memory revocation cache (`sid` claim) | ✅ Immediate for new requests |
| `user.deleted` webhook | Mark identity link `REVOKED` | ✅ Immediate for new requests |
| Explicit signout | `revokeSession()` + clear cookie | Immediate |
| JWT expiry | Natural expiration | At expiry |

**Implementation:** In-memory revocation cache keyed by WorkOS session ID (`sid` claim). Checked on each Bearer token validation.

**SLA Classification: IMMEDIATE for new requests (cache-based), EXPIRY-BASED for in-flight requests**

**Current Gap:** No Redis/database-backed revocation — in-memory only (single instance). Documented in code comments.

## 11. Webhook Security

**Verified from Code:**
- `express.raw()` before JSON parsing (`index.ts:81`)
- Raw body preserved for signature verification
- `WorkOS-Signature` header read and validated
- `WORKOS_WEBHOOK_SECRET` used for verification
- SDK `constructEvent()` for signature verification
- Signature failure → 401
- Durable idempotency via `workos_webhook_events` table + `claim/complete/fail` RPCs
- Provider-neutral event ID constraint (no `evt_` prefix assumption)

## 12. Supabase Fallback Test

**Verified from Code:**
- Supabase Auth remains available as fallback
- `requireAuthSupabase` middleware active on `/api/context`, `/api/admin`, `/api/dva`, `/api/payments`, `/api/payment-accounts`, `/api/payments`
- `apiClient` interceptor: WorkOS token (primary) → Supabase token (fallback)
- `AuthService` factory: `VITE_AUTH_PROVIDER=workos` → WorkOS primary, Supabase fallback
- No automatic email-based linking — all mappings explicit

## 13. RLS / Authorization

### Current State

| Table | RLS | Classification |
|-------|-----|----------------|
| `public.user_identity_links` | ✅ Enabled, deny-by-default | ✅ Secure |
| `public.workos_webhook_events` | ✅ Enabled, deny-by-default | ✅ Secure |
| `public.users` | ✅ | ✅ |
| `public.user_profiles` | ✅ | ✅ |
| `settlement_accounts` | ❌ | P1 (COMP-009) |
| `settlement_account_verifications` | ❌ | P1 (COMP-009) |
| `kyc_verifications` | ❌ | P1 (COMP-009) |
| `gateway_assignments` | ❌ | P1 (COMP-009) |
| `reconciliation_runs` | ❌ | P1 (COMP-009) |
| `reconciliation_issues` | ❌ | P1 (COMP-009) |
| `legacy_identity_migrations` | ❌ | P1 (COMP-009) |

**COMP-009 Backlog:** 7 sensitive tables lack RLS (service-role-only protection). Not a migration regression.

## 14. Token Storage Test

**Verified from Code:**
- Frontend `tokenStore.ts`: In-memory only (module-level variables)
- No localStorage/sessionStorage for access/refresh tokens
- `AuthKitProvider` uses `tokenStore` for in-memory storage
- `signOut()` calls `clearMemoryTokens()`
- 401 interceptor triggers token refresh, clears on failure

## 15. SPA Routing Test

**Verified from Code:**
- `/auth` route with `mode` query param (login/signup/verify-email/forgot-password/reset-password)
- `/auth/callback` redirects to `/auth` with `code`/`state` query params
- `AuthView.vue` watches route query for OAuth callback
- Protected routes use `authorizeRoute` guard with `requiresAuth: true`
- Vercel SPA rewrite configured (`vercel.json` rewrites all routes to `index.html`)

## 16. Negative Security Tests

**Verified from Code (Security Tests Pass):**
- Missing Authorization header → 401
- Malformed Authorization header → 401
- Expired JWT → 401
- Wrong issuer → 401
- Invalid signature → 401
- Unknown WorkOS user → 401
- REVOKED identity link → 401
- Invalid webhook signature → 401
- Duplicate webhook event → Idempotent (200, alreadyProcessed)
- Email fallback → Never used (explicit NO in code)
- WorkOS ID in UUID column → Blocked by CHECK constraint + UUID regex

## 17. Regression Tests

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| Backend (all) | 259 | 259 | 0 |
| Frontend (shared + auth) | 86 | 86 | 0 |
| Frontend (auth unit tests) | 47 | 47 | 0 |
| Typecheck (backend) | — | PASS | 0 |
| Typecheck (frontend) | — | No script (build passes) |
| Build (backend + frontend) | — | PASS | 0 |

**No regressions detected.**

## 18. Compliance Audit

| Check | Result | Notes |
|-------|--------|-------|
| check-secrets | FAIL | Dev `WORKOS_COOKIE_PASSWORD` in docs (not production) |
| check-rls | PARTIAL | 7 tables without RLS (COMP-009 backlog) |
| check-sensitive-logging | PARTIAL | 1 variable-based log |
| check-payment-idempotency | PASS | 11/11 verified |
| check-webhook-security | PARTIAL | Known partials documented |
| check-auth | FAIL | Webhook route unauthenticated (by design, signature-verified) |
| check-cors | PASS | Allowlist + dev hatch |
| check-sensitive-fields | PARTIAL | Known issues documented |
| check-file-storage | PARTIAL | Known hardening notes |
| check-environment | PARTIAL | 1 missing env var documented |

**Summary:** Same pre-existing issues as Gate 1 report. No migration regressions.

## 19. Known Risks

| Risk | Severity | Status |
|------|----------|--------|
| Sandbox environment not configured | **BLOCKER** | Cannot deploy or verify end-to-end |
| Supabase CLI bug (v2.112.0) | High | Cannot verify remote migration state via CLI |
| Session revocation not immediate (in-flight) | Medium | Documented SLA: expiry-based for in-flight |
| 7 tables without RLS | Medium | COMP-009 backlog |
| Supabase Auth fallback complexity | Low | Documented rollback |
| In-memory revocation cache | Low | Single-instance only; needs Redis for scale |
| IP allowlist optional for webhooks | Low | COMP-025 |

## 20. Production Safety Verification

✅ No production database modified  
✅ No production migrations applied  
✅ No production deployment triggered  
✅ No production environment variables changed  
✅ No production WorkOS redirect configuration changed  
✅ No Supabase Auth removed (preserved for rollback)  

## 21. Final Decision

### PHASE 3 STATUS: FAIL (Sandbox Verification Blocked)

**Sandbox Verification Status:**
- Supabase: **NOT VERIFIED REMOTELY** (CLI bug, no service role key)
- Backend: **NOT DEPLOYED** (missing sandbox env vars)
- Frontend: **NOT DEPLOYED** (missing sandbox env vars)
- WorkOS: **NOT CONFIGURED** (requires sandbox redirect URIs)
- Identity bridge: **NOT VERIFIED REMOTELY** (schema unverified)
- JWT: **NOT TESTED END-TO-END**
- Revocation: **NOT TESTED END-TO-END**
- Webhooks: **NOT TESTED END-TO-END**
- RLS: **NOT VERIFIED REMOTELY**
- Fallback: **NOT TESTED END-TO-END**
- SPA routing: **NOT TESTED END-TO-END**

### Test Results:
- Backend: **259 PASS / 0 FAIL**
- Frontend: **86 PASS / 0 FAIL** (auth unit tests: 47 PASS)
- Typecheck: **PASS** (backend)
- Build: **PASS** (backend + frontend)
- Compliance: **Same as Gate 1 (no regressions)**

### Critical Findings:
1. **Sandbox environment not configured** — Missing sandbox Supabase service role key, WorkOS credentials, redirect URIs
2. **Supabase CLI bug** — Cannot verify remote migration state via CLI (v2.112.0 schema validation error)
3. **Cannot characterize session revocation SLA end-to-end** — Requires live test

### Production Deployment:
**BLOCKED** — Sandbox verification incomplete due to missing sandbox environment configuration.

---

### Required Actions to Unblock:
1. **Obtain sandbox Supabase credentials** (service role key, anon key, project URL)
2. **Configure sandbox WorkOS AuthKit** (client ID, API key, webhook secret, redirect URIs)
3. **Create sandbox backend `.env`** with:
   - `CAPFLUX_MODE=sandbox`
   - `CAPFLUX_DATABASE_ENV=sandbox`
   - `SUPABASE_URL=<sandbox-project-url>`
   - `SUPABASE_SECRET_KEY=<sandbox-service-role-key>`
   - `CORS_ORIGINS=https://<sandbox-frontend-domain>`
   - `PAYMENTS_PROVIDER_MODE=sandbox`
   - `IDENTITY_VERIFICATION_PROVIDER=mock`
   - `SETTLEMENT_VERIFICATION_PROVIDER=mock`
   - WorkOS sandbox credentials
4. **Create sandbox frontend `.env`** with:
   - `VITE_CAPFLUX_MODE=sandbox`
   - `VITE_CAPFLUX_DATABASE_ENV=sandbox`
   - `VITE_API_BASE_URL=https://<sandbox-render-app>.onrender.com/api`
   - `VITE_SUPABASE_URL=<sandbox-project-url>`
   - `VITE_SUPABASE_ANON_KEY=<sandbox-anon-key>`
   - `VITE_AUTH_PROVIDER=workos`
5. **Deploy sandbox backend** (Render) → **Deploy sandbox frontend** (Vercel)
6. **Configure WorkOS AuthKit sandbox redirect URIs** to match deployed frontend
7. **Run full end-to-end test suite**
8. **Document session revocation SLA**
9. Then and only then: proceed to production deployment

---

**Evidence Standard Applied:**
- VERIFIED FROM CODE: All middleware, services, providers traced
- VERIFIED FROM TESTS: 259 backend + 86 frontend tests pass
- VERIFIED FROM MIGRATIONS: All SQL valid, no new migrations needed
- NOT VERIFIED: Remote sandbox database state (CLI bug, no credentials)
- NOT VERIFIED: End-to-end authentication flow (no deployed sandbox)

**Security > Convenience. Identity Integrity > Email Matching. Financial Integrity > Authentication Convenience.**