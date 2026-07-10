import { v4 as uuidv4 } from 'uuid';
import db from '../offline/localDb';
import { LocalRepository } from '../offline/localDb';

export const StudentRepository = {
  async saveStudent(student: Record<string, any>) {
    const record = {
      id: student.id ?? uuidv4(),
      ...student,
      updated_at: new Date().toISOString(),
    };

    await LocalRepository.saveStudent(record);
    await LocalRepository.enqueueSyncItem({
      id: `student-sync-${record.id}`,
      school_id: record.school_id,
      entity_type: 'students',
      entity_id: record.id,
      payload: record,
    });

    return record;
  },

  async getStudentsBySchool(school_id: string) {
    return LocalRepository.getStudentsBySchool(school_id);
  },

  async getStudentById(student_id: string) {
    return db.students.get(student_id);
  },

  async searchStudents(school_id: string, query: string) {
    return LocalRepository.searchStudentsBySchool(school_id, query);
  },
};
