import db from '../offline/localDb';
import { LocalRepository } from '../offline/localDb';
import type { TuitionConfiguration } from '../types/billing';

export const TuitionConfigurationRepository = {
  /**
   * Save tuition configuration to IndexedDB and enqueue for sync
   */
  async saveTuitionConfiguration(config: Partial<TuitionConfiguration>) {
    const { v4: uuidv4 } = await import('uuid');
    const record: TuitionConfiguration = {
      id: config.id ?? uuidv4(),
      school_id: config.school_id!,
      academic_session: config.academic_session!,
      academic_term: config.academic_term!,
      category: config.category!,
      tuition_amount: config.tuition_amount!,
      created_at: config.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await LocalRepository.saveTuitionConfiguration(record);
    await LocalRepository.enqueueSyncItem({
      school_id: record.school_id,
      entity_type: 'tuition_configuration',
      entity_id: record.id,
      payload: {
        id: record.id,
        school_id: record.school_id,
        academic_session: record.academic_session,
        academic_term: record.academic_term,
        category: record.category,
        tuition_amount: record.tuition_amount,
        created_at: record.created_at,
        updated_at: record.updated_at,
      } as Record<string, unknown>,
    });

    return record;
  },

  /**
   * Get tuition configuration by school, session, term, and category
   */
  async getTuitionConfiguration(
    school_id: string,
    academic_session: string,
    academic_term: string,
    category: string
  ): Promise<TuitionConfiguration | undefined> {
    return LocalRepository.getTuitionConfiguration(school_id, academic_session, academic_term, category);
  },

  /**
   * Get all tuition configurations for a school
   */
  async getTuitionConfigurationsBySchool(school_id: string): Promise<TuitionConfiguration[]> {
    return LocalRepository.getTuitionConfigurationsBySchool(school_id);
  },

  /**
   * Update tuition configuration
   */
  async updateTuitionConfiguration(config_id: string, updates: Partial<TuitionConfiguration>) {
    const existing = await db.tuition_configurations.get(config_id);
    if (!existing) throw new Error('Tuition configuration not found');

    const updated: TuitionConfiguration = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await db.tuition_configurations.put(updated);
    await LocalRepository.enqueueSyncItem({
      school_id: updated.school_id,
      entity_type: 'tuition_configuration',
      entity_id: config_id,
      operation: 'UPDATE',
      payload: {
        id: updated.id,
        school_id: updated.school_id,
        academic_session: updated.academic_session,
        academic_term: updated.academic_term,
        category: updated.category,
        tuition_amount: updated.tuition_amount,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      } as Record<string, unknown>,
    });

    return updated;
  },
};