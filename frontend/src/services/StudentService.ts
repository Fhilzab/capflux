import { StudentRepository } from '../repositories/StudentRepository';
import { GuardianService } from './GuardianService';
import { GuardianRepository } from '../repositories/GuardianRepository';
import db from '../offline/localDb';

export const StudentService = {
  /**
   * Register a student with guardian linking
   * Guardian dedup logic: if guardian with same school + phone exists, reuse it
   */
  async registerStudentWithGuardian(school_id: string, studentData: {
    first_name: string;
    last_name: string;
    class_name: string;
    guardian_full_name: string;
    guardian_phone: string;
    guardian_secondary_phone?: string;
    guardian_email?: string;
    relationship?: 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER';
  }) {
    // Get or create guardian
    const guardian = await GuardianService.getOrCreateGuardian(school_id, {
      full_name: studentData.guardian_full_name,
      primary_phone: studentData.guardian_phone,
      secondary_phone: studentData.guardian_secondary_phone,
      email: studentData.guardian_email,
      relationship: studentData.relationship,
    });

    // Create student linked to guardian
    const student = {
      school_id,
      first_name: studentData.first_name,
      last_name: studentData.last_name,
      class_name: studentData.class_name,
      guardian_id: guardian.id,
      status: 'ACTIVE',
      client_sequence: 0,
      device_id: 'local-client',
    };

    return StudentRepository.saveStudent(student);
  },

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

  /**
   * Get students with their guardian info populated
   * Useful for views that need to display guardian data
   */
  async getStudentsWithGuardians(school_id: string, includeArchived = false) {
    const students = await this.getStudentsBySchool(school_id, includeArchived);
    
    // Fetch guardians for each student
    const guardianIds = [...new Set(students.map(s => s.guardian_id).filter(Boolean))] as string[];
    
    const guardians = await db.guardians.where('id').anyOf(guardianIds).toArray();
    const guardianMap = new Map(guardians.map(g => [g.id, g]));

    return students.map(student => ({
      ...student,
      guardian: student.guardian_id ? guardianMap.get(student.guardian_id) : null,
    }));
  },
};
