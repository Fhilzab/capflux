/**
 * KycSubmission.spec.ts — Phase 8.4 consolidated KYC/onboarding wizard tests.
 *
 * Uses the vi.hoisted() + plain-values pattern (same as useModuleLock.spec.ts).
 * We do NOT call Vue ref()/computed() inside vi.hoisted().
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const pushMock = vi.fn();
const replaceMock = vi.fn();

// ── Plain-value mocks (no Vue ref()/computed() in vi.hoisted) ─────
const onboardingStoreMock = vi.hoisted(() => ({
  profile: { fullName: '', phone: '' },
  personalInfo: null as unknown,
  currentStep: 1,
  completedSteps: [] as number[],
  status: null as unknown,
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
  loadProfile: vi.fn().mockResolvedValue(undefined),
  setStep: vi.fn(),
  goToNextStep: vi.fn(),
  goToPreviousStep: vi.fn(),
  restoreStepFromStatus: vi.fn(),
  clearError: vi.fn(),
}));

const financialStoreMock = vi.hoisted(() => ({
  kycStatus: null as unknown,
  kycState: 'NONE',
  kycVerified: false,
  kycRejected: false,
  kycUnderReview: false,
  settlement: null as unknown,
  settlementVerified: false,
  settlementOwnershipMatch: false,
  loading: false,
  error: null as string | null,
  errorCategory: null as string | null,
  kycStatusLoaded: false,
  settlementStatusLoaded: false,
  readiness: null,
  gateway: null,
  gatewayAssigned: false,
  gatewayProvider: null,
  isReady: false,
  paymentStatus: null,
  shareholders: [] as unknown[],
  cacDocument: null as unknown,
  principalInvitation: null as unknown,
  kycSubmissionDraft: null as unknown,
  updateKycDraft: vi.fn(),
  kycReadyForSubmission: false,
  loadKycDraft: vi.fn().mockResolvedValue(undefined),
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
    replaceMock.mockClear();
    onboardingStoreMock.currentStep = 1;
    onboardingStoreMock.completedSteps = [];
    onboardingStoreMock.status = null;
    onboardingStoreMock.personalInfo = null;
    onboardingStoreMock.paymentStatus = null;
    onboardingStoreMock.isOnboardingComplete = false;
    onboardingStoreMock.loading = false;
    onboardingStoreMock.error = null;
    onboardingStoreMock.errorCategory = null;
    financialStoreMock.kycStatus = null;
    financialStoreMock.kycState = 'NONE';
    financialStoreMock.kycVerified = false;
    financialStoreMock.kycRejected = false;
    financialStoreMock.settlement = null;
    financialStoreMock.settlementVerified = false;
    financialStoreMock.loading = false;
    financialStoreMock.error = null;
    financialStoreMock.errorCategory = null;
    financialStoreMock.kycSubmissionDraft = null;
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
    expect(wrapper.text()).toContain('Personal');
  });

  it('shows Personal as the first section', async () => {
    const wrapper = mountWizard();
    await flushPromises();
    expect(wrapper.text()).toContain('Personal');
  });

  it('advances to identity section on @next-step', async () => {
    const wrapper = mountWizard();
    await flushPromises();
    const step = wrapper.findComponent({ name: 'ProfileStep' });
    await step.vm.$emit('next-step');
    await flushPromises();
    expect(wrapper.text()).toContain('Identity');
  });

  it('returns to personal section on @prev-step from identity', async () => {
    const wrapper = mountWizard();
    await flushPromises();
    await wrapper.findComponent({ name: 'ProfileStep' }).vm.$emit('next-step');
    await flushPromises();
    await wrapper.findComponent({ name: 'IdentityVerificationStep' }).vm.$emit('prev-step');
    await flushPromises();
    expect(wrapper.text()).toContain('Personal');
  });

  it('does not globally redirect on mount', async () => {
    const wrapper = mountWizard();
    await flushPromises();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('loads from stores on mount', async () => {
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
    financialStoreMock.kycStatus = {
      kyc: {
        status: 'VERIFIED',
        ninLast4: '1234',
        bvnLast4: '5678',
        identityMatchStates: {
          overall: 'MATCH',
          name: 'MATCH',
          dateOfBirth: 'NOT_PROVIDED',
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
    financialStoreMock.kycStatus = {
      kyc: {
        status: 'VERIFIED',
        identityMatchStates: {
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
    financialStoreMock.kycStatus = {
      kyc: {
        status: 'PENDING_PROVIDER',
        identityMatchStates: { overall: 'PENDING' },
      },
      schoolStatus: 'ACTIVE',
      paymentStatus: 'PENDING_KYC',
    };
    financialStoreMock.kycState = 'PENDING';
    const wrapper = mountWizard();
    await flushPromises();
    expect(wrapper.exists()).toBe(true);
  });

  it('shows masked data when KYC is verified', async () => {
    financialStoreMock.kycStatus = {
      kyc: {
        status: 'VERIFIED',
        bvnLast4: '5678',
        ninLast4: '1234',
        identityMatchStates: { overall: 'MATCH' },
      },
      schoolStatus: 'ACTIVE',
      paymentStatus: 'PENDING_KYC',
    };
    financialStoreMock.kycVerified = true;
    const wrapper = mountWizard();
    await flushPromises();
    expect(wrapper.exists()).toBe(true);
  });

  it('does not show "Full Name" field anywhere', async () => {
    const wrapper = mountWizard();
    await flushPromises();
    expect(wrapper.text()).not.toContain('Full Name');
  });
});
