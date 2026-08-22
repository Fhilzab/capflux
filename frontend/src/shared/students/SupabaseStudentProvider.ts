/**
 * SupabaseStudentProvider
 * Supabase-backed implementation of StudentProvider
 * Only file that directly calls supabase for student/guardian operations
 */

import { supabase, hasSupabaseConfig } from '../services/api/supabase';
import { StudentProvider } from './StudentProvider';
import type { Student, Guardian, StudentResult } from './types';
import { mapProviderError } from './StudentError';

type CreateStudentInput = {
  schoolId: string;
  divisionId: string;
  guardianId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  gender: string;
  dateOfBirth?: string;
  admissionNumber?: string;
  admissionDate: string;
  registeredAt: string;
  relationshipToGuardian: string;
  discountRate: number;
  status?: string;
  academicSession?: string;
};

type CreateGuardianInput = {
  schoolId: string;
  fullName: string;
  phone: string;
  email?: string;
  occupation?: string;
  address?: string;
};

export class SupabaseStudentProvider extends StudentProvider {
  async createStudent(input: CreateStudentInput): Promise<StudentResult<Student>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const { data, error } = await (supabase.from('students') as any)
        .insert({
          school_id: input.schoolId,
          division_id: input.divisionId,
          guardian_id: input.guardianId,
          first_name: input.firstName,
          middle_name: input.middleName || null,
          last_name: input.lastName,
          gender: input.gender,
          date_of_birth: input.dateOfBirth || null,
          admission_number: input.admissionNumber || null,
          admission_date: input.admissionDate,
          registered_at: input.registeredAt,
          relationship_to_guardian: input.relationshipToGuardian,
          discount_rate: input.discountRate,
          status: input.status || 'ACTIVE',
          academic_session: input.academicSession || null,
        })
        .select()
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'STUDENT_CREATE_FAILED') };
      }

      return { data: data as Student, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'STUDENT_CREATE_FAILED') };
    }
  }

  async updateStudent(studentId: string, updateData: Partial<Student>): Promise<StudentResult<Student>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const payload: Record<string, unknown> = {};
      if (updateData.divisionId !== undefined) payload.division_id = updateData.divisionId;
      if (updateData.guardianId !== undefined) payload.guardian_id = updateData.guardianId;
      if (updateData.firstName !== undefined) payload.first_name = updateData.firstName;
      if (updateData.middleName !== undefined) payload.middle_name = updateData.middleName || null;
      if (updateData.lastName !== undefined) payload.last_name = updateData.lastName;
      if (updateData.gender !== undefined) payload.gender = updateData.gender;
      if (updateData.dateOfBirth !== undefined) payload.date_of_birth = updateData.dateOfBirth || null;
      if (updateData.admissionNumber !== undefined) payload.admission_number = updateData.admissionNumber || null;
      if (updateData.admissionDate !== undefined) payload.admission_date = updateData.admissionDate;
      if (updateData.relationshipToGuardian !== undefined) payload.relationship_to_guardian = updateData.relationshipToGuardian;
      if (updateData.discountRate !== undefined) payload.discount_rate = updateData.discountRate;
      if (updateData.status !== undefined) payload.status = updateData.status;

      const { data, error } = await (supabase.from('students') as any)
        .update(payload)
        .eq('id', studentId)
        .select()
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'STUDENT_UPDATE_FAILED') };
      }

      return { data: data as Student, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'STUDENT_UPDATE_FAILED') };
    }
  }

  async getStudent(studentId: string): Promise<StudentResult<Student>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'STUDENT_NOT_FOUND', message: 'Supabase not configured' } };
    }

    try {
      const { data, error } = await (supabase.from('students') as any)
        .select('*')
        .eq('id', studentId)
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'STUDENT_NOT_FOUND') };
      }

      return { data: data as Student, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'STUDENT_NOT_FOUND') };
    }
  }

  async listStudents(schoolId: string): Promise<StudentResult<Student[]>> {
    if (!hasSupabaseConfig) {
      return { data: [], error: null };
    }

    try {
      const { data, error } = await (supabase.from('students') as any)
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: true });

      if (error) {
        return { data: null, error: mapProviderError(error, 'STUDENT_NOT_FOUND') };
      }

      return { data: (data || []) as Student[], error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'STUDENT_NOT_FOUND') };
    }
  }

  async activateStudent(studentId: string): Promise<StudentResult<Student>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const { data, error } = await (supabase.from('students') as any)
        .update({ status: 'ACTIVE' })
        .eq('id', studentId)
        .select()
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'STUDENT_UPDATE_FAILED') };
      }

      return { data: data as Student, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'STUDENT_UPDATE_FAILED') };
    }
  }

  async deactivateStudent(studentId: string): Promise<StudentResult<Student>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const { data, error } = await (supabase.from('students') as any)
        .update({ status: 'INACTIVE' })
        .eq('id', studentId)
        .select()
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'STUDENT_UPDATE_FAILED') };
      }

      return { data: data as Student, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'STUDENT_UPDATE_FAILED') };
    }
  }

  async createGuardian(input: CreateGuardianInput): Promise<StudentResult<Guardian>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const { data, error } = await (supabase.from('guardians') as any)
        .insert({
          school_id: input.schoolId,
          full_name: input.fullName,
          phone: input.phone,
          email: input.email || null,
          occupation: input.occupation || null,
          address: input.address || null,
          status: 'ACTIVE',
        })
        .select()
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'GUARDIAN_CREATE_FAILED') };
      }

      return { data: data as Guardian, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'GUARDIAN_CREATE_FAILED') };
    }
  }

  async updateGuardian(guardianId: string, updateData: Partial<Guardian>): Promise<StudentResult<Guardian>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const payload: Record<string, unknown> = {};
      if (updateData.fullName !== undefined) payload.full_name = updateData.fullName;
      if (updateData.phone !== undefined) payload.phone = updateData.phone;
      if (updateData.email !== undefined) payload.email = updateData.email || null;
      if (updateData.occupation !== undefined) payload.occupation = updateData.occupation || null;
      if (updateData.address !== undefined) payload.address = updateData.address || null;
      if (updateData.status !== undefined) payload.status = updateData.status;

      const { data, error } = await (supabase.from('guardians') as any)
        .update(payload)
        .eq('id', guardianId)
        .select()
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'GUARDIAN_UPDATE_FAILED') };
      }

      return { data: data as Guardian, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'GUARDIAN_UPDATE_FAILED') };
    }
  }

  async getGuardian(guardianId: string): Promise<StudentResult<Guardian>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'GUARDIAN_NOT_FOUND', message: 'Supabase not configured' } };
    }

    try {
      const { data, error } = await (supabase.from('guardians') as any)
        .select('*')
        .eq('id', guardianId)
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'GUARDIAN_NOT_FOUND') };
      }

      return { data: data as Guardian, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'GUARDIAN_NOT_FOUND') };
    }
  }

  async listGuardians(schoolId: string): Promise<StudentResult<Guardian[]>> {
    if (!hasSupabaseConfig) {
      return { data: [], error: null };
    }

    try {
      const { data, error } = await (supabase.from('guardians') as any)
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: true });

      if (error) {
        return { data: null, error: mapProviderError(error, 'GUARDIAN_NOT_FOUND') };
      }

      return { data: (data || []) as Guardian[], error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'GUARDIAN_NOT_FOUND') };
    }
  }

  async assignFee(_studentId: string, _feeId: string): Promise<StudentResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async removeFee(_studentId: string, _feeId: string): Promise<StudentResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async grantDiscount(_studentId: string, _discountRate: number): Promise<StudentResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async removeDiscount(_studentId: string): Promise<StudentResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async graduateStudent(_studentId: string): Promise<StudentResult<Student>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async transferStudent(_studentId: string, _targetDivisionId: string): Promise<StudentResult<Student>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async listGuardianStudents(_guardianId: string): Promise<StudentResult<Student[]>> {
    return { data: [], error: null };
  }

  async mergeGuardians(_sourceGuardianId: string, _targetGuardianId: string): Promise<StudentResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  isConfigured(): boolean {
    return hasSupabaseConfig;
  }
}