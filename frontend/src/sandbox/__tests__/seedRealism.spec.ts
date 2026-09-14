/**
 * Sandbox data realism — the demo must read like a functioning Nigerian
 * private school, not a generated fixture. Ranges and invariants are asserted
 * (never exact magic counts), so the seed can evolve without brittle tests.
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

describe('sandbox data realism', () => {
  useSandboxFixture();

  async function seed(db: FakeSandboxDb): Promise<SeedResult> {
    const { seedSandboxDatabase } = await import('../seed/seedSandbox');
    return seedSandboxDatabase(db as never);
  }

  it('scales people, money and operations together', async () => {
    const db = createFakeSandboxDb();
    const result = await seed(db);
    expect(result.students).toBeGreaterThan(400);
    expect(result.guardians).toBeGreaterThan(64);
    expect(result.guardians).toBeGreaterThanOrEqual(200);
    expect(result.payments).toBeGreaterThan(300);
    expect(result.ledgerEntries).toBeGreaterThan(result.payments + result.students * 2);
  });

  it('uses realistic admission numbers and human names', async () => {
    const db = createFakeSandboxDb();
    await seed(db);
    const students = await rows(db, 'students');
    for (const s of students.slice(0, 50)) {
      expect(String(s.admission_number)).toMatch(/^CAP\/(2024|2025)\/\d{4}$/);
      expect(`${s.first_name} ${s.last_name}`).not.toMatch(/student\s*\d+/i);
    }
    const genders = new Set(students.map((s) => String(s.gender)));
    expect(genders.has('Male')).toBe(true);
    expect(genders.has('Female')).toBe(true);
  });

  it('covers multiple payment statuses, dates and fee categories', async () => {
    const db = createFakeSandboxDb();
    await seed(db);
    const payments = await rows(db, 'payment_transactions');
    const statuses = new Set(payments.map((p) => String(p.status)));
    for (const expected of ['SUCCESS', 'PENDING', 'FAILED', 'REVERSED']) {
      expect(statuses.has(expected)).toBe(true);
    }
    const days = new Set(payments.map((p) => String(p.created_at).slice(0, 10)));
    expect(days.size).toBeGreaterThan(5);

    const fees = await rows(db, 'fees');
    const codes = new Set(fees.map((f) => String(f.code)));
    for (const expected of ['TUITION', 'DEVLEVY', 'EXAM']) {
      expect(codes.has(expected)).toBe(true);
    }
  });

  it('keeps every virtual account synthetic, deterministic and sandbox-scoped', async () => {
    const db = createFakeSandboxDb();
    await seed(db);
    const accounts = await rows(db, 'payment_accounts');
    for (const a of accounts.slice(0, 25)) {
      expect(String(a.bank_name)).toBe('CAPFLUX Demo Bank');
      expect(String(a.virtual_account_number)).toMatch(/^100\d{7}$/);
      expect(String(a.account_name)).toContain('CAPFLUX DEMO ACADEMY');
    }
  });

  it('keeps KYC/settlement synthetic with masked identifiers only', async () => {
    const db = createFakeSandboxDb();
    await seed(db);
    const kyc = await rows(db, 'kyc_records');
    expect(kyc[0]?.status).toBe('VERIFIED');
    expect(String(kyc[0]?.bvn_encrypted)).toContain('sandbox-marker');
    const settlement = await rows(db, 'settlement_accounts');
    expect(settlement[0]?.status).toBe('VERIFIED');

    const meta = await rows(db, 'sandbox_meta');
    const version = meta.find((m) => String(m.key) === 'seed_version');
    expect(Number(version?.value)).toBe(4);
  });

  it('leaves an actionable reconciliation trail with history', async () => {
    const db = createFakeSandboxDb();
    await seed(db);
    const runs = await rows(db, 'reconciliation_runs');
    expect(runs.length).toBeGreaterThanOrEqual(3);
    const issues = await rows(db, 'reconciliation_issues');
    expect(issues.some((i) => i.status === 'OPEN')).toBe(true);
  });

  it('seed writes the current SEED_VERSION so the boot gate recognises it', async () => {
    const { SEED_VERSION } = await import('../seed/seedSandbox');
    const db = createFakeSandboxDb();
    await seed(db);
    const meta = await rows(db, 'sandbox_meta');
    const version = meta.find((m) => String(m.key) === 'seed_version');
    expect(Number(version?.value)).toBe(SEED_VERSION);
    // A stale v3 dataset must read as outdated against the current version,
    // otherwise returning visitors would never upgrade to the new seed.
    expect(3).toBeLessThan(SEED_VERSION);
  });
});
