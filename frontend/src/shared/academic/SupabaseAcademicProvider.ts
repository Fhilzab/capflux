/**
 * SupabaseAcademicProvider
 * Supabase-backed implementation of AcademicProvider
 * Only file that directly calls supabase for academic session/term operations
 */

import { supabase, hasSupabaseConfig } from '../services/api/supabase';
import { AcademicProvider } from './AcademicProvider';
import type { AcademicSession, AcademicTerm, AcademicResult } from './types';
import { mapProviderError } from './AcademicError';

type CreateSessionInput = {
  schoolId: string;
  name: string;
  startDate: string;
  endDate: string;
};

type CreateTermInput = {
  sessionId: string;
  schoolId: string;
  name: string;
  termNumber: number;
  displayOrder: number;
  startDate: string;
  endDate: string;
};

export class SupabaseAcademicProvider extends AcademicProvider {
  async createSession(input: CreateSessionInput): Promise<AcademicResult<AcademicSession>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const { data, error } = await (supabase.from('academic_sessions') as any)
        .insert({
          school_id: input.schoolId,
          name: input.name,
          start_date: input.startDate,
          end_date: input.endDate,
          is_current: false,
          status: 'UPCOMING',
        })
        .select()
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'SESSION_CREATE_FAILED') };
      }

      return { data: data as AcademicSession, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'SESSION_CREATE_FAILED') };
    }
  }

  async updateSession(sessionId: string, updateData: Partial<AcademicSession>): Promise<AcademicResult<AcademicSession>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const payload: Record<string, unknown> = {};
      if (updateData.name !== undefined) payload.name = updateData.name;
      if (updateData.startDate !== undefined) payload.start_date = updateData.startDate;
      if (updateData.endDate !== undefined) payload.end_date = updateData.endDate;
      if (updateData.isCurrent !== undefined) payload.is_current = updateData.isCurrent;
      if (updateData.status !== undefined) payload.status = updateData.status;

      const { data, error } = await (supabase.from('academic_sessions') as any)
        .update(payload)
        .eq('id', sessionId)
        .select()
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'SESSION_UPDATE_FAILED') };
      }

      return { data: data as AcademicSession, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'SESSION_UPDATE_FAILED') };
    }
  }

  async getSession(sessionId: string): Promise<AcademicResult<AcademicSession>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'SESSION_NOT_FOUND', message: 'Supabase not configured' } };
    }

    try {
      const { data, error } = await (supabase.from('academic_sessions') as any)
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'SESSION_NOT_FOUND') };
      }

      return { data: data as AcademicSession, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'SESSION_NOT_FOUND') };
    }
  }

  async listSessions(schoolId: string): Promise<AcademicResult<AcademicSession[]>> {
    if (!hasSupabaseConfig) {
      return { data: [], error: null };
    }

    try {
      const { data, error } = await (supabase.from('academic_sessions') as any)
        .select('*')
        .eq('school_id', schoolId)
        .order('start_date', { ascending: false });

      if (error) {
        return { data: null, error: mapProviderError(error, 'SESSION_NOT_FOUND') };
      }

      return { data: (data || []) as AcademicSession[], error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'SESSION_NOT_FOUND') };
    }
  }

  async activateSession(sessionId: string): Promise<AcademicResult<AcademicSession>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      // First, deactivate all sessions for this school
      const session = await this.getSession(sessionId);
      if (session.error || !session.data) {
        return session;
      }

      await (supabase.from('academic_sessions') as any)
        .update({ is_current: false, status: 'COMPLETED' })
        .eq('school_id', session.data.schoolId)
        .neq('id', sessionId);

      // Then activate the requested session
      const { data, error } = await (supabase.from('academic_sessions') as any)
        .update({ is_current: true, status: 'ACTIVE' })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'SESSION_UPDATE_FAILED') };
      }

      return { data: data as AcademicSession, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'SESSION_UPDATE_FAILED') };
    }
  }

  async createTerm(input: CreateTermInput): Promise<AcademicResult<AcademicTerm>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const { data, error } = await (supabase.from('academic_terms') as any)
        .insert({
          session_id: input.sessionId,
          school_id: input.schoolId,
          name: input.name,
          term_number: input.termNumber,
          display_order: input.displayOrder,
          start_date: input.startDate,
          end_date: input.endDate,
          is_current: false,
          status: 'UPCOMING',
        })
        .select()
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'TERM_CREATE_FAILED') };
      }

      return { data: data as AcademicTerm, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'TERM_CREATE_FAILED') };
    }
  }

  async updateTerm(termId: string, updateData: Partial<AcademicTerm>): Promise<AcademicResult<AcademicTerm>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const payload: Record<string, unknown> = {};
      if (updateData.name !== undefined) payload.name = updateData.name;
      if (updateData.termNumber !== undefined) payload.term_number = updateData.termNumber;
      if (updateData.displayOrder !== undefined) payload.display_order = updateData.displayOrder;
      if (updateData.startDate !== undefined) payload.start_date = updateData.startDate;
      if (updateData.endDate !== undefined) payload.end_date = updateData.endDate;
      if (updateData.isCurrent !== undefined) payload.is_current = updateData.isCurrent;
      if (updateData.status !== undefined) payload.status = updateData.status;

      const { data, error } = await (supabase.from('academic_terms') as any)
        .update(payload)
        .eq('id', termId)
        .select()
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'TERM_UPDATE_FAILED') };
      }

      return { data: data as AcademicTerm, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'TERM_UPDATE_FAILED') };
    }
  }

  async getTerm(termId: string): Promise<AcademicResult<AcademicTerm>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'TERM_NOT_FOUND', message: 'Supabase not configured' } };
    }

    try {
      const { data, error } = await (supabase.from('academic_terms') as any)
        .select('*')
        .eq('id', termId)
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'TERM_NOT_FOUND') };
      }

      return { data: data as AcademicTerm, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'TERM_NOT_FOUND') };
    }
  }

  async listTerms(sessionId: string): Promise<AcademicResult<AcademicTerm[]>> {
    if (!hasSupabaseConfig) {
      return { data: [], error: null };
    }

    try {
      const { data, error } = await (supabase.from('academic_terms') as any)
        .select('*')
        .eq('session_id', sessionId)
        .order('display_order', { ascending: true });

      if (error) {
        return { data: null, error: mapProviderError(error, 'TERM_NOT_FOUND') };
      }

      return { data: (data || []) as AcademicTerm[], error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'TERM_NOT_FOUND') };
    }
  }

  async activateTerm(termId: string): Promise<AcademicResult<AcademicTerm>> {
    if (!hasSupabaseConfig) {
      return { data: null, error: { code: 'UNKNOWN', message: 'Supabase not configured' } };
    }

    try {
      const term = await this.getTerm(termId);
      if (term.error || !term.data) {
        return term;
      }

      // Deactivate all terms for this session
      await (supabase.from('academic_terms') as any)
        .update({ is_current: false, status: 'COMPLETED' })
        .eq('session_id', term.data.sessionId)
        .neq('id', termId);

      // Activate requested term
      const { data, error } = await (supabase.from('academic_terms') as any)
        .update({ is_current: true, status: 'ACTIVE' })
        .eq('id', termId)
        .select()
        .single();

      if (error) {
        return { data: null, error: mapProviderError(error, 'TERM_UPDATE_FAILED') };
      }

      return { data: data as AcademicTerm, error: null };
    } catch (error) {
      return { data: null, error: mapProviderError(error, 'TERM_UPDATE_FAILED') };
    }
  }

  async rolloverSession(_sessionId: string): Promise<AcademicResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async promoteStudents(_sessionId: string): Promise<AcademicResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  async archivePreviousSession(_sessionId: string): Promise<AcademicResult<void>> {
    return { data: null, error: { code: 'UNKNOWN', message: 'Not implemented' } };
  }

  isConfigured(): boolean {
    return hasSupabaseConfig;
  }
}