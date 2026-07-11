import { StudentRepository } from '../repositories/StudentRepository';

export const StudentService = {
  async saveStudent(student: Record<string, any>) {
    return StudentRepository.saveStudent(student);
  },

  async updateStudent(student_id: string, updates: Record<string, any>) {
    return StudentRepository.updateStudent(student_id, updates);
  },

  async archiveStudent(student_id: string, status: 'ACTIVE' | 'GRADUATED' | 'LEFT') {
    return StudentRepository.archiveStudent(student_id, status);
  },

  async getStudentsBySchool(school_id: string, includeArchived = false) {
    return StudentRepository.getStudentsBySchool(school_id, includeArchived);
  },

  async getStudentById(student_id: string) {
    return StudentRepository.getStudentById(student_id);
  },

  async searchStudents(school_id: string, query: string, includeArchived = false) {
    return StudentRepository.searchStudents(school_id, query, includeArchived);
  },
};
