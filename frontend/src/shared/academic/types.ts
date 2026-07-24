/**
 * Academic Session & Term Types
 */

export type SessionStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type TermStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED';

export interface AcademicSession {
  id: string;
  schoolId: string;
  name: string;              // "2026/2027"
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicTerm {
  id: string;
  sessionId: string;
  schoolId: string;
  name: string;              // "First Term", "Rain Term"
  termNumber: number;        // 1..N (validator enforces range by calendar type)
  displayOrder: number;      // UI sorting independent of termNumber
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: TermStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicResult<T> {
  data: T | null;
  error: AcademicError | null;
}

export type AcademicErrorCode =
  | 'SESSION_NOT_FOUND'
  | 'TERM_NOT_FOUND'
  | 'SESSION_CREATE_FAILED'
  | 'TERM_CREATE_FAILED'
  | 'SESSION_UPDATE_FAILED'
  | 'TERM_UPDATE_FAILED'
  | 'SESSION_OVERLAP'
  | 'TERM_OUT_OF_RANGE'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'UNKNOWN';

export interface AcademicError {
  code: AcademicErrorCode;
  message: string;
  raw?: unknown;
}