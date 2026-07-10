import { v4 as uuidv4 } from 'uuid';
import { LocalRepository } from '../offline/localDb';

export const StudentRepository = {
  async saveStudent(student: Record<string, any>) {
    const record = {
      id: student.id ?? uuidv4(),
      ...student,
      updated_at: new Date().toISOString(),
    };

    await LocalRepository.saveStudent(record);
    return record;
  },

  async getStudentsBySchool(school_id: string) {
    return LocalRepository.getStudentsBySchool(school_id);
  },
};
