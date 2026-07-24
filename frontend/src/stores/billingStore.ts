import { defineStore } from 'pinia';
import { billingService } from '../shared/billing/BillingService';
import type { BillingProfile, StudentCharge } from '../shared/billing/types';
import { useSchoolStore } from './schoolStore';

export const useBillingStore = defineStore('billing', {
  state: () => ({
    billingProfiles: [] as BillingProfile[],
    studentCharges: [] as StudentCharge[],
    loading: false as boolean,
    initialized: false as boolean,
    error: null as string | null,
  }),
  getters: {
    chargesByStudent: (state): Record<string, StudentCharge[]> => {
      const map: Record<string, StudentCharge[]> = {};
      for (const charge of state.studentCharges) {
        if (!map[charge.studentId]) map[charge.studentId] = [];
        map[charge.studentId].push(charge);
      }
      return map;
    },
    mandatoryCharges: (state): StudentCharge[] => state.studentCharges.filter(c => c.chargeSource === 'MANDATORY' || c.chargeSource === 'PLATFORM'),
    optionalCharges: (state): StudentCharge[] => state.studentCharges.filter(c => c.chargeSource === 'OPTIONAL'),
    mandatoryTotal: (state): number => 0,
    optionalTotal: (state): number => 0,
    grandTotal: (state): number => 0,
    studentChargeCount: (state): number => state.studentCharges.length,
  },
  actions: {
    async initialize() {
      this.loading = true;
      this.error = null;

      try {
        const schoolStore = useSchoolStore();
        const schoolId = schoolStore.currentSchoolId;

        if (schoolId) {
          const profileResult = await billingService.rebuildSchoolBilling(schoolId);
          if (profileResult.error) {
            this.error = profileResult.error.message;
          }
        }

        this.billingProfiles = [];
        this.studentCharges = [];
      } catch (e: any) {
        this.error = e?.message || 'Failed to load billing data';
        this.billingProfiles = [];
        this.studentCharges = [];
      } finally {
        this.loading = false;
        this.initialized = true;
      }
    },

    async initializeStudentBilling(studentId: string, profile: BillingProfile) {
      this.loading = true;
      this.error = null;

      try {
        const result = await billingService.initializeStudentBilling(studentId, profile);
        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        if (result.data?.charges) {
          this.studentCharges.push(...result.data.charges);
        }
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to initialize student billing';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async loadStudentCharges(studentId: string) {
      this.loading = true;
      this.error = null;

      try {
        const result = await billingService.rebuildStudentBilling(studentId);
        if (result.error) {
          this.error = result.error.message;
          return;
        }

        this.studentCharges = [];
      } catch (e: any) {
        this.error = e?.message || 'Failed to load student charges';
      } finally {
        this.loading = false;
      }
    },

    clear() {
      this.billingProfiles = [];
      this.studentCharges = [];
      this.loading = false;
      this.initialized = false;
      this.error = null;
    },
  },
});