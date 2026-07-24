/**
 * SchoolService
 * Business orchestrator for school lifecycle
 * No caching - delegates to SchoolProvider
 */

import { SupabaseSchoolProvider } from './SupabaseSchoolProvider';
import { SchoolProvider } from './SchoolProvider';
import { SchoolValidator } from './SchoolValidator';
import type { School, SchoolResult } from './types';

export class SchoolService {
  private provider: SchoolProvider;

  constructor(provider: SchoolProvider = new SupabaseSchoolProvider()) {
    this.provider = provider;
  }

  async createSchool(data: {
    schoolName: string;
    proprietorName: string;
    email: string;
    phone: string;
    address?: string;
    schoolType: string;
    academicSession?: string;
    currentTerm?: string;
  }): Promise<SchoolResult<School>> {
    const validation = SchoolValidator.validateCreate(data);
    if (!validation.valid) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: Object.values(validation.errors).join(', '),
        },
      };
    }

    return this.provider.createSchool(data);
  }

  async loadSchool(): Promise<SchoolResult<School>> {
    return this.provider.getCurrentSchool();
  }

  async getCurrentSchool(): Promise<SchoolResult<School>> {
    return this.provider.getCurrentSchool();
  }

  async updateSchool(schoolId: string, data: Partial<School>): Promise<SchoolResult<School>> {
    if (!schoolId) {
      return { data: null, error: { code: 'SCHOOL_NOT_FOUND', message: 'School ID is required' } };
    }

    const validation = SchoolValidator.validateUpdate({
      name: data.name,
      email: (data as any).email,
      phone: (data as any).phone,
    });

    if (!validation.valid) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: Object.values(validation.errors).join(', '),
        },
      };
    }

    return this.provider.updateSchool(schoolId, data);
  }

  async archiveSchool(schoolId: string): Promise<SchoolResult<School>> {
    if (!schoolId) {
      return { data: null, error: { code: 'SCHOOL_NOT_FOUND', message: 'School ID is required' } };
    }

    return this.provider.archiveSchool(schoolId);
  }

  async activateSchool(schoolId: string): Promise<SchoolResult<School>> {
    if (!schoolId) {
      return { data: null, error: { code: 'SCHOOL_NOT_FOUND', message: 'School ID is required' } };
    }

    return this.provider.activateSchool(schoolId);
  }
}

export const schoolService = new SchoolService();