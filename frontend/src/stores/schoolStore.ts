import { defineStore } from 'pinia';
import { schoolService } from '../shared/school/SchoolService';
import type { School, SchoolStatus } from '../shared/school/types';

export const useSchoolStore = defineStore('school', {
  state: () => ({
    school: null as School | null,
    loading: false as boolean,
    initialized: false as boolean,
    error: null as string | null,
  }),
  getters: {
    currentSchool: (state): School | null => state.school,
    currentSchoolId: (state): string | null => state.school?.id ?? null,
    isSchoolActive: (state): boolean => state.school?.status === 'ACTIVE',
    schoolStatus: (state): SchoolStatus | null => state.school?.status ?? null,
    // New computed helpers for onboarding & payment lifecycle
    requiresSetup: (state): boolean => state.school?.status === 'PENDING_SETUP',
    isOperational: (state): boolean => !!state.school && ['ACTIVE', 'SUSPENDED'].includes(state.school.status),
    isSuspended: (state): boolean => state.school?.status === 'SUSPENDED',
    isArchived: (state): boolean => state.school?.status === 'ARCHIVED',
    requiresKYC: (state): boolean => !!state.school && ['PENDING_KYC', 'REJECTED'].includes(state.school.paymentStatus),
    isPaymentReady: (state): boolean => state.school?.paymentStatus === 'READY',
    canCollectPayments: (state): boolean => !!state.school && (['ACTIVE', 'SUSPENDED'].includes(state.school.status) && state.school.paymentStatus === 'READY'),
    // Backwards compatible alias for previous check; keeps UI using this getter working
    schoolSetupComplete: (state): boolean => !!state.school && state.school.status === 'ACTIVE',
  },
  actions: {
    async initialize() {
      this.loading = true;
      this.error = null;

      try {
        const result = await schoolService.loadSchool();
        
        if (result.error) {
          this.error = result.error.message;
          this.school = null;
        } else {
          this.school = result.data;
        }
      } catch (e: any) {
        this.error = e?.message || 'Failed to load school';
        this.school = null;
      } finally {
        this.loading = false;
        this.initialized = true;
      }
    },

    async createSchool(data: {
      schoolName: string;
      proprietorName: string;
      email: string;
      phone: string;
      address?: string;
      schoolType: string;
      academicSession?: string;
      currentTerm?: string;
    }) {
      this.loading = true;
      this.error = null;

      try {
        const result = await schoolService.createSchool(data);

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        this.school = result.data;
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to create school';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async loadSchool() {
      this.loading = true;
      this.error = null;

      try {
        const result = await schoolService.loadSchool();

        if (result.error) {
          this.error = result.error.message;
          this.school = null;
        } else {
          this.school = result.data;
        }
      } catch (e: any) {
        this.error = e?.message || 'Failed to load school';
        this.school = null;
      } finally {
        this.loading = false;
      }
    },

    async updateSchool(schoolId: string, data: Partial<School>) {
      this.loading = true;
      this.error = null;

      try {
        const result = await schoolService.updateSchool(schoolId, data);

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        this.school = result.data;
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to update school';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async archiveSchool(schoolId: string) {
      this.loading = true;
      this.error = null;

      try {
        const result = await schoolService.archiveSchool(schoolId);

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        this.school = result.data;
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to archive school';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async activateSchool(schoolId: string) {
      this.loading = true;
      this.error = null;

      try {
        const result = await schoolService.activateSchool(schoolId);

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        this.school = result.data;
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to activate school';
        return false;
      } finally {
        this.loading = false;
      }
    },

    clear() {
      this.school = null;
      this.loading = false;
      this.initialized = false;
      this.error = null;
    },
  },
});