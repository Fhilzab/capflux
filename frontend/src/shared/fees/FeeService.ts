import { SupabaseFeeProvider } from './SupabaseFeeProvider';
import { FeeProvider } from './FeeProvider';
import { FeeValidator } from './FeeValidator';
import type { Fee, FeeResult } from './types';

export interface ApplicableFees {
  mandatory: Fee[];
  optional: Fee[];
  platform: Fee[];
}

export class FeeService {
  private provider: FeeProvider;

  constructor(provider: FeeProvider = new SupabaseFeeProvider()) {
    this.provider = provider;
  }

  async getMandatoryFees(schoolId: string, divisionId: string): Promise<FeeResult<Fee[]>> {
    const result = await this.provider.listSchoolFees(schoolId);
    if (result.error || !result.data) {
      return result;
    }

    const filtered = result.data.filter(fee => fee.isMandatory && fee.divisionId === divisionId && fee.isActive);
    return { data: filtered, error: null };
  }

  async getOptionalFees(schoolId: string, divisionId: string): Promise<FeeResult<Fee[]>> {
    const result = await this.provider.listSchoolFees(schoolId);
    if (result.error || !result.data) {
      return result;
    }

    const filtered = result.data.filter(fee => !fee.isMandatory && fee.divisionId === divisionId && fee.isActive);
    return { data: filtered, error: null };
  }

  async getPlatformFees(): Promise<FeeResult<Fee[]>> {
    return this.provider.listPlatformFees();
  }

  async getApplicableFees(
    schoolId: string,
    divisionId: string,
    academicLevelId?: string | null
  ): Promise<FeeResult<ApplicableFees>> {
    const [schoolFeesResult, platformResult] = await Promise.all([
      this.provider.listSchoolFees(schoolId),
      this.getPlatformFees(),
    ]);

    const allFees = schoolFeesResult.data || [];
    // Fees may target a section (divisionId) broadly or a specific academic
    // level (academicLevelId). When a level is provided, level-specific fees
    // take precedence over section-level defaults with the same code.
    const inScope = (fee: Fee) =>
      fee.isActive &&
      fee.divisionId === divisionId &&
      (!academicLevelId ||
        !(fee as any).academicLevelId ||
        (fee as any).academicLevelId === academicLevelId);

    const byCodePreference = (fees: Fee[]): Fee[] => {
      if (!academicLevelId) return fees;
      const preferred = fees.filter((f) => (f as any).academicLevelId === academicLevelId);
      const preferredCodes = new Set(preferred.map((f) => f.code));
      return [
        ...preferred,
        ...fees.filter((f) => !(f as any).academicLevelId && !preferredCodes.has(f.code)),
      ];
    };

    const mandatory = byCodePreference(allFees.filter((f) => f.isMandatory && inScope(f)));
    const optional = byCodePreference(allFees.filter((f) => !f.isMandatory && inScope(f)));
    const platform = platformResult.data || [];

    return {
      data: { mandatory, optional, platform },
      error: schoolFeesResult.error || platformResult.error || null,
    };
  }

  async loadSchoolFees(schoolId: string): Promise<FeeResult<Fee[]>> {
    return this.provider.listSchoolFees(schoolId);
  }

  async loadPlatformFees(): Promise<FeeResult<Fee[]>> {
    return this.provider.listPlatformFees();
  }

  async createSchoolFee(data: {
    schoolId: string;
    divisionId: string;
    name: string;
    code: string;
    isMandatory: boolean;
    description?: string;
  }): Promise<FeeResult<Fee>> {
    const validation = FeeValidator.validateCreate(data);
    if (!validation.valid) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: Object.values(validation.errors).join(', '),
        },
      };
    }

    // Enforce: tuition must be mandatory
    if (data.name.toLowerCase() === 'tuition' && !data.isMandatory) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Tuition fee must be marked as mandatory',
        },
      };
    }

    return this.provider.createSchoolFee(data);
  }

  async updateSchoolFee(feeId: string, data: Partial<Fee>): Promise<FeeResult<Fee>> {
    if (!feeId) {
      return { data: null, error: { code: 'FEE_NOT_FOUND', message: 'Fee ID is required' } };
    }

    const validation = FeeValidator.validateUpdate({
      name: data.name,
      code: data.code,
      isMandatory: data.isMandatory,
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

    // Enforce: tuition must remain mandatory
    if (data.name !== undefined && data.name.toLowerCase() === 'tuition' && data.isMandatory === false) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Tuition fee must be marked as mandatory',
        },
      };
    }

    return this.provider.updateSchoolFee(feeId, data);
  }

  async deactivateSchoolFee(feeId: string): Promise<FeeResult<Fee>> {
    if (!feeId) {
      return { data: null, error: { code: 'FEE_NOT_FOUND', message: 'Fee ID is required' } };
    }
    return this.provider.deactivateSchoolFee(feeId);
  }

  async activateSchoolFee(feeId: string): Promise<FeeResult<Fee>> {
    if (!feeId) {
      return { data: null, error: { code: 'FEE_NOT_FOUND', message: 'Fee ID is required' } };
    }
    return this.provider.activateSchoolFee(feeId);
  }
}

export const feeService = new FeeService();