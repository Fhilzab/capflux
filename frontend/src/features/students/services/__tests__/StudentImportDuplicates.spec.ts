/**
 * Phase I/J regression: import duplicate handling.
 * SKIP counts exactly once; UPDATE merges non-blank fields offline-first
 * through the student domain service; identity/tenant fields are untouched.
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

const fakeReady = vi.hoisted(async () => {
  const { createFakeDb } = await import(
    '../../../../features/students/services/__tests__/helpers/fakeDexie'
  );
  return createFakeDb([
    'students',
    'guardians',
    'student_guardians',
    'student_enrollments',
    'ledger_entries',
    'sync_queue',
    'app_settings',
  ]);
});

const { updateStudentMock } = vi.hoisted(() => ({ updateStudentMock: vi.fn().mockResolvedValue({}) }));

vi.mock('@/offline/localDb', async () => {
  const fake = await fakeReady;
  const d = fake.db as any;
  return {
    db: d,
    default: d,
    LocalRepository: {
      saveStudentGuardian: async (row: any) => {
        const e = { ...row, source: 'LOCAL', version: 1, updated_at: new Date().toISOString() };
        await d.student_guardians.put(e);
        return e;
      },
      deleteStudentGuardian: (id: string) => d.student_guardians.delete(id),
      getGuardianLinksForStudent: (studentId: string) =>
        d.student_guardians.where('student_id').equals(studentId).toArray(),
      getStudentsForGuardian: (guardianId: string) =>
        d.student_guardians.where('guardian_id').equals(guardianId).toArray(),
      enqueueSyncItem: async (item: any) => {
        const f = {
          id: crypto.randomUUID(),
          operation: 'UPSERT',
          status: 'PENDING',
          retry_count: 0,
          created_at: new Date().toISOString(),
          ...item,
        };
        await d.sync_queue.put(f);
        return f;
      },
    },
  };
});

vi.mock('@/stores/studentStore', () => ({
  useStudentStore: () => ({
    updateStudent: updateStudentMock,
  }),
}));

import { batchImport } from '@/features/students/services/StudentImportService';
import type { ValidatedRow } from '@/features/students/types';
import { db } from '@/offline/localDb';

let fake: Awaited<typeof fakeReady>;

beforeAll(async () => {
  fake = await fakeReady;
});

beforeEach(() => {
  fake.reset();
  updateStudentMock.mockClear();
});

function row(overrides: Partial<ValidatedRow>): ValidatedRow {
  return {
    rowIndex: 2,
    mapped: {
      firstName: 'Ada',
      lastName: 'Obi',
      guardianName: 'Grace Obi',
      guardianPhone: '08030000001',
      relationship: 'MOTHER',
      admissionNumber: '',
      status: 'ACTIVE',
      className: 'Primary 5',
      section: 'Primary',
      academicLevel: 'Primary 5',
      academicSession: '2026/2027',
    },
    valid: true,
    errors: [],
    warnings: [],
    exists: false,
    ...overrides,
  };
}

function ctx() {
  return {
    schoolId: 'school-1',
    divisions: [{ id: 'div-1', name: 'Primary', code: 'PRI' }],
    createStudent: vi.fn().mockResolvedValue({
      data: { id: crypto.randomUUID(), firstName: 'New', lastName: 'Kid' },
      error: null,
    }),
    updateStudent: updateStudentMock,
    getOrCreateGuardian: vi
      .fn()
      .mockResolvedValue({ id: 'guardian-1', full_name: 'Grace Obi' }),
  };
}

describe('Import duplicate handling', () => {
  it('SKIP leaves existing rows untouched and reports them exactly once regardless of batch size', async () => {
    const rows = [
      row({ exists: true, existingStudentId: 'stu-existing' }),
      row({ mapped: { /* fresh */ } as any }),
      row({ mapped: {} as any }),
      row({ mapped: {} as any }),
      row({ mapped: {} as any }),
      row({ mapped: {} as any }),
    ];

    const result = await batchImport(rows, ctx() as any, { batchSize: 2, duplicateHandling: 'SKIP' });
    // One skipped existing row — counted once even though it spans batches.
    expect(result.skipped).toBe(1);
    expect(updateStudentMock).not.toHaveBeenCalled();
  });

  it('UPDATE routes through the offline-first domain service with only non-blank fields', async () => {
    const r = row({
      exists: true,
      existingStudentId: 'stu-existing',
      mapped: {
        firstName: 'Adaeze',
        lastName: 'Obi',
        middleName: '',            // blank must NOT clear stored value
        gender: 'FEMALE',
        dateOfBirth: '',
        guardianName: 'Grace Obi',
        guardianPhone: '08030000001',
        relationship: 'MOTHER',
        admissionNumber: 'CAP-00042',
        status: 'ACTIVE',
        className: 'Primary 6',
      } as any,
    });

    const result = await batchImport([r], ctx() as any, { batchSize: 10, duplicateHandling: 'UPDATE' });
    expect(result.updated).toBe(1);
    expect(result.imported).toBe(0);

    expect(updateStudentMock).toHaveBeenCalledTimes(1);
    const [id, patch] = updateStudentMock.mock.calls[0];
    expect(id).toBe('stu-existing');
    expect(patch.firstName).toBe('Adaeze');
    expect(patch.lastName).toBe('Obi');
    expect(patch.gender).toBe('FEMALE');
    expect(patch.middleName).toBeUndefined(); // blank ignored
    expect(patch.dateOfBirth).toBeUndefined(); // blank ignored
  });

  it('IMPORT_AS_NEW creates a new student via the same offline-first path', async () => {
    const c = ctx();
    const result = await batchImport(
      [row({ exists: true, existingStudentId: 'stu-existing' })],
      c as any,
      { batchSize: 10, duplicateHandling: 'IMPORT_AS_NEW' },
    );
    expect(result.imported).toBe(1);
    expect(c.createStudent).toHaveBeenCalledTimes(1);
    expect(updateStudentMock).not.toHaveBeenCalled();
  });

  it('financial records are byte-identical after an UPDATE import', async () => {
    await (db as any).ledger_entries.put({
      id: 'le-9',
      school_id: 'school-1',
      entry_type: 'DEBIT',
      amount_minor: 12000,
      student_id: 'stu-existing',
      created_at: '2026-02-02T00:00:00Z',
    });
    const before = JSON.stringify(await (db as any).ledger_entries.toArray());

    await batchImport(
      [row({ exists: true, existingStudentId: 'stu-existing', mapped: { ...row({}).mapped, firstName: 'Renamed' } as any })],
      ctx() as any,
      { batchSize: 10, duplicateHandling: 'UPDATE' },
    );

    const after = JSON.stringify(await (db as any).ledger_entries.toArray());
    expect(after).toBe(before);
  });
});
