import db from '../offline/localDb';
import { LocalRepository } from '../offline/localDb';

export const GuardianRepository = {
  /**
   * Save a guardian record to IndexedDB and enqueue for sync
   */
  async saveGuardian(guardian: Record<string, any>) {
    const { v4: uuidv4 } = await import('uuid');
    const record = {
      id: guardian.id ?? uuidv4(),
      ...guardian,
      updated_at: new Date().toISOString(),
    } as any;

    await LocalRepository.saveGuardian(record);
    await LocalRepository.enqueueSyncItem({
      id: `guardian-sync-${record.id}-${Date.now()}`,
      school_id: record.school_id,
      entity_type: 'guardians',
      entity_id: record.id,
      payload: record,
    });

    return record;
  },

  /**
   * Find guardian by school and primary phone (for dedup during registration)
   */
  async findBySchoolAndPhone(school_id: string, phone: string) {
    return LocalRepository.findGuardianByPhone(school_id, phone);
  },

  /**
   * Get all guardians for a school
   */
  async getBySchool(school_id: string) {
    return LocalRepository.getGuardiansBySchool(school_id);
  },

  /**
   * Get guardian by ID
   */
  async getById(id: string) {
    return db.guardians.get(id);
  },

  /**
   * Update a guardian record
   */
  async updateGuardian(guardian_id: string, updates: Record<string, any>) {
    const existing = await db.guardians.get(guardian_id);
    if (!existing) throw new Error('Guardian not found');

    const updated = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await db.guardians.put(updated);
    await LocalRepository.enqueueSyncItem({
      id: `guardian-sync-${guardian_id}-${Date.now()}`,
      school_id: updated.school_id,
      entity_type: 'guardians',
      entity_id: guardian_id,
      operation: 'UPDATE',
      payload: updated,
    });

    return updated;
  },
};