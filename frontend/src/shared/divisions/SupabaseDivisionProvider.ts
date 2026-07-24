/**
 * SupabaseDivisionProvider
 * Supabase-backed implementation of DivisionProvider
 * Only file that directly calls supabase for division operations
 */

import { supabase, hasSupabaseConfig } from '../services/api/supabase';
import { DivisionProvider } from './DivisionProvider';
import type { SchoolDivision, DivisionResult } from './types';
import { mapProviderError } from './DivisionError';

type CreateDivisionInput = {
  schoolId: string;
  name: string;
  code: string;
  displayOrder: number;
  description?: string;
};

export class SupabaseDivisionProvider extends DivisionProvider {
  async getDivision(divisionId: string): Promise<DivisionResult<SchoolDivision>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: null };
    }

    try {
      const result = await (supabase.from('school_divisions') as any)
        .select('*')
        .eq('id', divisionId)
        .single();

      if (result.error) {
        return { data: null, error: mapProviderError(result.error, 'DIVISION_NOT_FOUND') };
      }

      return { data: result.data as SchoolDivision, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'DIVISION_NOT_FOUND') };
    }
  }

  async listDivisions(schoolId: string): Promise<DivisionResult<SchoolDivision[]>> {
    if (!hasSupabaseConfig) {
      return { data: [], error: null };
    }

    try {
      const result = await (supabase.from('school_divisions') as any)
        .select('*')
        .eq('school_id', schoolId)
        .order('display_order', { ascending: true });

      if (result.error) {
        return { data: null, error: mapProviderError(result.error, 'DIVISION_NOT_FOUND') };
      }

      return { data: (result.data || []) as SchoolDivision[], error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'DIVISION_NOT_FOUND') };
    }
  }

  async createDivision(input: CreateDivisionInput): Promise<DivisionResult<SchoolDivision>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const result = await (supabase.from('school_divisions') as any)
        .insert({
          school_id: input.schoolId,
          name: input.name,
          code: input.code,
          display_order: input.displayOrder,
          description: input.description || null,
          status: 'ACTIVE',
        })
        .select()
        .single();

      if (result.error) {
        return { data: null, error: mapProviderError(result.error, 'DIVISION_CREATE_FAILED') };
      }

      return { data: result.data as SchoolDivision, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'DIVISION_CREATE_FAILED') };
    }
  }

  async updateDivision(divisionId: string, updateData: Partial<SchoolDivision>): Promise<DivisionResult<SchoolDivision>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const payload: Record<string, unknown> = {};
      if (updateData.name !== undefined) payload.name = updateData.name;
      if (updateData.code !== undefined) payload.code = updateData.code;
      if (updateData.displayOrder !== undefined) payload.display_order = updateData.displayOrder;
      if (updateData.description !== undefined) payload.description = updateData.description;
      if (updateData.status !== undefined) payload.status = updateData.status;

      const result = await (supabase.from('school_divisions') as any)
        .update(payload)
        .eq('id', divisionId)
        .select()
        .single();

      if (result.error) {
        return { data: null, error: mapProviderError(result.error, 'DIVISION_UPDATE_FAILED') };
      }

      return { data: result.data as SchoolDivision, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'DIVISION_UPDATE_FAILED') };
    }
  }

  async deactivateDivision(divisionId: string): Promise<DivisionResult<SchoolDivision>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const result = await (supabase.from('school_divisions') as any)
        .update({ status: 'INACTIVE' })
        .eq('id', divisionId)
        .select()
        .single();

      if (result.error) {
        return { data: null, error: mapProviderError(result.error, 'DIVISION_DEACTIVATE_FAILED') };
      }

      return { data: result.data as SchoolDivision, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'DIVISION_DEACTIVATE_FAILED') };
    }
  }

  async activateDivision(divisionId: string): Promise<DivisionResult<SchoolDivision>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const result = await (supabase.from('school_divisions') as any)
        .update({ status: 'ACTIVE' })
        .eq('id', divisionId)
        .select()
        .single();

      if (result.error) {
        return { data: null, error: mapProviderError(result.error, 'DIVISION_ACTIVATE_FAILED') };
      }

      return { data: result.data as SchoolDivision, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'DIVISION_ACTIVATE_FAILED') };
    }
  }

  async assignStudentToDivision(_studentId: string, _divisionId: string): Promise<DivisionResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async moveStudentDivision(_studentId: string, _targetDivisionId: string): Promise<DivisionResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async listDivisionStudents(_divisionId: string): Promise<DivisionResult<string[]>> {
    return { data: [], error: null };
  }

  isConfigured(): boolean {
    return hasSupabaseConfig;
  }
}