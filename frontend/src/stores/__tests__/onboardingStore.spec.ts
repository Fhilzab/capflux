/**
 * Onboarding Store Tests
 *
 * Tests verify the contract between the onboarding store and the backend API:
 * - State restoration on refresh (restoreStepFromStatus)
 * - API call correctness
 * - Error handling and network failure resilience
 * - Duplicate submit protection (Set-based completedSteps)
 * - Onboarding completion reflects backend state
 */
import { setActivePinia, createPinia } from 'pinia';
import { useOnboardingStore } from '../onboardingStore';
import type { OnboardingStatus } from '@/shared/school/types';

// Mock the apiClient module
const { apiCallMock } = vi.hoisted(() => {
  return {
    apiCallMock: vi.fn(),
  };
});

vi.mock('@/shared/services/api/client', () => ({
  apiClient: {
    http: apiCallMock,
  },
}));

// Mock authStore — userId getter depends on it
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    session: { user: { id: 'test-user-id' } },
    user: { id: 'test-user-id' },
  }),
}));

describe('onboardingStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiCallMock.mockReset();
  });

  // --- Helper to build a mock OnboardingStatus ---
  function makeStatus(overrides: Partial<OnboardingStatus> = {}): OnboardingStatus {
    return {
      userId: 'test-user-id',
      organization: { id: 'org-1', name: 'Test Org', slug: 'test-org' },
      school: {
        id: 'school-1',
        name: 'Test School',
        slug: 'test-school',
        status: 'PENDING_SETUP',
        paymentStatus: 'NOT_READY',
        organizationId: 'org-1',
      },
      onboarding: {
        schoolId: 'school-1',
        profileCompleted: false,
        organizationCompleted: false,
        schoolCompleted: false,
        ownerCompleted: false,
        completedAt: null,
        activatedAt: null,
      },
      kyc: null,
      ...overrides,
    };
  }

  describe('loadStatus', () => {
    it('loads onboarding status from backend', async () => {
      const mockStatus = makeStatus();
      apiCallMock.mockResolvedValueOnce({ data: { success: true, data: mockStatus } });

      const store = useOnboardingStore();
      await store.loadStatus();

      expect(store.status).toEqual(mockStatus);
      expect(store.error).toBeNull();
      expect(store.loading).toBe(false);
    });

    it('sets contextual error on network failure', async () => {
      apiCallMock.mockRejectedValueOnce(new Error('Network request failed'));

      const store = useOnboardingStore();
      await store.loadStatus();

      expect(store.error).toBe('Connection problem');
      expect(store.errorCategory).toBe('NETWORK_ERROR');
      expect(store.status).toBeNull();
      expect(store.loading).toBe(false);
    });

    it('restores currentStep to step 1 when no onboarding exists', async () => {
      apiCallMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: makeStatus({ onboarding: null, school: null }),
        },
      });

      const store = useOnboardingStore();
      await store.loadStatus();

      expect(store.currentStep).toBe(1);
    });

    it('maps 401 (auth error) to AUTH_ERROR category', async () => {
      apiCallMock.mockRejectedValueOnce({
        response: { status: 401, data: { error: 'Session expired' } },
      });

      const store = useOnboardingStore();
      await store.loadStatus();

      expect(store.errorCategory).toBe('AUTH_ERROR');
      expect(store.error).toBe('Authentication required');
      expect(store.loading).toBe(false);
    });

    it('maps 403 (forbidden) to AUTH_ERROR category', async () => {
      apiCallMock.mockRejectedValueOnce({
        response: { status: 403, data: { error: 'Insufficient permissions' } },
      });

      const store = useOnboardingStore();
      await store.loadStatus();

      expect(store.errorCategory).toBe('AUTH_ERROR');
      expect(store.error).toBe('Authentication required');
    });

    it('maps 404 to SERVER_ERROR', async () => {
      apiCallMock.mockRejectedValueOnce({
        response: { status: 404, data: { error: 'Not found' } },
      });

      const store = useOnboardingStore();
      await store.loadStatus();

      expect(store.errorCategory).toBe('SERVER_ERROR');
      expect(store.error).toBe('CAPFLUX is temporarily unavailable');
    });

    it('maps 422 to VALIDATION_ERROR with backend message', async () => {
      apiCallMock.mockRejectedValueOnce({
        response: {
          status: 422,
          data: { error: 'Validation failed: phone number is required' },
        },
      });

      const store = useOnboardingStore();
      await store.loadStatus();

      expect(store.errorCategory).toBe('VALIDATION_ERROR');
      expect(store.error).toBe('Validation failed: phone number is required');
    });

    it('maps 500 to SERVER_ERROR', async () => {
      apiCallMock.mockRejectedValueOnce({
        response: { status: 500, data: { error: 'Internal server error' } },
      });

      const store = useOnboardingStore();
      await store.loadStatus();

      expect(store.errorCategory).toBe('SERVER_ERROR');
      expect(store.error).toBe('CAPFLUX is temporarily unavailable');
    });

    it('handles timeout as NETWORK_ERROR', async () => {
      apiCallMock.mockRejectedValueOnce({
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded',
      });

      const store = useOnboardingStore();
      await store.loadStatus();

      expect(store.errorCategory).toBe('NETWORK_ERROR');
      expect(store.error).toBe('Connection problem');
    });

    it('preserves cached status when a subsequent load fails', async () => {
      const store = useOnboardingStore();

      // First load succeeds — cache the status
      apiCallMock.mockResolvedValueOnce({ data: { success: true, data: makeStatus() } });
      await store.loadStatus();
      expect(store.status).not.toBeNull();

      // Second load fails — cached status should be preserved
      apiCallMock.mockRejectedValueOnce(new Error('Network request failed'));
      await store.loadStatus();

      expect(store.status).not.toBeNull();
      expect(store.error).toBe('Connection problem');
      expect(store.errorCategory).toBe('NETWORK_ERROR');
    });

    it('deduplicates concurrent loadStatus calls (one API request)', async () => {
      const store = useOnboardingStore();
      let resolveLoad!: (value: { data: { success: boolean; data: OnboardingStatus } }) => void;
      apiCallMock.mockImplementation(() => new Promise((resolve) => {
        resolveLoad = resolve;
      }));

      // Fire two concurrent requests
      const p1 = store.loadStatus();
      const p2 = store.loadStatus();

      // Only one API call should be made
      expect(apiCallMock).toHaveBeenCalledTimes(1);

      resolveLoad({ data: { success: true, data: makeStatus() } });
      await Promise.all([p1, p2]);
    });
  });

  describe('restoreStepFromStatus', () => {
    it('resets to step 1 when profile not completed', async () => {
      const store = useOnboardingStore();
      apiCallMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: makeStatus(),
        },
      });
      await store.loadStatus();
      expect(store.currentStep).toBe(1);
    });

    it('advances to step 2 when profile completed but org not', async () => {
      const store = useOnboardingStore();
      apiCallMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: makeStatus({
            onboarding: {
              schoolId: 'school-1',
              profileCompleted: true,
              organizationCompleted: false,
              schoolCompleted: false,
              ownerCompleted: false,
              completedAt: null,
              activatedAt: null,
            },
          }),
        },
      });
      await store.loadStatus();
      expect(store.currentStep).toBe(2);
    });

    it('advances to step 3 when org completed but school not', async () => {
      const store = useOnboardingStore();
      apiCallMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: makeStatus({
            onboarding: {
              schoolId: 'school-1',
              profileCompleted: true,
              organizationCompleted: true,
              schoolCompleted: false,
              ownerCompleted: false,
              completedAt: null,
              activatedAt: null,
            },
          }),
        },
      });
      await store.loadStatus();
      expect(store.currentStep).toBe(3);
    });

    it('advances to step 4 when school completed but owner not', async () => {
      const store = useOnboardingStore();
      apiCallMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: makeStatus({
            onboarding: {
              schoolId: 'school-1',
              profileCompleted: true,
              organizationCompleted: true,
              schoolCompleted: true,
              ownerCompleted: false,
              completedAt: null,
              activatedAt: null,
            },
          }),
        },
      });
      await store.loadStatus();
      expect(store.currentStep).toBe(4);
    });

    it('stays on step 4 when all steps complete (shows Complete Setup button)', async () => {
      const store = useOnboardingStore();
      apiCallMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: makeStatus({
            onboarding: {
              schoolId: 'school-1',
              profileCompleted: true,
              organizationCompleted: true,
              schoolCompleted: true,
              ownerCompleted: true,
              completedAt: null,
              activatedAt: null,
            },
          }),
        },
      });
      await store.loadStatus();
      expect(store.currentStep).toBe(4);
      expect(store.isOnboardingComplete).toBe(true);
    });
  });

  describe('isOnboardingComplete', () => {
    it('returns false when status is null', () => {
      const store = useOnboardingStore();
      expect(store.isOnboardingComplete).toBe(false);
    });

    it('returns false when some steps are incomplete', async () => {
      const store = useOnboardingStore();
      apiCallMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: makeStatus({
            onboarding: {
              schoolId: 'school-1',
              profileCompleted: true,
              organizationCompleted: false,
              schoolCompleted: false,
              ownerCompleted: false,
              completedAt: null,
              activatedAt: null,
            },
          }),
        },
      });
      await store.loadStatus();
      expect(store.isOnboardingComplete).toBe(false);
    });

    it('returns true only when all four steps are complete', async () => {
      const store = useOnboardingStore();
      apiCallMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: makeStatus({
            onboarding: {
              schoolId: 'school-1',
              profileCompleted: true,
              organizationCompleted: true,
              schoolCompleted: true,
              ownerCompleted: true,
              completedAt: null,
              activatedAt: null,
            },
          }),
        },
      });
      await store.loadStatus();
      expect(store.isOnboardingComplete).toBe(true);
    });
  });

  describe('isActivated', () => {
    it('returns false when activatedAt is null', async () => {
      const store = useOnboardingStore();
      apiCallMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: makeStatus({
            onboarding: {
              schoolId: 'school-1',
              profileCompleted: true,
              organizationCompleted: true,
              schoolCompleted: true,
              ownerCompleted: true,
              completedAt: null,
              activatedAt: null,
            },
          }),
        },
      });
      await store.loadStatus();
      expect(store.isActivated).toBe(false);
    });

    it('returns true when activatedAt is set', async () => {
      const store = useOnboardingStore();
      apiCallMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: makeStatus({
            onboarding: {
              schoolId: 'school-1',
              profileCompleted: true,
              organizationCompleted: true,
              schoolCompleted: true,
              ownerCompleted: true,
              completedAt: '2026-01-01T00:00:00Z',
              activatedAt: '2026-01-02T00:00:00Z',
            },
            school: {
              id: 'school-1',
              name: 'Test School',
              slug: 'test-school',
              status: 'ACTIVE',
              paymentStatus: 'PENDING_KYC',
              organizationId: 'org-1',
            },
          }),
        },
      });
      await store.loadStatus();
      expect(store.isActivated).toBe(true);
    });
  });

  describe('saveProfile', () => {
    it('calls POST /onboarding/profile with correct payload', async () => {
      const store = useOnboardingStore();
      apiCallMock.mockResolvedValueOnce({ data: { success: true } });
      apiCallMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: makeStatus({
            onboarding: {
              schoolId: 'school-1',
              profileCompleted: true,
              organizationCompleted: false,
              schoolCompleted: false,
              ownerCompleted: false,
              completedAt: null,
              activatedAt: null,
            },
          }),
        },
      });

      await store.saveProfile({ fullName: 'John Doe', phone: '08012345678' });

      expect(apiCallMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
        method: 'POST',
        url: '/onboarding/profile',
        data: expect.objectContaining({
          fullName: 'John Doe',
          phone: '08012345678',
        }),
      }));
    });

    it('does not mark completion on network failure', async () => {
      const store = useOnboardingStore();
      apiCallMock.mockRejectedValueOnce(new Error('Network error'));

      await expect(store.saveProfile({ fullName: 'John Doe' })).rejects.toThrow('Network error');

      // Step 1 should NOT be in completedSteps after a failure
      expect(store.completedSteps).not.toContain(1);
      expect(store.error).toBe('Connection problem');
      expect(store.errorCategory).toBe('NETWORK_ERROR');
    });

    it('prevents duplicate step completion via Set deduplication', async () => {
      const store = useOnboardingStore();
      apiCallMock.mockResolvedValue({ data: { success: true } });

      // Call saveProfile twice rapidly
      await Promise.all([
        store.saveProfile({ fullName: 'John Doe', phone: '08012345678' }),
        store.saveProfile({ fullName: 'John Doe', phone: '08012345678' }),
      ]);

      // Step 1 should appear only once
      expect(store.completedSteps.filter((s) => s === 1)).toHaveLength(1);
    });
  });

  describe('createOrganization', () => {
    it('calls POST /onboarding/organization with name', async () => {
      const store = useOnboardingStore();
      apiCallMock.mockResolvedValueOnce({ data: { success: true } });
      apiCallMock.mockResolvedValueOnce({
        data: { success: true, data: makeStatus() },
      });

      await store.createOrganization('Test Org');

      expect(apiCallMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
        method: 'POST',
        url: '/onboarding/organization',
        data: { name: 'Test Org' },
      }));
    });
  });

  describe('createSchool', () => {
    it('calls POST /onboarding/school with school data', async () => {
      const store = useOnboardingStore();
      apiCallMock.mockResolvedValueOnce({ data: { success: true } });
      apiCallMock.mockResolvedValueOnce({
        data: { success: true, data: makeStatus() },
      });

      await store.createSchool({
        name: 'Test School',
        address: '123 Street',
        state: 'Lagos',
        lga: 'Ikeja',
        country: 'Nigeria',
        schoolType: 'MIXED',
        academicCalendar: { start: '2024' },
      });

      expect(apiCallMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
        method: 'POST',
        url: '/onboarding/school',
        data: expect.objectContaining({ name: 'Test School' }),
      }));
    });
  });

  describe('saveOwnerInfo', () => {
    it('calls POST /onboarding/owner-info with phone and designation', async () => {
      const store = useOnboardingStore();
      apiCallMock.mockResolvedValueOnce({ data: { success: true } });
      apiCallMock.mockResolvedValueOnce({
        data: { success: true, data: makeStatus() },
      });

      await store.saveOwnerInfo({ phone: '08012345678', designation: 'Owner' });

      expect(apiCallMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
        method: 'POST',
        url: '/onboarding/owner-info',
        data: { phone: '08012345678', designation: 'Owner' },
      }));
    });
  });

  describe('completeOnboarding', () => {
    it('calls POST /onboarding/complete', async () => {
      const store = useOnboardingStore();
      apiCallMock.mockResolvedValueOnce({
        data: { success: true, data: { school: { status: 'ACTIVE' }, activated: true } },
      });
      apiCallMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: makeStatus({
            school: {
              id: 'school-1',
              name: 'Test School',
              slug: 'test-school',
              status: 'ACTIVE',
              paymentStatus: 'PENDING_KYC',
              organizationId: 'org-1',
            },
            onboarding: {
              schoolId: 'school-1',
              profileCompleted: true,
              organizationCompleted: true,
              schoolCompleted: true,
              ownerCompleted: true,
              completedAt: '2026-01-01T00:00:00Z',
              activatedAt: '2026-01-02T00:00:00Z',
            },
          }),
        },
      });

      const result = await store.completeOnboarding();

      expect(apiCallMock).toHaveBeenCalledWith(expect.objectContaining({
        method: 'POST',
        url: '/onboarding/complete',
      }));
      expect(result.activated).toBe(true);
    });

    it('sets error on failure and does not redirect', async () => {
      const store = useOnboardingStore();
      // Simulate a real backend 400 response with a user-friendly message
      apiCallMock.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { error: 'Onboarding checklist incomplete' },
        },
      });

      await expect(store.completeOnboarding()).rejects.toThrow('Onboarding checklist incomplete');

      expect(store.error).toBe('Onboarding checklist incomplete');
      expect(store.errorCategory).toBe('VALIDATION_ERROR');
      expect(store.isActivated).toBe(false);
    });

    it('does not mark activated on network failure', async () => {
      const store = useOnboardingStore();
      // Simulate a network-level failure (no response received)
      apiCallMock.mockRejectedValueOnce(new Error('Network error'));

      await expect(store.completeOnboarding()).rejects.toThrow('Network error');

      // Without a successful response, isActivated should remain false
      // (unless it was already true from a previous loadStatus)
      expect(store.isActivated).toBe(false);
      expect(store.errorCategory).toBe('NETWORK_ERROR');
    });
  });

  // NOTE: KYC methods (getKycStatus, submitKyc, resubmitKyc, getKycDocuments,
  // getKycHistory) have been moved to financialActivationStore as part of the
  // Phase 8.4 store consolidation. They are no longer tested here. See
  // financialActivationStore.spec.ts for KYC coverage.

  describe('setStep / goToNextStep / goToPreviousStep', () => {
    it('setStep updates currentStep', () => {
      const store = useOnboardingStore();
      store.setStep(3);
      expect(store.currentStep).toBe(3);
    });

    it('goToNextStep increments when below 4', () => {
      const store = useOnboardingStore();
      store.setStep(2);
      store.goToNextStep();
      expect(store.currentStep).toBe(3);
    });

    it('goToNextStep does not exceed 4', () => {
      const store = useOnboardingStore();
      store.setStep(4);
      store.goToNextStep();
      expect(store.currentStep).toBe(4);
    });

    it('goToPreviousStep decrements when above 1', () => {
      const store = useOnboardingStore();
      store.setStep(3);
      store.goToPreviousStep();
      expect(store.currentStep).toBe(2);
    });

    it('goToPreviousStep does not drop below 1', () => {
      const store = useOnboardingStore();
      store.setStep(1);
      store.goToPreviousStep();
      expect(store.currentStep).toBe(1);
    });
  });

  describe('reset', () => {
    it('clears all state', async () => {
      const store = useOnboardingStore();
      apiCallMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: makeStatus({
            onboarding: {
              schoolId: 'school-1',
              profileCompleted: true,
              organizationCompleted: true,
              schoolCompleted: true,
              ownerCompleted: true,
              completedAt: null,
              activatedAt: null,
            },
          }),
        },
      });
      await store.loadStatus();
      expect(store.status).not.toBeNull();

      store.reset();
      expect(store.status).toBeNull();
      expect(store.currentStep).toBe(1);
      expect(store.completedSteps).toEqual([]);
      expect(store.error).toBeNull();
      expect(store.errorCategory).toBeNull();
    });
  });
});
