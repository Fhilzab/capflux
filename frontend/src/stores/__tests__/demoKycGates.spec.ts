/**
 * Demo KYC normalization + gate spec (sandbox KYC contract fix).
 *
 * Uses the REAL financialActivationStore + REAL normalizeKycStatus path with
 * only the HTTP layer mocked, proving the fixed demo payload:
 *  - normalizes to kyc.status 'VERIFIED' (canonical) with paymentStatus 'READY'
 *  - resolves kycVerified === true
 *  - carries no fabricated identity evidence (no '0000', no MATCH, no timestamps)
 * and that useModuleLock flags (requiresKyc / paymentsLocked) clear for the
 * verified demo persona, so no KYC lock overlay is shown.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

/** Fixed demo payload — mirrors backend/routes/kyc.ts demo bypass exactly. */
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

import { useFinancialActivationStore } from '@/stores/financialActivationStore';

const onboardingStoreMock = vi.hoisted(() => ({
  paymentStatus: 'READY' as string | null,
  requiresSetup: false,
  loading: false,
  statusLoading: false,
  statusLoaded: true,
  status: { school: { paymentStatus: 'READY' } } as unknown,
  loadStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/stores/onboardingStore', () => ({
  useOnboardingStore: () => onboardingStoreMock,
}));

import { useModuleLock } from '@/composables/useModuleLock';

const GateProbe = defineComponent({
  setup() {
    return useModuleLock();
  },
  template: '<div></div>',
});

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  httpMock.mockResolvedValue({ data: { success: true, data: DEMO_KYC_DATA } });
});

describe('demo KYC normalization (real store path)', () => {
  it("normalizes the demo payload to canonical status 'VERIFIED'", async () => {
    const store = useFinancialActivationStore();
    await store.loadKycStatus();
    expect(store.kycStatus?.kyc?.status).toBe('VERIFIED');
    expect(store.kycState).toBe('VERIFIED');
  });

  it('resolves kycVerified and the READY payment status', async () => {
    const store = useFinancialActivationStore();
    await store.loadKycStatus();
    expect(store.kycVerified).toBe(true);
    expect(store.paymentStatus).toBe('READY');
  });

  it('carries no fabricated identity evidence after normalization', async () => {
    const store = useFinancialActivationStore();
    await store.loadKycStatus();
    const serialized = JSON.stringify(store.kycStatus);
    expect(serialized).not.toContain('0000');
    expect(serialized).not.toContain('MATCH');
    expect(serialized).not.toContain('APPROVED');
    expect(store.kycStatus?.kyc?.bvnLast4).toBeNull();
    expect(store.kycStatus?.kyc?.ninLast4).toBeNull();
    // Absent timestamps normalize to null/undefined via the existing path — never invented.
    expect(store.kycStatus?.kyc?.submittedAt == null).toBe(true);
    expect(store.kycStatus?.kyc?.reviewedAt == null).toBe(true);
  });
});

describe('demo KYC module-lock gates', () => {
  it('requiresKyc is false and no KYC lock applies to the verified demo persona', async () => {
    const store = useFinancialActivationStore();
    await store.loadKycStatus();

    // Wire the really-normalized values into the gate inputs (same shape the
    // mocked stores expose in useModuleLock.spec.ts).
    const wrapper = mount(GateProbe, {
      global: {
        plugins: [],
      },
    });
    // Note: setup-returned refs are unwrapped on the public instance.
    const flags = wrapper.vm as unknown as Record<string, boolean>;
    expect(flags.kycVerified).toBe(true);
    expect(flags.requiresKyc).toBe(false);
    expect(flags.paymentsLocked).toBe(false);
    expect(flags.requiresSetup).toBe(false);
    wrapper.unmount();
  });
});
