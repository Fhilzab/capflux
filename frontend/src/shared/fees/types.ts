/**
 * Fee Types
 * Fee master records for fee template assignment
 */

export type FeeOwner = 'SCHOOL' | 'PLATFORM';

export interface Fee {
  id: string;
  owner: FeeOwner;
  schoolId: string | null;      // null when owner === PLATFORM
  divisionId: string | null;    // null when owner === PLATFORM
  name: string;
  code: string;
  isMandatory: boolean;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeeResult<T> {
  data: T | null;
  error: FeeError | null;
}

export type FeeErrorCode =
  | 'FEE_NOT_FOUND'
  | 'FEE_CREATE_FAILED'
  | 'FEE_UPDATE_FAILED'
  | 'FEE_DEACTIVATE_FAILED'
  | 'FEE_ACTIVATE_FAILED'
  | 'TUITION_DUPLICATE'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'UNKNOWN';

export interface FeeError {
  code: FeeErrorCode;
  message: string;
  raw?: unknown;
}