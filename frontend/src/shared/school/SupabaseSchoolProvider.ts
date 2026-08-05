/**
 * SupabaseSchoolProvider
 * Supabase-backed implementation of SchoolProvider
 * Only file that directly calls supabase for school operations
 */

import { supabase, hasSupabaseConfig } from '../services/api/supabase';
import { SchoolProvider } from './SchoolProvider';
import type { School, SchoolResult } from './types';
import { mapProviderError } from './SchoolError';

type CreateSchoolInput = {
  schoolName: string;
  proprietorName: string;
  email: string;
  phone: string;
  address?: string;
  schoolType: string;
  academicSession?: string;
  currentTerm?: string;
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class SupabaseSchoolProvider extends SchoolProvider {
  async getCurrentSchool(): Promise<SchoolResult<School>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: null };
    }

    try {
      const { useAuthStore } = await import('../../stores/authStore');
      const user = useAuthStore().user;
      if (!user) {
        return { data: null, error: { code: 'UNAUTHORIZED', message: 'No authenticated user' } };
      }

      const { data: profile, error } = await supabase.rpc('get_profile', { user_id: user.id });
      
      if (!error && profile?.school_id) {
        const schoolResult = await supabase
          .from('schools')
          .select('*')
          .eq('id', profile.school_id)
          .single();

        if (schoolResult.data) {
          return { data: schoolResult.data as School, error: null };
        }
      }

      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error) };
    }
  }

  async createSchool(input: CreateSchoolInput): Promise<SchoolResult<School>> {
    if (!hasSupabaseConfig) {
      // Local dev fallback
      const school: School = {
        id: 'demo-school',
        name: input.schoolName,
        slug: generateSlug(input.schoolName),
        status: 'ACTIVE',
        organizationId: 'demo-org',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return { data: school, error: null };
    }

    try {
      const { data, error } = await supabase.rpc('create_school_with_owner', {
        p_school_name: input.schoolName,
        p_proprietor_name: input.proprietorName,
        p_email: input.email,
        p_phone: input.phone,
        p_address: input.address || null,
        p_school_type: input.schoolType,
        p_academic_session: input.academicSession || null,
        p_current_term: input.currentTerm || null,
      });

      if (error) {
        return { data: null, error: mapProviderError(error, 'SCHOOL_CREATE_FAILED') };
      }

      return { data: data as School, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'SCHOOL_CREATE_FAILED') };
    }
  }

  async updateSchool(schoolId: string, updateData: Partial<School>): Promise<SchoolResult<School>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const query = supabase
        .from('schools')
        .update(updateData)
        .eq('id', schoolId)
        .select()
        .single();

      const { data: updated, error } = await query;

      if (error) {
        return { data: null, error: mapProviderError(error, 'SCHOOL_UPDATE_FAILED') };
      }

      return { data: updated as School, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'SCHOOL_UPDATE_FAILED') };
    }
  }

  async archiveSchool(schoolId: string): Promise<SchoolResult<School>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const { data, error } = await supabase.rpc('archive_school', { p_school_id: schoolId });

      if (error) {
        return { data: null, error: mapProviderError(error, 'SCHOOL_ARCHIVE_FAILED') };
      }

      return { data: data as School, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'SCHOOL_ARCHIVE_FAILED') };
    }
  }

  async activateSchool(schoolId: string): Promise<SchoolResult<School>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const { data, error } = await supabase.rpc('activate_school', { p_school_id: schoolId });

      if (error) {
        return { data: null, error: mapProviderError(error, 'SCHOOL_ARCHIVE_FAILED') };
      }

      return { data: data as School, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'SCHOOL_ARCHIVE_FAILED') };
    }
  }

  async deleteSchool(_schoolId: string): Promise<SchoolResult<void>> {
    // Future milestone
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async listSchools(): Promise<SchoolResult<School[]>> {
    // Future milestone
    return { data: [], error: null };
  }

  async switchSchool(_schoolId: string): Promise<SchoolResult<School>> {
    // Future milestone
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  isConfigured(): boolean {
    return hasSupabaseConfig;
  }
}