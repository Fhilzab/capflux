import type { BillingErrorCode, BillingError } from './types';

const ERROR_MESSAGES: Record<BillingErrorCode, string> = {
  BILLING_PROFILE_NOT_FOUND: 'Billing profile not found.',
  STUDENT_CHARGE_NOT_FOUND: 'Student charge not found.',
  BILLING_PROFILE_CREATE_FAILED: 'Failed to create billing profile. Please try again.',
  STUDENT_CHARGE_CREATE_FAILED: 'Failed to create student charge. Please try again.',
  BILLING_SNAPSHOT_CREATE_FAILED: 'Failed to create billing snapshot. Please try again.',
  BILLING_PROFILE_UPDATE_FAILED: 'Failed to update billing profile. Please try again.',
  STUDENT_CHARGE_UPDATE_FAILED: 'Failed to update student charge. Please try again.',
  DUPLICATE_CHARGE: 'This fee has already been assigned to the student.',
  MANDATORY_FEE_REMOVAL: 'Mandatory fees cannot be removed.',
  PLATFORM_FEE_REMOVAL: 'Platform fees cannot be removed.',
  SESSION_NOT_ACTIVE: 'No active academic session found.',
  TERM_NOT_ACTIVE: 'No active academic term found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

export function mapProviderError(error: unknown, fallbackCode: BillingErrorCode = 'UNKNOWN'): BillingError {
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
    return { code: 'BILLING_PROFILE_NOT_FOUND', message: ERROR_MESSAGES.BILLING_PROFILE_NOT_FOUND, raw: error };
  }

  if (lowerMessage.includes('network') || lowerMessage.includes('failed to fetch')) {
    return { code: 'NETWORK_ERROR', message: ERROR_MESSAGES.NETWORK_ERROR, raw: error };
  }

  if (lowerMessage.includes('unauthorized') || lowerMessage.includes('permission')) {
    return { code: 'UNAUTHORIZED', message: ERROR_MESSAGES.UNAUTHORIZED, raw: error };
  }

  if (lowerMessage.includes('duplicate') || lowerMessage.includes('conflict')) {
    return { code: 'DUPLICATE_CHARGE', message: ERROR_MESSAGES.DUPLICATE_CHARGE, raw: error };
  }

  return {
    code: fallbackCode,
    message: ERROR_MESSAGES[fallbackCode],
    raw: error,
  };
}

export function getBillingErrorMessage(code: BillingErrorCode): string {
  return ERROR_MESSAGES[code];
}