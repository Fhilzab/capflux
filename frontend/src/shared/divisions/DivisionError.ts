/**
 * Centralized Division Error Handling
 * Maps raw provider errors to user-friendly messages
 */

import type { DivisionErrorCode, DivisionError } from './types';

const ERROR_MESSAGES: Record<DivisionErrorCode, string> = {
  DIVISION_NOT_FOUND: 'Division not found.',
  DIVISION_CREATE_FAILED: 'Failed to create division. Please try again.',
  DIVISION_UPDATE_FAILED: 'Failed to update division. Please try again.',
  DIVISION_DEACTIVATE_FAILED: 'Failed to update division.',
  DIVISION_ACTIVATE_FAILED: 'Failed to update division.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

export function mapProviderError(error: unknown, fallbackCode: DivisionErrorCode = 'UNKNOWN'): DivisionError {
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
    return { code: 'DIVISION_NOT_FOUND', message: ERROR_MESSAGES.DIVISION_NOT_FOUND, raw: error };
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

export function getDivisionErrorMessage(code: DivisionErrorCode): string {
  return ERROR_MESSAGES[code];
}