export type {
  Student,
  Guardian,
  Relationship,
  StudentStatus,
  GuardianStatus,
  StudentResult,
  StudentErrorCode,
} from './types';
export { StudentProvider } from './StudentProvider';
export { SupabaseStudentProvider } from './SupabaseStudentProvider';
export { StudentService, studentService } from './StudentService';
export { StudentValidator, type StudentValidationResult } from './StudentValidator';
export { mapProviderError, getStudentErrorMessage } from './StudentError';
export { AdmissionNumberGenerator, type GeneratedAdmissionNumber } from './AdmissionNumberGenerator';