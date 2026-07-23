/**
 * Centralized Authentication Error Handling
 * Maps raw provider errors to user-friendly messages
 */

import type { AuthErrorCode, AuthErrorData } from './types';

/**
 * Friendly error messages mapped from codes
 */
const ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  INVALID_CREDENTIALS: 'Invalid email or password. Please try again.',
  EMAIL_NOT_VERIFIED: 'Please verify your email before signing in.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  UNAUTHORIZED: 'You are not authorized to access this resource.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

/**
 * Creates an AuthErrorData from a raw provider error
 * Extracts known error codes or falls back to UNKNOWN
 */
export function mapProviderError(error: unknown): AuthErrorData {
  // Handle null/undefined
  if (!error) {
    return {
      code: 'UNKNOWN',
      message: ERROR_MESSAGES.UNKNOWN,
      raw: error,
    };
  }

  // Handle Supabase error format
  const supabaseError = error as { message?: string; code?: string; name?: string };
  const message = supabaseError.message || supabaseError.name || '';

  // Map known error patterns
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('invalid login') || 
      lowerMessage.includes('invalid email') ||
      lowerMessage.includes('invalid password') ||
      supabaseError.code === 'invalid_credentials') {
    return {
      code: 'INVALID_CREDENTIALS',
      message: ERROR_MESSAGES.INVALID_CREDENTIALS,
      raw: error,
    };
  }

  if (lowerMessage.includes('email not confirmed') ||
      lowerMessage.includes('email not verified')) {
    return {
      code: 'EMAIL_NOT_VERIFIED',
      message: ERROR_MESSAGES.EMAIL_NOT_VERIFIED,
      raw: error,
    };
  }

  if (lowerMessage.includes('jwt expired') ||
      lowerMessage.includes('session expired')) {
    return {
      code: 'SESSION_EXPIRED',
      message: ERROR_MESSAGES.SESSION_EXPIRED,
      raw: error,
    };
  }

  if (lowerMessage.includes('network') ||
      lowerMessage.includes('fetch') ||
      lowerMessage.includes('failed to fetch')) {
    return {
      code: 'NETWORK_ERROR',
      message: ERROR_MESSAGES.NETWORK_ERROR,
      raw: error,
    };
  }

  // Default to unknown
  return {
    code: 'UNKNOWN',
    message: ERROR_MESSAGES.UNKNOWN,
    raw: error,
  };
}

/**
 * Gets a friendly error message for a given error code
 */
export function getErrorMessage(code: AuthErrorCode): string {
  return ERROR_MESSAGES[code];
}