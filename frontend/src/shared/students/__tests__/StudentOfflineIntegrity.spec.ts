/**
 * Phase regression: offline-first student persistence, import UPDATE path,
 * admission-number autogeneration, promotion planning, and financial integrity.
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

const fakeReady = vi.hoisted(async () => {
  const { createFakeDb } = await import(
    '../../../features/students/services/__tests__/helpers/fakeDexie'
  );
  return createFakeDb([
    'students',
    'guardians',
    'student_guardians',
    'student_enrollments',
    'academic_sessions',
    'school_divisions',
    'academic_levels',
    'ledger_entries',
    'sync_queue',
    'app_settings',
  ]);
});

vi.mock('@/offline/localDb', async () => {
  const fake = await fakeReady;
  const d = fake.db as any;
  return {
    db: d,
    default: d,
    LocalRepository: {
      saveStudent: async (row: any) => {
        const entity = { ...row, source: 'LOCAL', version: 1, updated_at: new Date().toISOString() };
        await d.students.put(entity);
        return entity;
      },
      getStudentById: (id: string) => d.students.get(id),
      getStudentsBySchool: (schoolId: string) =>
        d.students.where('school_id').equals(schoolId).toArray(),
      saveStudentEnrollment: async (row: any) => d.student_enrollments.put(row),
      enqueueSyncItem: async (item: any) => {
        const full = {
          id: crypto.randomUUID(),
          operation: 'UPSERT',
          status: 'PENDING',
          retry_count: 0,
          created_at: new Date().toISOString(),
          ...item,
        };
        await d.sync_queue.put(full);
        return full;
      },
      getActiveEnrollmentsForLevel: (levelId: string) =>
        d.student_enrollments
          .where('level_id')
          .equals(levelId)
          .and((e: any) => e.status === 'ACTIVE')
          .toArray(),
      getActiveEnrollmentForStudent: async (studentId: string, sessionId?: string) => {
        const rows = await d.student_enrollments
          .where('student_id')
          .equals(studentId)
          .toArray();
        return (
          rows.find(
            (e: any) => e.status === 'ACTIVE' && (!sessionId || e.academic_session_id === sessionId),
          ) ?? undefined
        );
      },
    },
  };
});

vi.mock('@/shared/students/SupabaseStudentProvider', () => ({
  SupabaseStudentProvider: class {
    insertStudent = vi.fn();
    updateStudent = vi.fn();
    listStudents = vi.fn().mockResolvedValue([]);
    activateStudent = vi.fn();
    deactivateStudent = vi.fn();
  },
}));

import { studentService as StudentService } from '@/shared/students/StudentService';
import { db } from '@/offline/localDb';
import type { StudentRow } from '@/shared/repositories/StudentRepository';

let fake: Awaited<typeof fakeReady>;

async function ledgerSnapshot(): Promise<string> {
  const rows = await (db as any).ledger_entries.toArray();
  return JSON.stringify(rows.map((r: any) => ({ ...r })), Object.keys({}).length ? undefined : null);
}

beforeAll(async () => {
  fake = await fakeReady;
});

beforeEach(() => {
  fake.reset();
});

describe('Phase B — student mutations are offline-first (Dexie + outbox)', () => {
  it('createStudent writes Dexie locally with a client UUID and queues an outbox op without any network call', async () => {
    const result = await StudentService.createStudent({
      schoolId: 'school-1',
      firstName: 'Ada',
      lastName: 'Obi',
    });
    expect(result.error).toBeNull();

    const rows = await (db as any).students.toArray();
    expect(rows).toHaveLength(1);
    const row = rows[0];
    // Client-generated UUID v4, not a server-minted id
    expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(row.first_name).toBe('Ada');
    expect(row.last_name).toBe('Obi');
    expect(row.school_id).toBe('school-1');
    expect(row.source).toBe('LOCAL');

    const queue = await (db as any).sync_queue.toArray();
    expect(queue).toHaveLength(1);
    expect(queue[0].entity_type).toBe('students');
    expect(queue[0].operation).toBe('UPSERT');
    expect(queue[0].payload.id).toBe(row.id);
  });

  it('updateStudent mutates Dexie immediately and queues an idempotent upsert', async () => {
    const created = await StudentService.createStudent({
      schoolId: 'school-1',
      firstName: 'Ada',
      lastName: 'Obi',
    });
    const id = created.data!.id;

    const updated = await StudentService.updateStudent(id, { firstName: 'Adaeze' } as any);
    expect(updated.error).toBeNull();

    const row = await (db as any).students.get(id);
    expect(row.first_name).toBe('Adaeze');

    const queue = await (db as any).sync_queue.where('entity_id').equals(id).toArray();
    expect(queue.length).toBeGreaterThanOrEqual(1);
    const lastOp = queue[queue.length - 1];
    expect(lastOp.operation).toBe('UPDATE');
    expect(lastOp.payload.first_name).toBe('Adaeze');
  });

  it('archive is a soft state change (ARCHIVED), never a physical delete', async () => {
    const created = await StudentService.createStudent({
      schoolId: 'school-1',
      firstName: 'Ada',
      lastName: 'Obi',
    });
    const id = created.data!.id;
    await StudentService.deactivateStudent(id);

    const row = await (db as any).students.get(id);
    // Status widened to TEXT+CHECK ('ACTIVE'|'ARCHIVED'|'GRADUATED'|'LEFT') by
    // 202608240001_students_hardening.sql — ARCHIVED is the register's state.
    expect(row.status).toBe('ARCHIVED');
    expect(row.id).toBe(id);

    const queue = await (db as any).sync_queue.where('entity_id').equals(id).toArray();
    expect(queue[queue.length - 1].payload.status).toBe('ARCHIVED');
  });

  it('unarchive restores ACTIVE through the same offline path', async () => {
    const created = await StudentService.createStudent({
      schoolId: 'school-1',
      firstName: 'Ada',
      lastName: 'Obi',
    });
    const id = created.data!.id;
    await StudentService.deactivateStudent(id);
    await StudentService.activateStudent(id);
    const row = await (db as any).students.get(id);
    expect(row.status).toBe('ACTIVE');
  });

  it('admission number is auto-generated when left blank and is collision-safe', async () => {
    const first = await StudentService.createStudent({ schoolId: 'school-1', firstName: 'Ade', lastName: 'One' });
    expect(first.error).toBeNull();
    const second = await StudentService.createStudent({
      schoolId: 'school-1',
      firstName: 'Bola',
      lastName: 'Two',
    });
    expect(second.error).toBeNull();
    expect(second.data!.admissionNumber).toBeTruthy();
    const rows = await (db as any).students.toArray();
    const numbers = rows.map((r: any) => r.admission_number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('tenant ownership is preserved: school_id comes from the caller context, never invented', async () => {
    await StudentService.createStudent({ schoolId: 'school-B', firstName: 'Zed', lastName: 'Ali' });
    const rows = await (db as any).students.toArray();
    expect(rows.every((r: any) => r.school_id === 'school-B')).toBe(true);
  });
});

describe('Financial integrity — student mutations never touch the ledger', () => {
  it('ledger entries are byte-identical across create/update/archive cycles', async () => {
    // Seed historical financial records
    await (db as any).ledger_entries.put({
      id: 'le-1',
      school_id: 'school-1',
      entry_type: 'DEBIT',
      amount_minor: 50000,
      student_id: 'stu-x',
      created_at: '2026-01-01T00:00:00Z',
    });

    const before = JSON.stringify(await (db as any).ledger_entries.toArray());

    const created = await StudentService.createStudent({
      schoolId: 'school-1',
      firstName: 'Ada',
      lastName: 'Obi',
    });
    await StudentService.updateStudent(created.data!.id, { first_name: 'Adaeze' } as any);
    await StudentService.deactivateStudent(created.data!.id);

    const after = JSON.stringify(await (db as any).ledger_entries.toArray());
    expect(after).toBe(before);
  });
});
