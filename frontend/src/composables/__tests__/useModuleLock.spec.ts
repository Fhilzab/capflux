import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';

const onboardingStoreMock = vi.hoisted(() => ({
  paymentStatus: 'NOT_READY' as string | null,
  requiresSetup: false,
  loading: false,
  statusLoading: false,
  statusLoaded: false,
  status: null as unknown,
  loadStatus: vi.fn().mockResolvedValue(undefined),
}));

const financialStoreMock = vi.hoisted(() => ({
  kycVerified: false,
  kycState: 'NOT_SUBMITTED' as string,
  settlementVerified: false,
  kycStatus: null as unknown,
  readiness: null as unknown,
  kycStatusLoaded: false,
  readinessLoaded: false,
  loading: false,
  loadAll: vi.fn().mockResolvedValue(undefined),
  loadKycStatus: vi.fn().mockResolvedValue(undefined),
  loadReadiness: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/stores/onboardingStore', () => ({
  useOnboardingStore: () => onboardingStoreMock,
}));

vi.mock('@/stores/financialActivationStore', () => ({
  useFinancialActivationStore: () => financialStoreMock,
}));

import { useModuleLock } from '@/composables/useModuleLock';

const TestComponent = defineComponent({
  setup() {
    return useModuleLock();
  },
  template: '<div></div>',
});

describe('useModuleLock (Phase 8.2 progressive access)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onboardingStoreMock.paymentStatus = 'NOT_READY';
    onboardingStoreMock.requiresSetup = false;
    onboardingStoreMock.loading = false;
    onboardingStoreMock.statusLoading = false;
    onboardingStoreMock.statusLoaded = false;
    onboardingStoreMock.status = null;
    onboardingStoreMock.error = null;
    (onboardingStoreMock as any).errorCategory = null;
    financialStoreMock.kycVerified = false;
    financialStoreMock.kycState = 'NOT_SUBMITTED';
    financialStoreMock.settlementVerified = false;
    financialStoreMock.kycStatus = null;
    financialStoreMock.settlementStatus = null as any;
    financialStoreMock.readiness = null as any;
    financialStoreMock.kycStatusLoaded = false;
    financialStoreMock.settlementStatusLoaded = false;
    financialStoreMock.readinessLoaded = false;
    financialStoreMock.error = null;
    (financialStoreMock as any).errorCategory = null;
    financialStoreMock.loading = false;
  });

  // ── Capability checks ──────────────────────────────────────────

  it('detects all requirements incomplete when nothing is verified', async () => {
    // Known not-verified state: loaded but status/kyc present and not verified
    onboardingStoreMock.statusLoaded = true;
    onboardingStoreMock.status = { school: { status: 'ACTIVE', paymentStatus: 'NOT_READY' } } as any;
    onboardingStoreMock.paymentStatus = 'NOT_READY';
    financialStoreMock.kycStatusLoaded = true;
    (financialStoreMock as any).kycStatus = { kyc: { status: 'PENDING' } };
    financialStoreMock.kycVerified = false;
    financialStoreMock.settlementStatusLoaded = true;
    (financialStoreMock as any).settlementStatus = { settlement: { status: 'PENDING' } };
    financialStoreMock.settlementVerified = false;
    const wrapper = mount(TestComponent);
    await nextTick();

    expect(wrapper.vm.requiresSetup).toBe(false);
    expect(wrapper.vm.requiresKyc).toBe(true);
    expect(wrapper.vm.requiresSettlement).toBe(true);
    expect(wrapper.vm.paymentsLocked).toBe(true);
  });

  it('reports setup required when school is PENDING_SETUP', async () => {
    onboardingStoreMock.statusLoaded = true;
    onboardingStoreMock.status = { school: { status: 'PENDING_SETUP', paymentStatus: 'NOT_READY' } } as any;
    onboardingStoreMock.requiresSetup = true;
    financialStoreMock.kycStatusLoaded = true;
    (financialStoreMock as any).kycStatus = { kyc: { status: 'PENDING' } };
    financialStoreMock.kycVerified = false;
    const wrapper = mount(TestComponent);
    await nextTick();

    expect(wrapper.vm.requiresSetup).toBe(true);
    expect(wrapper.vm.requiresKyc).toBe(true);
  });

  it('reports KYC complete when kycVerified is true', async () => {
    financialStoreMock.kycStatusLoaded = true;
    (financialStoreMock as any).kycStatus = { kyc: { status: 'VERIFIED' } };
    financialStoreMock.kycVerified = true;
    financialStoreMock.kycState = 'VERIFIED';
    const wrapper = mount(TestComponent);
    await nextTick();

    expect(wrapper.vm.requiresKyc).toBe(false);
    expect(wrapper.vm.kycState).toBe('VERIFIED');
  });

  it('reports settlement complete when settlementVerified is true', async () => {
    financialStoreMock.kycStatusLoaded = true;
    (financialStoreMock as any).kycStatus = { kyc: { status: 'VERIFIED' } };
    financialStoreMock.kycVerified = true;
    financialStoreMock.settlementStatusLoaded = true;
    (financialStoreMock as any).settlementStatus = { settlement: { status: 'VERIFIED' } };
    financialStoreMock.settlementVerified = true;
    const wrapper = mount(TestComponent);
    await nextTick();

    expect(wrapper.vm.requiresSettlement).toBe(false);
  });

  it('reports payments unlocked when paymentStatus is READY', async () => {
    onboardingStoreMock.statusLoaded = true;
    onboardingStoreMock.status = { school: { status: 'ACTIVE', paymentStatus: 'READY' } } as any;
    onboardingStoreMock.paymentStatus = 'READY';
    const wrapper = mount(TestComponent);
    await nextTick();

    expect(wrapper.vm.paymentsLocked).toBe(false);
    expect(wrapper.vm.paymentReady).toBe(true);
  });

  it('reports loading when either store is loading', async () => {
    onboardingStoreMock.loading = true;
    let wrapper = mount(TestComponent);
    await nextTick();
    expect(wrapper.vm.loading).toBe(true);

    onboardingStoreMock.loading = false;
    financialStoreMock.loading = true;
    wrapper = mount(TestComponent);
    await nextTick();
    expect(wrapper.vm.loading).toBe(true);
  });

  it('does not represent UNKNOWN KYC as requiresKyc when status not loaded', async () => {
    // Never loaded, no status — should NOT show KYC lock (avoid false KYC required)
    onboardingStoreMock.statusLoaded = false;
    financialStoreMock.kycStatusLoaded = false;
    financialStoreMock.kycVerified = false;
    const wrapper = mount(TestComponent);
    await nextTick();
    expect(wrapper.vm.requiresKyc).toBe(false);
    expect(wrapper.vm.isKycStatusUnknown).toBe(false);
  });

  it('treats network/auth failure as unknown, not as not-verified', async () => {
    financialStoreMock.kycStatusLoaded = true;
    (financialStoreMock as any).kycStatus = null;
    (financialStoreMock as any).error = 'Network error';
    (financialStoreMock as any).errorCategory = 'NETWORK_ERROR';
    const wrapper = mount(TestComponent);
    await nextTick();
    expect(wrapper.vm.requiresKyc).toBe(false);
    expect(wrapper.vm.isKycStatusUnknown).toBe(true);
    expect(wrapper.vm.hasStatusError).toBe(true);
  });

  it('requiresKyc only when KYC status is known and not verified', async () => {
    financialStoreMock.kycStatusLoaded = true;
    (financialStoreMock as any).kycStatus = { kyc: { status: 'PENDING' } };
    financialStoreMock.kycVerified = false;
    (financialStoreMock as any).error = null;
    const wrapper = mount(TestComponent);
    await nextTick();
    expect(wrapper.vm.requiresKyc).toBe(true);
  });

  it('paymentsLocked is false when status unknown (do not misrepresent)', async () => {
    onboardingStoreMock.statusLoaded = false;
    onboardingStoreMock.paymentStatus = 'NOT_READY';
    onboardingStoreMock.status = null;
    const wrapper = mount(TestComponent);
    await nextTick();
    expect(wrapper.vm.paymentsLocked).toBe(false);
  });
});
