/**
 * Student & Guardian Types
 */

// Guardian relationship is per student, not per guardian
export type Relationship =
  | 'FATHER'
  | 'MOTHER'
  | 'UNCLE'
  | 'AUNT'
  | 'BROTHER'
  | 'SISTER'
  | 'GRANDPARENT'
  | 'OTHER';

export type StudentStatus = 'ACTIVE' | 'GRADUATED' | 'TRANSFERRED' | 'WITHDRAWN' | 'SUSPENDED' | 'ARCHIVED';
export type GuardianStatus = 'ACTIVE' | 'INACTIVE';

export interface Student {
  id: string;
  schoolId: string;
  divisionId: string;
  guardianId: string;
  admissionNumber?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  gender: string;
  dateOfBirth?: string;
  admissionDate: string;
  registeredAt: string;         // automatic - when recorded in CAPFLUX
  relationshipToGuardian: Relationship;
  discountRate: number;         // 0-100 percentage
  status: StudentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Guardian {
  id: string;
  schoolId: string;
  fullName: string;
  phone: string;             // required, unique within school
  email?: string;
  occupation?: string;
  address?: string;
  status: GuardianStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StudentResult<T> {
  data: T | null;
  error: StudentError | null;
}

export type StudentErrorCode =
  | 'STUDENT_NOT_FOUND'
  | 'GUARDIAN_NOT_FOUND'
  | 'STUDENT_CREATE_FAILED'
  | 'STUDENT_UPDATE_FAILED'
  | 'GUARDIAN_CREATE_FAILED'
  | 'GUARDIAN_UPDATE_FAILED'
  | 'DUPLICATE_ADMISSION_NUMBER'
  | 'DUPLICATE_PHONE'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'UNKNOWN';

export interface StudentError {
  code: StudentErrorCode;
  message: string;
  raw?: unknown;
}