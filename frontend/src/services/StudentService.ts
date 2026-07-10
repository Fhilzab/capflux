import { StudentRepository } from '../repositories/StudentRepository';

export const StudentService = {
  async saveStudent(student: Record<string, any>) {
    return StudentRepository.saveStudent(student);
  },

  async getStudentsBySchool(school_id: string) {
    return StudentRepository.getStudentsBySchool(school_id);
  },

  async getStudentById(student_id: string) {
    return StudentRepository.getStudentById(student_id);
  },

  async searchStudents(school_id: string, query: string) {
    return StudentRepository.searchStudents(school_id, query);
  },
};
