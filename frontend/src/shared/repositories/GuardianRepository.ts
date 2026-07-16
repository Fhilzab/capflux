import db from '../../offline/localDb';
import { LocalRepository } from '../../offline/localDb';
import type { Guardian } from '../types/billing';

export const GuardianRepository = {
  /**
   * Save a guardian record to IndexedDB and enqueue for sync
   */
  async saveGuardian(guardian: Partial<Guardian>) {
    const { v4: uuidv4 } = await import('uuid');
    const record: Guardian = {
      id: guardian.id ?? uuidv4(),
      school_id: guardian.school_id!,
      full_name: guardian.full_name!,
      primary_phone: guardian.primary_phone!,
      secondary_phone: guardian.secondary_phone,
      email: guardian.email,
      relationship: guardian.relationship ?? 'GUARDIAN',
      created_at: guardian.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await LocalRepository.saveGuardian(record);
    await LocalRepository.enqueueSyncItem({
      school_id: record.school_id,
      entity_type: 'guardians',
      entity_id: record.id,
      payload: {
        id: record.id,
        school_id: record.school_id,
        full_name: record.full_name,
        primary_phone: record.primary_phone,
        secondary_phone: record.secondary_phone,
        email: record.email,
        relationship: record.relationship,
        created_at: record.created_at,
        updated_at: record.updated_at,
      } as Record<string, unknown>,
    });

    return record;
  },

  /**
   * Find guardian by school and primary phone (for dedup during registration)
   */
  async findBySchoolAndPhone(school_id: string, phone: string): Promise<Guardian | undefined> {
    return LocalRepository.findGuardianByPhone(school_id, phone);
  },

  /**
   * Get all guardians for a school
   */
  async getBySchool(school_id: string): Promise<Guardian[]> {
    return LocalRepository.getGuardiansBySchool(school_id);
  },

  /**
   * Get guardian by ID
   */
  async getById(id: string): Promise<Guardian | undefined> {
    return db.guardians.get(id);
  },

  /**
   * Update a guardian record
   */
  async updateGuardian(guardian_id: string, updates: Partial<Guardian>) {
    const existing = await db.guardians.get(guardian_id);
    if (!existing) throw new Error('Guardian not found');

    const updated: Guardian = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await db.guardians.put(updated);
    await LocalRepository.enqueueSyncItem({
      school_id: updated.school_id,
      entity_type: 'guardians',
      entity_id: guardian_id,
      operation: 'UPDATE',
      payload: {
        id: updated.id,
        school_id: updated.school_id,
        full_name: updated.full_name,
        primary_phone: updated.primary_phone,
        secondary_phone: updated.secondary_phone,
        email: updated.email,
        relationship: updated.relationship,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      } as Record<string, unknown>,
    });

    return updated;
  },
};