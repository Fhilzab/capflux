import { SchoolRepository } from '../repositories/SchoolRepository';

export const SchoolService = {
  async getSchool(school_id: string) {
    return SchoolRepository.getSchool(school_id);
  },

  async saveSchool(school: Record<string, any>) {
    return SchoolRepository.saveSchool(school);
  },

  async getAppSettings(school_id: string) {
    return SchoolRepository.getAppSettings(school_id);
  },

  async updateAppSettings(school_id: string, settings: Record<string, any>) {
    return SchoolRepository.updateAppSettings(school_id, settings);
  },
};