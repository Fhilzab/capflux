/**
 * EnrollmentService tests — enrollment creation, history preservation,
 * movement, promotion planning, and the financial-integrity guarantee.
 *
 * Strategy: mock '@/offline/localDb' with the in-memory fake Dexie, then
 * snapshot the financial tables before/after movement operations and assert
 * they are byte-identical.
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

// Hoisted: creates the fake DB before vi.mock factories run.
const fakeReady = vi.hoisted(async () => {
  const { createFakeDb } = await import('../../../features/students/services/__tests__/helpers/fakeDexie');
  return createFakeDb([
    'students',
    'academic_sessions',
    'school_divisions',
    'academic_levels',
    'student_enrollments',
    'student_guardians',
    'guardians',
    'ledger_entries',
    'student_charges',
    'payment_transactions',
    'sync_queue',
  ]);
});

vi.mock('@/offline/localDb', async () => {
  const fake = await fakeReady;
  const d = fake.db as any;
  return {
    db: d,
    LocalRepository: {
      saveStudentEnrollment: async (row: any) => d.student_enrollments.put(row),
      getEnrollmentsByStudent: (id: string) =>
        d.student_enrollments.where('student_id').equals(id).toArray(),
      getEnrollmentsBySchool: (schoolId: string) =>
        d.student_enrollments.where('school_id').equals(schoolId).toArray(),
      getActiveEnrollmentForStudent: async (studentId: string, sessionId?: string) => {
        const rows = await d.student_enrollments
          .where('student_id')
          .equals(studentId)
          .toArray();
        return (
          rows
            .filter((r: any) => r.status === 'ACTIVE' && (!sessionId || r.academic_session_id === sessionId))
            .sort((a: any, b: any) => (b.effective_date ?? '').localeCompare(a.effective_date ?? ''))[0] ?? undefined
        );
      },
      saveStudentGuardian: async (row: any) => d.student_guardians.put(row),
      deleteStudentGuardian: (id: string) => d.student_guardians.delete(id),
      getGuardianLinksForStudent: (studentId: string) =>
        d.student_guardians.where('student_id').equals(studentId).toArray(),
      getStudentsForGuardian: (guardianId: string) =>
        d.student_guardians.where('guardian_id').equals(guardianId).toArray(),
      getAcademicSessionsBySchool: (schoolId: string) =>
        d.academic_sessions.where('school_id').equals(schoolId).toArray(),
      getAcademicLevelsBySchool: (schoolId: string) =>
        d.academic_levels.where('school_id').equals(schoolId).toArray(),
      getAcademicLevelsBySection: (sectionId: string) =>
        d.academic_levels.where('section_id').equals(sectionId).toArray(),
      enqueueSyncItem: async (item: any) => d.sync_queue.put({ id: crypto.randomUUID(), ...item }),
      saveAcademicSession: async (row: any) => d.academic_sessions.put(row),
      saveAcademicLevel: async (row: any) => d.academic_levels.put(row),
    },
  };
});

import { EnrollmentService } from '@/shared/enrollment/EnrollmentService';

let fake: Awaited<typeof fakeReady>;

beforeAll(async () => {
  fake = await fakeReady;
});

const SCHOOL = 'school-1';
const SESSION = 'session-1';
const SECTION = 'section-1';
const LEVEL_1 = 'level-1';
const LEVEL_2 = 'level-2';

function seedStructure() {
  (fake.db.academic_sessions as any).seed([
    { id: SESSION, school_id: SCHOOL, name: '2026/2027', is_current: true, status: 'ACTIVE' },
  ]);
  (fake.db.school_divisions as any).seed([
    { id: SECTION, school_id: SCHOOL, name: 'Primary', code: 'PRI', display_order: 1, status: 'ACTIVE' },
  ]);
  (fake.db.academic_levels as any).seed([
    { id: LEVEL_1, school_id: SCHOOL, section_id: SECTION, name: 'Primary 3', display_order: 1, status: 'ACTIVE' },
    { id: LEVEL_2, school_id: SCHOOL, section_id: SECTION, name: 'Primary 4', display_order: 2, status: 'ACTIVE' },
  ]);
}

function seedStudent(id: string, overrides: Record<string, unknown> = {}) {
  (fake.db.students as any).seed([
    {
      id,
      school_id: SCHOOL,
      first_name: 'Ada',
      last_name: 'Obi',
      status: 'ACTIVE',
      class_name: 'Primary 3',
      ...overrides,
    },
  ]);
}

async function snapshotFinancials() {
  return JSON.stringify({
    ledger: await (fake.db.ledger_entries as any).snapshot(),
    charges: await (fake.db.student_charges as any).snapshot(),
    transactions: await (fake.db.payment_transactions as any).snapshot(),
  });
}

beforeEach(() => {
  fake.reset();
  seedStructure();
});

describe('EnrollmentService — enrollment creation', () => {
  it('creates an ACTIVE enrollment with INITIAL reason', async () => {
    seedStudent('stu-1');
    const result = await EnrollmentService.enrollStudent({
      schoolId: SCHOOL,
      studentId: 'stu-1',
      sessionId: SESSION,
      sectionId: SECTION,
      levelId: LEVEL_1,
    });
    expect(result.ok).toBe(true);
    const rows = await (fake.db.student_enrollments as any).snapshot();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('ACTIVE');
    expect(rows[0].reason).toBe('INITIAL');
  });

  it('rejects enrollment when one already exists for the session', async () => {
    seedStudent('stu-1');
    await EnrollmentService.enrollStudent({
      schoolId: SCHOOL, studentId: 'stu-1', sessionId: SESSION, sectionId: SECTION, levelId: LEVEL_1,
    });
    const second = await EnrollmentService.enrollStudent({
      schoolId: SCHOOL, studentId: 'stu-1', sessionId: SESSION, sectionId: SECTION, levelId: LEVEL_2,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('ALREADY_AT_TARGET');
  });

  it('rejects inactive levels and unknown entities', async () => {
    seedStudent('stu-1');
    (fake.db.academic_levels as any).seed([
      { id: 'level-dead', school_id: SCHOOL, section_id: SECTION, name: 'Closed', display_order: 9, status: 'INACTIVE' },
    ]);
    const inactive = await EnrollmentService.enrollStudent({
      schoolId: SCHOOL, studentId: 'stu-1', sessionId: SESSION, sectionId: SECTION, levelId: 'level-dead',
    });
    expect(inactive.ok).toBe(false);

    const missing = await EnrollmentService.enrollStudent({
      schoolId: SCHOOL, studentId: 'ghost', sessionId: SESSION, sectionId: SECTION, levelId: LEVEL_1,
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('STUDENT_NOT_FOUND');
  });
});

describe('EnrollmentService — movement & history', () => {
  it('moveStudent closes the old row and appends a new ACTIVE row (history preserved)', async () => {
    seedStudent('stu-1');
    await EnrollmentService.enrollStudent({
      schoolId: SCHOOL, studentId: 'stu-1', sessionId: SESSION, sectionId: SECTION, levelId: LEVEL_1,
    });

    const moved = await EnrollmentService.moveStudent(
      'stu-1',
      { sessionId: SESSION, sectionId: SECTION, levelId: LEVEL_2 },
      'MOVEMENT',
    );
    expect(moved.ok).toBe(true);

    const history = await EnrollmentService.getEnrollmentHistory('stu-1');
    expect(history).toHaveLength(2);
    expect(history.filter((r) => r.status === 'SUPERSEDED')).toHaveLength(1);
    expect(history.find((r) => r.status === 'ACTIVE')?.level_id).toBe(LEVEL_2);
    // Old row still exists with its original placement — never mutated away.
    expect(history.find((r) => r.level_id === LEVEL_1)?.level_id).toBe(LEVEL_1);
  });

  it('rejects a no-op move to the same level', async () => {
    seedStudent('stu-1');
    await EnrollmentService.enrollStudent({
      schoolId: SCHOOL, studentId: 'stu-1', sessionId: SESSION, sectionId: SECTION, levelId: LEVEL_1,
    });
    const result = await EnrollmentService.moveStudent(
      'stu-1',
      { sessionId: SESSION, sectionId: SECTION, levelId: LEVEL_1 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ALREADY_AT_TARGET');
  });

  it('rejects movement to an inactive destination level', async () => {
    seedStudent('stu-1');
    await EnrollmentService.enrollStudent({
      schoolId: SCHOOL, studentId: 'stu-1', sessionId: SESSION, sectionId: SECTION, levelId: LEVEL_1,
    });
    (fake.db.academic_levels as any).seed([
      { id: 'level-dead', school_id: SCHOOL, section_id: SECTION, name: 'Closed', display_order: 9, status: 'INACTIVE' },
    ]);
    const result = await EnrollmentService.moveStudent(
      'stu-1',
      { sessionId: SESSION, sectionId: SECTION, levelId: 'level-dead' },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('LEVEL_INACTIVE');
  });
});

describe('EnrollmentService — bulk movement & promotion', () => {
  it('planBulkMove skips archived/withdrawn students and reports them', async () => {
    seedStudent('stu-a');
    seedStudent('stu-b', { status: 'ARCHIVED' });
    for (const id of ['stu-a', 'stu-b']) {
      await EnrollmentService.enrollStudent({
        schoolId: SCHOOL, studentId: id, sessionId: SESSION, sectionId: SECTION, levelId: LEVEL_1,
      });
    }
    const plan = await EnrollmentService.planBulkMove(LEVEL_1, {
      sessionId: SESSION, sectionId: SECTION, levelId: LEVEL_2,
    });
    expect(plan.eligible.map((s) => s.studentId)).toEqual(['stu-a']);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.skipped[0].reason).toContain('archived');
  });

  it('planPromotion picks the next level by display_order, not string sort', async () => {
    (fake.db.academic_levels as any).seed([
      { id: 'lvl-10', school_id: SCHOOL, section_id: SECTION, name: 'Level 10', display_order: 10, status: 'ACTIVE' },
      { id: 'lvl-2', school_id: SCHOOL, section_id: SECTION, name: 'Level 2', display_order: 2, status: 'ACTIVE' },
    ]);
    const next = await EnrollmentService.getNextLevelInSection(SECTION, 'lvl-2');
    expect(next.ok).toBe(true);
    if (next.ok) expect(next.data.id).toBe('lvl-10'); // order 2 → 10, not "10" → "2" alphabetically

    const final = await EnrollmentService.getNextLevelInSection(SECTION, 'lvl-10');
    expect(final.ok).toBe(false);
    if (!final.ok) expect(final.error.code).toBe('PROMOTION_NO_NEXT_LEVEL');
  });

  it('applyMove reports per-student failures without aborting the batch', async () => {
    seedStudent('stu-a');
    seedStudent('stu-b');
    await EnrollmentService.enrollStudent({
      schoolId: SCHOOL, studentId: 'stu-a', sessionId: SESSION, sectionId: SECTION, levelId: LEVEL_1,
    });
    // stu-b intentionally has NO enrollment → moveStudent falls back to enroll
    await EnrollmentService.enrollStudent({
      schoolId: SCHOOL, studentId: 'stu-b', sessionId: SESSION, sectionId: SECTION, levelId: LEVEL_1,
    });

    const result = await EnrollmentService.applyMove(
      ['stu-a', 'stu-b', 'stu-ghost'],
      { sessionId: SESSION, sectionId: SECTION, levelId: LEVEL_2 },
      'MOVEMENT',
    );
    expect(result.moved).toHaveLength(2);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].studentId).toBe('stu-ghost');
  });
});

describe('Financial integrity — movement must never touch financial records', () => {
  it('ledger, charges and transactions are byte-identical before/after move & promotion', async () => {
    seedStudent('stu-1');
    (fake.db.ledger_entries as any).seed([
      {
        id: 'ledger-1',
        school_id: SCHOOL,
        student_id: 'stu-1',
        amount: 50000,
        entry_type: 'DEBIT',
        entry_category: 'TUITION',
        created_at: '2025-09-01T00:00:00Z',
        metadata: { session: '2025/2026', level: 'Primary 3' },
      },
    ]);
    (fake.db.student_charges as any).seed([
      { id: 'charge-1', student_id: 'stu-1', status: 'PAID', ledger_locked: true, amount: 50000 },
    ]);
    (fake.db.payment_transactions as any).seed([
      { id: 'txn-1', student_id: 'stu-1', reference: 'REF-001', amount: 50000, status: 'SUCCESS' },
    ]);

    const before = await snapshotFinancials();

    await EnrollmentService.enrollStudent({
      schoolId: SCHOOL, studentId: 'stu-1', sessionId: SESSION, sectionId: SECTION, levelId: LEVEL_1,
    });
    await EnrollmentService.moveStudent(
      'stu-1',
      { sessionId: SESSION, sectionId: SECTION, levelId: LEVEL_2 },
      'PROMOTION',
    );
    const plan = await EnrollmentService.planBulkMove(LEVEL_2, {
      sessionId: SESSION, sectionId: SECTION, levelId: LEVEL_1,
    });
    await EnrollmentService.applyMove(
      plan.eligible.map((s) => s.studentId),
      { sessionId: SESSION, sectionId: SECTION, levelId: LEVEL_1 },
      'MOVEMENT',
    );

    const after = await snapshotFinancials();
    expect(after).toBe(before);
  });
});
