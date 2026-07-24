export interface BillingValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export class BillingValidator {
  static validateBillingProfile(input: {
    studentId: string;
    schoolId: string;
    academicSessionId: string;
    discountRate: number;
    billingCycle: string;
  }): BillingValidationResult {
    const errors: Record<string, string> = {};

    if (!input.studentId) errors.studentId = 'Student is required';
    if (!input.schoolId) errors.schoolId = 'School is required';
    if (!input.academicSessionId) errors.academicSessionId = 'Academic session is required';
    if (input.discountRate < 0 || input.discountRate > 100) {
      errors.discountRate = 'Discount rate must be between 0 and 100';
    }
    if (!['TERM', 'SEMESTER', 'SESSION'].includes(input.billingCycle)) {
      errors.billingCycle = 'Invalid billing cycle';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  static validateStudentCharge(input: {
    billingProfileId: string;
    snapshotId: string;
    studentId: string;
    academicSessionId: string;
    academicTermId: string;
    chargeSource: string;
    status: string;
  }): BillingValidationResult {
    const errors: Record<string, string> = {};

    if (!input.billingProfileId) errors.billingProfileId = 'Billing profile is required';
    if (!input.snapshotId) errors.snapshotId = 'Billing snapshot is required';
    if (!input.studentId) errors.studentId = 'Student is required';
    if (!input.academicSessionId) errors.academicSessionId = 'Academic session is required';
    if (!input.academicTermId) errors.academicTermId = 'Academic term is required';
    if (!['MANDATORY', 'OPTIONAL', 'PLATFORM'].includes(input.chargeSource)) {
      errors.chargeSource = 'Invalid charge source';
    }
    if (!['ACTIVE', 'WAIVED', 'VOID', 'PAID', 'PARTIALLY_PAID'].includes(input.status)) {
      errors.status = 'Invalid charge status';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  static validateBillingSnapshot(input: {
    feeId: string;
    amount: number;
    discountApplied: number;
    netAmount: number;
    academicSessionId: string;
    academicTermId: string;
  }): BillingValidationResult {
    const errors: Record<string, string> = {};

    if (!input.feeId) errors.feeId = 'Fee is required';
    if (input.amount < 0) errors.amount = 'Amount cannot be negative';
    if (input.discountApplied < 0) errors.discountApplied = 'Discount cannot be negative';
    if (input.netAmount < 0) errors.netAmount = 'Net amount cannot be negative';
    if (!input.academicSessionId) errors.academicSessionId = 'Academic session is required';
    if (!input.academicTermId) errors.academicTermId = 'Academic term is required';

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }
}