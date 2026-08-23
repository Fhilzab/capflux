# CAPFLUX Authentication & Authorization Audit

**Audit date:** 2026-08-23.

## 1. Architecture (verified)

- **Active auth**: Supabase Auth. Frontend obtains JWTs directly from Supabase; backend validates each request's Bearer token via `supabase.auth.getUser(token)` and resolves the CAPFLUX user from `public.users` (middleware/requireAuthSupabase.ts:27–74). Identity is never taken from body/legacy headers.
- **Legacy auth**: WorkOS AuthKit routes remain under `/api/auth/*` for rollback; AGENTS.md forbids building on them. `environment.md` overstates WorkOS — trust code + PROJECT_STATUS.md.

## 2. Findings

| ID | Area | Finding | Status |
|---|---|---|---|
| AUTH-001 | Token validation | Every protected route passes through requireAuthSupabase; invalid/expired → 401. Verified across route table. | PASS |
| AUTH-002 | Trusted identity | req.user built solely from verified JWT→users row; requirePaymentReady actively rejects client-supplied school mismatch (403 "Cross-school access"). | PASS |
| AUTH-003 | Enumeration (active paths) | Legacy signup maps `user_already_exists` → 409 USER_ALREADY_EXISTS; resend-verification returns 404 "User not found." — both are enumeration oracles, though the surface is legacy WorkOS paths not called by the current frontend. claim-account endpoint deliberately generic (good). | PARTIAL (legacy) / monitor when Supabase-native flows replace them |
| AUTH-004 | Rate limiting | Hand-rolled in-memory Map: global 100/min/IP, /api/auth 20/min. Weaknesses: per-process (lost on restart), no `trust proxy` ⇒ behind Render proxy all clients may share one socket IP (both over- and under-blocking). | PARTIAL — COMP-016 |
| AUTH-005 | Session revocation | Supabase path: no backend logout/revoke endpoint; sign-out is client-side `supabase.auth.signOut()`; access tokens live until expiry. WorkOS legacy path does revoke sessions server-side. | PARTIAL — COMP-023 |
| AUTH-006 | Privileged operations | admin.ts owner/admin invite/suspend/reactivate/remove/transfer-ownership all validate params.schoolId against caller membership AND target membership; updates scoped by id+schoolId; transfer requires target be active ADMIN of that school. DB-side SECURITY DEFINER RPCs exist as backstop. | PASS |
| AUTH-007 | Invitation acceptance | P0 FAIL — see TENANT-005/COMP-003 (no invited-email binding; OWNER grant). | FAIL |
| AUTH-008 | MFA | Not implemented anywhere (PROJECT_STATUS ⏳). | NOT_IMPLEMENTED |
| AUTH-009 | Password policy | Supabase config min length 6 vs documented policy 12 (PROJECT_STATUS.md:872). | PARTIAL |
| AUTH-010 | Token storage frontend | persistSession:true stores access+refresh JWTs in localStorage (standard SPA trade-off, XSS-exposed); stale code comment claims otherwise (authStore.ts:13–17 vs lib/supabase.ts:28–32). KYC drafts in localStorage are worse (SEC-006). | PARTIAL |
| AUTH-011 | Service-to-service | Single service-role client; no service accounts beyond env keys; webhook auth = HMAC + optional IP allowlist. | PARTIAL (see WEBHOOK_SECURITY.md) |
| AUTH-012 | staffAuth semantics | requireStaff(permissionCode) ignores its permission argument and effectively passes only SUPER_ADMIN today; permission codes documented but unenforced at middleware layer. | PARTIAL — COMP-024 |

## 3. Regression-test coverage

Existing: auth-security.test.ts, auth.test.ts, requireAuthSupabase.test.js, financial-authz.test.js, schoolIsolation.test.js, claim-account-audit.test.js.

Required when COMP-002/COMP-003 land (owner-approved):
1. Member of school A requesting `/api/onboarding/schools/B/state` → 403.
2. Invitation accept with non-matching account email → 403 and NO school_members row.
3. Invite-reuse response contains no `tokenHash` field (test exists implicitly once fix lands).

Tests were **not** pre-added in this audit because they would fail against current behaviour; adding failing tests violates the verification gate (no new regressions).
