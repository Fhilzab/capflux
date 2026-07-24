import { defineStore } from 'pinia';
import { feeService } from '../shared/fees/FeeService';
import type { Fee } from '../shared/fees/types';
import { useSchoolStore } from './schoolStore';

export const useFeeStore = defineStore('fee', {
  state: () => ({
    schoolFees: [] as Fee[],
    platformFees: [] as Fee[],
    loading: false as boolean,
    initialized: false as boolean,
    error: null as string | null,
  }),
  getters: {
    mandatoryFees: (state): Fee[] => [...state.schoolFees, ...state.platformFees].filter(f => f.isMandatory),
    optionalFees: (state): Fee[] => [...state.schoolFees, ...state.platformFees].filter(f => !f.isMandatory),
    activePlatformFees: (state): Fee[] => state.platformFees.filter(f => f.isActive),
    activeSchoolFees: (state): Fee[] => state.schoolFees.filter(f => f.isActive),
  },
  actions: {
    async initialize() {
      this.loading = true;
      this.error = null;

      try {
        const schoolStore = useSchoolStore();
        const schoolId = schoolStore.currentSchoolId;

        if (schoolId) {
          const schoolResult = await feeService.loadSchoolFees(schoolId);
          if (schoolResult.error) {
            this.error = schoolResult.error.message;
            this.schoolFees = [];
          } else {
            this.schoolFees = schoolResult.data || [];
          }
        } else {
          this.schoolFees = [];
        }

        const platformResult = await feeService.loadPlatformFees();
        if (platformResult.error) {
          this.error = platformResult.error.message;
          this.platformFees = [];
        } else {
          this.platformFees = platformResult.data || [];
        }
      } catch (e: any) {
        this.error = e?.message || 'Failed to load fees';
        this.schoolFees = [];
        this.platformFees = [];
      } finally {
        this.loading = false;
        this.initialized = true;
      }
    },

    async loadSchoolFees() {
      this.loading = true;
      this.error = null;

      try {
        const schoolStore = useSchoolStore();
        const schoolId = schoolStore.currentSchoolId;

        if (!schoolId) {
          this.schoolFees = [];
          return;
        }

        const result = await feeService.loadSchoolFees(schoolId);
        if (result.error) {
          this.error = result.error.message;
          this.schoolFees = [];
        } else {
          this.schoolFees = result.data || [];
        }
      } catch (e: any) {
        this.error = e?.message || 'Failed to load school fees';
        this.schoolFees = [];
      } finally {
        this.loading = false;
      }
    },

    async loadPlatformFees() {
      this.loading = true;
      this.error = null;

      try {
        const result = await feeService.loadPlatformFees();
        if (result.error) {
          this.error = result.error.message;
          this.platformFees = [];
        } else {
          this.platformFees = result.data || [];
        }
      } catch (e: any) {
        this.error = e?.message || 'Failed to load platform fees';
        this.platformFees = [];
      } finally {
        this.loading = false;
      }
    },

    async createSchoolFee(data: {
      schoolId: string;
      divisionId: string;
      name: string;
      code: string;
      isMandatory: boolean;
      description?: string;
    }) {
      this.loading = true;
      this.error = null;

      try {
        const result = await feeService.createSchoolFee(data);

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        if (result.data) {
          this.schoolFees.push(result.data);
        }
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to create fee';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async updateSchoolFee(feeId: string, data: Partial<Fee>) {
      this.loading = true;
      this.error = null;

      try {
        const result = await feeService.updateSchoolFee(feeId, data);

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        const idx = this.schoolFees.findIndex(f => f.id === feeId);
        if (idx >= 0 && result.data) {
          this.schoolFees[idx] = result.data;
        }
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to update fee';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async deactivateSchoolFee(feeId: string) {
      this.loading = true;
      this.error = null;

      try {
        const result = await feeService.deactivateSchoolFee(feeId);

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        const idx = this.schoolFees.findIndex(f => f.id === feeId);
        if (idx >= 0 && result.data) {
          this.schoolFees[idx] = result.data;
        }
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to deactivate fee';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async activateSchoolFee(feeId: string) {
      this.loading = true;
      this.error = null;

      try {
        const result = await feeService.activateSchoolFee(feeId);

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        const idx = this.schoolFees.findIndex(f => f.id === feeId);
        if (idx >= 0 && result.data) {
          this.schoolFees[idx] = result.data;
        }
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to activate fee';
        return false;
      } finally {
        this.loading = false;
      }
    },

    clear() {
      this.schoolFees = [];
      this.platformFees = [];
      this.loading = false;
      this.initialized = false;
      this.error = null;
    },
  },
});