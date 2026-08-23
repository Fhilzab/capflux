import type { StudentStatus, Relationship } from '@/shared/students/types';

import type { SchoolDivision } from '@/shared/divisions/types';

export interface NormalizedGuardian {
  id: string;
  schoolId: string;
  fullName: string;
  phone: string;
  secondaryPhone?: string;
  email?: string;
  relationship?: Relationship;
  createdAt: string;
  updatedAt: string;
}

export interface NormalizedStudent {
  id: string;
  schoolId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  admissionNumber?: string;
  studentId?: string;
  class: string;
  divisionId?: string;
  guardianId?: string;
  guardian: NormalizedGuardian | null;
  gender?: string;
  dateOfBirth?: string;
  admissionDate?: string;
  registeredAt?: string;
  status: StudentStatus;
  academicSession?: string;
  /** Current academic placement (hydrated from student_enrollments). */
  sessionId?: string;
  sectionId?: string;
  levelId?: string;
  levelName?: string;
  sectionName?: string;
  createdAt: string;
  updatedAt: string;
}

export type StudentSortField = 'name' | 'admissionNumber' | 'class' | 'dateRegistered' | 'status';

export interface SortConfig {
  field: StudentSortField;
  order: 'asc' | 'desc';
}

export interface FilterState {
  class: string;
  gender: string;
  status: 'ALL' | 'ACTIVE' | 'ARCHIVED';
  academicSession: string;
  relationship: string;
}

export type DivisionsLookup = SchoolDivision[] | NormalizedStudent['divisionId'][];

/**
 * Recognized student field for import column mapping.
 */
export type StudentField =
  | 'firstName'
  | 'lastName'
  | 'middleName'
  | 'gender'
  | 'dateOfBirth'
  | 'admissionNumber'
  | 'studentId'
  | 'guardianName'
  | 'guardianPhone'
  | 'relationship'
  | 'guardianEmail'
  | 'guardianSecondaryPhone'
  | 'secondaryPhone'
  | 'dateOfAdmission'
  | 'status'
  | 'className'
  | 'academicSession'
  | 'section'
  | 'academicLevel'
  | 'guardianAddress'
  | 'previousSchool'
  | 'medicalNotes'
  | 'specialNotes'
  | '';

export interface ColumnMapping {
  [header: string]: StudentField;
}

export interface ValidatedRow {
  rowIndex: number;
  mapped: Record<string, string>;
  valid: boolean;
  errors: string[];
  warnings: string[];
  exists: boolean;
}

export type ImportStepName = 'source' | 'upload' | 'mapping' | 'validation' | 'duplicates' | 'confirm' | 'results';

export interface ParseResult {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
}

export interface ImportSummary {
  total: number;
  ready: number;
  warnings: number;
  errors: number;
}

export interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  failures: Array<{ row: number; message: string }>;
  importedIds: string[];
}

export interface ExportField {
  key: string;
  label: string;
}
