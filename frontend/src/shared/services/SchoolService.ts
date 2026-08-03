import { SchoolRepository } from '../repositories/SchoolRepository';
import { rbacService } from '../rbac/RBACService';
import { PERMISSIONS } from '../rbac/permissions';

export const SchoolService = {
  async getSchool(school_id: string) {
    return SchoolRepository.getSchool(school_id);
  },

  async saveSchool(school: Record<string, any>) {
    await rbacService.assertCan(PERMISSIONS.SCHOOL.MANAGE);
    return SchoolRepository.saveSchool(school);
  },

  async getAppSettings(school_id: string) {
    return SchoolRepository.getAppSettings(school_id);
  },

  async updateAppSettings(school_id: string, settings: Record<string, any>) {
    await rbacService.assertCan(PERMISSIONS.SCHOOL.SETTINGS.UPDATE);
    return SchoolRepository.updateAppSettings(school_id, settings);
  },
};