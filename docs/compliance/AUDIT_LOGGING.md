# CAPFLUX Audit Logging Assessment

**Audit date:** 2026-08-23.

## 1. What exists

Two layers:
1. **DB triggers** (supabase/triggers/audit_triggers.sql): students, ledger_entries (INSERT-only), notifications, profiles, payment_transactions, settlement_records, payment_accounts — full old/new row capture + changed_fields.
2. **Application audit** (backend/services/auditService.ts `audit()` + RPC `log_audit_action`): login-adjacent events, KYC lifecycle (field *names* only), PAYMENT_INTENT_CREATED / PAYMENT_RECEIVED / PAYMENT_REVERSED / SETTLEMENT_CREATED/COMPLETED/FAILED, admin status changes (trigger), PRINCIPAL_INVITATION_CREATED, LEGACY_ACCOUNT_CLAIMED.

## 2. Coverage matrix

| Event class | Actor | School | Action | Entity | Timestamp | Result/correlation | Status |
|---|---|---|---|---|---|---|---|
| Payment success | system (actor null) | ✓ | ✓ | txn id | DB now() | reference + ledger id in metadata | PASS |
| Reversal | actor id | ✓ | ✓ | txn | DB | original_status in metadata | PASS |
| Settlement | actor/system | ✓ | ✓ | settlement | DB | last4 only | PASS |
| KYC submit/verify/reject | actor | ✓ | ✓ | kyc record | DB | field names only; bank_code+last4 masked | PASS |
| Login/success-failure | Supabase Auth internal — **no CAPFLUX-side login event log** | – | – | – | – | – | PARTIAL (AUTH gap) |
| Privileged admin ops | actor | ✓ | ✓ | target member | DB | metadata | PASS |
| Role changes | trigger on profiles + explicit logs | ✓ | ✓ | member/profile | DB | old/new | PASS |
| Sensitive data access | KYC doc serve logged via logKycAccess; general read access NOT logged | partial | ✓ | path | DB | signed-url token not recorded | PARTIAL |

## 3. Tamper resistance

Client-facing RLS on audit_logs is SELECT-only (rls_hardening.sql:79–83); inserts occur via SECURITY-path service role and triggers. There is **no WORM storage or hash-chaining** — a database administrator could alter rows. Acceptable for current stage; document as residual risk (REQUIRES_OPERATIONAL_REVIEW for log-immutability roadmap).

## 4. LEGACY_ACCOUNT_CLAIMED investigation

Verified behaviour (routes/auth.ts:318–423 + backend/tests/claim-account-audit.test.js):
- Claim flow is deliberately response-generic (anti-enumeration) and writes an audit row with action `LEGACY_ACCOUNT_CLAIMED`.
- **Actor attribution limitation**: at claim time the claiming Supabase user may have no resolvable school membership/profile linkage that satisfies the audit writer's expectations, so the audit row can carry an incomplete/null actor context while the legacy identity email lives only in `legacy_identity_migrations` (a table with no RLS).
- Schema cannot currently represent "pre-membership platform actor" cleanly.
**Decision required from owner** (schema change = out of audit scope per mission):
`REQUIRES_OWNER_DECISION` — options: (a) accept null-actor convention documented here; (b) add dedicated columns (e.g., supabase_user_id on legacy_identity_migrations + audit metadata enrichment) via additive migration. Regression test exists and passes (claim-account-audit.test.js).

## 5. Gaps → backlog

- COMP-029: add auth-event logging (login success/failure via webhook on auth events or session bootstrap call).
- COMP-030: log sensitive-document access uniformly (serve endpoint already does; extend to identity docs path if divergent).
