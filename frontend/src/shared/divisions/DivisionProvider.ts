import type { SchoolDivision, DivisionResult } from './types';

/**
 * Division Provider Interface
 * Abstract contract for division providers (Supabase, WorkOS, etc.)
 */
export abstract class DivisionProvider {
  /**
   * Get a division by ID
   */
  abstract getDivision(divisionId: string): Promise<DivisionResult<SchoolDivision>>;

  /**
   * List all divisions for a school
   */
  abstract listDivisions(schoolId: string): Promise<DivisionResult<SchoolDivision[]>>;

  /**
   * Create a new division
   */
  abstract createDivision(data: {
    schoolId: string;
    name: string;
    code: string;
    displayOrder: number;
    description?: string;
  }): Promise<DivisionResult<SchoolDivision>>;

  /**
   * Update an existing division
   */
  abstract updateDivision(divisionId: string, data: Partial<SchoolDivision>): Promise<DivisionResult<SchoolDivision>>;

  /**
   * Deactivate a division
   */
  abstract deactivateDivision(divisionId: string): Promise<DivisionResult<SchoolDivision>>;

  /**
   * Activate a division
   */
  abstract activateDivision(divisionId: string): Promise<DivisionResult<SchoolDivision>>;

  /**
   * Assign a student to a division (future milestone)
   */
  abstract assignStudentToDivision?(studentId: string, divisionId: string): Promise<DivisionResult<void>>;

  /**
   * Move a student to a different division (future milestone)
   */
  abstract moveStudentDivision?(studentId: string, targetDivisionId: string): Promise<DivisionResult<void>>;

  /**
   * List students in a division (future milestone)
   */
  abstract listDivisionStudents?(divisionId: string): Promise<DivisionResult<string[]>>;

  /**
   * Check if provider is configured
   */
  abstract isConfigured(): boolean;
}