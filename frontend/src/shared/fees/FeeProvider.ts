import type { Fee, FeeResult } from './types';

/**
 * Fee Provider Interface
 * Abstract contract for fee providers
 */
export abstract class FeeProvider {
  /**
   * List school-owned fees for a school
   */
  abstract listSchoolFees(schoolId: string): Promise<FeeResult<Fee[]>>;

  /**
   * List platform-owned fees
   */
  abstract listPlatformFees(): Promise<FeeResult<Fee[]>>;

  /**
   * Create a school-owned fee
   */
  abstract createSchoolFee(data: {
    schoolId: string;
    divisionId: string;
    name: string;
    code: string;
    isMandatory: boolean;
    description?: string;
  }): Promise<FeeResult<Fee>>;

  /**
   * Update a school-owned fee
   */
  abstract updateSchoolFee(feeId: string, data: Partial<Fee>): Promise<FeeResult<Fee>>;

  /**
   * Deactivate a school-owned fee
   */
  abstract deactivateSchoolFee(feeId: string): Promise<FeeResult<Fee>>;

  /**
   * Activate a school-owned fee
   */
  abstract activateSchoolFee(feeId: string): Promise<FeeResult<Fee>>;

  /**
   * Assign a fee to a student (future milestone)
   */
  abstract assignFeeToStudent?(studentId: string, feeId: string): Promise<FeeResult<void>>;

  /**
   * Remove a fee from a student (future milestone)
   */
  abstract removeFeeFromStudent?(studentId: string, feeId: string): Promise<FeeResult<void>>;

  /**
   * Duplicate fees from one division to another (future milestone)
   */
  abstract duplicateDivisionFees?(sourceDivisionId: string, targetDivisionId: string): Promise<FeeResult<Fee[]>>;

  /**
   * Copy fees between divisions (future milestone)
   */
  abstract copyFeesBetweenDivisions?(sourceDivisionId: string, targetDivisionId: string): Promise<FeeResult<Fee[]>>;

  /**
   * Check if provider is configured
   */
  abstract isConfigured(): boolean;
}