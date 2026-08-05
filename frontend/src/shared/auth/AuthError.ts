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
  USER_ALREADY_EXISTS: 'An account with this email already exists. Please sign in instead.',
  RATE_LIMITED: 'Too many attempts. Please try again later.',
  NOT_FOUND: 'The requested resource was not found.',
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
      supabaseError.code === 'invalid_credentials' ||
      supabaseError.code === 'INVALID_CREDENTIALS') {
    return {
      code: 'INVALID_CREDENTIALS',
      message: ERROR_MESSAGES.INVALID_CREDENTIALS,
      raw: error,
    };
  }

  if (lowerMessage.includes('email not confirmed') ||
      lowerMessage.includes('email not verified') ||
      supabaseError.code === 'EMAIL_NOT_VERIFIED' ||
      supabaseError.code === 'email_verification_required') {
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

  if (supabaseError.code === 'USER_ALREADY_EXISTS' || supabaseError.code === 'user_already_exists' || lowerMessage.includes('already exists')) {
    return { code: 'USER_ALREADY_EXISTS', message: ERROR_MESSAGES.USER_ALREADY_EXISTS, raw: error };
  }

  if (supabaseError.code === 'RATE_LIMITED' || supabaseError.code === 'rate_limited' || lowerMessage.includes('too many requests')) {
    return { code: 'RATE_LIMITED', message: ERROR_MESSAGES.RATE_LIMITED, raw: error };
  }

  if (supabaseError.code === 'NOT_FOUND' || supabaseError.code === 'not_found' || lowerMessage.includes('not found')) {
    return { code: 'NOT_FOUND', message: ERROR_MESSAGES.NOT_FOUND, raw: error };
  }

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