/**
 * Shared harness for sandbox unit tests.
 *
 * - re-resolves the runtime environment into SANDBOX mode before each test
 *   (the mode is a process-wide singleton, so tests must restore it);
 * - builds a full in-memory "sandbox database" from the project's fake-Dexie
 *   helper and injects it through the sanctioned `__setSandboxDbForTest`
 *   seam;
 * - signs demo sessions into localStorage so API handlers see callers.
 */
import { beforeEach } from 'vitest';
// eslint-disable-next-line import/order -- harness intentionally loads the env module first
import {
  __resolveRuntimeEnvironmentForTests,
  resolveAppMode,
} from '../../../shared/environment/runtimeEnvironment';
import { __setSandboxDbForTest } from '../../sandboxDb';
import { createFakeDb, type FakeDb } from '../../../features/students/services/__tests__/helpers/fakeDexie';
import type { FakeSandboxDb } from './fakeSandboxDb';

export const SANDBOX_TABLE_NAMES = [
  'schools', 'profiles', 'students', 'guardians', 'student_guardians',
  'student_enrollments', 'academic_sessions', 'academic_terms',
  'school_divisions', 'academic_levels', 'ledger_entries', 'notifications',
  'payment_accounts', 'payment_transactions', 'settlement_records',
  'fees', 'kyc_records', 'kyc_documents', 'settlement_accounts',
  'gateway_assignments', 'reconciliation_runs', 'reconciliation_issues',
  'school_shareholders', 'principal_invitations', 'onboarding_progress',
  'audit_trail', 'sandbox_meta', 'app_settings', 'sync_queue',
];

export function createFakeSandboxDb(): FakeSandboxDb {
  const { db } = createFakeDb(SANDBOX_TABLE_NAMES);
  const extended = db as unknown as FakeSandboxDb;
  extended.tables = SANDBOX_TABLE_NAMES.map((name) => ({ name }));
  extended.table = (name: string) => (db as FakeDb)[name];
  return extended;
}

export interface SandboxTestFixture {
  /** Live fixture database — always resolves to the instance currently injected into getSandboxDb(). */
  readonly db: FakeSandboxDb;
}

/** Call in beforeEach: sandbox mode + fresh isolated db. */
export function useSandboxFixture(): SandboxTestFixture {
  const holder: { current?: FakeSandboxDb } = {};
  beforeEach(() => {
    __resolveRuntimeEnvironmentForTests('sandbox');
    window.localStorage.clear();
    holder.current = createFakeSandboxDb();
    __setSandboxDbForTest(holder.current as never);
  });
  return {
    get db(): FakeSandboxDb {
      if (!holder.current) throw new Error('Fixture not initialised — access db inside a test');
      return holder.current;
    },
  };
}

/** Restore PRODUCTION mode — mandatory in afterEach for security tests. */
export function restoreProductionMode(): void {
  if (resolveAppMode() !== 'production') {
    __resolveRuntimeEnvironmentForTests('production');
  }
  __setSandboxDbForTest(null);
}

export function signInAs(personaId = 'demo-user-owner'): void {
  window.localStorage.setItem('capflux_sandbox_session', JSON.stringify({ personaId }));
}

export function signOut(): void {
  window.localStorage.removeItem('capflux_sandbox_session');
}

export function seedReadySchool(db: FakeSandboxDb): void {
  (db.schools as unknown as FakeDb[string]).put({
    id: 'demo-school',
    organization_id: 'demo-org',
    name: 'CAPFLUX Demo Academy',
    slug: 'capflux-demo-academy',
    status: 'ACTIVE',
    payment_status: 'READY',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}
