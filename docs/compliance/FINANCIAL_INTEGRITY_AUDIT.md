# CAPFLUX Financial Integrity Audit

**Audit date:** 2026-08-23. **No financial logic was modified in this audit** (Financial Core Freeze respected).

## 1. Core guarantee chain — verified

ONE payment → ONE authoritative transaction → ONE financial effect → deterministic retries:

```
record_verified_payment RPC (SECURITY DEFINER, migration 0025:101–182)
  ├─ pre-check by idempotency_key → {already_processed:true}
  ├─ INSERT payment_transactions (SUCCESS)  ─┐ atomic
  ├─ INSERT ledger_entries (single CREDIT)   ┘ same implicit transaction
  └─ EXCEPTION unique_violation → re-select winner, return already_processed
```

Idempotency layers: (1) `payment_transactions.idempotency_key` partial-unique (0008:100); (2) `provider_event_id` unique (0025:88); (3) `ledger_entries.idempotency_key` unique + `(source_document_type, source_document_id)` unique (0023:29–35); (4) reference unique (0008:97).

## 2. Audit results

| ID | Area | Result | Evidence |
|---|---|---|---|
| LEDGER-001 | Kobo arithmetic | amount_minor BIGINT is canonical; CHECK >0; naira column derived ×100 backfill; PaymentService rejects non-integers ≤0 at both entry points. Frontend DEBIT path uses minor units. | PASS |
| LEDGER-002 | Append-only ledger | No UPDATE/DELETE policy for clients (rls_hardening.sql:21–28); INSERT-only audit trigger; corrections are reversing entries per docs; FK RESTRICT protects rows from student deletion. | PASS |
| LEDGER-003 | Atomicity payment+ledger | Single plpgsql body; no partial-write window. | PASS |
| LEDGER-004 | Balances computed, never stored | Views + SQL functions only. | PASS |
| LEDGER-005 | Unique constraint integrity | Full index inventory verified (DATA_INVENTORY.md §3). | PASS |
| FIN-001 | Reconciliation | Runs/issues tables + service + staff endpoint + webhook checkpoints exist; **no scheduler**; matching service present but unproven against production data. | PARTIAL |
| FIN-002 | Settlement idempotency | `settle:{txnId}` key + unique index + pre-check; destination server-resolved from VERIFIED account only. | PASS |
| FIN-003 | Double credit / double settlement | Blocked by unique indexes at DB level regardless of application bugs. | PASS |
| FIN-004 | Race conditions | DB unique constraints are the race arbiter (exception-convergence pattern). No advisory locks needed for current single-RPC write shape. | PASS |
| FIN-005 | Partial failure / provider timeout / DB timeout | Webhook 500 ⇒ provider retry ⇒ idempotent convergence. Post-commit notification failures isolated (webhook.ts:160–183). | PASS |
| FIN-006 | Negative balances | Negative student balance = legitimate outstanding-fees state; direction enforced via entry_type semantics and CREDIT creation restricted to server RPC paths (frontend blocks local CREDIT creation, LedgerRepository.ts:79–81). | PASS (semantics verified) |
| FIN-007 | Split settlement ledger | LedgerService.recordSplitSettlement posts per-leg entries with designated server identity (client_sequence=0/device_id='payment-webhook'); error inside loop logs but does not abort remaining legs — flagged: partial split-posting possible on mid-loop failure (pre-existing behaviour; owner decision if hardening wanted — COMP-026). | PARTIAL (pre-existing) |
| FIN-008 | Levy/split in money path | Not implemented in record_verified_payment; levy exists as config only. Revenue-model accounting incomplete — REQUIRES_LEGAL_REVIEW + product decision (COMP-019). | NOT_IMPLEMENTED |
| AUDIT-* | Financial event logging | Triggers log PAYMENT_VERIFIED/PAYMENT_RECEIVED/SETTLEMENT_COMPLETED/TUITION_GENERATED + service-level audits with actor/reference/correlation. | PASS |

## 3. Known deviation register (documented, not changed)

1. WEBHOOK-005 amount-source gap (body vs API-verified) — P1 remediation COMP-008.
2. `SettlementService.updateSettlementStatus` relies on embedded-resource filter (`payment_transactions.school_id`) without `!inner` in the update select — works under current FK topology but is fragile; list/summary variants use consistent patterns. Verification item COMP-027.
3. Legacy shim `LedgerService.savePaymentTransaction` still allows raw inserts outside the RPC — used only by legacy paths; candidate for deprecation (COMP-028).

## 4. Tests preserved/run

ledger-split-settlement.test.js, payment-lifecycle.test.ts, activation.test.ts, gateway.test.ts, webhook suites — all untouched.
