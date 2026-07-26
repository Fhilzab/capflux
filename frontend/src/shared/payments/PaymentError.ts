import type { PaymentErrorCode, PaymentError } from './types';

const ERROR_MESSAGES: Record<PaymentErrorCode, string> = {
  PAYMENT_NOT_FOUND: 'Payment not found.',
  PAYMENT_CREATE_FAILED: 'Failed to create payment. Please try again.',
  PAYMENT_UPDATE_FAILED: 'Failed to update payment. Please try again.',
  PAYMENT_ALREADY_EXISTS: 'This payment has already been recorded.',
  PAYMENT_ALREADY_ALLOCATED: 'This payment has already been fully allocated.',
  ALLOCATION_FAILED: 'Failed to allocate payment to charges. Please try again.',
  ALLOCATION_ALREADY_EXISTS: 'This charge has already been allocated from this payment.',
  RECEIPT_CREATE_FAILED: 'Failed to generate receipt. Please try again.',
  RECEIPT_ALREADY_EXISTS: 'A receipt for this payment already exists.',
  CHARGE_NOT_FOUND: 'Student charge not found.',
  CHARGE_ALREADY_PAID: 'This charge has already been paid.',
  CHARGE_LEDGER_LOCKED: 'This charge is locked and cannot be modified.',
  PROVIDER_VERIFICATION_FAILED: 'Payment verification with provider failed.',
  PROVIDER_NOT_CONFIGURED: 'Payment gateway is not configured.',
  INVALID_PROVIDER_REFERENCE: 'Invalid provider reference.',
  DUPLICATE_PROVIDER_REFERENCE: 'A payment with this provider reference already exists.',
  ACCOUNT_NOT_FOUND: 'Student payment account not found.',
  ACCOUNT_NOT_ACTIVE: 'Student payment account is not active.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

export function mapPaymentError(error: unknown, fallbackCode: PaymentErrorCode = 'UNKNOWN'): PaymentError {
  if (!error) {
    return {
      code: fallbackCode,
      message: ERROR_MESSAGES[fallbackCode],
      raw: error,
    };
  }

  const supabaseError = error as { message?: string; code?: string };
  const message = supabaseError.message || supabaseError.code || '';
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('not found') || lowerMessage.includes('no rows')) {
    return { code: 'PAYMENT_NOT_FOUND', message: ERROR_MESSAGES.PAYMENT_NOT_FOUND, raw: error };
  }

  if (lowerMessage.includes('network') || lowerMessage.includes('failed to fetch')) {
    return { code: 'NETWORK_ERROR', message: ERROR_MESSAGES.NETWORK_ERROR, raw: error };
  }

  if (lowerMessage.includes('unauthorized') || lowerMessage.includes('permission')) {
    return { code: 'UNAUTHORIZED', message: ERROR_MESSAGES.UNAUTHORIZED, raw: error };
  }

  if (lowerMessage.includes('duplicate') || lowerMessage.includes('unique constraint')) {
    return { code: 'DUPLICATE_PROVIDER_REFERENCE', message: ERROR_MESSAGES.DUPLICATE_PROVIDER_REFERENCE, raw: error };
  }

  return {
    code: fallbackCode,
    message: ERROR_MESSAGES[fallbackCode],
    raw: error,
  };
}

export function getPaymentErrorMessage(code: PaymentErrorCode): string {
  return ERROR_MESSAGES[code];
}