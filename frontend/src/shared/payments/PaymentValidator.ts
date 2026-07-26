export interface PaymentValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export class PaymentValidator {
  static validatePayment(input: {
    studentId: string;
    billingProfileId: string;
    amount: number;
    currency: string;
    method: string;
    gatewayProvider: string;
    providerReference: string;
    gatewayReference: string;
  }): PaymentValidationResult {
    const errors: Record<string, string> = {};

    if (!input.studentId) errors.studentId = 'Student is required';
    if (!input.billingProfileId) errors.billingProfileId = 'Billing profile is required';
    if (input.amount <= 0) errors.amount = 'Amount must be greater than zero';
    if (!input.currency) errors.currency = 'Currency is required';
    if (!['BANK_TRANSFER', 'CASH', 'POS', 'ONLINE'].includes(input.method)) {
      errors.method = 'Invalid payment method';
    }
    if (!['PAYSTACK', 'MONNIFY'].includes(input.gatewayProvider)) {
      errors.gatewayProvider = 'Invalid gateway provider';
    }
    if (!input.providerReference) errors.providerReference = 'Provider reference is required';
    if (!input.gatewayReference) errors.gatewayReference = 'Gateway reference is required';

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  static validateAllocation(input: {
    paymentId: string;
    studentChargeId: string;
    allocatedAmount: number;
    remainingAmount: number;
  }): PaymentValidationResult {
    const errors: Record<string, string> = {};

    if (!input.paymentId) errors.paymentId = 'Payment is required';
    if (!input.studentChargeId) errors.studentChargeId = 'Student charge is required';
    if (input.allocatedAmount <= 0) errors.allocatedAmount = 'Allocated amount must be greater than zero';
    if (input.remainingAmount < 0) errors.remainingAmount = 'Remaining amount cannot be negative';

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  static validateReceipt(input: {
    paymentId: string;
    studentId: string;
    billingProfileId: string;
    totalAmount: number;
    currency: string;
    gatewayProvider: string;
    paymentMethod: string;
  }): PaymentValidationResult {
    const errors: Record<string, string> = {};

    if (!input.paymentId) errors.paymentId = 'Payment is required';
    if (!input.studentId) errors.studentId = 'Student is required';
    if (!input.billingProfileId) errors.billingProfileId = 'Billing profile is required';
    if (input.totalAmount <= 0) errors.totalAmount = 'Total amount must be greater than zero';
    if (!input.currency) errors.currency = 'Currency is required';
    if (!['PAYSTACK', 'MONNIFY'].includes(input.gatewayProvider)) {
      errors.gatewayProvider = 'Invalid gateway provider';
    }
    if (!['BANK_TRANSFER', 'CASH', 'POS', 'ONLINE'].includes(input.paymentMethod)) {
      errors.paymentMethod = 'Invalid payment method';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  static validatePaymentAccount(input: {
    schoolId: string;
    studentId: string;
    gatewayProvider: string;
    accountNumber: string;
  }): PaymentValidationResult {
    const errors: Record<string, string> = {};

    if (!input.schoolId) errors.schoolId = 'School is required';
    if (!input.studentId) errors.studentId = 'Student is required';
    if (!['PAYSTACK', 'MONNIFY'].includes(input.gatewayProvider)) {
      errors.gatewayProvider = 'Invalid gateway provider';
    }
    if (!input.accountNumber) errors.accountNumber = 'Account number is required';

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }
}