# CAPFLUX Data Inventory

**Audit date:** 2026-08-23
**Method:** source-code + migration inspection only. Every field below was verified in this repository; nothing is inferred.
**Status vocabulary:** see `CAPFLUX_COMPLIANCE_MASTER.md`.
This document describes **what data exists and where it lives**. It makes no legal conclusions.

---

## 1. Identity data

| Element | Source | Stored in | Protection | Third party |
|---|---|---|---|---|
| Auth identity (email, auth UUID) | Supabase Auth signup/login | `auth.users` (managed), `public.users`, `user_profiles`, `profiles.email` | Supabase-managed; TLS; RLS on public tables (migrations 0021:103, 0028) | Supabase (processor) |
| Full names (owner/staff/principal) | Onboarding/KYC forms | `user_profiles.*_name`, `profiles.full_name`, `kyc_records.principal_name` | Plaintext in DB; authenticated API only | Supabase |
| Phone numbers | Onboarding/KYC/guardians | `user_profiles.phone`, `profiles.phone`, `guardians.primary_phone/secondary_phone`, `kyc_records.phone/principal_phone`, `school_shareholders.phone`, `notifications.recipient_phone` | Plaintext in DB | Termii SMS planned but deferred (`docs/PROJECT_STATUS.md:859`) — no SMS currently sent by backend |
| School identity (name, CAC number, TIN, address, state/LGA) | KYC/onboarding | `schools.cac_number/tax_identification_number/address/state/lga` (0019:53, 0022:101–103), `kyc_records.cac_registration_number` (0022:180) | Plaintext; validated by `backend/services/validators.ts` before write | Supabase |
| Role/school membership | RBAC tables | `school_members`, `roles`, `permissions`, `role_permissions`, `organizations`, `organization_members` (0020, 0022, 0028) | RLS enabled (0020:95) | Supabase |

## 2. Student data

| Element | Stored in | Notes |
|---|---|---|
| First/last name, class, category, status | `students` (0002:51); mirrored unencrypted into Dexie table `students` (frontend/src/offline/localDb.ts:152) | Staff-entered; plaintext locally and server-side |
| Guardian relationships | `guardians` (0009:27), `student_guardians` (202608220001:227), legacy `students.guardian_id/guardian_phone` | Multi-guardian model added 2026-08-23 |
| Admission number | Frontend writes `students.admission_number` (frontend/src/shared/students/SupabaseStudentProvider.ts:56) | **Absent from all migrations and from generated types** — live-schema drift. REQUIRES_OWNER_DECISION |
| Enrollment/placement history | `student_enrollments` (immutable history, 202608220001:197) | Append-only by design |
| Academic structure | `academic_sessions/terms`, `school_divisions`, `academic_levels`, `fees`, `billing_profiles`, immutable `billing_snapshots`, `student_charges` (202608220001) | Tenant-scoped via RLS (202608220001:317–326) |
| **Minors** | Students are school pupils; CAPFLUX has **no student date-of-birth field and no age gate anywhere in the codebase** | The system cannot distinguish minors from adults ⇒ treat ALL student data as potential children's data. See DATA_PROTECTION.md §Children |

## 3. Financial data

| Element | Table(s) | Writer | Integrity controls |
|---|---|---|---|
| Payment transactions (reference, gateway_txn_ref, provider_event_id, amount_minor, currency, status, raw_payload) | `payment_transactions` (0008:78; extended 0025) | SUCCESS rows only via `record_verified_payment` RPC (0025:101–182); PENDING intents via PaymentService.ts:78 | unique reference (0008:97), partial-unique idempotency_key (0008:100), unique provider_event_id (0025:88), CHECK amount>0 (0008:90) |
| Ledger entries (append-only CREDIT/DEBIT) | `ledger_entries` (0002:73) | RPC for payment CREDITs; provisioning DEBIT paths; frontend DEBIT-only path (local CREDIT creation blocked, LedgerRepository.ts:79–81) | unique `(school_id, device_id, client_sequence)` (0002:66), idempotency-key unique (0023:29), source-document unique (0023:33), INSERT-only audit trigger + no client UPDATE/DELETE policy (supabase/policies/rls_hardening.sql:21–28) |
| Balances | computed views `student_balances`/`school_balances` (0006:13,38); functions `student_balance`/`school_balance` (0004:75,89) | never stored | matches AGENTS.md invariant |
| Settlements | `settlement_records` (0008:107), `settlement_accounts` (0024:42) | SettlementService — destination always resolved server-side from VERIFIED account (SettlementService.ts:36–56) | settlement idempotency unique (0025:247); no school_id column — isolation via parent payment join |
| Platform levy config | `fee_rules`, `calculate_platform_fee()` (0012:58–66) | SUPER_ADMIN only (`can_manage_platform_levy`) | **No levy split occurs inside `record_verified_payment`** — levy posting is not implemented in the live payment path |
| Reconciliation | `reconciliation_runs`, `reconciliation_issues` (0025:188,205) | webhook hook + `/api/operations/*` routes | **No RLS on either table** (see SECURITY_CONTROL_MATRIX.md TENANT-002) |

## 4. KYC / identity verification data

| Element | Storage | Encryption | Access |
|---|---|---|---|
| BVN | `kyc_records.bvn_encrypted` + `bvn_last4` (0022:183–186); `settlement_accounts.bvn_encrypted` + last4 (0030:127–133) | AES-256-GCM application layer (`backend/services/cryptoFields.ts:22–46`); key = `KYC_ENCRYPTION_KEY` env (32 bytes) | Decryptable only by backend service-role process; masked values only returned to clients |
| NIN | `kyc_records.nin_encrypted` + `nin_last4`; shareholders `identity_nin_last4`, `encrypted_identity_document BYTEA` (0030:77–84) | same scheme | same |
| CAC certificate file | Private server filesystem `kyc/{schoolId}/{kycRecordId}/cac-certificate.{ext}` under `CAPFLUX_STORAGE_DIR` (services/storage.ts:42–57). No Supabase Storage bucket exists anywhere in supabase/ (verified). | Filesystem permissions only | HMAC-signed URL, 5-minute expiry, auth required (`/api/kyc/documents/serve`, storage.ts:90–131) |
| Verification metadata / capability JSON | `kyc_verifications`, `settlement_account_verifications` (capability JSON stores field names/comparisons; migration comments say raw PII never stored, 0029:21–39) | n/a | **No RLS on either table** |
| Identity provider status | Fincra designated, `PENDING_PROVIDER` — zero credentials/integration (docs/providers/capability-matrix.md:43–79) | n/a | No PII currently leaves CAPFLUX to an identity provider |

## 5. Authentication / security data

| Element | Location | Notes |
|---|---|---|
| Supabase access/refresh tokens | Browser localStorage via `persistSession:true` (frontend/src/lib/supabase.ts:28–32) | Standard SPA pattern; XSS-exposed trade-off; no rotation configured in repo |
| Legacy WorkOS sealed session cookie | `workos_session` HttpOnly cookie (routes/auth.ts — legacy path only) | Retained for rollback; WorkOS is NOT active auth per AGENTS.md |
| Principal invitation tokens | SHA-256 `token_hash` in `principal_invitations.token_hash` (0030:100) | Raw token never stored; ⚠ idempotent-reuse branch returns the stored hash — backlog COMP-003 |
| Audit logs | `audit_logs` (0002:107) + triggers (supabase/triggers/audit_triggers.sql) | Client-facing RLS is SELECT-only (rls_hardening.sql:79); service-role writes |
| IP addresses / device identifiers | Not collected server-side. Offline ledger rows carry client-generated `device_id`; webhook notifications use `device_id='webhook-handler'` | No IP logging found in application code |
| Legacy claim state | `legacy_identity_migrations` (0026:20) — emails + statuses | **No RLS** |

## 6. Files

| File type | Path | Validation | Exposure |
|---|---|---|---|
| CAC certificate pdf/jpg/png ≤10MB | private dir per school/kycRecord | extension+MIME allowlist + magic-byte sniff (validators.ts:39–68; routes/kyc.ts:517–569) | signed URL, 5-min expiry |
| Identity document upload | `/api/kyc/documents/identity` → same storage service (financialActivationStore.ts:647–664) | same validator family | same pattern |
| Receipts / student images / other uploads | none found | n/a | NOT_IMPLEMENTED (no receipt storage exists) |

## 7. Notification data

| Element | Storage | Third party |
|---|---|---|
| Notification body incl. student name + amount | `notifications` table (0002:92) + Dexie mirror; inserted by webhook handler with recipient_phone (routes/webhook.ts:167–183) | None today — delivery provider integration (Termii) is deferred; edge function exists but is not confirmed deployed |
| Delivery status lifecycle | `delivery_status` PENDING→… updated by sync | n/a |

## 8. Jurisdictional notes

- Per `docs/architecture/environment.md:7–13`, the Supabase project is hosted in **EU West (Ireland)**. This means personal data of Nigerian data subjects is hosted outside Nigeria. Whether this constitutes a lawful cross-border transfer under NDPA 2023 + GAID 2025 transfer mechanisms is **REQUIRES_LEGAL_REVIEW** (REGULATORY_MATRIX.md R-10).
- Payment providers (Monnify/Paystack sandbox today) process transaction data under their own policies; production DPAs are unverified (VENDOR_PROCESSOR_REGISTER.md).
