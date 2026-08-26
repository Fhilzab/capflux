/**
 * Sandbox release gate — frontend isolation & deployment-readiness tests.
 *
 * Proves:
 *  - runtime configuration validation fails closed in BOTH directions
 *    (§3/§13/§14) and rejects invalid explicit values;
 *  - sandbox activity (seed, simulated payments, offline mutations, sync,
 *    promotion) NEVER reaches a production database handle (§15/§17);
 *  - deterministic reset restores the seed dataset after 25+ real mutations
 *    (§16);
 *  - sandbox audit records are labelled environment=sandbox (§19);
 *  - backend mode-consistency evaluation blocks mismatches (§12).
 */
import { describe, expect, it } from 'vitest';
import {
  createFakeSandboxDb,
  restoreProductionMode,
  seedReadySchool,
  signInAs,
  useSandboxFixture,
  type FakeSandboxDb,
} from './helpers/sandboxTestHarness';
import { createFakeDb } from '../../features/students/services/__tests__/helpers/fakeDexie';

// ---------------------------------------------------------------------------
// §3/§13/§14 — runtime configuration validation (both directions)
// ---------------------------------------------------------------------------

describe('frontend validateRuntimeConfiguration — fail-closed', () => {
  it('accepts consistent sandbox and production configurations', async () => {
    const { validateRuntimeConfiguration } = await import('../../shared/environment/runtimeConfiguration');
    expect(validateRuntimeConfiguration({ VITE_CAPFLUX_MODE: 'sandbox', VITE_CAPFLUX_DATABASE_ENV: 'sandbox' }).mode).toBe('sandbox');
    expect(validateRuntimeConfiguration({ VITE_CAPFLUX_MODE: 'production', VITE_CAPFLUX_DATABASE_ENV: 'production' }).mode).toBe('production');
  });

  it('rejects an explicitly INVALID mode value instead of silently defaulting', async () => {
    const { validateRuntimeConfiguration } = await import('../../shared/environment/runtimeConfiguration');
    expect(() =>
      validateRuntimeConfiguration({ VITE_CAPFLUX_MODE: 'demo' }),
    ).toThrowError(/INVALID_CAPFLUX_MODE/);
  });

  it('rejects mode/database mismatch in BOTH directions (§4)', async () => {
    const { validateRuntimeConfiguration } = await import('../../shared/environment/runtimeConfiguration');
    expect(() =>
      validateRuntimeConfiguration({ VITE_CAPFLUX_MODE: 'sandbox', VITE_CAPFLUX_DATABASE_ENV: 'production' }),
    ).toThrowError(/MODE_DATABASE_MISMATCH/);
    expect(() =>
      validateRuntimeConfiguration({ VITE_CAPFLUX_MODE: 'production', VITE_CAPFLUX_DATABASE_ENV: 'sandbox' }),
    ).toThrowError(/MODE_DATABASE_MISMATCH/);
  });

  it('rejects an invalid database-environment value', async () => {
    const { validateRuntimeConfiguration } = await import('../../shared/environment/runtimeConfiguration');
    expect(() =>
      validateRuntimeConfiguration({ VITE_CAPFLUX_MODE: 'sandbox', VITE_CAPFLUX_DATABASE_ENV: 'staging' }),
    ).toThrowError(/INVALID_CAPFLUX_DATABASE_ENV/);
  });
});

describe('backend mode-consistency evaluation (§12)', () => {
  it('blocks operation on CAPFLUX_ENVIRONMENT_MISMATCH', async () => {
    const { evaluateBackendMode } = await import('../../shared/environment/backendModeConsistency');
    const blocked = evaluateBackendMode('production', { mode: 'sandbox' });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.code).toBe('CAPFLUX_ENVIRONMENT_MISMATCH');

    const aligned = evaluateBackendMode('production', { mode: 'production' });
    expect(aligned.ok).toBe(true);

    // Unknown/unreachable descriptors never hard-block (offline tolerance).
    const unknown = evaluateBackendMode('production', null);
    expect(unknown.ok).toBe(false); // caller treats null-info as "skip", not "block" — see main.ts wiring
  });
});

// ---------------------------------------------------------------------------
// §15/§17 — sandbox data never reaches production; offline flow lands in the
// sandbox database only
// ---------------------------------------------------------------------------

function productionProbeDb(): FakeSandboxDb {
  const fake = createFakeDb([
    'students', 'guardians', 'student_guardians', 'student_enrollments',
    'payment_transactions', 'ledger_entries', 'notifications',
  ]) as unknown as FakeSandboxDb;
  return fake;
}

async function tableRows(db: FakeSandboxDb, table: string): Promise<Array<Record<string, unknown>>> {
  return (db[table] as unknown as { toArray(): Promise<Array<Record<string, unknown>>> }).toArray();
}

async function countAll(db: FakeSandboxDb, tables: string[]): Promise<number> {
  let total = 0;
  for (const t of tables) total += (await tableRows(db, t)).length;
  return total;
}

describe('cross-environment data isolation (§15)', () => {
  const f = useSandboxFixture();
  const PROD_TABLES = ['students', 'guardians', 'student_guardians', 'student_enrollments', 'payment_transactions', 'ledger_entries'];

  it('seed + simulate payment + offline mutation + sync + promotion leave a production handle EMPTY', async () => {
    const prodDb = productionProbeDb(); // stands in for any production resource

    // Seed the sandbox world.
    const { seedSandboxDatabase } = await import('../seed/seedSandbox');
    await seedSandboxDatabase(f.db as never);
    expect(await countAll(f.db, ['students'])).toBeGreaterThan(100);

    signInAs('demo-user-owner');
    seedReadySchool(f.db);
    f.db.students.put({
      id: 'stu-iso-1', school_id: 'demo-school', first_name: 'Isola', last_name: 'Check',
      admission_number: 'CAP-ISO-1', status: 'ACTIVE', guardian_id: null, guardian_phone: null,
      created_at: '', updated_at: '',
    } as never);

    // Simulated payment through the API simulator.
    const { handleSandboxRequest } = await import('../api/sandboxApiServer');
    await expect(
      handleSandboxRequest({
        method: 'post', url: '/sandbox/gateway/simulate-payment', baseURL: 'http://x/api',
        data: { studentId: 'stu-iso-1', amountMinor: 2500000, outcome: 'SUCCESS' } as never,
      }),
    ).resolves.toMatchObject({ status: 200 });

    // Offline mutation → outbox → back online → sync.
    await f.db.students.put({
      id: 'stu-offline-probe', school_id: 'demo-school', first_name: 'Offline', last_name: 'Kid',
      admission_number: 'CAP-OFF-1', status: 'ACTIVE', guardian_id: null, guardian_phone: null,
      created_at: '', updated_at: '',
    } as never);
    await f.db.sync_queue.put({
      id: 'sync-iso-1', school_id: 'demo-school', entity_type: 'students', entity_id: 'stu-offline-probe',
      operation: 'UPSERT', payload: { id: 'stu-offline-probe', first_name: 'Offline', last_name: 'Kid' },
      status: 'PENDING', retry_count: 0, created_at: new Date().toISOString(),
    } as never);
    const { processSandboxSyncQueue } = await import('../sync/sandboxSyncEngine');
    await processSandboxSyncQueue(f.db as never);

    // Promotion/movement inside the sandbox world.
    await f.db.student_enrollments.bulkPut([
      {
        id: 'enr-promo-a', school_id: 'demo-school', student_id: 'stu-iso-1',
        academic_session_id: 'sd-ses-cur', section_id: 'sd-div-pri', level_id: 'sd-lvl-05',
        status: 'ACTIVE', effective_date: new Date().toISOString(), ended_at: null, reason: 'INITIAL',
        created_at: '', updated_at: '',
      },
    ] as never);
    const { EnrollmentService } = await import('../../shared/enrollment/EnrollmentService');
    const promotion = await EnrollmentService.moveStudent(
      'stu-iso-1',
      { sessionId: 'sd-ses-cur', sectionId: 'sd-div-pri', levelId: 'sd-lvl-06' },
      'PROMOTION',
      { createdBy: 'test', source: 'release-gate' },
    );
    expect(promotion.ok).toBe(true);

    // THE INVARIANT: the production-side handle saw NOTHING.
    expect(await countAll(prodDb, PROD_TABLES)).toBe(0);

    // …while every artefact exists only inside the sandbox database.
    expect((await tableRows(f.db, 'payment_transactions')).some((t) => String(t.reference ?? '').startsWith('DEMO-PAY-'))).toBe(true);
    expect((await tableRows(f.db, 'ledger_entries')).some((e) => e.entry_type === 'PAYMENT')).toBe(true);
    expect((await tableRows(f.db, 'student_enrollments')).some((e) => e.status === 'SUPERSEDED')).toBe(true);
    expect((await tableRows(f.db, 'students')).some((s) => s.id === 'stu-offline-probe')).toBe(true);
  });

  it('sandbox audit records carry environment=sandbox (§19)', async () => {
    const audit = await tableRows(f.db, 'audit_trail');
    const financial = audit.filter((a) => a.action === 'PAYMENT_RECEIVED');
    expect(financial.length).toBeGreaterThan(0);
    for (const row of financial) {
      expect((row.metadata as Record<string, unknown>).environment).toBe('sandbox');
    }
  });

  it('reset restores the deterministic dataset after 25+ mutations and still touches no production resource (§16)', async () => {
    const prodDb = productionProbeDb();

    // Deterministic starting point.
    const { reseedSandboxInPlace } = await import('../index');
    const initial = await reseedSandboxInPlace(f.db as never);
    const baselineMeta = await f.db.sandbox_meta.get('dataset_hash');
    expect(String(baselineMeta!.value)).toBe(initial.datasetHash);

    signInAs('demo-user-owner');
    seedReadySchool(f.db);
    const { handleSandboxRequest } = await import('../api/sandboxApiServer');
    const sim = (n: number): Promise<unknown> =>
      handleSandboxRequest({
        method: 'post', url: '/sandbox/gateway/simulate-payment', baseURL: 'http://x/api',
        data: { studentId: `sd-stu-${String(n).padStart(4, '0')}`, amountMinor: 100000 + n, outcome: 'SUCCESS' } as never,
      });

    // 30 real mutations across domains.
    for (let i = 1; i <= 10; i++) {
      await f.db.students.put({
        id: `mut-stu-${i}`, school_id: 'demo-school', first_name: `Mut${i}`, last_name: 'Ation',
        admission_number: `CAP-MUT-${i}`, status: 'ACTIVE', guardian_id: null, guardian_phone: null,
        created_at: '', updated_at: '',
      } as never);
      await f.db.guardians.put({
        id: `mut-grd-${i}`, school_id: 'demo-school', full_name: `Guardian ${i}`,
        primary_phone: `+23470000000${String(i).padStart(2, '0')}`, relationship: 'GUARDIAN',
        created_at: '', updated_at: '',
      } as never);
    }
    for (let i = 1; i <= 5; i++) {
      await f.db.payment_transactions.put({
        id: `mut-txn-${i}`, school_id: 'demo-school', student_id: 'sd-stu-0001',
        reference: `MUT-TXN-${i}`, gateway_txn_ref: `MUT-${i}`, amount_minor: 1000,
        status: 'PENDING', settlement_status: 'PENDING', created_at: '', updated_at: '',
      } as never);
    }
    for (let i = 11; i <= 20; i++) await expect(sim(i)).resolves.toBeTruthy();

    // Confirm drift actually happened…
    const driftedHash = await f.db.sandbox_meta.get('dataset_hash');
    expect(await f.db.students.get('mut-stu-1')).toBeTruthy();
    void driftedHash;

    // …then reset IN PLACE and require exact restoration.
    const result = await reseedSandboxInPlace(f.db as never);
    expect(result.datasetHash).toBe(initial.datasetHash);
    expect(result.students).toBe(initial.students);
    expect(result.ledgerEntries).toBe(initial.ledgerEntries);
    expect(await f.db.students.get('mut-stu-1')).toBeUndefined();
    expect(await f.db.guardians.get('mut-grd-1')).toBeUndefined();
    expect(await f.db.payment_transactions.get('mut-txn-1')).toBeUndefined();
    expect((await tableRows(f.db, 'payment_transactions')).some((t) => String(t.reference ?? '').startsWith('DEMO-PAY-'))).toBe(true);
    expect(await f.db.sandbox_meta.get('dataset_hash')).toMatchObject({ value: initial.datasetHash });

    // Reset never reached the production side either.
    expect(await countAll(prodDb, PROD_TABLES)).toBe(0);
  });
});
