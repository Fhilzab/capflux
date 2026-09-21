/**
 * Demo onboarding gates spec (sandbox onboarding-contract fix).
 *
 * Uses the REAL onboardingStore + REAL financialActivationStore + REAL
 * useModuleLock with only the HTTP layer mocked. The mocked payloads are
 * byte-equivalent to the live demo endpoint responses, proving the demo
 * school resolves to ACTIVE / requiresSetup=false / no KYC lock — and that
 * the legacy shape (missing school_status) genuinely fails, so the test is
 * not vacuous.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

/** Live GET /api/onboarding/status demo response (backend/routes/onboarding.ts). */
const DEMO_ONBOARDING_DATA = {
  has_school: true,
  has_profile: true,
  has_organization: true,
  school_id: 'demo-school',
  organization_id: 'demo-org',
  status: 'ACTIVE',
  school_status: 'ACTIVE',
  school_name: 'Demo School',
  school_slug: 'demo-school',
  payment_status: 'READY',
  profile_completed: true,
  organization_completed: true,
  school_completed: true,
  owner_completed: true,
  requires_setup: false,
  requires_kyc: false,
  requires_settlement: false,
  business_type: 'PRIVATE_SCHOOL',
  cac_number: null,
  tax_identification_number: null,
};

/** Live GET /api/kyc/status demo response (backend/routes/kyc.ts, post-886743c). */
const DEMO_KYC_DATA = {
  kyc: {
    id: 'demo-kyc',
    status: 'VERIFIED',
    submitted_at: null,
    reviewed_at: null,
    reviewed_by: null,
    rejection_reason: null,
    bvn_last4: null,
    bvn_masked: null,
    bvn_verification_status: null,
    nin_last4: null,
    nin_verification_status: null,
    verification_provider: null,
    official_email: null,
    official_phone: null,
    cac_registration_number: null,
    cac_document_mime_type: null,
    cac_document_uploaded_at: null,
    cac_document_status: null,
    identity_document_type: null,
    identity_match_states: null,
    verification_reference: null,
  },
  schoolStatus: 'ACTIVE',
  paymentStatus: 'READY',
  businessType: null,
};

const httpMock = vi.hoisted(() => vi.fn());

vi.mock('@/shared/services/api/client', () => ({
  apiClient: {
    http: httpMock,
  },
}));

import { useOnboardingStore } from '@/stores/onboardingStore';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';
import { useModuleLock } from '@/composables/useModuleLock';

const GateProbe = defineComponent({
  setup() {
    return useModuleLock();
  },
  template: '<div></div>',
});

function mockHttpFor(onboardingData: unknown) {
  httpMock.mockImplementation(async ({ url }: { url: string }) => {
    if (url === '/onboarding/status') return { data: { success: true, data: onboardingData } };
    if (url === '/kyc/status') return { data: { success: true, data: DEMO_KYC_DATA } };
    return { data: { success: true, data: null } };
  });
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  mockHttpFor(DEMO_ONBOARDING_DATA);
});

describe('demo onboarding normalization (real store path)', () => {
  it('recognizes the demo school as ACTIVE with requiresSetup false', async () => {
    const store = useOnboardingStore();
    await store.loadStatus();
    expect(store.status?.school?.status).toBe('ACTIVE');
    expect(store.requiresSetup).toBe(false);
    expect(store.isOperational).toBe(true);
    expect(store.paymentStatus).toBe('READY');
    expect(store.completedSteps).toEqual([1, 2, 3, 4]);
  });

  it('fails against the legacy shape missing school_status (proves the test is not vacuous)', async () => {
    const { school_status: _omit, ...legacy } = DEMO_ONBOARDING_DATA;
    void _omit;
    mockHttpFor(legacy);
    const store = useOnboardingStore();
    await store.loadStatus();
    expect(store.status?.school?.status).toBe('PENDING_SETUP');
    expect(store.requiresSetup).toBe(true);
  });
});

describe('demo module-lock gates end to end (real stores, no store mocks)', () => {
  it('shows neither Setup nor KYC blocker for the demo school', async () => {
    const onboarding = useOnboardingStore();
    const financial = useFinancialActivationStore();
    await onboarding.loadStatus();
    await financial.loadKycStatus();
    expect(financial.kycVerified).toBe(true);

    const wrapper = mount(GateProbe);
    // Setup-returned refs are unwrapped on the public instance.
    const flags = wrapper.vm as unknown as Record<string, boolean>;
    expect(flags.requiresSetup).toBe(false);
    expect(flags.requiresKyc).toBe(false);
    expect(flags.paymentsLocked).toBe(false);
    expect(flags.requiresSettlement).toBe(false);
    wrapper.unmount();
  });
});
