/**
 * Deterministic seeding + complete reset restoration.
 */
import { describe, expect, it } from 'vitest';
import {
  createFakeSandboxDb,
  useSandboxFixture,
  type FakeSandboxDb,
} from './helpers/sandboxTestHarness';
import { SEED_COUNTS } from '../seed/seedSandbox';
import type { SeedResult } from '../seed/seedSandbox';

describe('sandbox seeder determinism', () => {
  useSandboxFixture();

  async function seed(db: FakeSandboxDb): Promise<SeedResult> {
    const { seedSandboxDatabase } = await import('../seed/seedSandbox');
    return seedSandboxDatabase(db as never);
  }

  it('produces the spec-required dataset volumes', async () => {
    const result = await seed(createFakeSandboxDb());
    expect(result.students).toBeGreaterThanOrEqual(100);
    expect(result.students).toBe(SEED_COUNTS.students);
    expect(result.guardians).toBeGreaterThanOrEqual(60);
    expect(result.payments).toBeGreaterThan(100);
    // Every payment and charge is a real append-only ledger entry.
    expect(result.ledgerEntries).toBeGreaterThan(result.payments + SEED_COUNTS.students * 2);
  });

  it('two independent seeds yield IDENTICAL content (deterministic reset)', async () => {
    const first = await seed(createFakeSandboxDb());
    const second = await seed(createFakeSandboxDb());
    expect(second.datasetHash).toBe(first.datasetHash);
  });

  it('covers every status class of payments', async () => {
    const db = createFakeSandboxDb();
    await seed(db);
    const statuses = new Set(
      ((db.payment_transactions as unknown as { toArray(): Promise<Array<Record<string, unknown>>> }).toArray())
        ? null : null,
    );
    void statuses;
    const rows: Array<Record<string, unknown>> = [];
    for (const row of await (db.payment_transactions as unknown as { toArray(): Promise<Array<Record<string, unknown>>> }).toArray()) {
      rows.push(row);
    }
    const present = new Set(rows.map((r) => r.status));
    expect(present.has('SUCCESS')).toBe(true);
    expect(present.has('PENDING')).toBe(true);
    expect(present.has('FAILED')).toBe(true);
    expect(present.has('REVERSED')).toBe(true);

    // Reversed payments must carry a compensating REVERSAL ledger entry.
    const ledgerRows = await (db.ledger_entries as unknown as { toArray(): Promise<Array<Record<string, unknown>>> }).toArray();
    const reversals = ledgerRows.filter((r) => r.entry_type === 'REVERSAL');
    const reversedTxns = rows.filter((r) => r.status === 'REVERSED');
    expect(reversals.length).toBe(reversedTxns.length);
  });

  it('seeds the full Nigerian academic structure', async () => {
    const db = createFakeSandboxDb();
    await seed(db);
    const levels: Array<Record<string, unknown>> =
      await (db.academic_levels as unknown as { toArray(): Promise<Array<Record<string, unknown>>> }).toArray();
    const names = levels.map((l) => String(l.name));
    for (const expected of ['Nursery 1', 'Primary 6', 'JSS 3', 'SS 3']) {
      expect(names).toContain(expected);
    }
    const divisions: Array<Record<string, unknown>> =
      await (db.school_divisions as unknown as { toArray(): Promise<Array<Record<string, unknown>>> }).toArray();
    expect(divisions.length).toBe(4);

    // Active + previous session.
    const sessions: Array<Record<string, unknown>> =
      await (db.academic_sessions as unknown as { toArray(): Promise<Array<Record<string, unknown>>> }).toArray();
    expect(sessions.filter((s) => s.status === 'ACTIVE').length).toBe(1);
    expect(sessions.some((s) => s.status === 'COMPLETED')).toBe(true);
  });

  it('every student has an ACTIVE enrollment in the current session', async () => {
    const db = createFakeSandboxDb();
    await seed(db);
    const enrollments: Array<Record<string, unknown>> =
      await (db.student_enrollments as unknown as { toArray(): Promise<Array<Record<string, unknown>>> }).toArray();
    const activeCurrent = enrollments.filter(
      (e) => e.status === 'ACTIVE' && e.academic_session_id === 'sd-ses-cur',
    );
    expect(activeCurrent.length).toBe(SEED_COUNTS.students);
    // History rows exist too (movement/promotion provenance).
    expect(enrollments.length).toBeGreaterThan(SEED_COUNTS.students);
  });

  it('provisions dedicated CAPFLUX Demo Bank virtual accounts', async () => {
    const db = createFakeSandboxDb();
    await seed(db);
    const accounts: Array<Record<string, unknown>> =
      await (db.payment_accounts as unknown as { toArray(): Promise<Array<Record<string, unknown>>> }).toArray();
    expect(accounts.length).toBe(SEED_COUNTS.students);
    for (const account of accounts.slice(0, 10)) {
      expect(String(account.bank_name)).toBe('CAPFLUX Demo Bank');
      expect(String(account.virtual_account_number)).toMatch(/^100\d{7}$/);
      expect(String(account.account_name)).toContain('CAPFLUX DEMO ACADEMY');
    }
  });

  it('ledger hash chain is coherent per student', async () => {
    const db = createFakeSandboxDb();
    await seed(db);
    const entries: Array<Record<string, unknown>> =
      await (db.ledger_entries as unknown as { toArray(): Promise<Array<Record<string, unknown>>> }).toArray();
    const byStudent = new Map<string, Array<Record<string, unknown>>>();
    for (const entry of entries) {
      const key = String(entry.student_id);
      const list = byStudent.get(key) ?? [];
      list.push(entry);
      byStudent.set(key, list);
    }
    for (const [, list] of byStudent) {
      const sorted = list.sort((a, b) => Number(a.sequence_number) - Number(b.sequence_number));
      let previousBalance = 0;
      let previousHash: string | null = null;
      for (const entry of sorted) {
        if (previousHash !== null) {
          expect(entry.previous_hash).toBe(previousHash);
        }
        const expected =
          previousBalance +
          (entry.entry_direction === 'DEBIT' ? Number(entry.amount_minor) : -Number(entry.amount_minor));
        expect(Number(entry.balance_after_minor)).toBe(expected);
        previousBalance = expected;
        previousHash = String(entry.entry_hash);
      }
    }
  });
});
