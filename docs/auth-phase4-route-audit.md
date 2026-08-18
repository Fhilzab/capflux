# Phase 4 Route Audit

## Route-by-Route Authentication Classification

This document records every Express route and its authentication/authorization
requirement after the Phase 4 migration (Supabase Auth integration).

### Middleware

| Middleware | File | Auth Mechanism | Status |
|---|---|---|---|
| `requireAuth` | `middleware/requireAuth.js` | WorkOS sealed session cookie (`workos_session`) | **Preserved — legacy/rollback only** |
| `requireAuthSupabase` | `middleware/requireAuthSupabase.js` | Supabase JWT via `Authorization: Bearer <token>` | **Active on all domain routes** |
| `requireStaff` | `middleware/staffAuth.js` | `req.user.id` → `is_super_admin()` RPC | Unchanged |
| `requirePaymentReady` | `middleware/paymentReady.js` | Payment gateway config check | Unchanged |
| `authRateLimit` | `index.js` | Rate limiter for `/api/auth/*` | Unchanged |
| `rateLimit` | `index.js` | General rate limit (100 req/5min) | Unchanged |

### Route Inventory

#### Authentication Routes (`/api/auth/*`) — WorkOS (Legacy/Rollback)

| Method | Path | Middleware | Purpose |
|---|---|---|---|
| GET | `/api/auth/authkit-url` | none | Returns WorkOS AuthKit URL (legacy) |
| GET | `/api/auth/callback` | none | WorkOS OAuth callback (legacy) |
| POST | `/api/auth/signin` | none | WorkOS email/password signin (legacy) |
| POST | `/api/auth/signup` | none | WorkOS email signup (legacy) |
| POST | `/api/auth/google` | none | WorkOS Google OAuth (legacy) |
| POST | `/api/auth/signout` | `requireAuth` (WorkOS) | WorkOS session revocation (legacy) |
| POST | `/api/auth/refresh` | none | WorkOS token refresh (legacy) |
| POST | `/api/auth/forgot-password` | none | WorkOS password reset (legacy) |
| POST | `/api/auth/reset-password` | none | WorkOS password update (legacy) |
| POST | `/api/auth/resend-verification` | none | WorkOS email verification (legacy) |
| POST | `/api/auth/claim-account` | none | Legacy WorkOS→Supabase migration |
| GET | `/api/auth/session` | `requireAuth` (WorkOS) | Returns session + roles + org (legacy) |
| GET | `/api/auth/me` | `requireAuth` (WorkOS) | Returns user identity (legacy) |

**Status**: Preserved intact. The frontend no longer calls these endpoints
authentication is handled by `SupabaseAuthProvider` directly against Supabase Auth.
These remain available for WorkOS rollback.

#### Context Routes (`/api/context/*`) — Supabase

| Method | Path | Middleware | `req.user` Usage |
|---|---|---|---|
| GET | `/api/context/me` | `requireAuthSupabase` | Returns `req.user` + profile |
| GET | `/api/context/org` | `requireAuthSupabase` | `req.user.id` → school/organization context |
| GET | `/api/context/rbac` | `requireAuthSupabase` | `req.user.id` → roles/permissions |

#### Onboarding Routes (`/api/onboarding/*`) — Supabase

| Method | Path | Middleware | `req.user` Usage |
|---|---|---|---|
| POST | `/api/onboarding/complete` | `requireAuthSupabase` | `req.user.id` → `complete_onboarding` RPC |
| GET | `/api/onboarding/status` | `requireAuthSupabase` | `req.user.id` → `get_onboarding_status` RPC |

#### KYC Routes (`/api/kyc/*`) — Supabase

| Method | Path | Middleware | `req.user` Usage |
|---|---|---|---|
| GET | `/api/kyc/status` | `requireAuthSupabase` | `req.user.id` → school membership |
| GET | `/api/kyc/pending` | `requireAuthSupabase` + `requireStaff` | `req.user.id` → `is_super_admin()` |
| GET | `/api/kyc/:schoolId` | `requireAuthSupabase` | `req.user.id` → `getSchoolMembership` |
| POST | `/api/kyc/:schoolId/submit` | `requireAuthSupabase` | `req.user.id` → `getCallerSchool` |
| POST | `/api/kyc/:schoolId/approve` | `requireAuthSupabase` + `requireStaff` | `req.user.id` |

#### Admin Routes (`/api/admin/*`) — Supabase

| Method | Path | Middleware | `req.user` Usage |
|---|---|---|---|
| GET | `/api/admin/schools` | `requireAuthSupabase` + `requireStaff` | `req.user.id` |
| GET | `/api/admin/schools/:id` | `requireAuthSupabase` + `requireStaff` | `req.user.id` |
| GET | `/api/admin/users` | `requireAuthSupabase` + `requireStaff` | `req.user.id` |
| GET | `/api/admin/roles` | `requireAuthSupabase` + `requireStaff` | `req.user.id` |

#### Payments Routes (`/api/payments/*`) — Supabase

| Method | Path | Middleware | `req.user` Usage |
|---|---|---|---|
| GET | `/api/payments/school/:schoolId` | `requireAuthSupabase` | `req.user.id` → `getCallerSchool` |
| POST | `/api/payments/record` | `requireAuthSupabase` + `requirePaymentReady` | `req.user.id` |

#### DVA Routes (`/api/dva/*`) — Supabase

| Method | Path | Middleware | `req.user` Usage |
|---|---|---|---|
| GET | `/api/dva/:schoolId` | `requireAuthSupabase` | `req.user.id` → `getCallerSchool` |
| POST | `/api/dva/:schoolId/generate` | `requireAuthSupabase` | `req.user.id` → `getCallerSchool` |

#### Payment Accounts Routes (`/api/payment-accounts/*`) — Supabase

| Method | Path | Middleware | `req.user` Usage |
|---|---|---|---|
| GET | `/api/payment-accounts/:schoolId` | `requireAuthSupabase` | `req.user.id` → `getCallerSchool` |
| POST | `/api/payment-accounts/:schoolId` | `requireAuthSupabase` + `requirePaymentReady` | `req.user.id` |
| PUT | `/api/payment-accounts/:id` | `requireAuthSupabase` | `req.user.id` |

#### Financial Operations Routes (`/api/operations/*`) — Supabase

| Method | Path | Middleware | `req.user` Usage |
|---|---|---|---|
| GET | `/api/operations/:schoolId` | `requireAuthSupabase` | `req.user.id` → `getCallerSchool` |
| POST | `/api/operations/:schoolId` | `requireAuthSupabase` | `req.user.id` → `getCallerSchool` |

#### Financial Admin Routes (`/api/admin/*` — financial) — Supabase

| Method | Path | Middleware | `req.user` Usage |
|---|---|---|---|
| GET | `/api/admin/settlements/:schoolId` | `requireAuthSupabase` + `requireStaff` | `req.user.id` → `is_super_admin()` |
| POST | `/api/admin/settlements/:id/approve` | `requireAuthSupabase` + `requireStaff` | `req.user.id` → `is_super_admin()` |

#### Provider Status Routes (`/api/providers/*`) — Public

| Method | Path | Middleware |
|---|---|---|
| GET | `/api/providers/status` | none |

#### RPC (`/rpc`) — Supabase

| Method | Path | Middleware | `req.user` Usage |
|---|---|---|---|
| POST | `/rpc` | `requireAuthSupabase` | `req.user.id` → caller ID, school scope enforcement |

#### Log Error (`/api/log-error`) — Public

| Method | Path | Middleware |
|---|---|---|
| POST | `/api/log-error` | none |

#### Webhook (`/api/webhook/*`) — Public

| Method | Path | Middleware |
|---|---|---|
| POST | `/api/webhook/supabase` | none (signature verification) |
| POST | `/api/webhook/stripe` | none (signature verification) |

### `req.user` Normalization

**`requireAuthSupabase`** sets:
- `req.user` — CAPFLUX application user from `public.users` (UUID id, email, auth_provider, email_verified)
- `req.supabaseUser` — raw Supabase auth.user object
- `req.token` — validated access token (for potential backend-to-Supabase calls)

**All domain routes** use only `req.user.id` (UUID). No route relies on:
- `req.sessionId` (WorkOS-specific — only used in `/api/auth/session`)
- `req.organizationId` (WorkOS-specific — only used in `/api/auth/session`)
- `req.roles` (WorkOS-specific — only used in `/api/auth/session`)
- `req.authenticationMethod` (WorkOS-specific)

**`requireStaff`** (staffAuth.js) uses `req.user?.id` — compatible with both auth backends.

### Security Review

- No domain route accepts `x-user-id` header for identity
- No domain route accepts `x-school-id` header for authorization
- No domain route reads user ID from request body or query string
- `/rpc` explicitly uses `req.user.id` and enforces cross-school isolation (line 230: `if safeParams.p_school_id && safeParams.p_school_id !== member.school_id → 403`)
- All domain route files have their own `getCallerSchool(userId)` that resolves school membership from `school_members` table