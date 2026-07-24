import { defineStore } from 'pinia';
import { divisionService } from '../shared/divisions/DivisionService';
import type { SchoolDivision } from '../shared/divisions/types';
import { useSchoolStore } from './schoolStore';

export const useDivisionStore = defineStore('division', {
  state: () => ({
    divisions: [] as SchoolDivision[],
    loading: false as boolean,
    initialized: false as boolean,
    error: null as string | null,
  }),
  getters: {
    activeDivisions: (state): SchoolDivision[] => state.divisions.filter(d => d.status === 'ACTIVE'),
    divisionCount: (state): number => state.divisions.length,
    hasDivisions: (state): boolean => state.divisions.length > 0,
  },
  actions: {
    async initialize() {
      this.loading = true;
      this.error = null;

      try {
        const schoolStore = useSchoolStore();
        const schoolId = schoolStore.currentSchoolId;
        if (!schoolId) {
          this.divisions = [];
          return;
        }

        const result = await divisionService.loadDivisions(schoolId);

        if (result.error) {
          this.error = result.error.message;
          this.divisions = [];
        } else {
          this.divisions = result.data || [];
        }
      } catch (e: any) {
        this.error = e?.message || 'Failed to load divisions';
        this.divisions = [];
      } finally {
        this.loading = false;
        this.initialized = true;
      }
    },

    async loadDivisions() {
      this.loading = true;
      this.error = null;

      try {
        const schoolStore = useSchoolStore();
        const schoolId = schoolStore.currentSchoolId;
        if (!schoolId) {
          this.divisions = [];
          return;
        }

        const result = await divisionService.loadDivisions(schoolId);

        if (result.error) {
          this.error = result.error.message;
          this.divisions = [];
        } else {
          this.divisions = result.data || [];
        }
      } catch (e: any) {
        this.error = e?.message || 'Failed to load divisions';
        this.divisions = [];
      } finally {
        this.loading = false;
      }
    },

    async createDivision(data: {
      schoolId: string;
      name: string;
      code: string;
      displayOrder: number;
      description?: string;
    }) {
      this.loading = true;
      this.error = null;

      try {
        const result = await divisionService.createDivision(data);

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        if (result.data) {
          this.divisions.push(result.data);
        }
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to create division';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async updateDivision(divisionId: string, data: Partial<SchoolDivision>) {
      this.loading = true;
      this.error = null;

      try {
        const result = await divisionService.updateDivision(divisionId, data);

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        const idx = this.divisions.findIndex(d => d.id === divisionId);
        if (idx >= 0 && result.data) {
          this.divisions[idx] = result.data;
        }
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to update division';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async deactivateDivision(divisionId: string) {
      this.loading = true;
      this.error = null;

      try {
        const result = await divisionService.deactivateDivision(divisionId);

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        const idx = this.divisions.findIndex(d => d.id === divisionId);
        if (idx >= 0 && result.data) {
          this.divisions[idx] = result.data;
        }
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to deactivate division';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async activateDivision(divisionId: string) {
      this.loading = true;
      this.error = null;

      try {
        const result = await divisionService.activateDivision(divisionId);

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        const idx = this.divisions.findIndex(d => d.id === divisionId);
        if (idx >= 0 && result.data) {
          this.divisions[idx] = result.data;
        }
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to activate division';
        return false;
      } finally {
        this.loading = false;
      }
    },

    clear() {
      this.divisions = [];
      this.loading = false;
      this.initialized = false;
      this.error = null;
    },
  },
});