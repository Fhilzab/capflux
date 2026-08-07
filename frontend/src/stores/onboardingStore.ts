/**
 * Onboarding Store
 * Manages the two-phase lifecycle:
 *   Phase 1: Operational onboarding (Profile, Organization, School, Owner Info)
 *   Phase 2: Financial activation (KYC, Payment Gateway)
 * KYC is a COMPLIANCE process, not onboarding.
 */
import { defineStore } from 'pinia';
import axios, { AxiosError } from 'axios';
import { useAuthStore } from './authStore';
import type {
  SchoolStatus,
  PaymentStatus,
  OnboardingProgress,
  OnboardingStatus,
} from '../shared/school/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

interface OnboardingState {
  loading: boolean;
  error: string | null;
  status: OnboardingStatus | null;
  currentStep: number;
  completedSteps: number[];
}

// Helper to make API calls
async function apiCall<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  userId?: string | null,
): Promise<T> {
  if (!userId) throw new Error('User not authenticated');

  try {
    const response = await axios({
      method,
      url: `${API_BASE_URL}${path}`,
      headers: { Authorization: `Bearer ${userId}` },
      data: body,
    });
    return response.data as T;
  } catch (raw) {
    const err = raw as AxiosError<{ error?: string }>;
    const message = err.response?.data?.error || err.message || 'Network request failed';
    throw new Error(message);
  }
}

export const useOnboardingStore = defineStore('onboarding', {
  state: (): OnboardingState => ({
    loading: false,
    error: null,
    status: null,
    currentStep: 1, // 1=Profile, 2=Organization, 3=School, 4=Owner Info
    completedSteps: [],
  }),

  getters: {
    // === Identity / school access ===
    userId(): string | null {
      const auth = useAuthStore();
      return auth.session?.user?.id || auth.user?.id || null;
    },

    schoolId(state): string | null {
      return state.status?.school?.id || null;
    },

    schoolStatus(state): SchoolStatus | null {
      return state.status?.school?.status || null;
    },

    paymentStatus(state): PaymentStatus | null {
      return state.status?.school?.paymentStatus || null;
    },

    // === Onboarding progress ===
    onboarding(state): OnboardingProgress | null {
      if (!state.status?.onboarding) return null;
      const o = state.status.onboarding;
      return {
        schoolId: o.schoolId,
        profileCompleted: o.profileCompleted,
        organizationCompleted: o.organizationCompleted,
        schoolCompleted: o.schoolCompleted,
        ownerCompleted: o.ownerCompleted,
        completedAt: o.completedAt,
        activatedAt: o.activatedAt,
      };
    },

    // === Checklist items (4-step onboarding) ===
    profileCompleted(state): boolean {
      return state.status?.onboarding?.profileCompleted ?? false;
    },

    organizationCompleted(state): boolean {
      return state.status?.onboarding?.organizationCompleted ?? false;
    },

    schoolCompleted(state): boolean {
      return state.status?.onboarding?.schoolCompleted ?? false;
    },

    ownerCompleted(state): boolean {
      return state.status?.onboarding?.ownerCompleted ?? false;
    },

    // === Computed lifecycle flags ===
    // School operational lifecycle
    requiresSetup(state): boolean {
      const s = state.status?.school?.status;
      return s === 'PENDING_SETUP';
    },

    isOperational(state): boolean {
      const s = state.status?.school?.status;
      return s === 'ACTIVE' || s === 'SUSPENDED';
    },

    isSuspended(state): boolean {
      return state.status?.school?.status === 'SUSPENDED';
    },

    isArchived(state): boolean {
      return state.status?.school?.status === 'ARCHIVED';
    },

    // Payment lifecycle
    isPaymentReady(state): boolean {
      const p = state.status?.school?.paymentStatus;
      return p === 'READY';
    },

    requiresKYC(state): boolean {
      const p = state.status?.school?.paymentStatus;
      return p === 'PENDING_KYC' || p === 'REJECTED';
    },

    isUnderReview(state): boolean {
      const p = state.status?.school?.paymentStatus;
      return p === 'UNDER_REVIEW';
    },

    canCollectPayments(state): boolean {
      const s = state.status?.school?.status;
      const p = state.status?.school?.paymentStatus;
      return (s === 'ACTIVE' || s === 'SUSPENDED') && p === 'READY';
    },

    // === KYC ===
    kycStatus(state): string | null {
      return state.status?.kyc?.status || null;
    },

    kycCompleted(state): boolean {
      return state.status?.kyc?.status === 'VERIFIED';
    },

    // === Completion / activation ===
    isOnboardingComplete(state): boolean {
      const o = state.status?.onboarding;
      if (!o) return false;
      return (
        o.profileCompleted &&
        o.organizationCompleted &&
        o.schoolCompleted &&
        o.ownerCompleted
      );
    },

    isActivated(state): boolean {
      return !!state.status?.onboarding?.activatedAt;
    },

    // === Progress bar ===
    completionPercentage(state): number {
      const items = [
        state.status?.onboarding?.profileCompleted,
        state.status?.onboarding?.organizationCompleted,
        state.status?.onboarding?.schoolCompleted,
        state.status?.onboarding?.ownerCompleted,
      ].filter(Boolean).length;
      return Math.round((items / 4) * 100);
    },

    // Alias for progressPercent (spec naming)
    progressPercent(state): number {
      return this.completionPercentage;
    },

    // Alias for isComplete (spec naming)
    isComplete(state): boolean {
      return this.isOnboardingComplete;
    },

    // === Display helpers ===
    schoolName(state): string {
      return state.status?.school?.name || 'Your School';
    },

    organizationName(state): string {
      return state.status?.organization?.name || '';
    },
  },

  actions: {
    // === Load onboarding status ===
    async loadStatus() {
      this.loading = true;
      this.error = null;
      try {
        const data = await apiCall<{ success: boolean; data: OnboardingStatus }>(
          'GET',
          '/onboarding/status',
          undefined,
          this.userId,
        );
        this.status = data.data;

        // Set completed steps based on status
        const o = data.data.onboarding;
        if (o) {
          const steps: number[] = [];
          if (o.profileCompleted) steps.push(1);
          if (o.organizationCompleted) steps.push(2);
          if (o.schoolCompleted) steps.push(3);
          if (o.ownerCompleted) steps.push(4);
          this.completedSteps = steps;
        }

        this.error = null;
      } catch (err) {
        this.error = (err as Error)?.message || 'Failed to load status';
      } finally {
        this.loading = false;
      }
    },

    // === Step: Profile ===
    async saveProfile(fullName: string, phone?: string) {
      this.loading = true;
      this.error = null;
      try {
        await apiCall<{ success: boolean }>('POST', '/onboarding/profile', {
          fullName,
          phone,
        }, this.userId);
        this.completedSteps = [...new Set([...this.completedSteps, 1])];
        await this.loadStatus();
      } catch (err) {
        this.error = (err as Error)?.message || 'Failed to save profile';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    // === Step: Organization ===
    async createOrganization(name: string) {
      this.loading = true;
      this.error = null;
      try {
        await apiCall<{ success: boolean }>('POST', '/onboarding/organization', { name }, this.userId);
        this.completedSteps = [...new Set([...this.completedSteps, 2])];
        await this.loadStatus();
      } catch (err) {
        this.error = (err as Error)?.message || 'Failed to create organization';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    // === Step: School ===
    async createSchool(school: {
      name: string;
      address?: string;
      state?: string;
      lga?: string;
      country?: string;
      schoolType?: string;
      academicCalendar?: Record<string, unknown>;
    }) {
      this.loading = true;
      this.error = null;
      try {
        await apiCall<{ success: boolean }>('POST', '/onboarding/school', school, this.userId);
        this.completedSteps = [...new Set([...this.completedSteps, 3])];
        await this.loadStatus();
      } catch (err) {
        this.error = (err as Error)?.message || 'Failed to create school';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    // === Step: Owner Info (phone, designation, alternate contact) ===
    async saveOwnerInfo(ownerInfo: {
      phone: string;
      designation?: string;
      alternateContact?: string;
    }) {
      this.loading = true;
      this.error = null;
      try {
        await apiCall<{ success: boolean }>('POST', '/onboarding/owner-info', ownerInfo, this.userId);
        this.completedSteps = [...new Set([...this.completedSteps, 4])];
        await this.loadStatus();
      } catch (err) {
        this.error = (err as Error)?.message || 'Failed to save owner info';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    // === Save progress (for resume later) ===
    async saveProgress() {
      try {
        await apiCall<{ success: boolean }>('POST', '/onboarding/save-progress', {
          profileCompleted: this.profileCompleted,
          organizationCompleted: this.organizationCompleted,
          schoolCompleted: this.schoolCompleted,
          ownerCompleted: this.ownerCompleted,
        }, this.userId);
      } catch (err) {
        console.warn('Failed to save progress:', (err as Error)?.message);
      }
    },

    // === Complete onboarding ===
    async completeOnboarding() {
      this.loading = true;
      this.error = null;
      try {
        const response = await apiCall<{
          success: boolean;
          data: { school: unknown; activated: boolean };
        }>('POST', '/onboarding/complete', undefined, this.userId);
        await this.loadStatus();
        return response.data;
      } catch (err) {
        this.error = (err as Error)?.message || 'Failed to complete onboarding';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    // === KYC ===
    async getKycStatus() {
      this.loading = true;
      this.error = null;
      try {
        const data = await apiCall<{
          success: boolean;
          data: { kyc: unknown; schoolStatus: string; paymentStatus: string };
        }>('GET', '/kyc/status', undefined, this.userId);
        return data.data;
      } catch (err) {
        this.error = (err as Error)?.message || 'Failed to load KYC status';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async submitKyc(kyc: {
      principalName: string;
      principalPhone: string;
      officialEmail?: string;
      officialPhone?: string;
      cacRegistrationNumber?: string;
      cacCertificateUrl?: string;
      bvn: string;
      nin: string;
    }) {
      this.loading = true;
      this.error = null;
      try {
        const data = await apiCall<{ success: boolean; data: unknown }>(
          'POST',
          '/kyc/submit',
          kyc,
          this.userId,
        );
        await this.loadStatus();
        return data.data;
      } catch (err) {
        this.error = (err as Error)?.message || 'Failed to submit KYC';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async resubmitKyc(kyc: {
      principalName?: string;
      principalPhone?: string;
      officialEmail?: string;
      officialPhone?: string;
      cacRegistrationNumber?: string;
      cacCertificateUrl?: string;
      bvn: string;
      nin: string;
    }) {
      this.loading = true;
      this.error = null;
      try {
        const data = await apiCall<{ success: boolean; data: unknown }>(
          'POST',
          '/kyc/resubmit',
          kyc,
          this.userId,
        );
        await this.loadStatus();
        return data.data;
      } catch (err) {
        this.error = (err as Error)?.message || 'Failed to resubmit KYC';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async getKycDocuments() {
      this.loading = true;
      this.error = null;
      try {
        const data = await apiCall<{ success: boolean; data: unknown }>(
          'GET',
          '/kyc/documents',
          undefined,
          this.userId,
        );
        return data.data;
      } catch (err) {
        this.error = (err as Error)?.message || 'Failed to load KYC documents';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async getKycHistory() {
      this.loading = true;
      this.error = null;
      try {
        const data = await apiCall<{ success: boolean; data: unknown[] }>(
          'GET',
          '/kyc/history',
          undefined,
          this.userId,
        );
        return data.data;
      } catch (err) {
        this.error = (err as Error)?.message || 'Failed to load KYC history';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    // === Navigation ===
    setStep(step: number) {
      this.currentStep = step;
    },

    goToNextStep() {
      if (this.currentStep < 4) {
        this.currentStep += 1;
      }
    },

    goToPreviousStep() {
      if (this.currentStep > 1) {
        this.currentStep -= 1;
      }
    },

    // === Reset ===
    reset() {
      this.status = null;
      this.currentStep = 1;
      this.completedSteps = [];
      this.error = null;
    },
  },
});
