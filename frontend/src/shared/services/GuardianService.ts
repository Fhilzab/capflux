import { GuardianRepository } from '../repositories/GuardianRepository';
import type { Guardian } from '../types/billing';

export const GuardianService = {
  /**
   * Get or create a guardian - core dedup logic for registration
   * If a guardian with the same school_id and primary_phone exists, return it.
   * Otherwise, create a new guardian record.
   */
  async getOrCreateGuardian(school_id: string, guardianData: {
    full_name: string;
    primary_phone: string;
    secondary_phone?: string;
    email?: string;
    relationship?: 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER';
  }): Promise<Guardian> {
    // Check if guardian already exists
    const existing = await GuardianRepository.findBySchoolAndPhone(school_id, guardianData.primary_phone);
    
    if (existing) {
      return existing;
    }

    // Create new guardian
    return GuardianRepository.saveGuardian({
      school_id,
      full_name: guardianData.full_name,
      primary_phone: guardianData.primary_phone,
      secondary_phone: guardianData.secondary_phone,
      email: guardianData.email,
      relationship: guardianData.relationship ?? 'GUARDIAN',
    });
  },

  /**
   * Get guardian by ID
   */
  async getGuardianById(id: string): Promise<Guardian | undefined> {
    return GuardianRepository.getById(id);
  },

  /**
   * Get all guardians for a school
   */
  async getGuardiansBySchool(school_id: string): Promise<Guardian[]> {
    return GuardianRepository.getBySchool(school_id);
  },

  /**
   * Update guardian details
   */
  async updateGuardian(guardian_id: string, updates: Partial<Guardian>): Promise<Guardian> {
    return GuardianRepository.updateGuardian(guardian_id, updates);
  },
};