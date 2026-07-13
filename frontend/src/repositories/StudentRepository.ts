import db from '../offline/localDb';
import { LocalRepository } from '../offline/localDb';

export const StudentRepository = {
  async saveStudent(student: Record<string, any>) {
    const { v4: uuidv4 } = await import('uuid');
    const record = {
      id: student.id ?? uuidv4(),
      ...student,
      updated_at: new Date().toISOString(),
    };

    await LocalRepository.saveStudent(record);
    await LocalRepository.enqueueSyncItem({
      id: `student-sync-${record.id}-${Date.now()}`,
      school_id: record.school_id,
      entity_type: 'students',
      entity_id: record.id,
      payload: record,
    });

    return record;
  },

  async updateStudent(student_id: string, updates: Record<string, any>) {
    const existing = await db.students.get(student_id);
    if (!existing) throw new Error('Student not found');

    const updated = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await db.students.put(updated);
    await LocalRepository.enqueueSyncItem({
      id: `student-sync-${student_id}-${Date.now()}`,
      school_id: updated.school_id,
      entity_type: 'students',
      entity_id: student_id,
      operation: 'UPDATE',
      payload: updated,
    });

    return updated;
  },

  async archiveStudent(student_id: string, status: 'ACTIVE' | 'GRADUATED' | 'LEFT') {
    const existing = await db.students.get(student_id);
    if (!existing) throw new Error('Student not found');

    const updated = {
      ...existing,
      status,
      updated_at: new Date().toISOString(),
    };

    await db.students.put(updated);
    await LocalRepository.enqueueSyncItem({
      id: `student-sync-${student_id}-${Date.now()}`,
      school_id: updated.school_id,
      entity_type: 'students',
      entity_id: student_id,
      operation: 'UPDATE',
      payload: updated,
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

  async getStudentById(student_id: string) {
    return db.students.get(student_id);
  },

  async searchStudents(school_id: string, query: string, includeArchived = false) {
    const results = await LocalRepository.searchStudentsBySchool(school_id, query);
    if (includeArchived) return results;
    return results.filter((s) => s.status === 'ACTIVE');
  },
};