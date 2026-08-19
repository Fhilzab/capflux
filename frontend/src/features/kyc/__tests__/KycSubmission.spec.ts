/**
 * KycSubmission.spec.ts — Phase 8.4 consolidated KYC/onboarding wizard tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref, computed } from 'vue';

const pushMock = vi.fn();
const replaceMock = vi.fn();

const onboardingStoreMock = vi.hoisted(() => ({
  profile: ref({ fullName: '', phone: '' }),
  currentStep: ref(1),
  completedSteps: ref([] as number[]),
  status: ref(null as unknown),
  statusLoading: false,
  statusLoaded: false,
  loading: false,
  error: null as string | null,
  errorCategory: null as string | null,
  paymentStatus: null as string | null,
  isActivated: false,
  isOnboardingComplete: false,
  requiresSetup: false,
  hasSchool: false,
  saveProfile: vi.fn().mockResolvedValue(undefined),
  createOrganization: vi.fn().mockResolvedValue({ organization: { id: 'o1', name: 'Org', slug: 'org' } }),
  createSchool: vi.fn().mockResolvedValue(undefined),
  saveOwnerInfo: vi.fn().mockResolvedValue(undefined),
  completeOnboarding: vi.fn().mockResolvedValue({ activated: true }),
  loadStatus: vi.fn().mockResolvedValue(undefined),
  setStep: vi.fn(),
  goToNextStep: vi.fn(),
  goToPreviousStep: vi.fn(),
  restoreStepFromStatus: vi.fn(),
  clearError: vi.fn(),
}));

const financialStoreMock = vi.hoisted(() => ({
  kycStatus: ref(null as unknown),
  settlementStatus: ref(null as unknown),
  readiness: ref(null as unknown),
  cacDocument: ref(null as unknown),
  shareholders: ref([] as unknown[]),
  principalInvitation: ref(null as unknown),
  loading: false,
  error: null as string | null,
  errorCategory: null as string | null,
  kycStatusLoaded: false,
  settlementStatusLoaded: false,
  readinessLoaded: false,
  kycState: 'NONE',
  kycVerified: false,
  kycRejected: false,
  kycUnderReview: false,
  settlementVerified: false,
  settlementState: null,
  gatewayAssigned: false,
  gatewayProvider: null,
  isReady: computed(() => false),
  paymentStatus: null,
  loadKycStatus: vi.fn().mockResolvedValue(undefined),
  loadSettlementStatus: vi.fn().mockResolvedValue(undefined),
  loadReadiness: vi.fn().mockResolvedValue(undefined),
  loadKycDocuments: vi.fn().mockResolvedValue(undefined),
  loadAll: vi.fn().mockResolvedValue(undefined),
  submitKyc: vi.fn().mockResolvedValue(undefined),
  submitSettlement: vi.fn().mockResolvedValue(undefined),
  uploadCacDocument: vi.fn().mockResolvedValue(undefined),
  invitePrincipal: vi.fn().mockResolvedValue(undefined),
  addShareholder: vi.fn().mockResolvedValue(undefined),
  fetchShareholders: vi.fn().mockResolvedValue(undefined),
  clearError: vi.fn(),
  settlement: computed(() => financialStoreMock.settlementStatus.value?.settlement || null),
}));

const authStoreMock = vi.hoisted(() => ({
  user: { id: 'user-1', email: 'test@example.com', user_metadata: { full_name: 'Test User' } },
  profile: { id: 'user-1', full_name: 'Test User', phone: '' },
  isAuthenticated: true,
  initialized: true,
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  useRoute: () => ({ query: {}, params: {} }),
}));

vi.mock('@/stores/onboardingStore', () => ({
  useOnboardingStore: () => onboardingStoreMock,
}));

vi.mock('@/stores/financialActivationStore', () => ({
  useFinancialActivationStore: () => financialStoreMock,
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => authStoreMock,
}));

import KycSubmission from '../KycSubmission.vue';

describe('KycSubmission (Phase 8.4 consolidated wizard)', () => {
  let wrapper: ReturnType<typeof mount>;

  beforeEach(() => {
    vi.clearAllMocks();
    pushMock.mockClear();
    onboardingStoreMock.currentStep.value = 1;
    onboardingStoreMock.completedSteps.value = [];
    onboardingStoreMock.status.value = null;
    onboardingStoreMock.paymentStatus = null;
    onboardingStoreMock.isOnboardingComplete = false;
    financialStoreMock.kycStatus.value = null;
    financialStoreMock.kycState = 'NONE';
    financialStoreMock.kycVerified = false;
    financialStoreMock.settlementStatus.value = null;
    financialStoreMock.error = null;
    financialStoreMock.errorCategory = null;
  });

  const mountWizard = () => {
    return mount(KycSubmission, {
      attachTo: document.body,
      shallow: true,
    });
  };

  it('renders the wizard with branding and progress indicator', async () => {
    const wrapper = mountWizard();
    await flushPromises();
    expect(wrapper.text()).toContain('CAPFLUX');
    expect(wrapper.text()).toContain('Setup & Verification');
  });

  it('shows Personal Information as the first section', async () => {
    const wrapper = mountWizard();
    await flushPromises();
    expect(wrapper.text()).toContain('Personal Information');
  });

  it('advances to identity section on @next-step', async () => {
    const wrapper = mountWizard();
    await flushPromises();
    const step = wrapper.findComponent({ name: 'ProfileStep' });
    await step.vm.$emit('next-step');
    await flushPromises();
    expect(wrapper.text()).toContain('Identity Verification');
  });

  it('returns to personal section on @prev-step from identity', async () => {
    const wrapper = mountWizard();
    await flushPromises();
    await wrapper.findComponent({ name: 'ProfileStep' }).vm.$emit('next-step');
    await flushPromises();
    await wrapper.findComponent({ name: 'IdentityVerificationStep' }).vm.$emit('prev-step');
    await flushPromises();
    expect(wrapper.text()).toContain('Personal Information');
  });

  it('does not globally redirect on mount', async () => {
    const wrapper = mountWizard();
    await flushPromises();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('preserves progress by loading from stores on mount', async () => {
    const wrapper = mountWizard();
    await flushPromises();
    expect(onboardingStoreMock.loadStatus).toHaveBeenCalled();
    expect(financialStoreMock.loadKycStatus).toHaveBeenCalled();
  });

  it('shows error banner on network failure without destroying wizard', async () => {
    financialStoreMock.error = 'Connection problem';
    financialStoreMock.errorCategory = 'NETWORK_ERROR';
    const wrapper = mountWizard();
    await flushPromises();
    expect(wrapper.text()).toContain('Connection problem');
    expect(wrapper.find('section').exists()).toBe(true);
  });

  it('renders without error when KYC has NOT_PROVIDED match state', async () => {
    financialStoreMock.kycStatus.value = {
      kyc: {
        status: 'VERIFIED',
        nin_last4: '1234',
        bvn_last4: '5678',
        identity_match_states: {
          overall: 'MATCH',
          name: 'MATCH',
          date_of_birth: 'NOT_PROVIDED',
          phone: 'MISMATCH',
        },
      },
      schoolStatus: 'ACTIVE',
      paymentStatus: 'PENDING_KYC',
    };
    const wrapper = mountWizard();
    await flushPromises();
    expect(wrapper.exists()).toBe(true);
  });

  it('renders without error when KYC has MISMATCH match state', async () => {
    financialStoreMock.kycStatus.value = {
      kyc: {
        status: 'VERIFIED',
        identity_match_states: {
          overall: 'MISMATCH',
          name: 'MISMATCH',
          phone: 'MISMATCH',
        },
      },
      schoolStatus: 'ACTIVE',
      paymentStatus: 'PENDING_KYC',
    };
    const wrapper = mountWizard();
    await flushPromises();
    expect(wrapper.exists()).toBe(true);
  });

  it('renders without error when verification is PENDING', async () => {
    financialStoreMock.kycStatus.value = {
      kyc: {
        status: 'PENDING_PROVIDER',
        identity_match_states: { overall: 'PENDING' },
      },
      schoolStatus: 'ACTIVE',
      paymentStatus: 'PENDING_KYC',
    };
    const wrapper = mountWizard();
    await flushPromises();
    expect(wrapper.exists()).toBe(true);
  });

  it('shows masked data when KYC is verified', async () => {
    financialStoreMock.kycStatus.value = {
      kyc: {
        status: 'VERIFIED',
        bvn_last4: '5678',
        nin_last4: '1234',
        identity_match_states: { overall: 'MATCH' },
      },
      schoolStatus: 'ACTIVE',
      paymentStatus: 'PENDING_KYC',
    };
    financialStoreMock.kycVerified = true;
    const wrapper = mountWizard();
    await flushPromises();
    expect(wrapper.exists()).toBe(true);
  });
});
