# CAPFLUX Webhook Security Audit

**Audit date:** 2026-08-23. Existing webhook behaviour was NOT weakened. All hardening tests were preserved.

## Pipeline under audit

`backend/routes/webhook.ts` → `WebhookVerifier` → `PaymentService.recordVerifiedPayment` (RPC).

## Findings

| ID | Control | Finding | Status |
|---|---|---|---|
| WEBHOOK-001 | Signature validation mandatory | HMAC-SHA512 over raw body; missing signature ⇒ 401 in production; invalid ⇒ 401 always; missing secret fails closed in prod with loud error log in dev. Dev-mode unsigned acceptance exists but is gated on `NODE_ENV !== 'production'`. | PASS (prod) / PARTIAL (dev affordance documented) |
| WEBHOOK-002 | Secret management | Secrets only from server env (`MONNIFY_WEBHOOK_SECRET`/`PAYSTACK_WEBHOOK_SECRET`); never from DB or request. | PASS |
| WEBHOOK-003 | Request authenticity beyond HMAC | Optional IP allowlist (`MONNIFY_WEBHOOK_IPS`) — **skips enforcement when unset even in production**; single allowlist var shared by providers naming only Monnify. API re-verification is the primary authenticity control. | PARTIAL — COMP-025 |
| WEBHOOK-004 | Replay resistance | No timestamp/window check on the envelope; replay safety derives entirely from idempotency (provider_event_id unique + reference unique + RPC exception convergence). A replay of a *new* provider event ID for an *already-posted reference* short-circuits at `isReferenceProcessed`. | PASS-by-idempotency (documented) |
| WEBHOOK-005 | Amount validation vs authoritative source | Posted amount = `parseWebhookAmount(webhookBody)` rounded to kobo. The API-verified transaction object is used for status/settlement/txn-ref but its **amount is never compared**. Currency likewise unchecked against verified value. Signature protects this path in production, but defense-in-depth requires comparing body amount to gateway-API amount before posting. **P1 — financial-code change ⇒ owner decision, regression tests mandatory** (COMP-008). Do not hot-fix without the full Rule-4 protocol. | PARTIAL |
| WEBHOOK-006 | Provider validation | Route param restricted to {monnify, paystack}; unknown → 400. Gateway resolved via factory; TestGateway cannot be registered in production mode (startup validation). | PASS |
| WEBHOOK-007 | State validation | Transaction must be SUCCESS and settlement SUCCESS/SETTLED before posting; otherwise throws → 500 → provider retry. | PASS |
| WEBHOOK-008 | Duplicate webhook behaviour | Three-layer convergence: pre-check, unique indexes, unique-violation handler returns alreadyProcessed 200. Providers receive deterministic success. | PASS |
| WEBHOOK-009 | Post-commit error handling | Notification insert wrapped in try/catch so post-commit failures can't turn success into spurious 500s (webhook.ts:160–183, documented Phase-1 fix). Reconciliation checkpoint failure swallowed by design (non-authoritative). | PASS |
| WEBHOOK-010 | Unknown-DVA handling | Returns 200 with warning (prevents enumeration oracle + retry storms); logs DVA number to console (see LOGGING_PII_LEAKAGE.md L-002). | PASS w/ logging note |

## Tests exercised

Existing suites preserved: `webhook-hardening.test.js`, `webhook-contract.test.ts`, `webhook-step7-regression.test.js`, `payment-lifecycle.test.ts`, `gateway.test.ts`, `provider-contract.test.ts`.

## Explicit non-changes

Signature verification, state machine transitions, idempotency keys, ledger posting semantics: untouched (Financial Core Freeze). COMP-008 is recorded as remediation requiring owner approval + tests.
