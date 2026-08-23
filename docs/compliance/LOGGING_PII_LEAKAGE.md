# CAPFLUX Logging & PII Leakage Audit

**Audit date:** 2026-08-23.

## Server (backend) console logging

No structured logger exists; console-only. Scan results:

| ID | Location | What is printed | Risk | Action |
|---|---|---|---|---|
| L-001 | index.ts:266–281 (`/api/log-error`, unauthenticated) | Client-supplied message + truncated stack + URL + UA | Log-spam/injection vector; client stacks can embed PII/urls-with-tokens | COMP-036: rate-limit + sanitize + require auth or drop endpoint |
| L-002 | routes/webhook.ts:84 | Virtual account number for unknown DVAs | DVA numbers are sensitive-ish identifiers in logs | COMP-037: mask to last4 |
| L-003 | webhook.ts:190, LedgerService.ts:58, index.ts:260 | Full error objects | May embed payload fragments | low; covered by COMP-015 error-hygiene pass |
| — | BVN/NIN/passwords/tokens in server logs | **NOT FOUND** anywhere in routes/services/middleware | – | – |

Committed ops scripts at backend root (`_phase6_*.js`) dump emails/profiles/KYC samples to stdout when run manually — housekeeping risk; COMP-038 (remove/archive).

## Frontend logging

No deliberate PII logging found. Error-object prints (DownloadSyncEngine etc.) could carry payload fragments — acceptable, tracked by same hygiene item.

## Sensitive values outside logs (worse than logs)

| ID | Location | Content | Action |
|---|---|---|---|
| SEC-006a | localStorage `capflux:kycSubmissionDraft` (financialActivationStore.ts:389–407,534–554) | **Plaintext BVN, NIN, document number, CAC reg no, settlement account no**, persists past logout | COMP-010 (P1): session-scoped storage only / strip identifiers |
| SEC-006b | localStorage `capflux:kyc:personalInfoDraft` (ProfileStep.vue:22–135) | Names, phone, DOB, residential address on every keystroke | COMP-010 |
| SEC-006c | IndexedDB (all tables unencrypted; retained after logout) | Students, guardians incl. phones, ledger, notifications | COMP-010 |

## Automated enforcement

`check-sensitive-logging` compliance script scans backend/frontend source for console statements whose string literals reference bvn/nin/token/password/secret/account-number patterns and flags them; CI-runnable via `npm run compliance:audit`.
