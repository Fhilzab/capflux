import { supabase } from './api/supabase';
import type { Profile } from '@/features/school/types';

/**
 * ProfileService - Handles profile data only
 * Email comes from auth.users, NOT profiles table
 */
export class ProfileService {
  async getProfile(): Promise<Profile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('ProfileService.getProfile error:', error);
      return null;
    }

    return data as Profile;
  }

  async updateProfile(data: { full_name?: string; phone?: string }): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', user.id);

    if (error) throw error;
  }

  async getSchoolId(): Promise<string | null> {
    const profile = await this.getProfile();
    return profile?.school_id ?? null;
  }
}