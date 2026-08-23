/**
 * StudentGuardianService tests — link/unlink, primary uniqueness,
 * and reuse (never duplication) of guardian records.
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

const fakeReady = vi.hoisted(async () => {
  const { createFakeDb } = await import('../../../features/students/services/__tests__/helpers/fakeDexie');
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
    db: d,
    LocalRepository: {
      saveStudentGuardian: async (row: any) => d.student_guardians.put(row),
      deleteStudentGuardian: (id: string) => d.student_guardians.delete(id),
      getGuardianLinksForStudent: (studentId: string) =>
        d.student_guardians.where('student_id').equals(studentId).toArray(),
      getStudentsForGuardian: (guardianId: string) =>
        d.student_guardians.where('guardian_id').equals(guardianId).toArray(),
      enqueueSyncItem: async (item: any) => d.sync_queue.put({ id: crypto.randomUUID(), ...item }),
    },
  };
});

import { StudentGuardianService } from '@/shared/guardians/StudentGuardianService';
import { db } from '@/offline/localDb';

let fake: Awaited<typeof fakeReady>;

beforeAll(async () => {
  fake = await fakeReady;
});

const SCHOOL = 'school-1';

beforeEach(() => {
  fake.reset();
  (fake.db.students as any).seed([
    { id: 'stu-1', school_id: SCHOOL, first_name: 'Ada', last_name: 'Obi', status: 'ACTIVE', guardian_id: 'g-1' },
    { id: 'stu-2', school_id: SCHOOL, first_name: 'Emeka', last_name: 'Obi', status: 'ACTIVE', guardian_id: 'g-1' },
  ]);
  (fake.db.guardians as any).seed([
    { id: 'g-1', school_id: SCHOOL, full_name: 'Mrs. Obi', primary_phone: '08011111111' },
    { id: 'g-2', school_id: SCHOOL, full_name: 'Mr. Tunde', primary_phone: '08022222222' },
  ]);
  // Pre-existing primary links from the migration backfill.
  for (const stu of ['stu-1', 'stu-2']) {
    (fake.db.student_guardians as any).seed([
      {
        id: `link-${stu}`,
        school_id: SCHOOL,
        student_id: stu,
        guardian_id: 'g-1',
        relationship: 'MOTHER',
        is_primary: true,
        created_at: new Date().toISOString(),
      },
    ]);
  }
});

describe('StudentGuardianService — linking', () => {
  it('links a second guardian to a student', async () => {
    const result = await StudentGuardianService.linkGuardian({
      schoolId: SCHOOL, studentId: 'stu-1', guardianId: 'g-2', relationship: 'FATHER',
    });
    expect(result.ok).toBe(true);
    const links = await StudentGuardianService.getGuardiansForStudent('stu-1');
    expect(links).toHaveLength(2);
  });

  it('rejects duplicate links and unknown guardians', async () => {
    const dupe = await StudentGuardianService.linkGuardian({
      schoolId: SCHOOL, studentId: 'stu-1', guardianId: 'g-1',
    });
    expect(dupe.ok).toBe(false);
    if (!dupe.ok) expect(dupe.error.code).toBe('LINK_EXISTS');

    const ghost = await StudentGuardianService.linkGuardian({
      schoolId: SCHOOL, studentId: 'stu-1', guardianId: 'ghost',
    });
    expect(ghost.ok).toBe(false);
    if (!ghost.ok) expect(ghost.error.code).toBe('GUARDIAN_NOT_FOUND');
  });

  it('does not duplicate guardian records when linking across students', async () => {
    await StudentGuardianService.linkGuardian({
      schoolId: SCHOOL, studentId: 'stu-2', guardianId: 'g-2', relationship: 'FATHER',
    });
    const guardians = await (fake.db.guardians as any).snapshot();
    expect(guardians).toHaveLength(2); // g-1 + g-2 only — no new rows
  });
});

describe('StudentGuardianService — primary management', () => {
  it('setPrimaryGuardian makes exactly one link primary and mirrors to students.guardian_id', async () => {
    await StudentGuardianService.linkGuardian({
      schoolId: SCHOOL, studentId: 'stu-1', guardianId: 'g-2', relationship: 'FATHER',
    });
    const links = await StudentGuardianService.getGuardiansForStudent('stu-1');
    const g2Link = links.find((l) => l.guardian_id === 'g-2')!;

    const result = await StudentGuardianService.setPrimaryGuardian('stu-1', g2Link.id);
    expect(result.ok).toBe(true);

    const after = await StudentGuardianService.getGuardiansForStudent('stu-1');
    expect(after.filter((l) => l.is_primary)).toHaveLength(1);
    expect(after.find((l) => l.is_primary)?.guardian_id).toBe('g-2');

    const student = await db.students.get('stu-1');
    expect(student?.guardian_id).toBe('g-2');
  });

  it('unlinking the primary promotes another linked guardian', async () => {
    await StudentGuardianService.linkGuardian({
      schoolId: SCHOOL, studentId: 'stu-1', guardianId: 'g-2', relationship: 'FATHER',
    });
    const links = await StudentGuardianService.getGuardiansForStudent('stu-1');
    const primaryLink = links.find((l) => l.is_primary)!;

    const result = await StudentGuardianService.unlinkGuardian(primaryLink.id);
    expect(result.ok).toBe(true);

    const after = await StudentGuardianService.getGuardiansForStudent('stu-1');
    expect(after.filter((l) => l.is_primary)).toHaveLength(1);
    expect(after.find((l) => l.is_primary)?.guardian_id).toBe('g-2');
  });
});

describe('StudentGuardianService — queries', () => {
  it('getStudentsForGuardian returns all linked students', async () => {
    const students = await StudentGuardianService.getStudentsForGuardian('g-1');
    expect(students.map((s) => s.student_id).sort()).toEqual(['stu-1', 'stu-2']);
  });

  it('searchGuardians filters by name/phone case-insensitively', async () => {
    const byName = await StudentGuardianService.searchGuardians(SCHOOL, 'obi');
    expect(byName.map((g) => g.id)).toEqual(['g-1']);
    const byPhone = await StudentGuardianService.searchGuardians(SCHOOL, '08022222');
    expect(byPhone.map((g) => g.id)).toEqual(['g-2']);
  });
});

describe('StudentGuardianService — relationship types', () => {
  it('updateRelationshipType updates the link row and enqueues an upsert', async () => {
    const links = await StudentGuardianService.getGuardiansForStudent('stu-1');
    const result = await StudentGuardianService.updateRelationshipType(links[0]!.id, 'SPONSOR');
    expect(result.ok).toBe(true);

    const after = await StudentGuardianService.getGuardiansForStudent('stu-1');
    expect(after.find((l) => l.id === links[0]!.id)?.relationship).toBe('SPONSOR');

    const queue = await (fake.db.sync_queue as any).snapshot();
    expect(queue.some((q: any) => q.entity_type === 'student_guardians' && q.payload?.relationship === 'SPONSOR')).toBe(true);
  });
});

describe('StudentGuardianService — primary conflicts', () => {
  it('repairLocalConsistency collapses duplicate primaries to one winner', async () => {
    // Simulate a conflicting replay: three primaries for stu-1. The intended
    // winner (link-y/g-2) is dated a day ahead so it deterministically beats
    // the pre-seeded row from beforeEach (dated "now").
    const t0 = new Date(Date.now() - 60_000).toISOString();
    const t1 = new Date(Date.now() - 30_000).toISOString();
    const tWin = new Date(Date.now() + 86_400_000).toISOString();
    (fake.db.student_guardians as any).seed([
      {
        id: 'link-x', school_id: SCHOOL, student_id: 'stu-1', guardian_id: 'g-1',
        relationship: 'MOTHER', is_primary: true,
        created_at: t0, updated_at: t0,
      },
      {
        id: 'link-y', school_id: SCHOOL, student_id: 'stu-1', guardian_id: 'g-2',
        relationship: 'FATHER', is_primary: true,
        created_at: t1, updated_at: tWin,
      },
    ]);
    // g-1 currently mirrored as primary pointer.
    await (fake.db.students as any).put({ id: 'stu-1', school_id: SCHOOL, guardian_id: 'g-1' });

    await StudentGuardianService.repairLocalConsistency('stu-1');

    const after = await StudentGuardianService.getGuardiansForStudent('stu-1');
    expect(after.filter((l) => l.is_primary)).toHaveLength(1);
    // Latest updated_at wins (link-y / g-2).
    expect(after.find((l) => l.is_primary)?.guardian_id).toBe('g-2');

    const student = await db.students.get('stu-1');
    expect(student?.guardian_id).toBe('g-2');
  });

  it('unlinking the ONLY primary leaves no orphaned legacy pointer', async () => {
    // Seed a second student whose single link is primary.
    await (fake.db.students as any).put({ id: 'stu-solo', school_id: SCHOOL, guardian_id: 'g-9' });
    await (fake.db.student_guardians as any).seed([
      {
        id: 'link-solo', school_id: SCHOOL, student_id: 'stu-solo', guardian_id: 'g-9',
        relationship: 'GUARDIAN', is_primary: true,
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      },
    ]);

    const result = await StudentGuardianService.unlinkGuardian('link-solo');
    expect(result.ok).toBe(true);

    const after = await StudentGuardianService.getGuardiansForStudent('stu-solo');
    expect(after).toHaveLength(0);
    const student = await db.students.get('stu-solo');
    expect(student?.guardian_id ?? null).toBeNull();

    const queue = await (fake.db.sync_queue as any).snapshot();
    expect(
      queue.some((q: any) => q.entity_type === 'students' && q.payload?.id === 'stu-solo' && q.payload?.guardian_id === null)
    ).toBe(true);
  });
});

describe('Financial integrity — guardian changes never touch the ledger', () => {
  it('setPrimaryGuardian and unlink leave ledger_entries untouched', async () => {
    const ledgerBefore = [
      { id: 'led-1', school_id: SCHOOL, student_id: 'stu-1', amount: 5000, entry_type: 'DEBIT' },
      { id: 'led-2', school_id: SCHOOL, student_id: 'stu-1', amount: 2000, entry_type: 'CREDIT' },
    ];
    for (const entry of ledgerBefore) await (fake.db.ledger_entries as any).put(entry);

    await StudentGuardianService.linkGuardian({
      schoolId: SCHOOL, studentId: 'stu-1', guardianId: 'g-2', relationship: 'FATHER',
    });
    const links = await StudentGuardianService.getGuardiansForStudent('stu-1');
    const g2Link = links.find((l) => l.guardian_id === 'g-2')!;
    await StudentGuardianService.setPrimaryGuardian('stu-1', g2Link.id);
    await StudentGuardianService.unlinkGuardian(g2Link.id);

    const ledgerAfter = await (fake.db.ledger_entries as any).snapshot();
    expect(ledgerAfter).toHaveLength(2);
    expect(ledgerAfter).toEqual(expect.arrayContaining(ledgerBefore));
  });
});
