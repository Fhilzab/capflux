# CAPFLUX Data Flow Register

**Audit date:** 2026-08-23. Flows verified against code; security-control references point at SECURITY_CONTROL_MATRIX.md control IDs.

Status legend: `VERIFIED` (code-confirmed) / `PLANNED` (code exists, provider not live) / `VIOLATION` (contradicts documented architecture invariant).

---

## F-01 Parent/guardian payment → receipt (core money flow)

```
Parent (bank transfer / PSP channel)
  → Licensed PSP (Monnify/Paystack DVA)
  → Bank/payment network
  → PSP webhook  POST /api/webhook/:provider
      1. HMAC signature verify (fail-closed in production)        WEBHOOK-001
      2. DVA → payment_accounts → school/student resolution       TENANT-006
      3. Full API re-verification of the transaction              PAY-003
      4. Idempotency (provider_event_id unique + RPC pre-check)   PAY-004
      5. Atomic RPC record_verified_payment:
           payment_transactions SUCCESS row + ONE ledger CREDIT   LEDGER-003
      6. Reconciliation checkpoint row                            FIN-001
      7. Notification row (non-authoritative, try/catch)          CONSUMER-002
  → Student balance recomputed from ledger views                  LEDGER-004
  → Settlement via SettlementService (server-resolved destination) PAY-009
```

| Attribute | Value |
|---|---|
| Data | payer reference, amount, DVA number, student/school linkage |
| Actor | parent/payer (indirect), PSP (processor), CAPFLUX backend |
| Storage | `payment_transactions`, `ledger_entries`, `notifications`, `reconciliation_runs` |
| Security controls | signature verify, API verify, idempotency, tenant-scoped writes by service role only |
| Retention | no automated purge; ledger append-only forever — DATA_RETENTION_POLICY.md |
| Compliance relevance | PAY-*, LEDGER-*, AUDIT-001 |

**Known gap:** the amount posted is parsed from the **webhook body** (`gateway.parseWebhookAmount(payload)`), not compared against the API-verified transaction object. Mitigated by mandatory HMAC in production; flagged as WEBHOOK-005 / backlog COMP-008.

## F-02 School administrator → student records

Staff browser (Vue SPA) → Express API (`/api/onboarding/*`, students providers) and — VIOLATION — in several modules directly browser→Supabase:

- Direct Supabase domain access confirmed in: `shared/students/SupabaseStudentProvider.ts`, `shared/ledger/SupabaseLedgerProvider.ts`, `shared/billing/SupabaseBillingProvider.ts`, `shared/fees/*`, `shared/divisions/*`, `shared/academic/*`, plus all offline sync engines (`offline/syncEngine.ts`, `UploadSyncEngine.ts`, `DownloadSyncEngine.ts`, `RealtimeSyncService.ts`).
- AGENTS.md declares "the frontend never queries Supabase for domain data". The code contradicts this invariant ⇒ recorded as **VIOLATION** of the internal data-path policy.
- Practical effect: these paths are protected only by Postgres RLS. Legacy policies key on `jwt.claims.school_id`, which Supabase Auth JWTs do not carry ⇒ direct-client access is effectively **denied** for those tables (fail-closed). Newer auth.uid()-based tables (identity/RBAC/KYC-view) do work direct. Net effect today is fail-closed rather than leak-prone, but the data path is inconsistent and must be reconciled — backlog COMP-011.

## F-03 Guardian → student payment initiation

Guardian pays into a per-student DVA provisioned through `/api/dva/provision` (requireAuthSupabase + requirePaymentReady + server-side provider call). No guardian-facing portal exists; guardians interact with bank rails, not the app.

## F-04 KYC → identity verification

```
School owner (browser)
  → POST /api/kyc/submit|settlement|shareholders   (BVN/NIN validated then AES-GCM encrypted before storage)
  → POST /api/kyc/documents/cac                    (binary upload, MIME+magic sniff, private FS)
Identity provider (Fincra): DESIGNATED ONLY — PENDING_PROVIDER, zero integration (capability-matrix.md:43–79)
```
Today **no PII leaves CAPFLUX to any KYC provider**. When Fincra is integrated, transfer basis + DPA become mandatory — NDPC-DP-010.

## F-05 File upload → storage → authorized user

Binary body (≤10MB) → validators.ts allowlist + magic-byte sniff → server-side path `kyc/{schoolId}/{recordId}/…` → stored on private filesystem → retrieval only via authenticated request + HMAC signed URL (5-min expiry) + path-traversal guard (storage.ts:108–131). FILE-001..004.

## F-06 Offline-first local flow (browser device)

All staff mutations write Dexie/IndexedDB first (students, guardians, ledger DEBITs, notifications, sync_queue) → background upload to Supabase (direct client) when online. UUIDs assigned client-side before sync (idempotency preserved). Local data is **unencrypted**, persists after logout, and includes guardian phones and full student records — SEC-006 / COMP-010.

## F-07 Notifications

Webhook handler inserts `notifications` row (phone + message). Delivery: edge function `send-notification` (Termii/email) — PLANNED; not confirmed deployed. Message content includes student name + amount ⇒ notification payloads are personal data.

## F-08 Platform administration (FHILZAB NIG LTD staff)

`/api/admin/kyc/*`, `/api/admin/settlements/*`, `/api/admin/gateway/assign`, `/api/admin/payments/*` gated by `requireStaff(permission)` which currently resolves to SUPER_ADMIN-only. Staff actions audit-logged. Identity data visible to platform staff is masked (last4) except where noted (financial-admin.ts list endpoints).

## F-09 Webhook → reconciliation loop

Every processed webhook writes a `reconciliation_runs` checkpoint (webhook.ts:127–136). Scheduled/provider-driven reconciliation exists as service code (ReconciliationService) invoked from `/api/operations/reconciliation/run`.

## F-10 Auth flows

Browser ↔ Supabase Auth (signup/login/refresh) directly; backend validates Bearer tokens per request via `supabase.auth.getUser(token)` and resolves the CAPFLUX user from `public.users`. No backend session store for Supabase tokens; revocation = Supabase-side sign-out. AUTH-*.
