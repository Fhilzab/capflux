/**
 * Sandbox financial integrity — the people scale up, the money rules do not change.
 *
 * Charges, payments and reversals are real append-only ledger entries with a
 * per-student SHA256_V1 hash chain; balances are derived (never stored):
 *   assessed   = SUM(CHARGE debits)
 *   collected  = SUM(PAYMENT credits) net of reversals
 *   outstanding = assessed − collected
 * No unexplained negative balances may exist.
 */
import { describe, expect, it } from 'vitest';
import {
  createFakeSandboxDb,
  useSandboxFixture,
  type FakeSandboxDb,
} from './helpers/sandboxTestHarness';
import type { SeedResult } from '../seed/seedSandbox';

async function rows(db: FakeSandboxDb, table: string): Promise<Array<Record<string, unknown>>> {
  return (db[table] as unknown as { toArray(): Promise<Array<Record<string, unknown>>> }).toArray();
}

describe('sandbox financial integrity', () => {
  useSandboxFixture();

  async function seed(db: FakeSandboxDb): Promise<SeedResult> {
    const { seedSandboxDatabase } = await import('../seed/seedSandbox');
    return seedSandboxDatabase(db as never);
  }

  it('assessed = collected + outstanding across the ledger', async () => {
    const db = createFakeSandboxDb();
    await seed(db);
    const entries = await rows(db, 'ledger_entries');

    let assessed = 0;
    let collected = 0;
    const balanceByStudent = new Map<string, number>();
    for (const e of entries) {
      const student = String(e.student_id);
      const amount = Number(e.amount_minor);
      const direction = String(e.entry_direction);
      const type = String(e.entry_type);
      if (type === 'CHARGE' && direction === 'DEBIT') assessed += amount;
      if (type === 'PAYMENT' && direction === 'CREDIT') collected += amount;
      if (type === 'REVERSAL' && direction === 'DEBIT') collected -= amount;
      balanceByStudent.set(student, (balanceByStudent.get(student) ?? 0) + (direction === 'DEBIT' ? amount : -amount));
    }

    let outstanding = 0;
    for (const balance of balanceByStudent.values()) {
      if (balance > 0) outstanding += balance;
    }

    expect(assessed).toBeGreaterThan(0);
    expect(collected).toBeGreaterThan(0);
    expect(outstanding).toBeGreaterThan(0);
    // Exact reconciliation: every kobo assessed is either collected or outstanding.
    expect(assessed).toBe(collected + outstanding);
  });

  it('has no unexplained negative balances', async () => {
    const db = createFakeSandboxDb();
    await seed(db);
    const entries = await rows(db, 'ledger_entries');
    const balanceByStudent = new Map<string, number>();
    for (const e of entries) {
      const student = String(e.student_id);
      const amount = Number(e.amount_minor);
      balanceByStudent.set(
        student,
        (balanceByStudent.get(student) ?? 0) + (String(e.entry_direction) === 'DEBIT' ? amount : -amount),
      );
    }
    const negatives = [...balanceByStudent.entries()].filter(([, b]) => b < 0);
    expect(negatives.length).toBe(0);
  });

  it('meaningful share of students carry outstanding balances', async () => {
    const db = createFakeSandboxDb();
    await seed(db);
    const entries = await rows(db, 'ledger_entries');
    const balanceByStudent = new Map<string, number>();
    for (const e of entries) {
      const student = String(e.student_id);
      const amount = Number(e.amount_minor);
      balanceByStudent.set(
        student,
        (balanceByStudent.get(student) ?? 0) + (String(e.entry_direction) === 'DEBIT' ? amount : -amount),
      );
    }
    const withBalance = [...balanceByStudent.values()].filter((b) => b > 0).length;
    // Partial + unpaid students must be a visible cohort, not a rounding error.
    expect(withBalance).toBeGreaterThan(50);
  });

  it('every payment references a valid student and every DVA belongs to one student', async () => {
    const db = createFakeSandboxDb();
    await seed(db);
    const students = await rows(db, 'students');
    const studentIds = new Set(students.map((s) => String(s.id)));
    const payments = await rows(db, 'payment_transactions');
    expect(payments.length).toBeGreaterThan(100);
    for (const p of payments) {
      expect(studentIds.has(String(p.student_id))).toBe(true);
    }
    const accounts = await rows(db, 'payment_accounts');
    expect(accounts.length).toBe(students.length);
    const seen = new Set<string>();
    for (const a of accounts) {
      expect(studentIds.has(String(a.student_id))).toBe(true);
      expect(seen.has(String(a.student_id))).toBe(false);
      seen.add(String(a.student_id));
    }
  });

  it('reversed payments carry compensating REVERSAL ledger entries', async () => {
    const db = createFakeSandboxDb();
    await seed(db);
    const payments = await rows(db, 'payment_transactions');
    const entries = await rows(db, 'ledger_entries');
    const reversed = payments.filter((p) => p.status === 'REVERSED');
    expect(reversed.length).toBeGreaterThan(0);
    const reversals = entries.filter((e) => e.entry_type === 'REVERSAL');
    expect(reversals.length).toBe(reversed.length);
    const reversedRefs = new Set(reversed.map((p) => String(p.reference)));
    for (const r of reversals) {
      expect(reversedRefs.has(String(r.source_document_id))).toBe(true);
    }
  });

  it('open reconciliation issues reference real seeded payments', async () => {
    const db = createFakeSandboxDb();
    await seed(db);
    const payments = await rows(db, 'payment_transactions');
    const references = new Set(payments.map((p) => String(p.reference)));
    const issues = await rows(db, 'reconciliation_issues');
    const open = issues.filter((i) => i.status === 'OPEN');
    expect(open.length).toBeGreaterThanOrEqual(1);
    for (const issue of open) {
      expect(references.has(String(issue.reference))).toBe(true);
    }
  });

  it('collection rate is a believable partial-collection story', async () => {
    const db = createFakeSandboxDb();
    await seed(db);
    const entries = await rows(db, 'ledger_entries');
    let assessed = 0;
    let collected = 0;
    for (const e of entries) {
      const amount = Number(e.amount_minor);
      if (String(e.entry_type) === 'CHARGE') assessed += amount;
      if (String(e.entry_type) === 'PAYMENT') collected += amount;
      if (String(e.entry_type) === 'REVERSAL') collected -= amount;
    }
    const rate = collected / assessed;
    expect(rate).toBeGreaterThan(0.3);
    expect(rate).toBeLessThan(0.95);
  });
});
