export type {
  School,
  SchoolStatus,
  SchoolResult,
  SchoolError,
  SchoolErrorCode,
} from './types';
export { SchoolProvider } from './SchoolProvider';
export { SupabaseSchoolProvider } from './SupabaseSchoolProvider';
export { SchoolService, schoolService } from './SchoolService';
export { SchoolValidator, type SchoolValidationResult } from './SchoolValidator';
export { mapProviderError, getSchoolErrorMessage } from './SchoolError';