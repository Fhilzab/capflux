import type { BillingProfile, StudentCharge, BillingSnapshot, BillingResult } from './types';

/**
 * Billing Provider Interface
 * Abstract contract for billing providers
 */
export abstract class BillingProvider {
  // BillingProfile CRUD
  abstract createBillingProfile(data: {
    studentId: string;
    schoolId: string;
    academicSessionId: string;
    discountRate: number;
    billingCycle: 'TERM' | 'SEMESTER' | 'SESSION';
    initializationStatus: 'PENDING' | 'ACTIVE' | 'LOCKED' | 'ARCHIVED' | 'FAILED';
  }): Promise<BillingResult<BillingProfile>>;

  abstract updateBillingProfile(profileId: string, data: Partial<BillingProfile>): Promise<BillingResult<BillingProfile>>;
  abstract getBillingProfile(profileId: string): Promise<BillingResult<BillingProfile>>;
  abstract findBillingProfile(studentId: string, academicSessionId: string): Promise<BillingResult<BillingProfile | null>>;
  abstract listBillingProfiles(schoolId: string): Promise<BillingResult<BillingProfile[]>>;

  // BillingSnapshot CRUD
  abstract createBillingSnapshot(data: {
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
    billingVersion: number;
  }): Promise<BillingResult<BillingSnapshot>>;

  abstract getBillingSnapshot(snapshotId: string): Promise<BillingResult<BillingSnapshot>>;

  // StudentCharge CRUD
  abstract createStudentCharge(data: {
    billingProfileId: string;
    snapshotId: string;
    studentId: string;
    academicSessionId: string;
    academicTermId: string;
    chargeSource: 'MANDATORY' | 'OPTIONAL' | 'PLATFORM';
    status: 'ACTIVE' | 'WAIVED' | 'VOID' | 'PAID' | 'PARTIALLY_PAID';
    ledgerLocked: boolean;
    paymentPlanId?: string;
  }): Promise<BillingResult<StudentCharge>>;

  abstract updateStudentCharge(chargeId: string, data: Partial<StudentCharge>): Promise<BillingResult<StudentCharge>>;
  abstract getStudentCharge(chargeId: string): Promise<BillingResult<StudentCharge>>;
  abstract listStudentCharges(studentId: string): Promise<BillingResult<StudentCharge[]>>;
  abstract listChargesByProfile(profileId: string): Promise<BillingResult<StudentCharge[]>>;
  abstract listChargesByStatus(studentId: string, status: string): Promise<BillingResult<StudentCharge[]>>;

  // Future stubs
  abstract generateInvoice?(chargeIds: string[]): Promise<BillingResult<void>>;
  abstract recordPayment?(chargeId: string, amount: number): Promise<BillingResult<void>>;
  abstract reverseCharge?(chargeId: string): Promise<BillingResult<void>>;
  abstract rollForwardTerm?(billingCycle: 'TERM' | 'SEMESTER' | 'SESSION'): Promise<BillingResult<void>>;
  abstract rollForwardSession?(sessionId: string): Promise<BillingResult<void>>;
  abstract rebuildStudentBilling?(studentId: string): Promise<BillingResult<void>>;
  abstract rebuildDivisionBilling?(schoolId: string, divisionId: string): Promise<BillingResult<void>>;
  abstract rebuildSchoolBilling?(schoolId: string): Promise<BillingResult<void>>;

  abstract isConfigured(): boolean;
}