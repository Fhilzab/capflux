export interface FeeValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export class FeeValidator {
  static validateCreate(input: {
    schoolId: string;
    divisionId: string;
    name: string;
    code: string;
    isMandatory: boolean;
  }): FeeValidationResult {
    const errors: Record<string, string> = {};

    if (!input.schoolId) {
      errors.schoolId = 'School is required for school-owned fees';
    }

    if (!input.divisionId) {
      errors.divisionId = 'Division is required for school-owned fees';
    }

    if (!input.name || input.name.trim().length < 2) {
      errors.name = 'Fee name must be at least 2 characters';
    }

    if (!input.code || input.code.trim().length < 2) {
      errors.code = 'Fee code must be at least 2 characters';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  static validateUpdate(input: {
    name?: string;
    code?: string;
    isMandatory?: boolean;
  }): FeeValidationResult {
    const errors: Record<string, string> = {};

    if (input.name !== undefined && input.name.trim().length < 2) {
      errors.name = 'Fee name must be at least 2 characters';
    }

    if (input.code !== undefined && input.code.trim().length < 2) {
      errors.code = 'Fee code must be at least 2 characters';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  static isPlatformFee(fee: { owner: string }): boolean {
    return fee.owner === 'PLATFORM';
  }

  static isSchoolFee(fee: { owner: string }): boolean {
    return fee.owner === 'SCHOOL';
  }
}