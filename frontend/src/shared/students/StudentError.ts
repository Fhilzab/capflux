import type { StudentErrorCode, StudentError } from './types';

const ERROR_MESSAGES: Record<StudentErrorCode, string> = {
  STUDENT_NOT_FOUND: 'Student not found.',
  GUARDIAN_NOT_FOUND: 'Guardian not found.',
  STUDENT_CREATE_FAILED: 'Failed to register student. Please try again.',
  STUDENT_UPDATE_FAILED: 'Failed to update student. Please try again.',
  GUARDIAN_CREATE_FAILED: 'Failed to create guardian. Please try again.',
  GUARDIAN_UPDATE_FAILED: 'Failed to update guardian. Please try again.',
  DUPLICATE_ADMISSION_NUMBER: 'This admission number is already in use.',
  DUPLICATE_PHONE: 'This guardian phone number is already registered.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

export function mapProviderError(error: unknown, fallbackCode: StudentErrorCode = 'UNKNOWN'): StudentError {
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
    return { code: 'STUDENT_NOT_FOUND', message: ERROR_MESSAGES.STUDENT_NOT_FOUND, raw: error };
  }

  if (lowerMessage.includes('network') || lowerMessage.includes('failed to fetch')) {
    return { code: 'NETWORK_ERROR', message: ERROR_MESSAGES.NETWORK_ERROR, raw: error };
  }

  if (lowerMessage.includes('unauthorized') || lowerMessage.includes('permission')) {
    return { code: 'UNAUTHORIZED', message: ERROR_MESSAGES.UNAUTHORIZED, raw: error };
  }

  if (lowerMessage.includes('duplicate') || lowerMessage.includes('unique')) {
    if (message.toLowerCase().includes('admission')) {
      return { code: 'DUPLICATE_ADMISSION_NUMBER', message: ERROR_MESSAGES.DUPLICATE_ADMISSION_NUMBER, raw: error };
    }
    if (message.toLowerCase().includes('phone')) {
      return { code: 'DUPLICATE_PHONE', message: ERROR_MESSAGES.DUPLICATE_PHONE, raw: error };
    }
  }

  return {
    code: fallbackCode,
    message: ERROR_MESSAGES[fallbackCode],
    raw: error,
  };
}

export function getStudentErrorMessage(code: StudentErrorCode): string {
  return ERROR_MESSAGES[code];
}