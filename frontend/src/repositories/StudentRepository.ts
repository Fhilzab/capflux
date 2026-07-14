import db from '../offline/localDb';
import { LocalRepository } from '../offline/localDb';
import type { Student } from '../types/billing';

export const StudentRepository = {
  async saveStudent(student: Partial<Student>) {
    const { v4: uuidv4 } = await import('uuid');
    const record: Student = {
      id: student.id ?? uuidv4(),
      school_id: student.school_id!,
      first_name: student.first_name!,
      last_name: student.last_name!,
      class_name: student.class_name!,
      category: student.category ?? 'PRIMARY',
      guardian_id: student.guardian_id,
      status: student.status ?? 'ACTIVE',
      client_sequence: student.client_sequence ?? 0,
      device_id: student.device_id ?? 'local-client',
      created_at: student.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await LocalRepository.saveStudent(record);
    await LocalRepository.enqueueSyncItem({
      school_id: record.school_id,
      entity_type: 'students',
      entity_id: record.id,
      payload: {
        id: record.id,
        school_id: record.school_id,
        first_name: record.first_name,
        last_name: record.last_name,
        class_name: record.class_name,
        category: record.category,
        guardian_id: record.guardian_id,
        status: record.status,
        client_sequence: record.client_sequence,
        device_id: record.device_id,
        created_at: record.created_at,
        updated_at: record.updated_at,
      } as Record<string, unknown>,
    });

    return record;
  },

  async updateStudent(student_id: string, updates: Partial<Student>) {
    const existing = await db.students.get(student_id);
    if (!existing) throw new Error('Student not found');

    const updated: Student = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await db.students.put(updated);
    await LocalRepository.enqueueSyncItem({
      school_id: updated.school_id,
      entity_type: 'students',
      entity_id: student_id,
      operation: 'UPDATE',
      payload: {
        id: updated.id,
        school_id: updated.school_id,
        first_name: updated.first_name,
        last_name: updated.last_name,
        class_name: updated.class_name,
        category: updated.category,
        guardian_id: updated.guardian_id,
        status: updated.status,
        client_sequence: updated.client_sequence,
        device_id: updated.device_id,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      } as Record<string, unknown>,
    });

    return updated;
  },

  async archiveStudent(student_id: string, status: 'ACTIVE' | 'GRADUATED' | 'LEFT') {
    const existing = await db.students.get(student_id);
    if (!existing) throw new Error('Student not found');

    const updated: Student = {
      ...existing,
      status,
      updated_at: new Date().toISOString(),
    };

    await db.students.put(updated);
    await LocalRepository.enqueueSyncItem({
      school_id: updated.school_id,
      entity_type: 'students',
      entity_id: student_id,
      operation: 'UPDATE',
      payload: {
        id: updated.id,
        school_id: updated.school_id,
        first_name: updated.first_name,
        last_name: updated.last_name,
        class_name: updated.class_name,
        category: updated.category,
        guardian_id: updated.guardian_id,
        status: updated.status,
        client_sequence: updated.client_sequence,
        device_id: updated.device_id,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      } as Record<string, unknown>,
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

  async getStudentById(student_id: string): Promise<Student | undefined> {
    return db.students.get(student_id);
  },

  async searchStudents(school_id: string, query: string, includeArchived = false) {
    const results = await LocalRepository.searchStudentsBySchool(school_id, query);
    if (includeArchived) return results;
    return results.filter((s) => s.status === 'ACTIVE');
  },
};