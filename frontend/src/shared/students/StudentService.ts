import { SupabaseStudentProvider } from './SupabaseStudentProvider';
import { StudentProvider } from './StudentProvider';
import { StudentValidator } from './StudentValidator';
import { AdmissionNumberGenerator } from './AdmissionNumberGenerator';
import type { Student, Guardian, StudentResult } from './types';
import type { SchoolAdmissionSettings } from '../school/types';

export class StudentService {
  private provider: StudentProvider;

  constructor(provider: StudentProvider = new SupabaseStudentProvider()) {
    this.provider = provider;
  }

  async createStudent(data: {
    schoolId: string;
    divisionId: string;
    guardianId: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    gender: string;
    dateOfBirth?: string;
    admissionNumber?: string;
    admissionDate: string;
    registeredAt: string;
    relationshipToGuardian: string;
    discountRate: number;
    admissionSettings?: SchoolAdmissionSettings;
  }): Promise<StudentResult<Student>> {
    const validation = StudentValidator.validateCreate(data);
    if (!validation.valid) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: Object.values(validation.errors).join(', '),
        },
      };
    }

    // Handle admission number generation
    let admissionNumber = data.admissionNumber;
    if (!admissionNumber && data.admissionSettings?.mode === 'AUTO') {
      const generated = AdmissionNumberGenerator.generate(data.admissionSettings);
      admissionNumber = generated.number;
    }

    return this.provider.createStudent({
      ...data,
      admissionNumber,
    });
  }

  async updateStudent(studentId: string, data: Partial<Student>): Promise<StudentResult<Student>> {
    if (!studentId) {
      return { data: null, error: { code: 'STUDENT_NOT_FOUND', message: 'Student ID is required' } };
    }

    const validation = StudentValidator.validateUpdate(data);
    if (!validation.valid) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: Object.values(validation.errors).join(', '),
        },
      };
    }

    return this.provider.updateStudent(studentId, data);
  }

  async loadStudents(schoolId: string): Promise<StudentResult<Student[]>> {
    return this.provider.listStudents(schoolId);
  }

  async searchStudents(schoolId: string, query: string): Promise<StudentResult<Student[]>> {
    const allResult = await this.provider.listStudents(schoolId);
    if (allResult.error || !allResult.data) {
      return allResult;
    }

    if (!query.trim()) {
      return allResult;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = allResult.data.filter(student => {
      const admissionMatch = student.admissionNumber?.toLowerCase().includes(lowerQuery);
      const firstNameMatch = student.firstName.toLowerCase().includes(lowerQuery);
      const lastNameMatch = student.lastName.toLowerCase().includes(lowerQuery);
      const nameMatch = `${student.firstName} ${student.lastName}`.toLowerCase().includes(lowerQuery);
      return admissionMatch || firstNameMatch || lastNameMatch || nameMatch;
    });

    return { data: filtered, error: null };
  }

  async filterByDivision(schoolId: string, divisionId: string): Promise<StudentResult<Student[]>> {
    const allResult = await this.provider.listStudents(schoolId);
    if (allResult.error || !allResult.data) {
      return allResult;
    }

    const filtered = allResult.data.filter(student => student.divisionId === divisionId);
    return { data: filtered, error: null };
  }

  async activateStudent(studentId: string): Promise<StudentResult<Student>> {
    if (!studentId) {
      return { data: null, error: { code: 'STUDENT_NOT_FOUND', message: 'Student ID is required' } };
    }
    return this.provider.activateStudent(studentId);
  }

  async deactivateStudent(studentId: string): Promise<StudentResult<Student>> {
    if (!studentId) {
      return { data: null, error: { code: 'STUDENT_NOT_FOUND', message: 'Student ID is required' } };
    }
    return this.provider.deactivateStudent(studentId);
  }

  // Guardian methods
  async createGuardian(data: {
    schoolId: string;
    fullName: string;
    phone: string;
    email?: string;
    occupation?: string;
    address?: string;
  }): Promise<StudentResult<Guardian>> {
    const validation = StudentValidator.validateGuardian(data);
    if (!validation.valid) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: Object.values(validation.errors).join(', '),
        },
      };
    }

    return this.provider.createGuardian(data);
  }

  async updateGuardian(guardianId: string, data: Partial<Guardian>): Promise<StudentResult<Guardian>> {
    if (!guardianId) {
      return { data: null, error: { code: 'GUARDIAN_NOT_FOUND', message: 'Guardian ID is required' } };
    }

    const validation = StudentValidator.validateGuardianUpdate(data);
    if (!validation.valid) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: Object.values(validation.errors).join(', '),
        },
      };
    }

    return this.provider.updateGuardian(guardianId, data);
  }

  async loadGuardians(schoolId: string): Promise<StudentResult<Guardian[]>> {
    return this.provider.listGuardians(schoolId);
  }

  async searchGuardians(schoolId: string, query: string): Promise<StudentResult<Guardian[]>> {
    const allResult = await this.provider.listGuardians(schoolId);
    if (allResult.error || !allResult.data) {
      return allResult;
    }

    if (!query.trim()) {
      return allResult;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = allResult.data.filter(guardian => {
      const nameMatch = guardian.fullName.toLowerCase().includes(lowerQuery);
      const phoneMatch = guardian.phone.includes(query);
      return nameMatch || phoneMatch;
    });

    return { data: filtered, error: null };
  }

  async getGuardianStudents(guardianId: string): Promise<StudentResult<Student[]>> {
    if (!guardianId) {
      return { data: [], error: null };
    }

    const result = await this.provider.listGuardianStudents(guardianId);
    return result;
  }
}

export const studentService = new StudentService();