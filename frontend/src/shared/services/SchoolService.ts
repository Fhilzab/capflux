import { supabase } from './api/supabase';
import type { School, AcademicSession, AcademicTerm, OnboardingProgress } from '@/features/school/types';

/**
 * SchoolService - Handles school data only
 */
export class SchoolService {
  async getSchool(schoolId: string): Promise<School | null> {
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .eq('id', schoolId)
      .maybeSingle();

    if (error) {
      console.error('SchoolService.getSchool error:', error);
      return null;
    }

    return data as School;
  }

  async updateSchool(schoolId: string, data: Partial<School>): Promise<void> {
    const { error } = await supabase
      .from('schools')
      .update(data)
      .eq('id', schoolId);

    if (error) throw error;
  }

  async getOnboardingProgress(schoolId: string): Promise<OnboardingProgress | null> {
    const { data, error } = await supabase
      .from('onboarding_progress')
      .select('*')
      .eq('school_id', schoolId)
      .maybeSingle();

    if (error) {
      console.error('SchoolService.getOnboardingProgress error:', error);
      return null;
    }

    return data as OnboardingProgress;
  }

  async getSessions(schoolId: string): Promise<AcademicSession[]> {
    const { data, error } = await supabase
      .from('academic_sessions')
      .select('*')
      .eq('school_id', schoolId)
      .order('start_date', { ascending: true });

    if (error) {
      console.error('SchoolService.getSessions error:', error);
      return [];
    }

    return data as AcademicSession[];
  }

  async getTerms(schoolId: string, sessionId?: string): Promise<AcademicTerm[]> {
    let query = supabase
      .from('academic_terms')
      .select('*')
      .eq('school_id', schoolId);
    
    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }
    
    const { data, error } = await query.order('start_date', { ascending: true });

    if (error) {
      console.error('SchoolService.getTerms error:', error);
      return [];
    }

    return data as AcademicTerm[];
  }

  async isReady(schoolId: string): Promise<boolean> {
    try {
      const { data } = await supabase.rpc('school_is_ready', { p_school_id: schoolId });
      return data ?? false;
    } catch (err) {
      console.error('SchoolService.isReady error:', err);
      return false;
    }
  }
}