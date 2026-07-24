/**
 * SupabaseFeeProvider
 * Supabase-backed implementation of FeeProvider
 * Only file that directly calls supabase for fee operations
 */

import { supabase, hasSupabaseConfig } from '../services/api/supabase';
import { FeeProvider } from './FeeProvider';
import type { Fee, FeeResult } from './types';
import { mapProviderError } from './FeeError';

type CreateSchoolFeeInput = {
  schoolId: string;
  divisionId: string;
  name: string;
  code: string;
  isMandatory: boolean;
  description?: string;
};

export class SupabaseFeeProvider extends FeeProvider {
  async listSchoolFees(schoolId: string): Promise<FeeResult<Fee[]>> {
    if (!hasSupabaseConfig) {
      return { data: [], error: null };
    }

    try {
      const result = await (supabase.from('fees') as any)
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: true });

      if (result.error) {
        return { data: null, error: mapProviderError(result.error, 'FEE_NOT_FOUND') };
      }

      return { data: (result.data || []) as Fee[], error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'FEE_NOT_FOUND') };
    }
  }

  async listPlatformFees(): Promise<FeeResult<Fee[]>> {
    if (!hasSupabaseConfig) {
      return { data: [], error: null };
    }

    try {
      const result = await (supabase.from('fees') as any)
        .select('*')
        .is('school_id', null)
        .order('created_at', { ascending: true });

      if (result.error) {
        return { data: null, error: mapProviderError(result.error, 'FEE_NOT_FOUND') };
      }

      return { data: (result.data || []) as Fee[], error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'FEE_NOT_FOUND') };
    }
  }

  async createSchoolFee(input: CreateSchoolFeeInput): Promise<FeeResult<Fee>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const { data, error } = await (supabase.from('fees') as any)
        .insert({
          school_id: input.schoolId,
          division_id: input.divisionId,
          name: input.name,
          code: input.code,
          is_mandatory: input.isMandatory,
          description: input.description || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'FEE_CREATE_FAILED') };
      }

      return { data: data as Fee, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'FEE_CREATE_FAILED') };
    }
  }

  async updateSchoolFee(feeId: string, updateData: Partial<Fee>): Promise<FeeResult<Fee>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const payload: Record<string, unknown> = {};
      if (updateData.name !== undefined) payload.name = updateData.name;
      if (updateData.code !== undefined) payload.code = updateData.code;
      if (updateData.isMandatory !== undefined) payload.is_mandatory = updateData.isMandatory;
      if (updateData.description !== undefined) payload.description = updateData.description;
      if (updateData.isActive !== undefined) payload.is_active = updateData.isActive;

      const { data, error } = await (supabase.from('fees') as any)
        .update(payload)
        .eq('id', feeId)
        .select()
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'FEE_UPDATE_FAILED') };
      }

      return { data: data as Fee, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'FEE_UPDATE_FAILED') };
    }
  }

  async deactivateSchoolFee(feeId: string): Promise<FeeResult<Fee>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const { data, error } = await (supabase.from('fees') as any)
        .update({ is_active: false })
        .eq('id', feeId)
        .select()
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'FEE_DEACTIVATE_FAILED') };
      }

      return { data: data as Fee, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'FEE_DEACTIVATE_FAILED') };
    }
  }

  async activateSchoolFee(feeId: string): Promise<FeeResult<Fee>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const { data, error } = await (supabase.from('fees') as any)
        .update({ is_active: true })
        .eq('id', feeId)
        .select()
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'FEE_ACTIVATE_FAILED') };
      }

      return { data: data as Fee, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'FEE_ACTIVATE_FAILED') };
    }
  }

  async assignFeeToStudent(_studentId: string, _feeId: string): Promise<FeeResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async removeFeeFromStudent(_studentId: string, _feeId: string): Promise<FeeResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async duplicateDivisionFees(_sourceDivisionId: string, _targetDivisionId: string): Promise<FeeResult<Fee[]>> {
    return { data: [], error: null };
  }

  async copyFeesBetweenDivisions(_sourceDivisionId: string, _targetDivisionId: string): Promise<FeeResult<Fee[]>> {
    return { data: [], error: null };
  }

  isConfigured(): boolean {
    return hasSupabaseConfig;
  }
}