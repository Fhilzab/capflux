/**
 * SchoolValidator
 * Business validation for school creation and updates
 */

export interface SchoolValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export class SchoolValidator {
  static validateCreate(input: {
    schoolName: string;
    email: string;
    phone: string;
    proprietorName: string;
  }): SchoolValidationResult {
    const errors: Record<string, string> = {};

    if (!input.schoolName || input.schoolName.trim().length < 2) {
      errors.schoolName = 'School name must be at least 2 characters';
    }

    if (!input.proprietorName || input.proprietorName.trim().length < 2) {
      errors.proprietorName = 'Proprietor name must be at least 2 characters';
    }

    if (!input.email || !input.email.includes('@')) {
      errors.email = 'A valid email is required';
    }

    if (!input.phone || input.phone.length < 10) {
      errors.phone = 'A valid phone number is required';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  static validateUpdate(input: {
    name?: string;
    email?: string;
    phone?: string;
  }): SchoolValidationResult {
    const errors: Record<string, string> = {};

    if (input.name !== undefined && input.name.trim().length < 2) {
      errors.name = 'School name must be at least 2 characters';
    }

    if (input.email !== undefined && !input.email.includes('@')) {
      errors.email = 'A valid email is required';
    }

    if (input.phone !== undefined && input.phone.length < 10) {
      errors.phone = 'A valid phone number is required';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }
}