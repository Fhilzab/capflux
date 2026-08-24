import db from '../../offline/localDb';
import { LocalRepository, type EntitySource } from '../../offline/localDb';

/**
 * Canonical snake_case student row — mirrors the actual Postgres columns
 * (base migration 002 + guardian FK 009 + identity/hardening additions in
 * 202608240001_students_hardening.sql).
 */
export interface StudentRow {
  id: string;
  school_id: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  gender?: string | null;
  date_of_birth?: string | null;
  admission_number?: string | null;
  admission_date?: string | null;
  class_name: string;
  category?: string;
  guardian_id?: string | null;
  division_id?: string | null;
  guardian_phone?: string | null;
  status: 'ACTIVE' | 'ARCHIVED' | 'GRADUATED' | 'LEFT';
  client_sequence: number;
  device_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * StudentRepository — THE authoritative offline-first student write path.
 *
 * Flow: Domain service → here → Dexie put → outbox → UploadSyncEngine → Supabase.
 * Client UUIDs are minted here; replay is idempotent (UPSERT onConflict id).
 * Identity fields (id, school_id, created_at, client_sequence, device_id) are
 * immutable after creation. Financial data is never touched by this module.
 *
 * Column set mirrors the actual Postgres `students` schema (base 002 +
 * guardian FK 009 + division_id 202608220001 + identity columns added in
 * 202608240001_students_hardening.sql).
 */

/** Fields the UI/domain model may change after creation. */
const UPDATABLE_FIELDS = [
  'first_name',
  'middle_name',
  'last_name',
  'gender',
  'date_of_birth',
  'admission_number',
  'admission_date',
  'class_name',
  'category',
  'guardian_id',
  'division_id',
  'status',
  'guardian_phone',
] as const;

type UpdatableField = (typeof UPDATABLE_FIELDS)[number];

export interface StudentRowInput {
  id?: string;
  school_id: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  gender?: string | null;
  date_of_birth?: string | null;
  admission_number?: string | null;
  admission_date?: string | null;
  class_name?: string | null;
  category?: string;
  guardian_id?: string | null;
  division_id?: string | null;
  guardian_phone?: string | null;
  status?: 'ACTIVE' | 'ARCHIVED' | 'GRADUATED' | 'LEFT';
  client_sequence?: number;
  device_id?: string;
  created_at?: string;
}

function nowIso() {
  return new Date().toISOString();
}

function buildPayload(record: StudentRow): Record<string, unknown> {
  // Explicit column list — never spread unknown fields into the wire payload.
  return {
    id: record.id,
    school_id: record.school_id,
    first_name: record.first_name,
    middle_name: (record as any).middle_name ?? null,
    last_name: record.last_name,
    gender: (record as any).gender ?? null,
    date_of_birth: (record as any).date_of_birth ?? null,
    admission_number: (record as any).admission_number ?? null,
    admission_date: (record as any).admission_date ?? null,
    class_name: record.class_name,
    category: record.category,
    guardian_id: record.guardian_id ?? null,
    division_id: (record as any).division_id ?? null,
    guardian_phone: (record as any).guardian_phone ?? null,
    status: record.status,
    client_sequence: record.client_sequence,
    device_id: record.device_id,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

export const StudentRepository = {
  /** Create: client UUID, immediate Dexie write, outbox UPSERT. Idempotent on replay. */
  async saveStudent(student: StudentRowInput) {
    const { v4: uuidv4 } = await import('uuid');
    const record: StudentRow = {
      id: student.id ?? uuidv4(),
      school_id: student.school_id,
      first_name: student.first_name,
      last_name: student.last_name,
      class_name: student.class_name ?? '',
      category: student.category ?? 'PRIMARY',
      guardian_id: student.guardian_id ?? null,
      status: student.status ?? 'ACTIVE',
      client_sequence: student.client_sequence ?? 0,
      device_id: student.device_id ?? 'local-client',
      created_at: student.created_at ?? nowIso(),
      updated_at: nowIso(),
      ...(student.middle_name !== undefined ? { middle_name: student.middle_name } : {}),
      ...(student.gender !== undefined ? { gender: student.gender } : {}),
      ...(student.date_of_birth !== undefined ? { date_of_birth: student.date_of_birth } : {}),
      ...(student.admission_number !== undefined ? { admission_number: student.admission_number } : {}),
      ...(student.admission_date !== undefined ? { admission_date: student.admission_date } : {}),
      ...(student.division_id !== undefined ? { division_id: student.division_id } : {}),
      ...(student.guardian_phone !== undefined ? { guardian_phone: student.guardian_phone } : {}),
    } as StudentRow;

    await LocalRepository.saveStudent(record);
    await LocalRepository.enqueueSyncItem({
      school_id: record.school_id,
      entity_type: 'students',
      entity_id: record.id,
      operation: 'UPSERT',
      payload: buildPayload(record as StudentRow),
    });

    return record;
  },

  /**
   * Update: Dexie-first, outbox UPDATE. Only UPDATABLE_FIELDS may change —
   * tenant ownership and identity fields are preserved from the existing row.
   */
  async updateStudent(student_id: string, updates: Partial<StudentRow>) {
    const existing = await db.students.get(student_id);
    if (!existing) throw new Error('Student not found');

    const updated: StudentRow = { ...(existing as StudentRow), updated_at: nowIso() };
    const snakeUpdates = updates as Record<string, unknown>;
    for (const field of UPDATABLE_FIELDS) {
      if (snakeUpdates[field] !== undefined) {
        (updated as any)[field] = snakeUpdates[field];
      }
    }

    await db.students.put(updated as StudentRow & EntitySource);
    await LocalRepository.enqueueSyncItem({
      school_id: updated.school_id,
      entity_type: 'students',
      entity_id: student_id,
      operation: 'UPDATE',
      payload: buildPayload(updated),
    });

    return updated;
  },

  /** Archive/unarchive/status change — soft state only, never a delete. */
  async archiveStudent(student_id: string, status: StudentRow['status']) {
    const existing = await db.students.get(student_id);
    if (!existing) throw new Error('Student not found');

    const updated: StudentRow = {
      ...(existing as StudentRow),
      status,
      updated_at: nowIso(),
    };

    await db.students.put(updated as StudentRow & EntitySource);
    await LocalRepository.enqueueSyncItem({
      school_id: updated.school_id,
      entity_type: 'students',
      entity_id: student_id,
      operation: 'UPDATE',
      payload: buildPayload(updated),
    });

    return updated;
  },

  async getStudentsBySchool(school_id: string, includeArchived = false) {
    const students = await LocalRepository.getStudentsBySchool(school_id);
    if (includeArchived) return students;
    return students.filter((s) => s.status === 'ACTIVE');
  },

  async getStudentsByIds(studentIds: string[]) {
    return db.students.where('id').anyOf(studentIds).toArray();
  },

  async getStudentById(student_id: string): Promise<StudentRow | undefined> {
    return db.students.get(student_id);
  },

  async searchStudents(school_id: string, query: string, includeArchived = false) {
    const results = await LocalRepository.searchStudentsBySchool(school_id, query);
    if (includeArchived) return results;
    return results.filter((s) => s.status === 'ACTIVE');
  },
};
