/**
 * CAPFLUX Password Validation
 * Aligns frontend validation with WorkOS production requirements:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one symbol
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push('Password must be at least 12 characters');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    errors.push('Password must contain at least one symbol');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function getPasswordPlaceholder(): string {
  return '12+ chars, A-Z, a-z, 1 number, 1 symbol';
}

export function getPasswordError(): string {
  return 'Password must be 12+ characters with uppercase, lowercase, number, and symbol';
}
