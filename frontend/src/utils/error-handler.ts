/**
 * Error handling utilities for Capstone authentication
 * Sanitizes error messages to prevent information disclosure
 */

/**
 * Sanitize authentication errors to prevent information disclosure
 * Maps known error codes to user-friendly messages
 */
export function sanitizeAuthError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'An error occurred. Please try again.';
  }

  const errorObj = error as Record<string, unknown>;

  // Map known Supabase error codes to safe messages
  const safeErrorMessages: Record<string, string> = {
    // Supabase auth errors
    'auth/invalid-email': 'Please enter a valid email address',
    'auth/user-disabled': 'This account has been disabled',
    'auth/user-not-found': 'Invalid email or password',
    'auth/wrong-password': 'Invalid email or password',
    'auth/invalid-password': 'Password does not meet security requirements',
    'auth/email-already-in-use': 'An account with this email already exists',
    'auth/weak-password': 'Password is too weak. Please use a stronger password',
    'auth/requires-recent-login': 'Please sign in again to continue',
    'auth/too-many-requests': 'Too many attempts. Please try again later',
    'auth/popup-blocked': 'Popup was blocked. Please allow popups and try again',
    'auth/popup-closed-by-user': 'Authentication was cancelled',
    'auth/cancelled-popup-request': 'Authentication was cancelled',
    'auth/unauthorized': 'You do not have permission to perform this action',
    'auth/timeout': 'Request timed out. Please try again',
    'auth/invalid-otp': 'Invalid verification code',
    'auth/missing-email': 'Email is required',
    'refresh_token_expired': 'Your session has expired. Please sign in again',
    'access_token_expired': 'Your session has expired. Please sign in again',
  };

  // Check for error code property
  if ('code' in errorObj && typeof errorObj.code === 'string') {
    return safeErrorMessages[errorObj.code] || 'Authentication failed. Please try again.';
  }

  // Check for message property
  if ('message' in errorObj && typeof errorObj.message === 'string') {
    const message = errorObj.message.toLowerCase();
    
    // Handle common patterns in error messages
    if (message.includes('password')) {
      if (message.includes('short') || message.includes('length')) {
        return 'Password does not meet security requirements';
      }
      if (message.includes('weak') || message.includes('common')) {
        return 'Password is too common. Please choose a stronger password';
      }
    }
    
    if (message.includes('email')) {
      if (message.includes('invalid') || message.includes('malformed')) {
        return 'Please enter a valid email address';
      }
      if (message.includes('already') || message.includes('exists')) {
        return 'An account with this email already exists';
      }
    }

    if (message.includes('rate limit') || message.includes('too many')) {
      return 'Too many attempts. Please wait and try again';
    }

    if (message.includes('network') || message.includes('fetch')) {
      return 'Network error. Please check your connection and try again';
    }
  }

  // Default safe message
  return 'An error occurred. Please try again.';
}

/**
 * Check if an error indicates email is not verified
 */
export function isEmailNotVerifiedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  
  const errorObj = error as Record<string, unknown>;
  const message = 
    ('message' in errorObj && typeof errorObj.message === 'string' 
      ? errorObj.message.toLowerCase() 
      : '') || '';
  
  return (
    message.includes('email not confirmed') ||
    message.includes('email not verified') ||
    message.includes('confirm your email')
  );
}