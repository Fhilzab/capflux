# CAPFLUX File Storage Security Audit

**Audit date:** 2026-08-23.

## Upload/download paths (complete list)

1. `POST /api/kyc/documents/cac` — CAC certificate (routes/kyc.ts:537–625)
2. `POST /api/kyc/documents/identity` — identity document (same pattern; frontend financialActivationStore.ts:647–664)
3. `GET /api/kyc/documents/serve` — retrieval via signed URL (kyc.ts:630–648)

No other upload path exists (no receipt/student-photo storage found).

## Controls

| ID | Control | Finding | Status |
|---|---|---|---|
| FILE-001 | File type validation | Extension allowlist (pdf/jpg/jpeg/png) + declared-MIME allowlist + **magic-byte sniffing** cross-check (validators.ts:39–68; kyc.ts:517–523,566–569) | PASS |
| FILE-002 | Size limits | 10MB application check; route body cap 15MB; global JSON cap unaffected (100kb) | PASS |
| FILE-003 | Filename handling / path traversal | Client filename discarded except final extension (`split('.').pop()`); server builds path from DB UUIDs + fixed basename `cac-certificate.{ext}` ⇒ no user-controlled path segments; serving enforces `absPath.startsWith(resolve(STORAGE_DIR))` (storage.ts:108–131). Note: prefix check is functional but not separator-aware — a stricter `path.relative` check recommended (COMP-034, P3). | PASS (hardening note) |
| FILE-004 | Authorization | Both router-level Supabase auth AND HMAC signed URL (5-min expiry, secret-signed) required to serve | PASS |
| FILE-005 | School isolation of documents | Path namespaced by schoolId + kycRecordId (server-derived, never client-supplied) | PASS |
| FILE-006 | Public exposure | No public buckets exist; no Supabase Storage buckets at all; private filesystem default; Supabase adapter seam unconfigured | PASS |
| FILE-007 | Signed URL expiry & scope | expires param validated; token = HMAC(secret, path+expiry); scope = single file path | PASS |
| FILE-008 | Signing secret strength | Fallback chain ends in `'dev-secret'` when envs unset (storage.ts:94,117) — must be dev-only | FAIL pattern → COMP-033 |

## KYC/student document exposure analysis

- CAC + identity docs are company/principal documents. Student documents are **not stored** anywhere today (no student file uploads implemented).
- Documents live outside any database backup path (filesystem) — backup/DR coverage for the storage directory is undefined in backup_strategy docs (**REQUIRES_OPERATIONAL_REVIEW** — COMP-035: define encrypted offsite backup for CAPFLUX_STORAGE_DIR or move to object storage with SSE + private bucket).
