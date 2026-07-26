# Ledger Integrity Verification — Capstone ERP

## Review Scope
- `shared/ledger` (types, engine, service, provider, validator, error)
- `shared/billing/BillingEngine.ts`
- `shared/payments/PaymentEngine.ts`
- `shared/payments/PaymentService.ts`
- `stores/ledgerStore.ts`, `stores/paymentStore.ts`

---

## Invariant 1 — CHARGE Idempotency

**Requirement:** A StudentCharge cannot create more than one CHARGE ledger entry.

**Current behavior (BillingEngine.ts):**
- `initializeStudentBilling()` loops fees → creates `StudentCharge` object → immediately calls `ledgerService.createChargeEntry(...)`.
- `sourceDocumentId` is set to `charge.id || snapshot.id`.
- **Problem:** `charge.id` is `''` at this point, so `sourceDocumentId` falls back to `snapshot.id`. If the same snapshot is reused or the method is replayed, multiple CHARGE entries can be created with the same `sourceDocumentId`.

**Verdict:** ❌ Not idempotent.

**Proposed fix:** Check for an existing ledger entry by source document before creating the CHARGE entry. If one exists, skip creation and reuse the existing entry number.

---

## Invariant 2 — PAYMENT Idempotency

**Requirement:** A replayed payment webhook cannot create duplicate PAYMENT ledger entries.

**Current behavior (PaymentEngine.ts):**
- `allocate()` creates a PAYMENT ledger entry with `sourceDocumentId: payment.id`.
- No pre-check for an existing PAYMENT entry with the same `sourceDocumentId`.
- `PaymentEngine.allocate` is wrapped in a try/catch in `PaymentService.ts`, but the catch only re-throws as a payment error, not a ledger duplicate check.

**Verdict:** ❌ Not idempotent.

**Proposed fix:** Before creating the PAYMENT ledger entry, call `ledgerService.getEntryBySourceDocument('PAYMENT', payment.id)`. If an entry already exists, return it or skip creation.

---

## Invariant 3 — Atomic Failure

**Requirement:** Ledger creation failure causes the surrounding business transaction to fail atomically.

**Current behavior:**
- `BillingEngine.initializeStudentBilling()`: If `ledgerService.createChargeEntry()` throws, the outer try/catch returns a `BILLING` error. However, because charges are accumulated in memory and the ledger call happens *inside* the loop, earlier charges in the same batch may have already had ledger entries created while later ones did not. In a persisted implementation, this would leave partial state.
- `PaymentEngine.allocate()`: Ledger failure is explicitly swallowed:
  ```ts
  } catch (e) {
    console.warn('PaymentEngine.allocate: failed to create payment ledger entry', e);
  }
  ```
  The allocation still succeeds, returning allocations to the caller.

**Verdict:** ❌ Not atomic.

**Proposed fix:**
- In `BillingEngine.initializeStudentBilling`: Either create all ledger entries first and validate before returning charges, or catch ledger failures and roll back the entire batch.
- In `PaymentEngine.allocate`: Remove the try/catch around ledger creation so the error propagates and fails the allocation transaction.

---

## Invariant 4 — Reversals / Refunds Create Entries Only

**Requirement:** Corrections must be append-only; original entries must never be modified.

**Current behavior:**
- `LedgerEngine.createReversalEntry()` correctly creates a new REVERSAL entry with opposite direction and same amount.
- `LedgerService.createRefundEntry()` delegates to `LedgerEngine.createEntry()` with an expected REFUND type.
- `SupabaseLedgerProvider` intentionally lacks `updateEntry` / `deleteEntry`.

**Verdict:** ✅ Append-only principle holds.

**Gap:** Reversal and refund flows are not wired into `BillingEngine` or `PaymentEngine` yet—stubs only. This is acceptable for current milestone scope, but must be addressed before financial reporting.

---

## Invariant 5 — Running Balance Correctness

**Requirement:** Running balances must remain correct after reversals and partial payments.

**Current behavior:**
- `LedgerEngine.createEntry()` calculates `balanceAfterMinor = calculateRunningBalance(balanceBeforeMinor, direction, amountMinor)`.
- `calculateRunningBalance()`: `DEBIT → +`, `CREDIT → -`.
- For partial payments: each CREDIT payment entry subtracts from the running balance. Correct.
- For reversal: `createReversalEntry()` flips direction, so if original was DEBIT +100, reversal is CREDIT -100. Correct.

**Potential race:** `getLatestEntry()` is used to obtain `previousEntry` for chaining. If two allocations happen concurrently, both may read the same `previousEntry`, producing duplicate `sequenceNumber` or stale `balanceBeforeMinor`. This is a concurrency bug that will surface under load.

**Verdict:** ✅ Logic is correct for single-threaded use. ⚠️ Concurrent safety needs DB-level sequence/balance enforcement.

---

## Summary

| Invariant | Status | Action Required |
|---|---|---|
| CHARGE idempotency | ❌ | Pre-check source document; skip duplicate |
| PAYMENT idempotency | ❌ | Pre-check source document; skip duplicate |
| Atomic failure | ❌ | Remove swallow in PaymentEngine; make BillingEngine batch atomic |
| Append-only corrections | ✅ | No change; wire reversal/refund flows later |
| Running balance correctness | ⚠️ | Single-threaded OK; add DB guard for concurrency |

---

## Recommended Next Steps

1. Add idempotency guards in `LedgerEngine.createEntry()` using `sourceDocumentType + sourceDocumentId` lookup via provider.
2. Change `PaymentEngine.allocate()` to fail hard on ledger errors.
3. Add a transaction wrapper in `BillingEngine.initializeStudentBilling()` so charge objects are only created if all ledger entries succeed.
4. Add a DB unique constraint / sequence function in Supabase for `source_document_type + source_document_id` and atomic `sequence_number` generation.