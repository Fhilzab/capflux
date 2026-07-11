import db, { LocalRepository } from '../offline/localDb';
import { v4 as uuidv4 } from 'uuid';

export const SchoolRepository = {
  async saveSchool(school: Record<string, any>) {
    const record = {
      id: school.id ?? uuidv4(),
      ...school,
    };
    return db.schools.put(record);
  },

  async getSchool(school_id: string) {
    return db.schools.get(school_id);
  },

  async updateAppSettings(school_id: string, settings: Record<string, any>) {
    const existing = await db.app_settings.get(school_id);
    const record = {
      school_id,
      currency: settings.currency ?? existing?.currency ?? 'NGN',
      timezone: settings.timezone ?? existing?.timezone ?? 'Africa/Lagos',
      settings: settings.settings ?? existing?.settings ?? {},
    };
    await db.app_settings.put(record);
    return record;
  },

  async getAppSettings(school_id: string) {
    return db.app_settings.get(school_id);
  },
};