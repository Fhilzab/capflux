/**
 * Billing Domain Types
 */

export type BillingCycle = 'TERM' | 'SEMESTER' | 'SESSION';
export type BillingInitializationStatus = 'PENDING' | 'ACTIVE' | 'LOCKED' | 'ARCHIVED' | 'FAILED';
export type ChargeSource = 'MANDATORY' | 'OPTIONAL' | 'PLATFORM';
export type ChargeStatus = 'ACTIVE' | 'WAIVED' | 'VOID' | 'PAID' | 'PARTIALLY_PAID';

export interface BillingProfile {
  id: string;
  studentId: string;
  schoolId: string;
  academicSessionId: string;      // per session, not term
  discountRate: number;
  billingCycle: BillingCycle;     // 'TERM' | 'SEMESTER' | 'SESSION'
  initializationStatus: BillingInitializationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BillingSnapshot {
  id: string;
  feeId: string;
  feeName: string;
  feeCode: string;
  amount: number;
  currency: string;
  owner: 'SCHOOL' | 'PLATFORM';
  isMandatory: boolean;
  divisionId: string;
  academicSessionId: string;
  academicTermId: string;
  discountApplied: number;
  netAmount: number;
  billingVersion: number;         // starts at 1 — future-proof for algorithm changes
  createdAt: string;
}

export interface StudentCharge {
  id: string;
  billingProfileId: string;
  snapshotId: string;             // references BillingSnapshot
  studentId: string;
  academicSessionId: string;
  academicTermId: string;
  chargeSource: ChargeSource;
  status: ChargeStatus;
  ledgerLocked: boolean;
  paymentPlanId?: string;         // reserved for future
  createdAt: string;
  updatedAt: string;
}

export interface BillingResult<T> {
  data: T | null;
  error: BillingError | null;
}

export type BillingErrorCode =
  | 'BILLING_PROFILE_NOT_FOUND'
  | 'STUDENT_CHARGE_NOT_FOUND'
  | 'BILLING_PROFILE_CREATE_FAILED'
  | 'STUDENT_CHARGE_CREATE_FAILED'
  | 'BILLING_SNAPSHOT_CREATE_FAILED'
  | 'BILLING_PROFILE_UPDATE_FAILED'
  | 'STUDENT_CHARGE_UPDATE_FAILED'
  | 'DUPLICATE_CHARGE'
  | 'MANDATORY_FEE_REMOVAL'
  | 'PLATFORM_FEE_REMOVAL'
  | 'SESSION_NOT_ACTIVE'
  | 'TERM_NOT_ACTIVE'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'UNKNOWN';

export interface BillingError {
  code: BillingErrorCode;
  message: string;
  raw?: unknown;
}