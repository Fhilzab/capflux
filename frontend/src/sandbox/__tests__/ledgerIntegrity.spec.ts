/**
 * Financial ledger integrity in sandbox mode — the sandbox must preserve the
 * same rules as production: append-only entries, idempotent payment posting,
 * correct reversal semantics, balances computed FROM entries (never stored).
 */
import { describe, expect, it } from 'vitest';
import {
  createFakeSandboxDb,
  useSandboxFixture,
  type FakeSandboxDb,
} from './helpers/sandboxTestHarness';
import type { LedgerRow } from '../api/ledgerWriter';

function chargeRow(overrides: Partial<LedgerRow>): LedgerRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    entry_number: `LED-TEST-${crypto.randomUUID().slice(0, 8)}`,
    sequence_number: 1,
    schema_version: 1,
    organization_id: 'demo-org',
    school_id: 'demo-school',
    student_id: 'stu-1',
    billing_profile_id: null,
    transaction_group_id: 'grp',
    source_document_type: 'CHARGE',
    source_document_id: `charge-${crypto.randomUUID().slice(0, 6)}`,
    academic_session_id: 'sd-ses-cur',
    academic_term_id: 'sd-trm-1-1',
    entry_type: 'CHARGE',
    entry_direction: 'DEBIT',
    amount_minor: 1000000,
    amount: 10000,
    balance_before_minor: 0,
    balance_after_minor: 1000000,
    currency: 'NGN',
    source_entity: 'BILLING',
    previous_hash: null,
    entry_hash: 'seed-hash',
    hash_algorithm: 'SHA256_V1',
    reconciliation_status: 'UNRECONCILED',
    metadata: {},
    occurred_at: new Date().toISOString(),
    posting_date: new Date().toISOString(),
    created_by: null,
    created_at: new Date().toISOString(),
    device_id: 'test',
    client_sequence: 0,
    ...overrides,
  };
}

async function rows(db: FakeSandboxDb, table: string): Promise<Array<Record<string, unknown>>> {
  return (db[table] as unknown as { toArray(): Promise<Array<Record<string, unknown>>> }).toArray();
}

describe('sandbox ledger integrity', () => {
  useSandboxFixture();

  async function seedCharges(db: FakeSandboxDb): Promise<void> {
    await db.ledger_entries.bulkPut([
      chargeRow({ id: 'led-chg-1', source_document_id: 'chg-1', amount_minor: 500000, amount: 5000, balance_after_minor: 500000 }),
      chargeRow({ id: 'led-chg-2', source_document_id: 'chg-2', amount_minor: 1000000, amount: 10000, balance_before_minor: 500000, balance_after_minor: 1500000 }),
    ] as never);
  }

  it('posts a verified payment credit exactly once (idempotency)', async () => {
    const db = createFakeSandboxDb();
    await seedCharges(db);
    const { postVerifiedPaymentCredit } = await import('../api/ledgerWriter');

    const first = await postVerifiedPaymentCredit({
      schoolId: 'demo-school', organizationId: 'demo-org', studentId: 'stu-1',
      reference: 'DEMO-PAY-000001', gatewayTxnRef: 'SANDBOX-TXN-000001',
      amountMinor: 700000, method: 'BANK_TRANSFER',
      sessionId: 'sd-ses-cur', termId: 'sd-trm-1-1', occurredAt: new Date().toISOString(),
    }, db as never);
    expect(first.ok).toBe(true);

    // Replay with the SAME reference must be rejected.
    const replay = await postVerifiedPaymentCredit({
      schoolId: 'demo-school', organizationId: 'demo-org', studentId: 'stu-1',
      reference: 'DEMO-PAY-000001', gatewayTxnRef: 'SANDBOX-TXN-000001',
      amountMinor: 700000, method: 'BANK_TRANSFER',
      sessionId: 'sd-ses-cur', termId: 'sd-trm-1-1', occurredAt: new Date().toISOString(),
    }, db as never);
    expect(replay.ok).toBe(false);
    if (!replay.ok) expect(replay.code).toBe('DUPLICATE_LEDGER_ENTRY');

    const ledger = await rows(db, 'ledger_entries');
    const credits = ledger.filter((r) => r.entry_type === 'PAYMENT');
    expect(credits.length).toBe(1);
  });

  it('computes balances from entries through partial → multiple → full payment', async () => {
    const db = createFakeSandboxDb();
    await seedCharges(db);
    const { postVerifiedPaymentCredit } = await import('../api/ledgerWriter');
    const base = {
      schoolId: 'demo-school', organizationId: 'demo-org', studentId: 'stu-1',
      method: 'BANK_TRANSFER', sessionId: 'sd-ses-cur', termId: 'sd-trm-1-1',
      occurredAt: new Date().toISOString(),
    };

    let seq = 0;
    const pay = async (minor: number): Promise<void> => {
      const result = await postVerifiedPaymentCredit({
        ...base, reference: `DEMO-PAY-${String(++seq).padStart(6, '0')}`, gatewayTxnRef: `TXN-${seq}`,
        amountMinor: minor,
      }, db as never);
      expect(result.ok).toBe(true);
    };

    // Charges total ₦15,000.00 (1,500,000 kobo).
    const balanceAfter = async (): Promise<number> => {
      const ledger = await rows(db, 'ledger_entries');
      return ledger.reduce(
        (acc, r) =>
          r.student_id === 'stu-1'
            ? acc + (r.entry_direction === 'DEBIT' ? Number(r.amount_minor) : -Number(r.amount_minor))
            : acc,
        0,
      );
    };

    expect(await balanceAfter()).toBe(1500000); // charges only

    await pay(400000); // partial payment
    expect(await balanceAfter()).toBe(1100000);

    await pay(400000); // multiple payments
    expect(await balanceAfter()).toBe(700000);

    await pay(700000); // settles exactly — no negative drift
    expect(await balanceAfter()).toBe(0);

    await pay(250000); // overpayment is visible as negative outstanding (credit balance)
    expect(await balanceAfter()).toBe(-250000);
  });

  it('reversal appends a compensating DEBIT entry and never mutates the original', async () => {
    const db = createFakeSandboxDb();
    await seedCharges(db);
    const { postVerifiedPaymentCredit, postReversalForPayment } = await import('../api/ledgerWriter');

    await postVerifiedPaymentCredit({
      schoolId: 'demo-school', organizationId: 'demo-org', studentId: 'stu-1',
      reference: 'DEMO-PAY-000009', gatewayTxnRef: 'TXN-9', amountMinor: 300000,
      method: 'BANK_TRANSFER', sessionId: 's', termId: 't', occurredAt: new Date().toISOString(),
    }, db as never);

    const before = await rows(db, 'ledger_entries');
    const original = before.find((r) => r.source_document_id === 'DEMO-PAY-000009');
    expect(original).toBeTruthy();

    const reversal = await postReversalForPayment({
      studentId: 'stu-1', originalReference: 'DEMO-PAY-000009',
      reason: 'Duplicate transfer (demo)', occurredAt: new Date().toISOString(),
    }, db as never);
    expect(reversal.ok).toBe(true);

    const after = await rows(db, 'ledger_entries');
    // Original untouched (append-only).
    expect(after.find((r) => r.id === original!.id)).toEqual(original);
    // Compensating REVERSAL entry negates the credit.
    const reversalEntry = after.find((r) => r.entry_type === 'REVERSAL');
    expect(reversalEntry).toBeTruthy();
    expect(Number(reversalEntry!.amount_minor)).toBe(300000);
    expect(reversalEntry!.entry_direction).toBe('DEBIT');

    // Double reversal rejected.
    const again = await postReversalForPayment({
      studentId: 'stu-1', originalReference: 'DEMO-PAY-000009',
      reason: 'again', occurredAt: new Date().toISOString(),
    }, db as never);
    expect(again.ok).toBe(false);
  });

  it('SandboxLedgerProvider rejects duplicate source documents and maps rows to domain shape', async () => {
    const db = createFakeSandboxDb();
    const providerModule = await import('../providers/sandboxProviders');
    const provider = new providerModule.SandboxLedgerProvider();

    const built = await import('../../shared/ledger/LedgerEngine').then(({ LedgerEngine }) =>
      LedgerEngine.createEntry({
        organizationId: 'demo-org', schoolId: 'demo-school', studentId: 'stu-x',
        billingProfileId: '', transactionGroupId: 'g', sourceDocumentType: 'PAYMENT',
        sourceDocumentId: 'DEMO-PAY-777', academicSessionId: 's', academicTermId: 't',
        entryType: 'PAYMENT', entryDirection: 'CREDIT', amountMinor: 123456,
        currency: 'NGN', sourceEntity: 'PAYMENT', occurredAt: new Date().toISOString(),
        postingDate: new Date().toISOString(),
      }),
    );
    expect(built.error).toBeNull();

    const firstPost = await provider.createEntry(built.data!);
    expect(firstPost.error).toBeNull();
    expect(firstPost.data!.amountMinor).toBe(123456);
    expect(firstPost.data!.hashAlgorithm).toBe('SHA256_V1');

    const secondPost = await provider.createEntry(built.data!);
    expect(secondPost.data).toBeNull();
    expect(secondPost.error?.code).toBe('DUPLICATE_LEDGER_ENTRY');

    const listed = await provider.listEntriesByStudent('stu-x');
    expect(listed.data!.length).toBe(1);
    expect(listed.data![0]!.sourceDocumentId).toBe('DEMO-PAY-777');
  });
});
