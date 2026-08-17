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
  DUPLICATE_ACCOUNT: 'An account with this email already exists. Please sign in instead.',
  RATE_LIMITED: 'Too many attempts. Please try again later.',
  NOT_FOUND: 'The requested resource was not found.',
   VALIDATION_ERROR: 'Please correct the highlighted fields and try again.',
  WEAK_PASSWORD: 'Your password does not meet CAPFLUX\'s security requirements. Use at least 8 characters with a mix of letters, numbers, and symbols.',
  BREACHED_PASSWORD: 'This password has appeared in known data breaches and cannot be used. Please choose a different password.',
  SERVER_ERROR: 'CAPFLUX could not complete the request. Please try again.',
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

  // The error may carry a code set by AuthKitProvider.mapStatus as well as
  // status and the backend's own error code/message.
  const err = error as { message?: string; code?: string; name?: string; status?: number };
  const message = err.message || err.name || '';
  const lowerMessage = message.toLowerCase();

   // Password-policy errors surfaced by the backend. The backend maps WorkOS
   //rejections to WEAK_PASSWORD / BREACHED_PASSWORD; preserve the actual WorkOS
   //message so the user knows what to fix, but use the CAPFLUX code.
  if (err.code === 'WEAK_PASSWORD' || err.code === 'BREACHED_PASSWORD' ||
      lowerMessage.includes('password does not meet') ||
      lowerMessage.includes('password policy') ||
      lowerMessage.includes('password must') ||
      lowerMessage.includes('does not meet any password') ||
      lowerMessage.includes('breach') ||
      lowerMessage.includes('compromised') ||
      lowerMessage.includes('pwned') ||
      lowerMessage.includes('commonly used')) {
    const code: AuthErrorCode = lowerMessage.includes('breach') ||
      lowerMessage.includes('compromised') ||
      lowerMessage.includes('pwned') ||
      err.code === 'BREACHED_PASSWORD'
      ? 'BREACHED_PASSWORD'
      : 'WEAK_PASSWORD';
    return {
      code,
      message: ERROR_MESSAGES[code],
      raw: error,
    };
  }

  // Map known error patterns
  if (lowerMessage.includes('invalid login') ||
      lowerMessage.includes('invalid email') ||
      lowerMessage.includes('invalid password') ||
      lowerMessage.includes('invalid credentials') ||
      err.code === 'INVALID_CREDENTIALS' ||
      err.code === 'invalid_credentials') {
    return {
      code: 'INVALID_CREDENTIALS',
      message: ERROR_MESSAGES.INVALID_CREDENTIALS,
      raw: error,
    };
  }

  if (lowerMessage.includes('email not confirmed') ||
      lowerMessage.includes('email not verified') ||
      err.code === 'EMAIL_NOT_VERIFIED' ||
      err.code === 'email_verification_required') {
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

  if (err.code === 'USER_ALREADY_EXISTS' || err.code === 'user_already_exists' || lowerMessage.includes('already exists')) {
    return { code: 'USER_ALREADY_EXISTS', message: ERROR_MESSAGES.USER_ALREADY_EXISTS, raw: error };
  }

  if (err.code === 'DUPLICATE_ACCOUNT' || err.code === 'duplicate_account') {
    return { code: 'DUPLICATE_ACCOUNT', message: ERROR_MESSAGES.DUPLICATE_ACCOUNT, raw: error };
  }

  if (err.code === 'SERVER_ERROR' || err.code === 'server_error') {
    return { code: 'SERVER_ERROR', message: ERROR_MESSAGES.SERVER_ERROR, raw: error };
  }

  if (err.code === 'RATE_LIMITED' || err.code === 'rate_limited' || lowerMessage.includes('too many requests')) {
    return { code: 'RATE_LIMITED', message: ERROR_MESSAGES.RATE_LIMITED, raw: error };
  }

  if (err.code === 'NOT_FOUND' || err.code === 'not_found' || lowerMessage.includes('not found')) {
    return { code: 'NOT_FOUND', message: ERROR_MESSAGES.NOT_FOUND, raw: error };
  }

   // For remaining 400 validation errors, preserve the original backend
  // message so the user sees what went wrong. Password-policy errors are
  // already caught above as WEAK_PASSWORD/BREACHED_PASSWORD.
  if (err.status === 400) {
    return {
      code: 'VALIDATION_ERROR',
      message: message || ERROR_MESSAGES.VALIDATION_ERROR,
      raw: error,
    };
  }

  // Last resort: preserve the real message instead of masking it.
  return {
    code: 'UNKNOWN',
    message,
    raw: error,
  };
}

/**
 * Gets a friendly error message for a given error code
 */
export function getErrorMessage(code: AuthErrorCode): string {
  return ERROR_MESSAGES[code];
}