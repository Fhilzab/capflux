export interface DivisionValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export class DivisionValidator {
  static validateCreate(input: {
    schoolId: string;
    name: string;
    code: string;
    displayOrder: number;
  }): DivisionValidationResult {
    const errors: Record<string, string> = {};

    if (!input.schoolId) {
      errors.schoolId = 'School ID is required';
    }

    if (!input.name || input.name.trim().length < 2) {
      errors.name = 'Division name must be at least 2 characters';
    }

    if (!input.code || input.code.trim().length < 2) {
      errors.code = 'Division code must be at least 2 characters';
    }

    if (!input.displayOrder || input.displayOrder < 1) {
      errors.displayOrder = 'Display order must be a positive number';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  static validateUpdate(input: {
    name?: string;
    code?: string;
    displayOrder?: number;
  }): DivisionValidationResult {
    const errors: Record<string, string> = {};

    if (input.name !== undefined && input.name.trim().length < 2) {
      errors.name = 'Division name must be at least 2 characters';
    }

    if (input.code !== undefined && input.code.trim().length < 2) {
      errors.code = 'Division code must be at least 2 characters';
    }

    if (input.displayOrder !== undefined && input.displayOrder < 1) {
      errors.displayOrder = 'Display order must be a positive number';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }
}