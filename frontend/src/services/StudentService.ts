import { StudentRepository } from '../repositories/StudentRepository';

export const StudentService = {
  async saveStudent(student: Record<string, any>) {
    return StudentRepository.saveStudent(student);
  },

  async getStudentsBySchool(school_id: string) {
    return StudentRepository.getStudentsBySchool(school_id);
  },
};
