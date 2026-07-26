import type { ReportFilter } from './types';

export class ReportingValidator {
  static validateFilter(filter: ReportFilter): { valid: boolean; error?: string } {
    if (!filter.organizationId) {
      return { valid: false, error: 'Organization ID is required' };
    }

    if (filter.startDate && filter.endDate) {
      const start = new Date(filter.startDate);
      const end = new Date(filter.endDate);
      if (start > end) {
        return { valid: false, error: 'Start date must be before or equal to end date' };
      }
    }

    return { valid: true };
  }

  static validateSchool(filter: ReportFilter): { valid: boolean; error?: string } {
    if (!filter.schoolId) {
      return { valid: false, error: 'School ID is required for school-specific reports' };
    }
    return { valid: true };
  }

  static validateOrganization(filter: ReportFilter): { valid: boolean; error?: string } {
    if (!filter.organizationId) {
      return { valid: false, error: 'Organization ID is required' };
    }
    return { valid: true };
  }
}