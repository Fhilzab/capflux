/**
 * School Types
 * Operational + Payment status for the two-phase lifecycle
 */

// School operational lifecycle status
export type SchoolStatus = 'PENDING_SETUP' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

// Payment activation lifecycle status (separate concern from school status)
export type PaymentStatus =
  | 'NOT_READY'
  | 'PENDING_KYC'
  | 'UNDER_REVIEW'
  | 'READY'
  | 'REJECTED'
  | 'SUSPENDED';

// Minimal School interface (identity + lifecycle status)
export interface School {
  id: string;
  name: string;
  slug: string;
  status: SchoolStatus;
  paymentStatus: PaymentStatus;
  organizationId: string;
  address?: string;
  state?: string;
  lga?: string;
  country?: string;
  schoolType?: string;
  academicCalendar?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Onboarding checklist state
export interface OnboardingProgress {
  schoolId: string;
  profileCompleted: boolean;
  organizationCompleted: boolean;
  schoolCompleted: boolean;
  ownerCompleted: boolean;
  completedAt?: string | null;
  activatedAt?: string | null;
}

// Onboarding status response from backend
export interface OnboardingStatus {
  userId: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  } | null;
  school: {
    id: string;
    name: string;
    slug: string;
    status: SchoolStatus;
    paymentStatus: PaymentStatus;
    organizationId: string;
  } | null;
  onboarding: OnboardingProgress | null;
  kyc: {
    id: string;
    status: string;
    submittedAt?: string;
    reviewedAt?: string;
    rejectionReason?: string;
  } | null;
}

// Computed visibility helpers
export interface SchoolComputedFlags {
  requiresSetup: boolean;
  isOperational: boolean;
  isPaymentReady: boolean;
  requiresKYC: boolean;
  isUnderReview: boolean;
  canCollectPayments: boolean;
}

export type AdmissionNumberMode = 'MANUAL' | 'AUTO';

export interface SchoolAdmissionSettings {
  mode: AdmissionNumberMode;
  prefix?: string;
  currentSequence: number;
}

export type AcademicCalendarType = 'TERM' | 'SEMESTER' | 'QUARTER';

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
