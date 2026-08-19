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
    financialStoreMock.kycVerified = false;
    financialStoreMock.kycState = 'NOT_SUBMITTED';
    financialStoreMock.settlementVerified = false;
    financialStoreMock.kycStatus = null;
    financialStoreMock.readiness = null;
    financialStoreMock.loading = false;
  });

  // ── Capability checks ──────────────────────────────────────────

  it('detects all requirements incomplete when nothing is verified', async () => {
    const wrapper = mount(TestComponent);
    await nextTick();

    expect(wrapper.vm.requiresSetup).toBe(false);
    expect(wrapper.vm.requiresKyc).toBe(true);
    expect(wrapper.vm.requiresSettlement).toBe(true);
    expect(wrapper.vm.paymentsLocked).toBe(true);
  });

  it('reports setup required when school is PENDING_SETUP', async () => {
    onboardingStoreMock.requiresSetup = true;
    const wrapper = mount(TestComponent);
    await nextTick();

    expect(wrapper.vm.requiresSetup).toBe(true);
    expect(wrapper.vm.requiresKyc).toBe(true);
  });

  it('reports KYC complete when kycVerified is true', async () => {
    financialStoreMock.kycVerified = true;
    financialStoreMock.kycState = 'VERIFIED';
    const wrapper = mount(TestComponent);
    await nextTick();

    expect(wrapper.vm.requiresKyc).toBe(false);
    expect(wrapper.vm.kycState).toBe('VERIFIED');
  });

  it('reports settlement complete when settlementVerified is true', async () => {
    financialStoreMock.kycVerified = true;
    financialStoreMock.settlementVerified = true;
    const wrapper = mount(TestComponent);
    await nextTick();

    expect(wrapper.vm.requiresSettlement).toBe(false);
  });

  it('reports payments unlocked when paymentStatus is READY', async () => {
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
});
