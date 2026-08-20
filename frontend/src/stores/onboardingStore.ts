/**
 * Onboarding Store
 * Manages the two-phase lifecycle:
 *   Phase 1: Operational onboarding (Profile, Organization, School, Owner Info)
 *   Phase 2: Financial activation (KYC, Payment Gateway)
 * KYC is a COMPLIANCE process, not onboarding.
 *
 * Resilience guarantees (Phase 8.3):
 *   - loadStatus() deduplicates concurrent calls (no duplicate API requests).
 *   - A failed loadStatus() preserves any previously cached status rather
 *     than nulling it, so the UI can render stale-but-useful data.
 *   - Errors carry an HTTP status + category so the UI can present
 *     contextual messages instead of a generic "Connection problem".
 */
import { defineStore } from 'pinia';
import { apiClient } from '../shared/services/api/client';
import { categorizeApiError, ApiErrorCategory } from '../shared/services/api/errors';
import { useAuthStore } from './authStore';
import type {
  SchoolStatus,
  PaymentStatus,
  OnboardingProgress,
  OnboardingStatus,
} from '../shared/school/types';

// Re-export so existing imports remain valid.
export type OnboardingErrorCategory = ApiErrorCategory;

export interface OnboardingError {
  category: ApiErrorCategory;
  message: string;
}

interface OnboardingState {
  loading: boolean;
  statusLoading: boolean;
  statusLoaded: boolean;
  error: string | null;
  errorCategory: ApiErrorCategory | null;
  status: OnboardingStatus | null;
  currentStep: number;
  completedSteps: number[];
  /** Personal info collected in ProfileStep — available for KYC submission. */
  personalInfo: {
    firstName: string;
    middleName: string;
    lastName: string;
    phone: string;
    email: string;
    dateOfBirth: string | null;
    country: string;
    state: string;
    lga: string;
    residentialAddress: string;
  } | null;
}

// Module-level promise used to deduplicate concurrent loadStatus() calls.
// Pinia guarantees a single store instance, so this is effectively instance-scoped.
let _pendingLoadStatus: Promise<void> | null = null;

/**
 * Normalize the flat `get_onboarding_status` RPC payload into the nested
 * OnboardingStatus shape the frontend expects. Handles both the legacy flat
 * shape ({ has_school, school_id, profile_completed, … }) and an already-nested
 * shape (returned by tests or a fully-assembled backend response).
 */
function normalizeStatus(raw: unknown): OnboardingStatus {
  if (!raw || typeof raw !== 'object') {
    return {
      userId: null,
      organization: null,
      school: null,
      onboarding: null,
      kyc: null,
      hasSchool: false,
    };
  }

  const r = raw as Record<string, unknown>;

  // Already in the nested shape — pass through unchanged so tests and
  // fully-assembled backend responses keep working.
  if (r.onboarding !== undefined || r.school !== undefined || r.organization !== undefined) {
    return r as OnboardingStatus;
  }

  // Flat RPC shape: { has_school, school_id, profile_completed, … }
  const hasSchool = r.has_school === true;

  const onboarding: OnboardingProgress | null = hasSchool
    ? {
        schoolId: (r.school_id as string) || '',
        profileCompleted: !!r.profile_completed,
        organizationCompleted: !!r.organization_completed,
        schoolCompleted: !!r.school_completed,
        ownerCompleted: !!r.owner_completed,
        completedAt: (r.completed_at as string) | null,
        activatedAt: (r.activated_at as string) | null,
      }
    : null;

  return {
    userId: (r.user_id as string) || (r.userId as string) || null,
    organization: null,
    school: hasSchool
      ? {
          id: (r.school_id as string) || '',
          name: (r.school_name as string) || '',
          slug: (r.school_slug as string) || '',
          status: (r.school_status as SchoolStatus) || 'PENDING_SETUP',
          paymentStatus: (r.payment_status as PaymentStatus) || 'NOT_READY',
          organizationId: (r.organization_id as string) || '',
        }
      : null,
    onboarding,
    kyc: null,
    hasSchool,
  };
}

// Helper to make API calls via the cookie-authenticated apiClient.
// Throws an enhanced Error that preserves HTTP status and network-error info
// (isNetworkError, status, backendMessage, category, userMessage) so
// categorizeApiError() can categorize errors accurately.
async function apiCall<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  fallback = 'Network request failed',
): Promise<T> {
  try {
    const response = await apiClient.http({
      method: method as 'get' | 'post' | 'put' | 'patch' | 'delete',
      url: path,
      data: body,
    });
    return response.data as T;
  } catch (raw) {
    const err = raw as {
      response?: { status?: number; data?: { error?: string; message?: string } };
      message?: string;
      code?: string;
      isNetworkError?: boolean;
      status?: number;
      backendMessage?: string;
    };

    const status = err.status ?? err.response?.status;
    const backendMessage =
      err.backendMessage || err.response?.data?.error || err.response?.data?.message;
    const isNetworkError = err.isNetworkError ?? !err.response;
    const message = backendMessage || err.message || fallback;

    const ctx = categorizeApiError(err, fallback);

    const enhanced = new Error(message) as Error & {
      status?: number;
      isNetworkError: boolean;
      backendMessage?: string;
      category?: ApiErrorCategory;
      userMessage: string;
    };
    enhanced.status = status;
    enhanced.isNetworkError = isNetworkError;
    enhanced.backendMessage = backendMessage;
    enhanced.category = ctx.category;
    enhanced.userMessage = ctx.message;

    throw enhanced;
  }
}

type EnhancedError = Error & {
  category?: ApiErrorCategory;
  userMessage?: string;
  status?: number;
  isNetworkError?: boolean;
  backendMessage?: string;
};

export const useOnboardingStore = defineStore('onboarding', {
  state: (): OnboardingState => ({
    loading: false,
    statusLoading: false,
    statusLoaded: false,
    error: null,
    errorCategory: null,
    status: null,
    currentStep: 1,
    completedSteps: [],
    personalInfo: null,
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

    hasSchool(state): boolean {
      return state.status?.hasSchool ?? !!state.status?.school;
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

    // === Error helpers ===
    isNetworkError(state): boolean {
      return state.errorCategory === 'NETWORK_ERROR';
    },

    isAuthError(state): boolean {
      return state.errorCategory === 'AUTH_ERROR';
    },

    hasRecoverableError(state): boolean {
      return state.errorCategory === 'NETWORK_ERROR' || state.errorCategory === 'SERVER_ERROR';
    },
  },

  actions: {
    // === Load onboarding status ===
    async loadStatus() {
      // Deduplicate: if a load is already in-flight, return the existing promise
      // so multiple components (SchoolSetupView, useModuleLock, etc.) never
      // fire duplicate requests.
      if (_pendingLoadStatus) {
        return _pendingLoadStatus;
      }

      this.statusLoading = true;
      this.statusLoaded = true;
      this.error = null;
      this.errorCategory = null;

      _pendingLoadStatus = this._fetchStatus();

      try {
        await _pendingLoadStatus;
      } finally {
        _pendingLoadStatus = null;
        this.statusLoading = false;
      }
    },

    /** Internal: performs the actual API call + state reconciliation for loadStatus. */
    async _fetchStatus() {
      try {
        const data = await apiCall<{ success: boolean; data: OnboardingStatus }>(
          'GET',
          '/onboarding/status',
          undefined,
          'Failed to load onboarding status',
        );
        this.status = normalizeStatus(data.data);

        // Set completed steps based on status
        const o = this.status?.onboarding;
        if (o) {
          const steps: number[] = [];
          if (o.profileCompleted) steps.push(1);
          if (o.organizationCompleted) steps.push(2);
          if (o.schoolCompleted) steps.push(3);
          if (o.ownerCompleted) steps.push(4);
          this.completedSteps = steps;
        }

        // Restore currentStep from backend state so refresh preserves
        // the correct onboarding stage.
        this.restoreStepFromStatus();
      } catch (err) {
        // Preserve any previously cached status — do NOT null it.
        // The error is surfaced for a contextual banner while the
        // rest of the Setup Center shell remains usable.
        this.setError(err as EnhancedError);
      }
    },

    // === Load saved personal info (for resume after refresh) ===
    async loadProfile() {
      try {
        const data = await apiCall<{
          success: boolean;
          data: {
            firstName?: string;
            middleName?: string;
            lastName?: string;
            phone?: string;
            dateOfBirth?: string | null;
            country?: string;
            state?: string;
            lga?: string;
            residentialAddress?: string;
          } | null;
        }>('GET', '/onboarding/profile', undefined, 'Failed to load profile');

        if (data?.success && data.data) {
          this.personalInfo = {
            firstName: data.data.firstName || '',
            middleName: data.data.middleName || '',
            lastName: data.data.lastName || '',
            phone: data.data.phone || '',
            email: '',
            dateOfBirth: data.data.dateOfBirth || null,
            country: data.data.country || 'Nigeria',
            state: data.data.state || '',
            lga: data.data.lga || '',
            residentialAddress: data.data.residentialAddress || '',
          };
        }
      } catch (err) {
        this.setError(err as EnhancedError);
      }
    },

    // === Step: Profile (Personal Information) ===
    async saveProfile(profile: {
      firstName?: string;
      middleName?: string;
      lastName?: string;
      phone?: string;
      dateOfBirth?: string;
      country?: string;
      state?: string;
      lga?: string;
      residentialAddress?: string;
    }) {
      const fullName = [profile.firstName, profile.middleName, profile.lastName]
        .filter(Boolean)
        .join(' ');
      if (!fullName) {
        throw Object.assign(new Error('First name and last name are required.'), {
          status: 400,
          category: 'VALIDATION_ERROR',
          userMessage: 'First name and last name are required.',
        });
      }
      this.loading = true;
      this.error = null;
      this.errorCategory = null;
      try {
        await apiCall<{ success: boolean }>('POST', '/onboarding/profile', {
          firstName: profile.firstName,
          middleName: profile.middleName,
          lastName: profile.lastName,
          phone: profile.phone,
          dateOfBirth: profile.dateOfBirth,
          country: profile.country,
          state: profile.state,
          lga: profile.lga,
          residentialAddress: profile.residentialAddress,
        });
        // Store personal info for later KYC submission (principal name, phone)
        this.personalInfo = {
          firstName: profile.firstName || '',
          middleName: profile.middleName || '',
          lastName: profile.lastName || '',
          phone: profile.phone || '',
          email: '',
          dateOfBirth: profile.dateOfBirth || null,
          country: profile.country || 'Nigeria',
          state: profile.state || '',
          lga: profile.lga || '',
          residentialAddress: profile.residentialAddress || '',
        };
        this.completedSteps = [...new Set([...this.completedSteps, 1])];
        await this.loadStatus();
      } catch (err) {
        this.setError(err as EnhancedError);
        throw err;
      } finally {
        this.loading = false;
      }
    },

    // === Step: Organization ===
    async createOrganization(name: string) {
      this.loading = true;
      this.error = null;
      this.errorCategory = null;
      try {
        await apiCall<{ success: boolean }>('POST', '/onboarding/organization', { name });
        this.completedSteps = [...new Set([...this.completedSteps, 2])];
        await this.loadStatus();
      } catch (err) {
        this.setError(err as EnhancedError);
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
      schoolCategory?: string;
      gender?: string;
      schoolLevels?: string[];
      academicCalendar?: Record<string, unknown>;
    }) {
      this.loading = true;
      this.error = null;
      this.errorCategory = null;
      try {
        await apiCall<{ success: boolean }>('POST', '/onboarding/school', school);
        this.completedSteps = [...new Set([...this.completedSteps, 3])];
        await this.loadStatus();
      } catch (err) {
        this.setError(err as EnhancedError);
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
      this.errorCategory = null;
      try {
        await apiCall<{ success: boolean }>('POST', '/onboarding/owner-info', ownerInfo);
        this.completedSteps = [...new Set([...this.completedSteps, 4])];
        await this.loadStatus();
      } catch (err) {
        this.setError(err as EnhancedError);
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
        });
      } catch (err) {
        console.warn('Failed to save progress:', (err as Error)?.message);
      }
    },

    // === Complete onboarding ===
    async completeOnboarding() {
      this.loading = true;
      this.error = null;
      this.errorCategory = null;
      try {
        const response = await apiCall<{
          success: boolean;
          data: { school: unknown; activated: boolean };
        }>('POST', '/onboarding/complete', undefined, 'Failed to complete onboarding');
        await this.loadStatus();
        return response.data;
      } catch (err) {
        this.setError(err as EnhancedError);
        throw err;
      } finally {
        this.loading = false;
      }
    },

    // === Error handling ===
    setError(err: EnhancedError) {
      this.error = err?.userMessage || err?.message || 'An unexpected error occurred';
      this.errorCategory = err?.category || 'ONBOARDING_ERROR';
    },

    clearError() {
      this.error = null;
      this.errorCategory = null;
    },

    // === Navigation ===
    setStep(step: number) {
      this.currentStep = step;
    },

    /**
     * Restore currentStep based on the backend onboarding checklist state.
     * On refresh, currentStep resets to its default (1); this method advances
     * it to the first incomplete step so the user resumes where they left off.
     * If all steps are complete, step 4 is shown so the "Complete Setup"
     * button remains accessible.
     */
    restoreStepFromStatus() {
      const o = this.status?.onboarding;
      if (!o) {
        this.currentStep = 1;
        return;
      }
      if (!o.profileCompleted) {
        this.currentStep = 1;
      } else if (!o.organizationCompleted) {
        this.currentStep = 2;
      } else if (!o.schoolCompleted) {
        this.currentStep = 3;
      } else {
        this.currentStep = 4;
      }
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
      this.personalInfo = null;
      this.error = null;
      this.errorCategory = null;
      this.statusLoading = false;
      this.statusLoaded = false;
    },
  },
});
