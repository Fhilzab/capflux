import type { AcademicErrorCode, AcademicError } from './types';

const ERROR_MESSAGES: Record<AcademicErrorCode, string> = {
  SESSION_NOT_FOUND: 'Academic session not found.',
  TERM_NOT_FOUND: 'Academic term not found.',
  SESSION_CREATE_FAILED: 'Failed to create session. Please try again.',
  TERM_CREATE_FAILED: 'Failed to create term. Please try again.',
  SESSION_UPDATE_FAILED: 'Failed to update session. Please try again.',
  TERM_UPDATE_FAILED: 'Failed to update term. Please try again.',
  SESSION_OVERLAP: 'Session dates overlap with an existing session.',
  TERM_OUT_OF_RANGE: 'Term dates must be within the session date range.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

export function mapProviderError(error: unknown, fallbackCode: AcademicErrorCode = 'UNKNOWN'): AcademicError {
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
    return { code: 'SESSION_NOT_FOUND', message: ERROR_MESSAGES.SESSION_NOT_FOUND, raw: error };
  }

  if (lowerMessage.includes('network') || lowerMessage.includes('failed to fetch')) {
    return { code: 'NETWORK_ERROR', message: ERROR_MESSAGES.NETWORK_ERROR, raw: error };
  }

  if (lowerMessage.includes('unauthorized') || lowerMessage.includes('permission')) {
    return { code: 'UNAUTHORIZED', message: ERROR_MESSAGES.UNAUTHORIZED, raw: error };
  }

  if (lowerMessage.includes('overlap') || lowerMessage.includes('conflict')) {
    return { code: 'SESSION_OVERLAP', message: ERROR_MESSAGES.SESSION_OVERLAP, raw: error };
  }

  return {
    code: fallbackCode,
    message: ERROR_MESSAGES[fallbackCode],
    raw: error,
  };
}

export function getAcademicErrorMessage(code: AcademicErrorCode): string {
  return ERROR_MESSAGES[code];
}