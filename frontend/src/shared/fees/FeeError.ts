/**
 * Centralized Fee Error Handling
 */

import type { FeeErrorCode, FeeError } from './types';

const ERROR_MESSAGES: Record<FeeErrorCode, string> = {
  FEE_NOT_FOUND: 'Fee not found.',
  FEE_CREATE_FAILED: 'Failed to create fee. Please try again.',
  FEE_UPDATE_FAILED: 'Failed to update fee. Please try again.',
  FEE_DEACTIVATE_FAILED: 'Failed to update fee.',
  FEE_ACTIVATE_FAILED: 'Failed to update fee.',
  TUITION_DUPLICATE: 'Tuition fee already exists for this division. Only one tuition fee is allowed per division.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

export function mapProviderError(error: unknown, fallbackCode: FeeErrorCode = 'UNKNOWN'): FeeError {
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
    return { code: 'FEE_NOT_FOUND', message: ERROR_MESSAGES.FEE_NOT_FOUND, raw: error };
  }

  if (lowerMessage.includes('network') || lowerMessage.includes('failed to fetch')) {
    return { code: 'NETWORK_ERROR', message: ERROR_MESSAGES.NETWORK_ERROR, raw: error };
  }

  if (lowerMessage.includes('unauthorized') || lowerMessage.includes('permission')) {
    return { code: 'UNAUTHORIZED', message: ERROR_MESSAGES.UNAUTHORIZED, raw: error };
  }

  return {
    code: fallbackCode,
    message: ERROR_MESSAGES[fallbackCode],
    raw: error,
  };
}

export function getFeeErrorMessage(code: FeeErrorCode): string {
  return ERROR_MESSAGES[code];
}