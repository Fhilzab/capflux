# CAPFLUX Security Control Matrix — Tenant Isolation & Core Security

**Audit date:** 2026-08-23. P0 priority per mission. Every control lists code evidence and honest status.

Statuses: PASS / PARTIAL / FAIL / NOT_IMPLEMENTED / REQUIRES_LEGAL_REVIEW / REQUIRES_OPERATIONAL_REVIEW / UNKNOWN.

---

## Tenant isolation

### TENANT-001 — RLS enabled on core tenant tables
REQUIREMENT: every tenant-scoped table enforces school isolation at the database layer for any direct-client path.
IMPLEMENTATION: `ENABLE ROW LEVEL SECURITY` + policies on schools, profiles, students, ledger_entries, notifications, audit_logs, sync_queue, app_settings (0005:13–20), payment tables (0008:125–128), guardians (0009/0010), tuition/fee/payment_accounts (0013/0016), RBAC (0020:95), users/user_profiles (0021:103), org/KYC/onboarding (0022:496+), shareholders/invitations (0030), academic/billing set (202608220001:317–326); hardening overrides in supabase/policies/rls_hardening.sql.
EVIDENCE: migrations listed; schoolIsolation tests.
STATUS: **PASS** (for the covered set).
CAVEAT: legacy policies key on `current_school_id()` = `jwt.claims.school_id`, which Supabase Auth JWTs do not carry ⇒ direct-client access to those tables fails closed. Safe today, but the mechanism is accidental isolation, not designed isolation (COMP-011).

### TENANT-002 — RLS on financial/KYC satellite tables
Six sensitive tables have **no RLS**: `settlement_accounts` (full bank accounts + encrypted BVN), `settlement_account_verifications`, `kyc_verifications`, `gateway_assignments`, `reconciliation_runs`, `reconciliation_issues`, plus `legacy_identity_migrations`. Protected only by service-role-only access discipline and non-exposure of new entities (config.toml:19–24).
STATUS: **FAIL** (defence-in-depth absent). REMEDIATION: COMP-009 (P1, additive migration).

### TENANT-003 — Backend route school scoping
Dominant pattern is correct: schoolId derived from `school_members` via membership lookups; client-supplied school_id rejected where it matters most (`requirePaymentReady` rejects mismatched body/query school — requirePaymentReady.ts:17–60). Admin routes validate `params.schoolId` against caller membership.
EXCEPTIONS: staff endpoints accept client schoolId by design (`financial-admin.ts:632/654/670/686`, `financial-operations.ts:44`) behind SUPER_ADMIN-only `requireStaff`; acceptable as platform-staff surface but must stay SUPER_ADMIN-only.
STATUS: **PARTIAL** (see TENANT-004/005 exceptions).

### TENANT-004 — Onboarding state IDOR (P0)
`GET /api/onboarding/schools/:schoolId/state` (routes/onboarding.ts:515–555) reads any school's onboarding_progress by URL param with **no membership check** — exposes other tenants' KYC/settlement verification posture.
STATUS: **FAIL**. REMEDIATION: COMP-002 (one-line membership check; owner sign-off required before authz change).

### TENANT-005 — Principal invitation privilege escalation (P0)
`POST /api/kyc/principal-invitation/accept/:token`: grants **OWNER** role membership to *any* authenticated user presenting a valid token without verifying the accepting user's email matches `principal_invitations.email`; stored invitation role 'PRINCIPAL' is ignored. Additionally the idempotent-reuse branch returns the stored `token_hash` (contradicting its own "Never expose token_hash" comment) and returns a fresh token that does not match the stored hash (broken reuse flow).
STATUS: **FAIL**. REMEDIATION: COMP-003 (P0; email binding + least-privilege role + stop hash leak). The hash-leak field removal implements documented intent and was applied in this audit (see PHASE_10 report §Applied changes).

### TENANT-006 — Webhook DVA resolution scoping
DVA → payment_accounts join resolves school server-side; unknown DVAs short-circuit 200 with warning; no client-controlled school identity enters the money path.
STATUS: **PASS** (webhook.ts:74–93).

### TENANT-007 — Storage isolation
Documents stored under `kyc/{schoolId}/{recordId}/…`; serving requires authenticated request + HMAC token + traversal guard.
STATUS: **PASS** (FILE-002..004 detail in FILE_STORAGE_SECURITY.md).

### TENANT-008 — Service-role exposure
Service key loaded server-side only; throws at boot when missing; never shipped to frontend (frontend env holds publishable anon key only).
STATUS: **PASS**.

## Cross-cutting security controls

| ID | Control | Status | Evidence |
|---|---|---|---|
| SEC-001 | Secrets management | **FAIL** — secret-looking value committed in docs/auth-migration-audit.md (:250,:680,:688); frontend/.env tracked in git (anon/publishable values only) | SECRETS_AND_CRYPTOGRAPHY.md; COMP-001 |
| SEC-002 | Field-level encryption | **PASS** — AES-256-GCM BVN/NIN, last4 mirrors, startup key validation | cryptoFields.ts |
| SEC-003 | HTTP security headers | **PARTIAL** — nosniff/frame-deny/HSTS(prod)/permissions-policy present; CSP absent | index.ts:37–47 |
| SEC-004 | Error hygiene | **PARTIAL** — raw Postgres messages/details forwarded in ~20 handlers; no central error handler; `/health` leaks DB error text unauthenticated | index.ts:140–187,256; COMP-015 |
| SEC-005 | Dependency vulnerability management | **UNKNOWN** — no audit tooling configured | COMP-022 |
| SEC-006 | Local device data protection | **FAIL** — IndexedDB plaintext PII retained after logout; localStorage KYC draft holds plaintext BVN/NIN/account numbers | localDb.ts; financialActivationStore.ts:389–407,534–554; COMP-010 |
| AUTH-00x | Authentication family | see AUTH_AUDIT.md | |
