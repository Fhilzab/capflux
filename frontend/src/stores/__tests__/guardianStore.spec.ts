/**
 * guardianStore.spec.ts — registry + relationship actions through Pinia.
 * Uses the vi.hoisted plain-values pattern with a fake Dexie.
 */
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const fakeReady = vi.hoisted(async () => {
  const { createFakeDb } = await import('../../features/students/services/__tests__/helpers/fakeDexie');
  return createFakeDb([
    'students',
    'guardians',
    'student_guardians',
    'ledger_entries',
    'sync_queue',
  ]);
});

vi.mock('@/offline/localDb', async () => {
  const fake = await fakeReady;
  const d = fake.db as any;
  return {
    default: d,
    db: d,
    LocalRepository: {
      saveGuardian: async (row: any) => d.guardians.put(row),
      saveStudentGuardian: async (row: any) => d.student_guardians.put(row),
      deleteStudentGuardian: (id: string) => d.student_guardians.delete(id),
      getGuardianLinksForStudent: (studentId: string) =>
        d.student_guardians.where('student_id').equals(studentId).toArray(),
      getStudentsForGuardian: (guardianId: string) =>
        d.student_guardians.where('guardian_id').equals(guardianId).toArray(),
      findGuardianByPhone: async (schoolId: string, phone: string) =>
        (await d.guardians.where('school_id').equals(schoolId).toArray())
          .find((g: any) => g.primary_phone === phone),
      enqueueSyncItem: async (item: any) => d.sync_queue.put({ id: crypto.randomUUID(), ...item }),
      getGuardiansBySchool: (schoolId: string) => d.guardians.where('school_id').equals(schoolId).toArray(),
    },
  };
});

// The store reads the school context from schoolStore.
const schoolStoreMock = vi.hoisted(() => ({
  currentSchoolId: 'school-1' as string | null,
}));

vi.mock('@/stores/schoolStore', () => ({
  useSchoolStore: () => schoolStoreMock,
}));

import { useGuardianStore } from '@/stores/guardianStore';

let fake: Awaited<typeof fakeReady>;

beforeAll(async () => {
  fake = await fakeReady;
});

const SCHOOL = 'school-1';

beforeEach(() => {
  setActivePinia(createPinia());
  fake.reset();
  schoolStoreMock.currentSchoolId = SCHOOL;
  (fake.db.students as any).seed([
    { id: 'stu-1', school_id: SCHOOL, first_name: 'Ada', last_name: 'Obi', guardian_id: 'g-1' },
  ]);
  (fake.db.guardians as any).seed([
    { id: 'g-1', school_id: SCHOOL, full_name: 'Mrs. Obi', primary_phone: '08011111111' },
    { id: 'g-2', school_id: SCHOOL, full_name: 'Mr. Tunde', primary_phone: '08022222222' },
  ]);
});

describe('guardianStore — registry', () => {
  it('loadGuardians reads local-first and initializes once', async () => {
    const store = useGuardianStore();
    await store.initialize();
    await store.initialize(); // second call is a no-op
    expect(store.guardians).toHaveLength(2);
  });

  it('createGuardian persists offline-first and refreshes the registry', async () => {
    const store = useGuardianStore();
    const created = await store.createGuardian({
      full_name: 'New Guardian',
      primary_phone: '08099999999',
    });
    expect(created).not.toBeNull();
    const all = await (fake.db.guardians as any).snapshot();
    expect(all.some((g: any) => g.primary_phone === '08099999999')).toBe(true);
    // Outbox received a guardians upsert.
    const queue = await (fake.db.sync_queue as any).snapshot();
    expect(queue.some((q: any) => q.entity_type === 'guardians')).toBe(true);
  });

  it('updateGuardian works (regression: was calling undefined lowercase service)', async () => {
    const store = useGuardianStore();
    const ok = await store.updateGuardian('g-2', { email: 'tunde@example.com' });
    expect(ok).toBe(true);
    const g2 = await (fake.db.guardians as any).get('g-2');
    expect(g2?.email).toBe('tunde@example.com');
  });
});

describe('guardianStore — relationships', () => {
  it('link → setPrimary → unlink round-trip keeps one primary and mirrors pointer', async () => {
    const store = useGuardianStore();
    await (fake.db.student_guardians as any).seed([
      {
        id: 'link-1', school_id: SCHOOL, student_id: 'stu-1', guardian_id: 'g-1',
        relationship: 'MOTHER', is_primary: true,
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      },
    ]);

    const linked = await store.linkGuardian({
      schoolId: SCHOOL, studentId: 'stu-1', guardianId: 'g-2', relationship: 'FATHER',
    });
    expect(linked).toBe(true);

    const links = store.linksByStudent['stu-1'] ?? [];
    const g2Link = links.find((l) => l.guardian_id === 'g-2')!;

    const promoted = await store.setPrimaryGuardian('stu-1', g2Link.id);
    expect(promoted).toBe(true);
    let after = store.linksByStudent['stu-1'] ?? [];
    expect(after.filter((l) => l.is_primary)).toHaveLength(1);
    expect(after.find((l) => l.is_primary)?.guardian_id).toBe('g-2');

    const student = await (fake.db.students as any).get('stu-1');
    expect(student.guardian_id).toBe('g-2');

    const removed = await store.unlinkGuardian(g2Link.id, 'stu-1');
    expect(removed).toBe(true);
    after = store.linksByStudent['stu-1'] ?? [];
    expect(after.filter((l) => l.is_primary)).toHaveLength(1); // g-1 re-promoted
  });

  it('updateRelationshipType flows through the store action', async () => {
    const store = useGuardianStore();
    await (fake.db.student_guardians as any).seed([
      {
        id: 'link-1', school_id: SCHOOL, student_id: 'stu-1', guardian_id: 'g-1',
        relationship: 'MOTHER', is_primary: true,
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      },
    ]);
    const ok = await store.updateRelationshipType('stu-1', 'link-1', 'AUNT');
    expect(ok).toBe(true);
    const links = store.linksByStudent['stu-1'] ?? [];
    expect(links.find((l) => l.id === 'link-1')?.relationship).toBe('AUNT');
  });

  it('refreshStudentCounts counts in a single scan (no N+1)', async () => {
    const store = useGuardianStore();
    await (fake.db.student_guardians as any).seed([
      { id: 'l1', school_id: SCHOOL, student_id: 'stu-1', guardian_id: 'g-1', relationship: 'MOTHER', is_primary: true, created_at: '', updated_at: '' },
      { id: 'l2', school_id: SCHOOL, student_id: 'stu-1', guardian_id: 'g-2', relationship: 'FATHER', is_primary: false, created_at: '', updated_at: '' },
      { id: 'l3', school_id: SCHOOL, student_id: 'stu-1', guardian_id: 'g-1', relationship: 'MOTHER', is_primary: false, created_at: '', updated_at: '' },
    ]);
    const counts = await store.refreshStudentCounts();
    expect(counts['g-1']).toBe(2);
    expect(counts['g-2']).toBe(1);
  });
});
