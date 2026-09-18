# CAPFLUX Production Auth P0 Fix — Detailed Report

**Date:** 2026-09-18
**Status:** COMPLETE
**Commits:** `23cb9fb` (latest), pushed to `origin/main`

---

## 1. EXACT ROOT CAUSE

**Production error:** `"null value in column "id" of relation "users" violates not-null constraint"`

**Three independent bugs caused this:**

### Bug A — Signup never created CAPFLUX users row

The `/auth/signup` route called `upsertUserRecords()` which contained:
```typescript
if (!UUID_RE.test(u.id)) {
  console.warn('Skipping users upsert: id is not a CAPFLUX UUID');
  return; // <-- CAPFLUX user NEVER created
}
```
WorkOS `createUser()` returns a WorkOS ID like `user_01EHWNC0FCBHZ3BJ7EGKYXK0E6` which is TEXT, not UUID. The guard correctly prevented writing it to UUID columns, but meant the CAPFLUX `users` row was never created at all.

### Bug B — All provisioning paths omitted the `id` field

Every inline provisioning attempt (webhook, authkit-callback, callback, signin) did:
```typescript
await supabase.from('users').insert({
  email: ...,
  auth_provider: 'workos',
  email_verified: ...,
  // <-- MISSING: id field
});
```
Since `users.id` has `NOT NULL`, this triggered the constraint violation.

### Bug C — Invalid migration_source

The `WorkOSProvisioningService` used `migration_source: 'WORKOS_PROVISIONING'` which is not in the production constraint: `PREIMPORT | JIT_VERIFIED_EMAIL | MANUAL | WEBHOOK`.

### Result

- WorkOS user = CREATED
- CAPFLUX `users` row = NOT CREATED
- `user_identity_links` row = NOT CREATED
- Accounts stranded in WorkOS

---

## 2. COMPLETE FILE-BY-FILE CHANGES

### `backend/services/WorkOSProvisioningService.ts` (NEW)

**Purpose:** Single reusable provisioning function for WorkOS → CAPFLUX identity bridge.

**Key features:**
- Accepts `migrationSource` parameter (default: `'MANUAL'`)
- Identity state based on `emailVerified`:
  - `emailVerified=false` → `status=PENDING`, `verified_at=NULL`
  - `emailVerified=true` → `status=ACTIVE`, `verified_at=timestamp`
- Resolves existing identity by WorkOS user ID (ACTIVE or PENDING)
- Generates `crypto.randomUUID()` before inserting into `users`
- Handles duplicate key (`23505`) idempotently — cleans up orphaned user
- Checks for REVOKED link (cannot resurrect)

**Contract:** `provisionWorkOSIdentity(input) → { capfluxUserId, isNew }`

---

### `backend/services/WorkOSAuthService.ts`

**Changes:**
- Added `verifyEmail` to `UserManagementApi` interface
- Added `verifyEmail(code, userId)` method — calls WorkOS SDK `userManagement.verifyEmail()`

**WorkOS SDK v10 API used:**
- `sendVerificationEmail({ userId })` — sends 6-digit code (already existed)
- `verifyEmail({ code, userId })` — marks email_verified=true, returns `{ user }` (NEW)

---

### `backend/routes/auth.ts` (complete rewrite)

**Header comment updated:** Removed "LEGACY" / "Phase 4: Supabase Auth is the active authentication authority". These are now production WorkOS auth paths.

**Removed:** `upsertUserRecords()` (the broken function) — replaced by `WorkOSProvisioningService`

**Kept:** `UUID_RE` guard (required by identity-safety test)

#### New `POST /auth/signup` flow

```
1. WorkOS createUser()
2. workosProvisioningService.provisionWorkOSIdentity({
     workosUserId, email, firstName, lastName,
     emailVerified: false,
     migrationSource: 'MANUAL'
   })
3. Returns { verificationRequired: true, verificationSent: true }
4. No session cookie
```

On provisioning failure:
- Email already exists → 409 USER_ALREADY_EXISTS
- Other failure → 500 PROVISIONING_ERROR
- Never returns false success

#### New `POST /auth/verify-email`

```
1. authService.verifyEmail(code, userId) — WorkOS marks email_verified=true
2. Resolve identity by WorkOS user ID (NOT email)
3. Update CAPFLUX users.email_verified = true
4. Transition identity: PENDING → ACTIVE, verified_at = timestamp
5. Attempt authentication (expected to fail without password)
6. Return { verificationSuccess: true, authenticated: false }
```

#### Fixed `POST /auth/resend-verification`

- Accepts `email` (not `userId`)
- Resolves CAPFLUX user by email (for identity lookup only)
- Finds WorkOS user ID via `user_identity_links`
- Calls `authService.sendVerificationEmail(workosUserId)`
- Always returns success (prevents account enumeration)

#### Fixed `GET /auth/authkit-callback` (Google OAuth)

- Provisioning failure = **hard error** (returns 500, no session)
- Uses `migrationSource: 'JIT_VERIFIED_EMAIL'`
- Google users have `emailVerified=true` → identity: ACTIVE

#### Fixed `GET /auth/callback` (legacy)

- Same hard-fail provisioning as authkit-callback

#### Fixed `POST /auth/signin`

- Uses `workosProvisioningService` instead of inline provisioning
- Uses `migrationSource: 'JIT_VERIFIED_EMAIL'`

---

### `frontend/src/features/auth/components/EmailVerification.vue` (complete rewrite)

**Before:** "Check your email" dead-end with no code input

**After:** Full verification code UI:
- 6-digit code input (`maxlength="6"`, `inputmode="numeric"`, monospace font)
- Verify button (disabled until 6 digits entered)
- Resend button with 30-second countdown
- Error display for invalid/expired codes
- Success state with redirect to sign-in
- Back to sign in link

---

### `frontend/src/shared/auth/AuthKitProvider.ts`

**Changed:**
- `resendVerification(userId)` → `resendVerification(email)` — accepts email
- Added `verifyEmail(code, userId)` — calls `POST /auth/verify-email`

---

### `frontend/src/shared/auth/AuthProvider.ts`

**Changed:** `resendVerification(userId: string)` → `resendVerification(email: string)`

---

### `frontend/src/shared/auth/AuthService.ts`

**Changed:**
- `resendVerification(userId)` → `resendVerification(email)` — passes email to provider
- Added `verifyEmail(code, userId)` — calls provider's `verifyEmail`

---

### `frontend/src/stores/authStore.ts`

**Added:**
- `resendVerification(email)` action
- `verifyEmail(code, userId)` action

---

### `frontend/src/features/auth/AuthView.vue`

**Removed:**
- `provider=google` auto-click behavior (interfered with callback route)
- Supabase Auth migration comment (no longer applicable)

**Kept:**
- Single callback responsibility: code+state → exchange once → dashboard or visible error
- No silent redirect to login on failure

---

## 3. PROVISIONING ARCHITECTURE

```
                    WorkOSProvisioningService
                    provisionWorkOSIdentity()
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    Signup            Google OAuth       Signin (JIT)
  (MANUAL)        (JIT_VERIFIED_EMAIL)  (JIT_VERIFIED_EMAIL)
   PENDING              ACTIVE              ACTIVE
 verified_at=NULL  verified_at=now    verified_at=now
          │                │                │
          └────────────────┼────────────────┘
                           │
                    ┌──────┴──────┐
                    │  idempotent │
                    │  by WorkOS  │
                    │  user ID    │
                    └─────────────┘
```

**Resolution hierarchy (no email fallback):**
1. Check for ACTIVE identity link by WorkOS user ID → return existing UUID
2. Check for PENDING identity link → return existing UUID
3. Check for REVOKED link → throw (no resurrection)
4. Generate new UUID → create users + profile + identity link

---

## 4. CONFIRMATION: NO DB SCHEMA/RPC ADDED

- No migration files created
- No new RPCs
- No `supabase rpc()` calls added (except existing `revoke_workos_session`)
- The `provision_workos_user` RPC that was previously referenced no longer exists in any code path
- All provisioning is application-level using `supabase.from().insert()`

---

## 5. TEST RESULTS

| Test Suite | Result |
|------------|--------|
| Backend all tests | **268/268 pass** |
| Backend typecheck | **pass** |
| Backend build | **pass** |
| Frontend auth tests | **88/88 pass** |
| Frontend build | **pass** |

**No `any`, `@ts-ignore`, or `@ts-nocheck` used.**

---

## 6. EXACT PRODUCTION SIGNUP FLOW

```
1. User fills RegisterForm (first name, last name, email, password, terms)
2. POST /api/auth/signup
   → WorkOS createUser({ email, password, firstName, lastName, emailVerified: false })
   → WorkOS user created (id: "user_...")
   → sendVerificationEmail({ userId }) → 6-digit code sent
3. workosProvisioningService.provisionWorkOSIdentity({
     workosUserId: "user_...",
     email: "...",
     emailVerified: false,
     migrationSource: "MANUAL"
   })
   → crypto.randomUUID() → new CAPFLUX UUID
   → INSERT INTO users (id=UUID, email, auth_provider='workos', email_verified=false)
   → INSERT INTO user_profiles (user_id=UUID, full_name, avatar_url)
   → INSERT INTO user_identity_links (
       capflux_user_id=UUID,
       workos_user_id="user_...",
       identity_type='workos_authkit',
       status='PENDING',
       migration_source='MANUAL',
       verified_at=NULL
     )
4. Response: { verificationRequired: true, verificationSent: true }
5. Frontend navigates to /auth?mode=verify-email&email=...
6. User enters 6-digit code
7. POST /api/auth/verify-email { code, userId }
   → WorkOS verifyEmail({ code, userId }) → email_verified=true
   → UPDATE users SET email_verified=true WHERE id=UUID
   → UPDATE user_identity_links SET status='ACTIVE', verified_at=now
8. Response: { verificationSuccess: true }
9. User redirected to /auth?mode=login
10. User signs in with email + password
    → WorkOS authenticateWithPassword → tokens
    → Session established → dashboard
```

---

## 7. WORKOS USER ID → CAPFLUX UUID MAPPING

| Table | Column | Value |
|-------|--------|-------|
| `user_identity_links` | `workos_user_id` | `user_01EHWNC0FCBHZ3BJ7EGKYXK0E6` (TEXT) |
| `user_identity_links` | `capflux_user_id` | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` (UUID) |
| `users` | `id` | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` (UUID) |
| `user_profiles` | `user_id` | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` (UUID) |

**Authoritative bridge:** `user_identity_links` — never email, never UUID casting.

---

## 8. VERIFICATION EMAIL

**Sent by:** `WorkOSAuthService.signUpWithPassword()` calls `sendVerificationEmail({ userId })`

**If sending fails:** `verificationSent: false` returned but signup succeeds. User can resend from verification screen.

**Resend:** `POST /auth/resend-verification { email }` — resolves WorkOS user via identity link, calls `sendVerificationEmail()`.

---

## 9. GOOGLE OAUTH

**Flow:**
```
1. "Continue with Google" → POST /api/auth/google → WorkOS authorization URL
2. Google consent → https://capflux.vercel.app/auth/callback?code=...&state=...
3. AuthView watch detects code → authStore.handleOAuthCallback(code, state)
4. GET /api/auth/authkit-callback?code=...&state=...
   → WorkOS authenticateWithCode → tokens
   → workosProvisioningService.provisionWorkOSIdentity({
       emailVerified: true (Google verified),
       migrationSource: "JIT_VERIFIED_EMAIL"
     })
   → Identity: status=ACTIVE, verified_at=timestamp
5. Session established → redirect to dashboard
```

**New Google user:** Gets CAPFLUX UUID + identity link (ACTIVE)
**Existing Google user:** Identity resolved idempotently by WorkOS user ID
**Provisioning failure:** Hard error (500), no session

---

## 10. IDENTITY STATE MACHINE

```
                    ┌─────────────┐
                    │  PENDING    │
                    │ verified_at │
                    │   = NULL    │
                    └──────┬──────┘
                           │
                    verify-email endpoint
                    (WorkOS verifyEmail API)
                           │
                    ┌──────┴──────┐
                    │   ACTIVE    │
                    │ verified_at │
                    │  = timestamp│
                    └──────┬──────┘
                           │
                    user.deleted webhook
                           │
                    ┌──────┴──────┐
                    │  REVOKED    │
                    │ (cannot     │
                    │  resurrect) │
                    └─────────────┘
```

---

## 11. COMMIT HISTORY

```
23cb9fb fix(auth): P0 — complete auth flow fix (signup provisioning, verification code UI, Google OAuth)
b0646e8 fix(webhook): fail loudly on provisioning instead of hiding behind 200
416b61d fix(auth): P0 — account creation broken due to missing UUID in users insert
0a99b55 fix: email verification, webhook provisioning, OAuth cross-origin flow
2971534 fix(auth): cross-site cookies, duplicate signup detection, JIT identity provisioning
4a7f78b fix(auth): enforce 5 password requirements, fix Google OAuth cookie transfer, fix signup user-null handling
4b951b2 fix(auth): use imported errorMessage instead of this.errorMessage
```

All pushed to `origin/main`.
