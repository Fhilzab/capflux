export interface AcademicValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export class AcademicValidator {
  static validateSession(input: {
    schoolId: string;
    name: string;
    startDate: string;
    endDate: string;
  }): AcademicValidationResult {
    const errors: Record<string, string> = {};

    if (!input.schoolId) errors.schoolId = 'School is required';
    if (!input.name || input.name.trim().length < 2) errors.name = 'Session name is required';
    if (!input.startDate) errors.startDate = 'Start date is required';
    if (!input.endDate) errors.endDate = 'End date is required';
    if (input.startDate && input.endDate && new Date(input.startDate) >= new Date(input.endDate)) {
      errors.endDate = 'End date must be after start date';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  static validateTerm(input: {
    sessionId: string;
    schoolId: string;
    name: string;
    termNumber: number;
    displayOrder: number;
    startDate: string;
    endDate: string;
    sessionStartDate?: string;
    sessionEndDate?: string;
    calendarType?: string;
  }): AcademicValidationResult {
    const errors: Record<string, string> = {};

    if (!input.sessionId) errors.sessionId = 'Session is required';
    if (!input.schoolId) errors.schoolId = 'School is required';
    if (!input.name || input.name.trim().length < 2) errors.name = 'Term name is required';

    // Validate termNumber range based on calendar type
    const termCount = this.getTermCount(input.calendarType || 'TERM');
    if (input.termNumber < 1 || input.termNumber > termCount) {
      errors.termNumber = `Term number must be between 1 and ${termCount}`;
    }

    if (input.displayOrder < 1) errors.displayOrder = 'Display order must be a positive number';

    if (!input.startDate) errors.startDate = 'Start date is required';
    if (!input.endDate) errors.endDate = 'End date is required';

    // Term dates must be within session dates
    if (input.startDate && input.endDate && input.sessionStartDate && input.sessionEndDate) {
      if (new Date(input.startDate) < new Date(input.sessionStartDate)) {
        errors.startDate = 'Term start date cannot be before session start date';
      }
      if (new Date(input.endDate) > new Date(input.sessionEndDate)) {
        errors.endDate = 'Term end date cannot be after session end date';
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  private static getTermCount(calendarType: string): number {
    switch (calendarType) {
      case 'SEMESTER': return 2;
      case 'QUARTER': return 4;
      case 'TERM':
      default: return 3;
    }
  }
}