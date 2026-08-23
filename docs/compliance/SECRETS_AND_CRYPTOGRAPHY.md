# CAPFLUX Secrets & Cryptography Audit

**Audit date:** 2026-08-23. No actual secret values are reproduced in this report.

## 1. Repository-wide secret scan (source, git-tracked files, docs, fixtures, logs)

| Location | Finding | Remediation |
|---|---|---|
| `docs/auth-migration-audit.md:250,:680,:688` | **FOUND** — plaintext 32-hex value presented as the real `WORKOS_COOKIE_PASSWORD` (quoted from a `.env.local.backup`). Git-tracked. | COMP-001 (P0): treat as compromised → rotate WorkOS cookie password (legacy path) + purge from git history (filter/BFG) + scrub doc |
| `backend/.env`, `backend/.env.local` | Present on disk, correctly **untracked** | keep untracked |
| `frontend/.env` | **Tracked in git** — deviation from `.env*` convention; contains only publishable/anon values (`VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, publishable-format anon key). Not a leak of secret material. | hygiene: untrack + gitignore (COMP-031) |
| `.env.example` (both projects) | Placeholders only | none |
| Test fixtures (`webhook-contract.test.ts:40`, `TestGateway.ts:46`, `crypto.test.ts`, `kyc-settlement-bvn.test.ts`) | Fake/derived secrets only (`my-test-webhook-secret`, `'a'.repeat(32)`) | acceptable |
| Docs (`encryption.md:225`) | Placeholder `sk_live_...` inside illustrative SQL | acceptable |
| JWTs / private keys / service-role keys in tracked code | **NOT FOUND** | – |

## 2. Key inventory & management

| Key/secret | Source | Rotation | Status |
|---|---|---|---|
| SUPABASE_SECRET_KEY (service role) | backend env; throws at boot if missing (supabaseClient.ts:9–11) | undocumented | PARTIAL — no rotation procedure |
| KYC_ENCRYPTION_KEY (AES-256-GCM, 32 bytes) | backend env; validated length at use (cryptoFields.ts:14–20); single static key — **no key-versioning ⇒ rotation would orphan old ciphertexts** | documented target in encryption.md §rotation but NOT implemented | PARTIAL — COMP-032 |
| MONNIFY/PAYSTACK creds + webhook secrets | backend env only; never per-school; never DB | provider-side | PASS (placement) |
| Storage signing secret | `CAPFLUX_STORAGE_SIGNING_SECRET \|\| WORKOS_COOKIE_PASSWORD \|\| 'dev-secret'` fallback chain (storage.ts:94,117) | n/a | **FAIL pattern** — 'dev-secret' fallback must be impossible outside dev; COMP-033 |
| WORKOS_COOKIE_PASSWORD | legacy path only | rotate per COMP-001 | compromised-in-docs |

## 3. Cryptography review

- AES-256-GCM with random 12-byte IV, auth tag stored (iv‖tag‖ciphertext base64) — sound construction for field encryption.
- Weaknesses:
  1. Static single key without key IDs/versioning blocks rotation and crypto-agility (COMP-032).
  2. HMAC comparison `signature === expected` is not constant-time (WebhookVerifier.ts:62). Timing side-channels on HMAC hex digests are low-practical-risk but trivially fixable with `timingSafeEqual`. Flagged, NOT changed (financial-core adjacency) — COMP-008b.
  3. Invitation tokens: 32-byte CSPRNG, SHA-256 hashed at rest — good; leak issue tracked separately (TENANT-005).
  4. No encryption-at-rest for IndexedDB/localStorage client data (SEC-006).

## 4. Automated enforcement

`npm run compliance:audit` includes `check-secrets` (pattern scan over git-tracked files) and `check-sensitive-fields` (encrypted-column presence + masking helper usage).
