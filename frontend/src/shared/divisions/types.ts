/**
 * Division Types
 * Billing divisions for fee template assignment
 */

export type DivisionStatus = 'ACTIVE' | 'INACTIVE';

export interface SchoolDivision {
  id: string;
  schoolId: string;
  name: string;           // "Nursery", "Primary", "Secondary"
  code: string;           // "NUR", "PRI", "SEC"
  displayOrder: number;   // 1, 2, 3
  status: DivisionStatus;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DivisionResult<T> {
  data: T | null;
  error: DivisionError | null;
}

export type DivisionErrorCode =
  | 'DIVISION_NOT_FOUND'
  | 'DIVISION_CREATE_FAILED'
  | 'DIVISION_UPDATE_FAILED'
  | 'DIVISION_DEACTIVATE_FAILED'
  | 'DIVISION_ACTIVATE_FAILED'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'UNKNOWN';

export interface DivisionError {
  code: DivisionErrorCode;
  message: string;
  raw?: unknown;
}