import { TuitionConfigurationRepository } from '../repositories/TuitionConfigurationRepository';
import type { TuitionConfiguration } from '../types/billing';

/**
 * Tuition Configuration Service
 * Manages tuition configuration for schools based on category/session/term
 */
export const TuitionConfigurationService = {
  /**
   * Get tuition for a specific combination of school, session, term, and category
   */
  async getTuition(
    school_id: string,
    academic_session: string,
    academic_term: string,
    category: string
  ): Promise<TuitionConfiguration | undefined> {
    return TuitionConfigurationRepository.getTuitionConfiguration(
      school_id,
      academic_session,
      academic_term,
      category
    );
  },

  /**
   * Get all tuition configurations for a school
   */
  async getTuitionConfigurations(school_id: string): Promise<TuitionConfiguration[]> {
    return TuitionConfigurationRepository.getTuitionConfigurationsBySchool(school_id);
  },

  /**
   * Configure tuition for a school
   */
  async configureTuition(
    school_id: string,
    academic_session: string,
    academic_term: string,
    category: string,
    tuition_amount: number
  ): Promise<TuitionConfiguration> {
    // Check if configuration already exists
    const existing = await TuitionConfigurationRepository.getTuitionConfiguration(
      school_id,
      academic_session,
      academic_term,
      category
    );

    if (existing) {
      return TuitionConfigurationRepository.updateTuitionConfiguration(existing.id, { tuition_amount });
    }

    return TuitionConfigurationRepository.saveTuitionConfiguration({
      school_id,
      academic_session,
      academic_term: academic_term as 'FIRST' | 'SECOND' | 'THIRD',
      category: category as 'NURSERY' | 'PRIMARY' | 'SECONDARY',
      tuition_amount,
    });
  },

  /**
   * Update tuition configuration
   */
  async updateTuition(
    config_id: string,
    updates: Partial<TuitionConfiguration>
  ): Promise<TuitionConfiguration> {
    return TuitionConfigurationRepository.updateTuitionConfiguration(config_id, updates);
  },
};