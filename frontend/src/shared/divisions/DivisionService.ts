import { SupabaseDivisionProvider } from './SupabaseDivisionProvider';
import { DivisionProvider } from './DivisionProvider';
import { DivisionValidator } from './DivisionValidator';
import type { SchoolDivision, DivisionResult } from './types';

export class DivisionService {
  private provider: DivisionProvider;

  constructor(provider: DivisionProvider = new SupabaseDivisionProvider()) {
    this.provider = provider;
  }

  async createDivision(data: {
    schoolId: string;
    name: string;
    code: string;
    displayOrder: number;
    description?: string;
  }): Promise<DivisionResult<SchoolDivision>> {
    const validation = DivisionValidator.validateCreate(data);
    if (!validation.valid) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: Object.values(validation.errors).join(', '),
        },
      };
    }

    return this.provider.createDivision(data);
  }

  async loadDivisions(schoolId: string): Promise<DivisionResult<SchoolDivision[]>> {
    return this.provider.listDivisions(schoolId);
  }

  async getActiveDivisions(schoolId: string): Promise<DivisionResult<SchoolDivision[]>> {
    const result = await this.provider.listDivisions(schoolId);
    if (result.error || !result.data) {
      return result;
    }
    return {
      data: result.data.filter(d => d.status === 'ACTIVE'),
      error: null,
    };
  }

  async updateDivision(divisionId: string, data: Partial<SchoolDivision>): Promise<DivisionResult<SchoolDivision>> {
    if (!divisionId) {
      return { data: null, error: { code: 'DIVISION_NOT_FOUND', message: 'Division ID is required' } };
    }

    const validation = DivisionValidator.validateUpdate({
      name: data.name,
      code: data.code,
      displayOrder: data.displayOrder,
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

    return this.provider.updateDivision(divisionId, data);
  }

  async deactivateDivision(divisionId: string): Promise<DivisionResult<SchoolDivision>> {
    if (!divisionId) {
      return { data: null, error: { code: 'DIVISION_NOT_FOUND', message: 'Division ID is required' } };
    }
    return this.provider.deactivateDivision(divisionId);
  }

  async activateDivision(divisionId: string): Promise<DivisionResult<SchoolDivision>> {
    if (!divisionId) {
      return { data: null, error: { code: 'DIVISION_NOT_FOUND', message: 'Division ID is required' } };
    }
    return this.provider.activateDivision(divisionId);
  }
}

export const divisionService = new DivisionService();