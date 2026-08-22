export interface StudentValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export class StudentValidator {
  static validateCreate(input: {
    schoolId: string;
    divisionId: string;
    guardianId: string;
    firstName: string;
    lastName: string;
    admissionNumber?: string;
    gender: string;
    admissionDate: string;
    registeredAt: string;
    relationshipToGuardian: string;
    discountRate: number;
    status?: string;
    academicSession?: string;
  }): StudentValidationResult {
    const errors: Record<string, string> = {};

    if (!input.schoolId) errors.schoolId = 'School is required';
    if (!input.divisionId) errors.divisionId = 'Division is required';
    if (!input.guardianId) errors.guardianId = 'Guardian is required';
    if (!input.firstName || input.firstName.trim().length < 2) errors.firstName = 'First name is required';
    if (!input.lastName || input.lastName.trim().length < 2) errors.lastName = 'Last name is required';
    if (!input.gender) errors.gender = 'Gender is required';
    if (!input.admissionDate) errors.admissionDate = 'Admission date is required';
    if (!input.registeredAt) errors.registeredAt = 'Registration date is required';
    if (!input.relationshipToGuardian) errors.relationshipToGuardian = 'Relationship is required';

    if (input.discountRate < 0 || input.discountRate > 100) {
      errors.discountRate = 'Discount must be between 0 and 100';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  static validateUpdate(input: {
    firstName?: string;
    lastName?: string;
    gender?: string;
    dateOfBirth?: string;
    admissionDate?: string;
    relationshipToGuardian?: string;
    discountRate?: number;
  }): StudentValidationResult {
    const errors: Record<string, string> = {};

    if (input.firstName !== undefined && input.firstName.trim().length < 2) {
      errors.firstName = 'First name must be at least 2 characters';
    }
    if (input.lastName !== undefined && input.lastName.trim().length < 2) {
      errors.lastName = 'Last name must be at least 2 characters';
    }
    if (input.discountRate !== undefined && (input.discountRate < 0 || input.discountRate > 100)) {
      errors.discountRate = 'Discount must be between 0 and 100';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  static validateGuardian(input: {
    schoolId: string;
    fullName: string;
    phone: string;
    email?: string;
  }): StudentValidationResult {
    const errors: Record<string, string> = {};

    if (!input.schoolId) errors.schoolId = 'School is required';
    if (!input.fullName || input.fullName.trim().length < 2) errors.fullName = 'Full name is required';
    if (!input.phone || input.phone.length < 10) errors.phone = 'Valid phone number is required';

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  static validateGuardianUpdate(input: {
    fullName?: string;
    phone?: string;
    email?: string;
    occupation?: string;
    address?: string;
  }): StudentValidationResult {
    const errors: Record<string, string> = {};

    if (input.fullName !== undefined && input.fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters';
    }
    if (input.phone !== undefined && input.phone.length < 10) {
      errors.phone = 'Valid phone number is required';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }
}