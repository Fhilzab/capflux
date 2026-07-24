/**
 * Centralized School Error Handling
 * Maps raw provider errors to user-friendly messages
 */

import type { SchoolErrorCode, SchoolError } from './types';

/**
 * Friendly error messages mapped from codes
 */
const ERROR_MESSAGES: Record<SchoolErrorCode, string> = {
  SCHOOL_NOT_FOUND: 'School not found. Please complete setup.',
  SCHOOL_CREATE_FAILED: 'Failed to create school. Please try again.',
  SCHOOL_UPDATE_FAILED: 'Failed to update school. Please try again.',
  SCHOOL_ARCHIVE_FAILED: 'Failed to archive school.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

/**
 * Creates a SchoolError from a raw provider error
 */
export function mapProviderError(error: unknown, fallbackCode: SchoolErrorCode = 'UNKNOWN'): SchoolError {
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
    return { code: 'SCHOOL_NOT_FOUND', message: ERROR_MESSAGES.SCHOOL_NOT_FOUND, raw: error };
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

/**
 * Gets a friendly error message for a given error code
 */
export function getSchoolErrorMessage(code: SchoolErrorCode): string {
  return ERROR_MESSAGES[code];
}