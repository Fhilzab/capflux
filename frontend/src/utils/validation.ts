/**
 * Password validation utilities for Capstone authentication
 * Implements password policy: 8-64 chars, requires uppercase, lowercase, special character
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates password against security requirements
 * - Minimum 8 characters
 * - Maximum 64 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 special character
 * - Recommended: 12+ characters (shown as guidance, not required)
 */
export function validatePassword(password: string): ValidationResult {
  // Check minimum length
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  // Check maximum length
  if (password.length > 64) {
    return { valid: false, error: 'Password must not exceed 64 characters' };
  }

  // Check for uppercase
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }

  // Check for lowercase
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }

  // Check for special character
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character' };
  }

  return { valid: true };
}

/**
 * Calculate password strength (0-5)
 * Based on: length, uppercase, lowercase, number, special character
 */
export function calculatePasswordStrength(password: string): number {
  let strength = 0;
  
  if (password.length >= 8) strength += 1;
  if (/[A-Z]/.test(password)) strength += 1;
  if (/[a-z]/.test(password)) strength += 1;
  if (/[0-9]/.test(password)) strength += 1;
  if (/[^A-Za-z0-9]/.test(password)) strength += 1;
  
  return strength;
}

/**
 * Check if password meets recommended length (12+)
 */
export function isPasswordRecommended(password: string): boolean {
  return password.length >= 12;
}

/**
 * Email validation
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || !email.trim()) {
    return { valid: false, error: 'Email is required' };
  }

  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }

  return { valid: true };
}