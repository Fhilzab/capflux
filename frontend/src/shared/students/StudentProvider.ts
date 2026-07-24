import type { Student, Guardian, StudentResult } from './types';

/**
 * Student Provider Interface
 * CRUD for Students and Guardians only
 */
export abstract class StudentProvider {
  // Student CRUD
  abstract createStudent(data: {
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
  }): Promise<StudentResult<Student>>;

  abstract updateStudent(studentId: string, data: Partial<Student>): Promise<StudentResult<Student>>;
  abstract getStudent(studentId: string): Promise<StudentResult<Student>>;
  abstract listStudents(schoolId: string): Promise<StudentResult<Student[]>>;
  abstract activateStudent(studentId: string): Promise<StudentResult<Student>>;
  abstract deactivateStudent(studentId: string): Promise<StudentResult<Student>>;

  // Guardian CRUD
  abstract createGuardian(data: {
    schoolId: string;
    fullName: string;
    phone: string;
    email?: string;
    occupation?: string;
    address?: string;
  }): Promise<StudentResult<Guardian>>;

  abstract updateGuardian(guardianId: string, data: Partial<Guardian>): Promise<StudentResult<Guardian>>;
  abstract getGuardian(guardianId: string): Promise<StudentResult<Guardian>>;
  abstract listGuardians(schoolId: string): Promise<StudentResult<Guardian[]>>;

  // Future stubs
  abstract assignFee?(studentId: string, feeId: string): Promise<StudentResult<void>>;
  abstract removeFee?(studentId: string, feeId: string): Promise<StudentResult<void>>;
  abstract grantDiscount?(studentId: string, discountRate: number): Promise<StudentResult<void>>;
  abstract removeDiscount?(studentId: string): Promise<StudentResult<void>>;
  abstract graduateStudent?(studentId: string): Promise<StudentResult<Student>>;
  abstract transferStudent?(studentId: string, targetDivisionId: string): Promise<StudentResult<Student>>;
  abstract listGuardianStudents?(guardianId: string): Promise<StudentResult<Student[]>>;
  abstract mergeGuardians?(sourceGuardianId: string, targetGuardianId: string): Promise<StudentResult<void>>;

  abstract isConfigured(): boolean;
}