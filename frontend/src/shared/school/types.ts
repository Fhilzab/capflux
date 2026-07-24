/**
 * School Types
 * Minimal identity-focused types for this milestone
 */

// School lifecycle status
export type SchoolStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'PENDING';

// Minimal School interface (identity only - settings/branding belong in later milestones)
export interface School {
  id: string;
  name: string;
  slug: string;
  status: SchoolStatus;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export type AdmissionNumberMode = 'MANUAL' | 'AUTO';

export interface SchoolAdmissionSettings {
  mode: AdmissionNumberMode;
  prefix?: string;
  currentSequence: number;
}

// Result wrapper for school operations
export interface SchoolResult<T> {
  data: T | null;
  error: SchoolError | null;
}

// School error codes
export type SchoolErrorCode = 
  | 'SCHOOL_NOT_FOUND'
  | 'SCHOOL_CREATE_FAILED'
  | 'SCHOOL_UPDATE_FAILED'
  | 'SCHOOL_ARCHIVE_FAILED'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'UNKNOWN';

// School error structure
export interface SchoolError {
  code: SchoolErrorCode;
  message: string;
  raw?: unknown;
}