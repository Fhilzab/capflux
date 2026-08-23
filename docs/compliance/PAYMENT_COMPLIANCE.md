# CAPFLUX Payment Compliance Audit

**Audit date:** 2026-08-23. Financial-core code was **not modified** during this audit (see FINANCIAL_INTEGRITY_AUDIT.md).

## 1. Money & data path (as implemented)

```
Parent pays → PSP-hosted DVA (Monnify/Paystack) → bank rails
  → webhook POST /api/webhook/{monnify|paystack}
      HMAC verify (fail-closed prod) → provider allowlist
      → DVA lookup → school/student resolution
      → API re-verification of transaction (getTransaction)
      → idempotency pre-check + DB unique indexes
      → record_verified_payment RPC: 1 payment row (SUCCESS) + 1 CREDIT ledger entry
      → reconciliation checkpoint → notification row
  → balance = computed from ledger (never stored)
  → settlement: SettlementService posts settlement_records to VERIFIED school account
```

## 2. Control-by-control audit

| Area | Finding | Status | Evidence |
|---|---|---|---|
| DVA creation | Server-side provisioning after `requirePaymentReady`; idempotency key unique (`uq_payment_accounts_idempotency`); provider-ref unique prevents gateway-success/DB-fail duplicates | PASS | routes/dva.ts; migration 0025:44–51 |
| Payment initiation | Client can create PENDING intent only; amount validated positive integer server-side; browser can never set SUCCESS | PASS | payments.ts:125–153; PaymentService.ts:87–88 |
| Webhook authentication | HMAC-SHA512 mandatory in production, fail-closed when secret missing (WebhookVerifier.ts:44–63) | PASS | webhook-hardening tests |
| Webhook replay resistance | Idempotency by provider_event_id unique index + RPC exception handler converges duplicates | PARTIAL — no timestamp/nonce replay window check | migrations 0025:88–89 |
| Transaction verification | Full API verification before posting; body never trusted for status/settlement | PASS | WebhookVerifier.verifyWebhook steps 1–7 |
| Amount validation | Amount parsed from webhook **body**, positive-checked; NOT compared against API-verified transaction object. Currency never compared. | PARTIAL — integrity gap if signature compromised or payload mismatched; backlog COMP-008 | WebhookVerifier.ts:210–214; gateways parseWebhookAmount |
| Duplicate payments | reference unique + alreadyProcessed short-circuit at three layers | PASS | webhook.ts:104–107,123–125,192–195 |
| Reversal | State machine SUCCESS→REVERSED only; requires `payment.reconcile` permission; audit-logged with actor | PASS | PaymentService.transition:124–171; payments.ts:162–169 |
| Refunds | No refund implementation found | NOT_IMPLEMENTED — consumer-protection exposure | COMP-018 |
| Failed payments | FAILED terminal state reachable from PENDING/PROCESSING with failure_reason; no auto-retry loops | PASS | VALID_TRANSITIONS map |
| Settlement | Destination resolved ONLY from verified settlement_accounts; one-active-account constraint; settlement idempotency unique; status updates audited | PASS | SettlementService.ts:36–106; 0024:66–68; 0025:247 |
| Reconciliation | Runs/issues tables + service + staff-gated run endpoint; webhook writes checkpoints | PARTIAL — automated scheduling absent | financial-operations.ts:41+ |
| Platform levy | Config exists (`fee_rules`, `calculate_platform_fee`, min/pct/max clamp) but **no levy split inside record_verified_payment**; no levy posting in live path; frontend does not disclose levy rate | PARTIAL / REQUIRES_LEGAL_REVIEW for revenue model classification | 0012:58–73; COMP-014/019 |
| Audit trail | PAYMENT_INTENT_CREATED / PAYMENT_RECEIVED / PAYMENT_REVERSED / SETTLEMENT_* all logged; DB triggers add second layer | PASS | auditService; triggers/audit_triggers.sql:234–249 |
| Financial record retention | Append-only; no purge exists (good for integrity, unresolved for DP law) | REQUIRES_LEGAL_REVIEW | DATA_RETENTION_POLICY.md |

## 3. Division of responsibility: CAPFLUX vs licensed providers

| Function | CAPFLUX does | Licensed provider/bank does |
|---|---|---|
| Holding payer funds | ✗ never | ✓ PSP/bank hold funds in DVA until settlement |
| Payment channels/UI | ✗ (no card data ever touches CAPFLUX) | ✓ hosts payment experience under its PCI scope |
| DVA issuance | requests via API | issues/owns accounts |
| Transaction truth | re-verifies via API before posting | authoritative source |
| Ledger of fees/credits | ✓ internal double-entry style ledger | n/a |
| Settlement execution | records/tracks; execution is provider-side | executes payouts to school account |
| Levy deduction | not implemented in money path | TBD per provider split config — REQUIRES_LEGAL_REVIEW |

CAPFLUX's software posture is that of a fee-management/accounting platform layered on licensed PSP rails. Whether any CAPFLUX activity nonetheless falls within a regulated payment category (e.g., levy collection economics, aggregator behaviour) is a **legal classification question — REQUIRES_LEGAL_REVIEW** (REGULATORY_MATRIX R-3). Nothing in this document asserts CAPFLUX is or is not a regulated institution.

## 4. Provider-mode enforcement

`PAYMENTS_PROVIDER_MODE` (disabled/sandbox/production) validated at startup; production mode demands NODE_ENV=production and real credentials. Gap: `requireProviderReady` middleware is defined but **wired into zero routes** — mode enforcement relies on startup validation and gateway factory behaviour. Backlog COMP-017.
