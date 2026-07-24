import type { School, SchoolResult } from './types';

/**
 * School Provider Interface
 * Abstract contract for school providers (Supabase, WorkOS, etc.)
 * Future-proof: includes methods for multi-school support
 */
export abstract class SchoolProvider {
  /**
   * Get the current school for the authenticated user
   */
  abstract getCurrentSchool(): Promise<SchoolResult<School>>;

  /**
   * Create a new school
   */
  abstract createSchool(data: {
    schoolName: string;
    proprietorName: string;
    email: string;
    phone: string;
    address?: string;
    schoolType: string;
    academicSession?: string;
    currentTerm?: string;
  }): Promise<SchoolResult<School>>;

  /**
   * Update an existing school
   */
  abstract updateSchool(schoolId: string, data: Partial<School>): Promise<SchoolResult<School>>;

  /**
   * Archive a school
   */
  abstract archiveSchool(schoolId: string): Promise<SchoolResult<School>>;

  /**
   * Activate a school
   */
  abstract activateSchool(schoolId: string): Promise<SchoolResult<School>>;

  /**
   * Delete a school (future milestone)
   */
  abstract deleteSchool?(schoolId: string): Promise<SchoolResult<void>>;

  /**
   * List all schools for the user (future milestone)
   */
  abstract listSchools?(): Promise<SchoolResult<School[]>>;

  /**
   * Switch to a different school (future milestone)
   */
  abstract switchSchool?(schoolId: string): Promise<SchoolResult<School>>;

  /**
   * Check if provider is configured
   */
  abstract isConfigured(): boolean;
}