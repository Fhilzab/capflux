/** Shape of the fake sandbox db handle (see sandboxTestHarness.ts). */
import type { FakeDb } from '../../../features/students/services/__tests__/helpers/fakeDexie';

export interface FakeSandboxDb extends FakeDb {
  tables: Array<{ name: string }>;
  table(name: string): FakeDb[string];
}
