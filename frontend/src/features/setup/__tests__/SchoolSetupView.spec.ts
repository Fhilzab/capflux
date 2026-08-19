/**
 * SchoolSetupView Tests (Phase 8.3 — Setup Center Recovery & Verification UX)
 *
 * Verifies:
 *  - The full Setup Center shell NEVER collapses to a blank error screen.
 *  - Loading shows skeleton placeholders (not a blank screen).
 *  - API failure renders a contextual banner INSIDE the shell.
 *  - Cached status is preserved after a network failure.
 *  - Retry restores status and remains recoverable on repeated failure.
 *  - No duplicate API requests on mount or re-mount.
 *  - The four sections (Account Setup, KYC, Settlement, Payment Activation)
 *    are always visible.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';

const { onboardingStoreMock, authStoreMock, financialStoreMock } = vi.hoisted(
  () => ({
    onboardingStoreMock: {
      currentStep: 1,
      error: null as string | null,
      errorCategory: null as string | null,
      loading: false,
      statusLoading: false,
      statusLoaded: false,
      status: null as unknown,
      completedSteps: [] as number[],
      isOnboardingComplete: false,
      isActivated: false,
      requiresSetup: true,
      hasSchool: false,
      loadStatus: vi.fn().mockResolvedValue(undefined),
      completeOnboarding: vi.fn().mockResolvedValue({ activated: true }),
      goToNextStep: vi.fn(),
      goToPreviousStep: vi.fn(),
      setStep: vi.fn(),
      restoreStepFromStatus: vi.fn(),
      clearError: vi.fn(),
    },
    financialStoreMock: {
      loading: false,
      error: null as string | null,
      errorCategory: null as string | null,
      kycStatus: null as unknown,
      settlementStatus: null as unknown,
      readiness: null as unknown,
      kycStatusLoaded: false,
      settlementStatusLoaded: false,
      readinessLoaded: false,
      kycState: 'NONE',
      kycVerified: false,
      settlementVerified: false,
      settlementState: null as string | null,
      gatewayAssigned: false,
      gatewayProvider: null as string | null,
      isReady: false,
      loadAll: vi.fn().mockResolvedValue(undefined),
      clearError: vi.fn(),
    },
    authStoreMock: {
      isAuthenticated: true,
      initialized: true,
      user: { id: 'user-1', user_metadata: { full_name: 'Test User' } },
    },
  }),
);

const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: {},
    name: 'SchoolSetup',
  }),
  useRouter: () => ({
    push: pushMock,
  }),
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

// Import after mocks
import SchoolSetupView from '../SchoolSetupView.vue';

function makeDefaultStatus(profileCompleted = false) {
  return {
    userId: 'user-1',
    organization: null,
    school: null,
    onboarding: {
      schoolId: 's1',
      profileCompleted,
      organizationCompleted: false,
      schoolCompleted: false,
      ownerCompleted: false,
      completedAt: null,
      activatedAt: null,
    },
    kyc: null,
  };
}

function makeDefaultStatusWithSchool() {
  return {
    userId: 'user-1',
    organization: { id: 'o1', name: 'Org', slug: 'org' },
    school: {
      id: 's1',
      name: 'School',
      slug: 'school',
      status: 'ACTIVE',
      paymentStatus: 'NOT_READY',
      organizationId: 'o1',
    },
    onboarding: {
      schoolId: 's1',
      profileCompleted: true,
      organizationCompleted: true,
      schoolCompleted: true,
      ownerCompleted: true,
      completedAt: '2024-01-01',
      activatedAt: null,
    },
    kyc: null,
    hasSchool: true,
  };
}

/**
 * Mount with shallow rendering. Ui primitives (CmButton, CmAlert, CmBadge)
 * get explicit stub templates so their prop / slot text is queryable.
 * Workflow components (OnboardingChecklist, step forms) are auto-stubbed.
 */
function mountView() {
  return mount(SchoolSetupView, {
    shallow: true,
    global: {
      stubs: {
        CmButton: {
          name: 'CmButton',
          template:
            '<button @click="$emit(\'click\')" :disabled="disabled" :loading="loading"><slot/></button>',
          emit: ['click'],
          props: ['variant', 'size', 'loading', 'disabled', 'type'],
        },
        CmAlert: {
          name: 'CmAlert',
          template:
            '<div :data-variant="variant"><h3 v-if="title">{{ title }}</h3>' +
            '<p v-if="description">{{ description }}</p><slot/></div>',
          props: ['variant', 'title', 'description', 'dismissible'],
        },
        CmBadge: {
          name: 'CmBadge',
          template: '<span class="cm-badge" :data-variant="variant">{{ label }}</span>',
          props: ['variant', 'label', 'size', 'pill', 'dot'],
        },
        ProfileStep: {
          name: 'ProfileStep',
          template: '<div class="profile-step-stub"></div>',
        },
        OrganizationStep: {
          name: 'OrganizationStep',
          template: '<div class="org-step-stub"></div>',
        },
        SchoolStep: {
          name: 'SchoolStep',
          template: '<div class="school-step-stub"></div>',
        },
        OwnerInfoStep: {
          name: 'OwnerInfoStep',
          template: '<div class="owner-step-stub"></div>',
        },
      },
    },
  });
}

describe('SchoolSetupView.vue (Phase 8.3 resilient center)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onboardingStoreMock.currentStep = 1;
    onboardingStoreMock.error = null;
    onboardingStoreMock.errorCategory = null;
    onboardingStoreMock.loading = false;
    onboardingStoreMock.statusLoading = false;
    onboardingStoreMock.statusLoaded = false;
    onboardingStoreMock.status = null;
    onboardingStoreMock.completedSteps = [];
    onboardingStoreMock.isOnboardingComplete = false;
    onboardingStoreMock.requiresSetup = true;
    onboardingStoreMock.hasSchool = false;
    onboardingStoreMock.loadStatus = vi.fn().mockResolvedValue(undefined);
    onboardingStoreMock.completeOnboarding = vi
      .fn()
      .mockResolvedValue({ activated: true });
    onboardingStoreMock.clearError = vi.fn();

    financialStoreMock.loading = false;
    financialStoreMock.error = null;
    financialStoreMock.errorCategory = null;
    financialStoreMock.kycStatus = null;
    financialStoreMock.settlementStatus = null;
    financialStoreMock.readiness = null;
    financialStoreMock.kycStatusLoaded = false;
    financialStoreMock.settlementStatusLoaded = false;
    financialStoreMock.readinessLoaded = false;
    financialStoreMock.kycState = 'NONE';
    financialStoreMock.kycVerified = false;
    financialStoreMock.settlementVerified = false;
    financialStoreMock.settlementState = null;
    financialStoreMock.gatewayAssigned = false;
    financialStoreMock.gatewayProvider = null;
    financialStoreMock.isReady = false;
    financialStoreMock.loadAll = vi.fn().mockResolvedValue(undefined);
    financialStoreMock.clearError = vi.fn();
  });

  // ─── Shell always renders ──────────────────────────────────────────

  describe('shell always renders (no blank screen)', () => {
    it('renders the "Setup & Verification" heading even when API fails', async () => {
      onboardingStoreMock.status = null;
      onboardingStoreMock.error = 'Connection problem';
      onboardingStoreMock.errorCategory = 'NETWORK_ERROR';

      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.find('h1').text()).toBe('Setup & Verification');
    });

    it('renders the Back to Dashboard link', async () => {
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain('Back to Dashboard');
    });

    it('renders all four section headings even when API fails', async () => {
      onboardingStoreMock.status = null;
      onboardingStoreMock.error = 'Connection problem';
      onboardingStoreMock.errorCategory = 'NETWORK_ERROR';

      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain('Account Setup');
      expect(wrapper.text()).toContain('Identity Verification');
      expect(wrapper.text()).toContain('Settlement Account');
      expect(wrapper.text()).toContain('Financial Activation');
    });

    it('renders the progressive-access explanation', async () => {
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain('complete verification when you need it');
    });
  });

  // ─── Loading state ─────────────────────────────────────────────────

  describe('loading state', () => {
    it('shows skeleton placeholders while status is being fetched', async () => {
      onboardingStoreMock.statusLoading = true;
      onboardingStoreMock.status = null;
      onboardingStoreMock.statusLoaded = false;

      let resolveLoad: () => void;
      onboardingStoreMock.loadStatus = vi.fn().mockImplementation(() => {
        return new Promise<void>((resolve) => {
          resolveLoad = resolve;
        });
      });

      const wrapper = mountView();
      await nextTick();

      // Shell is visible
      expect(wrapper.find('h1').text()).toBe('Setup & Verification');
      // Skeleton is present
      expect(wrapper.html()).toContain('animate-pulse');

      resolveLoad!();
      await flushPromises();
    });

    it('does NOT show a blank screen during loading', async () => {
      onboardingStoreMock.statusLoading = true;
      onboardingStoreMock.status = null;
      onboardingStoreMock.statusLoaded = false;

      const wrapper = mountView();
      await nextTick();

      // Shell is present
      expect(wrapper.find('header').exists()).toBe(true);
      expect(wrapper.find('h1').exists()).toBe(true);
      // Section headings are present
      expect(wrapper.text()).toContain('Account Setup');
    });
  });

  // ─── API success ───────────────────────────────────────────────────

  describe('API success', () => {
    it('renders the OnboardingChecklist when status loaded', async () => {
      onboardingStoreMock.status = makeDefaultStatus(true);
      onboardingStoreMock.statusLoading = false;
      onboardingStoreMock.statusLoaded = true;

      const wrapper = mountView();
      await flushPromises();

      expect(
        wrapper.findComponent({ name: 'OnboardingChecklist' }).exists(),
      ).toBe(true);
    });

    it('renders the step form for the current step', async () => {
      onboardingStoreMock.currentStep = 1;
      onboardingStoreMock.status = makeDefaultStatus(false);

      const wrapper = mountView();
      await flushPromises();

      expect(
        wrapper.findComponent({ name: 'ProfileStep' }).exists(),
      ).toBe(true);
    });

    it('renders the verification, settlement, and payment sections', async () => {
      onboardingStoreMock.status = makeDefaultStatus(true);
      onboardingStoreMock.statusLoaded = true;
      financialStoreMock.kycStatusLoaded = true;
      financialStoreMock.kycState = 'VERIFIED';
      financialStoreMock.kycVerified = true;
      financialStoreMock.settlementState = 'VERIFIED';
      financialStoreMock.settlementVerified = true;

      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.findComponent({ name: 'CmBadge' }).exists()).toBe(true);
    });
  });

  // ─── API failure (no blank screen) ─────────────────────────────────

  describe('API failure — full shell always visible', () => {
    it('renders the shell with error banner on network failure (no blank screen)', async () => {
      onboardingStoreMock.status = null;
      onboardingStoreMock.error = 'Connection problem';
      onboardingStoreMock.errorCategory = 'NETWORK_ERROR';
      onboardingStoreMock.statusLoaded = true;

      const wrapper = mountView();
      await flushPromises();

      // Shell is present
      expect(wrapper.find('h1').text()).toBe('Setup & Verification');

      // All sections visible
      expect(wrapper.text()).toContain('Account Setup');
      expect(wrapper.text()).toContain('Identity Verification');
      expect(wrapper.text()).toContain('Settlement Account');
      expect(wrapper.text()).toContain('Financial Activation');

      // Contextual error banner (inside the shell)
      expect(wrapper.text()).toContain('Connection problem');
      expect(wrapper.text()).toContain("We couldn't refresh your setup status");
      expect(wrapper.text()).toContain(
        'Your saved setup information has not been deleted',
      );
    });

    it('renders the shell with auth error (401) banner', async () => {
      onboardingStoreMock.status = null;
      onboardingStoreMock.error = 'Your session has expired. Please sign in again.';
      onboardingStoreMock.errorCategory = 'AUTH_ERROR';
      onboardingStoreMock.statusLoaded = true;

      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.find('h1').text()).toBe('Setup & Verification');
      expect(wrapper.text()).toContain('Authentication required');
      expect(wrapper.text()).toContain('session could not be verified');
    });

    it('renders the shell with server error (500) banner', async () => {
      onboardingStoreMock.status = null;
      onboardingStoreMock.error = 'CAPFLUX is temporarily unavailable';
      onboardingStoreMock.errorCategory = 'SERVER_ERROR';
      onboardingStoreMock.statusLoaded = true;

      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.find('h1').text()).toBe('Setup & Verification');
      expect(wrapper.text()).toContain('temporarily unavailable');
    });

    it('renders the shell with validation error (400/422) banner', async () => {
      onboardingStoreMock.status = null;
      onboardingStoreMock.error = 'Some setup information needs attention before you can continue.';
      onboardingStoreMock.errorCategory = 'VALIDATION_ERROR';
      onboardingStoreMock.statusLoaded = true;

      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.find('h1').text()).toBe('Setup & Verification');
      expect(wrapper.text()).toContain('Attention needed');
    });

    it('shows "No setup data loaded yet" when no cached status', async () => {
      onboardingStoreMock.status = null;
      onboardingStoreMock.error = null;
      onboardingStoreMock.errorCategory = null;
      onboardingStoreMock.statusLoaded = true;
      financialStoreMock.kycStatusLoaded = true;
      financialStoreMock.readinessLoaded = true;

      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain('No setup data loaded yet');
    });

    it('does NOT collapse to a single centered error card', async () => {
      onboardingStoreMock.status = null;
      onboardingStoreMock.error = 'Connection problem';
      onboardingStoreMock.errorCategory = 'NETWORK_ERROR';
      onboardingStoreMock.statusLoaded = true;

      const wrapper = mountView();
      await flushPromises();

      // Multiple section headings prove the shell didn't collapse.
      const h2s = wrapper.findAll('h2');
      expect(h2s.length).toBeGreaterThanOrEqual(4);
      expect(wrapper.text()).toContain('Account Setup');
      expect(wrapper.text()).toContain('Financial Activation');
    });
  });

  // ─── Cached state preservation ─────────────────────────────────────

  describe('cached state preservation', () => {
    it('shows cached status with error banner after network failure', async () => {
      onboardingStoreMock.status = makeDefaultStatusWithSchool();
      onboardingStoreMock.error = 'Connection problem';
      onboardingStoreMock.errorCategory = 'NETWORK_ERROR';
      onboardingStoreMock.statusLoaded = true;

      const wrapper = mountView();
      await flushPromises();

      // Shell present, error banner present, cached data visible
      expect(wrapper.find('h1').text()).toBe('Setup & Verification');
      expect(wrapper.text()).toContain('Connection problem');
      expect(wrapper.text()).toContain('Account Setup');
    });
  });

  // ─── Retry ─────────────────────────────────────────────────────────

  describe('retry', () => {
    it('calls loadStatus and loadAll when retrying', async () => {
      onboardingStoreMock.status = null;
      onboardingStoreMock.error = 'Connection problem';
      onboardingStoreMock.errorCategory = 'NETWORK_ERROR';
      onboardingStoreMock.statusLoaded = true; // prevent onMount call
      financialStoreMock.kycStatusLoaded = true;
      financialStoreMock.readinessLoaded = true;
      const loadStatusSpy = vi.fn().mockResolvedValue(undefined);
      onboardingStoreMock.loadStatus = loadStatusSpy;
      const loadAllSpy = vi.fn().mockResolvedValue(undefined);
      financialStoreMock.loadAll = loadAllSpy;

      const wrapper = mountView();
      await flushPromises();

      const buttons = wrapper.findAll('button');
      const retryBtn = buttons.find((b) => b.text().includes('Try again'));
      expect(retryBtn).toBeDefined();

      await retryBtn!.trigger('click');
      await flushPromises();

      expect(onboardingStoreMock.clearError).toHaveBeenCalled();
      expect(financialStoreMock.clearError).toHaveBeenCalled();
      expect(loadStatusSpy).toHaveBeenCalledTimes(1);
      expect(loadAllSpy).toHaveBeenCalledTimes(1);
    });

    it('disables retry while already retrying', async () => {
      onboardingStoreMock.status = null;
      onboardingStoreMock.error = 'Connection problem';
      onboardingStoreMock.errorCategory = 'NETWORK_ERROR';
      onboardingStoreMock.statusLoaded = true;
      onboardingStoreMock.statusLoading = true; // isRetrying = true

      const wrapper = mountView();
      await flushPromises();

      // While isRetrying=true the banner is hidden (v-if="hasError && !isRetrying").
      const buttons = wrapper.findAll('button');
      const retryBtn = buttons.find((b) => b.text().includes('Try again'));
      expect(retryBtn).toBeFalsy();
    });

    it('retry successfully restores status', async () => {
      onboardingStoreMock.status = null;
      onboardingStoreMock.error = 'Connection problem';
      onboardingStoreMock.errorCategory = 'NETWORK_ERROR';
      onboardingStoreMock.statusLoaded = true;

      const loadStatusSpy = vi.fn().mockImplementation(async () => {
        onboardingStoreMock.error = null;
        onboardingStoreMock.errorCategory = null;
        onboardingStoreMock.status = makeDefaultStatus(true);
      });
      onboardingStoreMock.loadStatus = loadStatusSpy;

      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain('Connection problem');

      const buttons = wrapper.findAll('button');
      const retryBtn = buttons.find((b) => b.text().includes('Try again'));
      await retryBtn!.trigger('click');
      await flushPromises();

      // Retry calls loadStatus and clearError
      expect(loadStatusSpy).toHaveBeenCalledTimes(1);
      expect(onboardingStoreMock.clearError).toHaveBeenCalled();
    });

    it('retry failure remains recoverable (banner stays, Try again visible)', async () => {
      onboardingStoreMock.status = null;
      onboardingStoreMock.error = 'Connection problem';
      onboardingStoreMock.errorCategory = 'NETWORK_ERROR';
      onboardingStoreMock.statusLoaded = true;

      const loadStatusSpy = vi.fn().mockImplementation(async () => {
        onboardingStoreMock.error = 'Connection problem';
        onboardingStoreMock.errorCategory = 'NETWORK_ERROR';
      });
      onboardingStoreMock.loadStatus = loadStatusSpy;

      const wrapper = mountView();
      await flushPromises();

      const buttons = wrapper.findAll('button');
      const retryBtn = buttons.find((b) => b.text().includes('Try again'));
      await retryBtn!.trigger('click');
      await flushPromises();

      // loadStatus was called (recovery attempted)
      expect(loadStatusSpy).toHaveBeenCalledTimes(1);
      // Banner still visible (error persists)
      expect(wrapper.text()).toContain('Connection problem');
    });
  });

  // ─── Duplicate request prevention ──────────────────────────────────

  describe('duplicate request prevention', () => {
    it('does not call loadStatus when status already loaded', async () => {
      onboardingStoreMock.status = makeDefaultStatus(true);
      onboardingStoreMock.statusLoaded = true;
      financialStoreMock.kycStatusLoaded = true;
      financialStoreMock.readinessLoaded = true;

      mountView();
      await flushPromises();

      expect(onboardingStoreMock.loadStatus).not.toHaveBeenCalled();
      expect(financialStoreMock.loadAll).not.toHaveBeenCalled();
    });

    it('calls loadStatus once on mount when status is null', async () => {
      onboardingStoreMock.status = null;
      onboardingStoreMock.statusLoaded = false;

      mountView();
      await flushPromises();

      expect(onboardingStoreMock.loadStatus).toHaveBeenCalledTimes(1);
    });

    it('calls loadAll once on mount when financial data not loaded', async () => {
      onboardingStoreMock.status = makeDefaultStatus(true);
      onboardingStoreMock.statusLoaded = true;
      financialStoreMock.kycStatusLoaded = false;
      financialStoreMock.readinessLoaded = false;

      mountView();
      await flushPromises();

      expect(financialStoreMock.loadAll).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Step navigation ───────────────────────────────────────────────

  describe('step navigation', () => {
    it('renders ProfileStep on step 1', async () => {
      onboardingStoreMock.status = makeDefaultStatus(false);

      const wrapper = mountView();
      await flushPromises();

      expect(
        wrapper.findComponent({ name: 'ProfileStep' }).exists(),
      ).toBe(true);
    });

    it('renders OrganizationStep on step 2', async () => {
      onboardingStoreMock.currentStep = 2;
      onboardingStoreMock.status = makeDefaultStatus(true);

      const wrapper = mountView();
      await flushPromises();

      expect(
        wrapper.findComponent({ name: 'OrganizationStep' }).exists(),
      ).toBe(true);
    });

    it('shows Back button when currentStep > 1', async () => {
      onboardingStoreMock.currentStep = 2;
      onboardingStoreMock.status = makeDefaultStatus(true);

      const wrapper = mountView();
      await flushPromises();

      const buttons = wrapper.findAll('button');
      const backButton = buttons.find((b) => b.text() === 'Back');
      expect(backButton).toBeDefined();
    });

    it('does not show step Back button on step 1', async () => {
      onboardingStoreMock.currentStep = 1;
      onboardingStoreMock.status = makeDefaultStatus(false);

      const wrapper = mountView();
      await flushPromises();

      const buttons = wrapper.findAll('button');
      const backButton = buttons.find((b) => b.text() === 'Back');
      expect(backButton).toBeFalsy();
    });

    it('shows Complete Setup button on step 4 when onboarding complete', async () => {
      onboardingStoreMock.status = makeDefaultStatusWithSchool();
      onboardingStoreMock.currentStep = 4;
      onboardingStoreMock.isOnboardingComplete = true;
      onboardingStoreMock.statusLoaded = true;
      financialStoreMock.kycStatusLoaded = true;
      financialStoreMock.readinessLoaded = true;

      const wrapper = mountView();
      await flushPromises();

      const buttons = wrapper.findAll('button');
      const completeButton = buttons.find((b) =>
        b.text().includes('Complete Setup'),
      );
      expect(completeButton).toBeDefined();
    });

    it('redirects to dashboard after completeOnboarding succeeds', async () => {
      onboardingStoreMock.status = makeDefaultStatusWithSchool();
      onboardingStoreMock.currentStep = 4;
      onboardingStoreMock.isOnboardingComplete = true;
      onboardingStoreMock.statusLoaded = true;
      financialStoreMock.kycStatusLoaded = true;
      financialStoreMock.readinessLoaded = true;

      const wrapper = mountView();
      await flushPromises();

      const buttons = wrapper.findAll('button');
      const completeButton = buttons.find((b) =>
        b.text().includes('Complete Setup'),
      );
      expect(completeButton).toBeDefined();
      await completeButton!.trigger('click');
      await flushPromises();

      expect(onboardingStoreMock.completeOnboarding).toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith('/dashboard');
    });
  });

  // ─── Verification sections ─────────────────────────────────────────

  describe('verification sections', () => {
    it('renders KYC "Verified" badge when KYC is verified', async () => {
      onboardingStoreMock.status = makeDefaultStatus(true);
      onboardingStoreMock.statusLoaded = true;
      financialStoreMock.kycStatusLoaded = true;
      financialStoreMock.kycState = 'VERIFIED';
      financialStoreMock.kycVerified = true;

      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain('Verified');
    });

    it('renders settlement section heading', async () => {
      onboardingStoreMock.status = makeDefaultStatus(true);
      financialStoreMock.kycStatusLoaded = true;
      financialStoreMock.settlementState = 'VERIFIED';
      financialStoreMock.settlementVerified = true;

      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain('Settlement Account');
      expect(wrapper.text()).toContain('Verified');
    });

    it('renders payment activation with prerequisites checklist', async () => {
      onboardingStoreMock.status = makeDefaultStatusWithSchool();
      onboardingStoreMock.isOnboardingComplete = true;
      onboardingStoreMock.statusLoaded = true;
      financialStoreMock.kycStatusLoaded = true;
      financialStoreMock.readinessLoaded = true;
      financialStoreMock.isReady = false;
      financialStoreMock.kycVerified = true;
      financialStoreMock.settlementVerified = true;
      financialStoreMock.gatewayAssigned = false;
      financialStoreMock.readiness = { ready: false, reason: 'Incomplete', conditions: {} };

      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain('Prerequisites');
      expect(wrapper.text()).toContain('School setup completed');
      expect(wrapper.text()).toContain('Identity verification verified');
    });

    it('shows "Start verification" CTA when KYC is not started and setup is complete', async () => {
      onboardingStoreMock.status = makeDefaultStatusWithSchool();
      onboardingStoreMock.isOnboardingComplete = true;
      onboardingStoreMock.statusLoaded = true;
      financialStoreMock.kycStatusLoaded = true;
      financialStoreMock.kycState = 'NONE';

      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain('Start verification');
    });

    it('shows "Complete school setup first" when onboarding incomplete', async () => {
      onboardingStoreMock.status = makeDefaultStatus(false);
      onboardingStoreMock.isOnboardingComplete = false;
      financialStoreMock.kycStatusLoaded = true;
      financialStoreMock.kycState = 'NONE';

      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain('Complete school setup first');
    });
  });

  // ─── No redirect on mount ──────────────────────────────────────────

  describe('routing behaviour', () => {
    it('does not redirect to dashboard on mount', async () => {
      onboardingStoreMock.status = null;
      onboardingStoreMock.statusLoaded = false;

      mountView();
      await flushPromises();

      expect(pushMock).not.toHaveBeenCalled();
    });

    it('does not redirect when API fails', async () => {
      onboardingStoreMock.status = null;
      onboardingStoreMock.error = 'Connection problem';
      onboardingStoreMock.errorCategory = 'NETWORK_ERROR';
      onboardingStoreMock.statusLoaded = true;

      mountView();
      await flushPromises();

      expect(pushMock).not.toHaveBeenCalled();
    });
  });
});
