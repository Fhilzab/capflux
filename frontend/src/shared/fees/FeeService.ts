import { SupabaseFeeProvider } from './SupabaseFeeProvider';
import { FeeProvider } from './FeeProvider';
import { FeeValidator } from './FeeValidator';
import type { Fee, FeeResult } from './types';

export class FeeService {
  private provider: FeeProvider;

  constructor(provider: FeeProvider = new SupabaseFeeProvider()) {
    this.provider = provider;
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