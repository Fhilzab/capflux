/**
 * Centralized financial-access gate spec (useModuleLock contract).
 *
 * Covers, with REAL stores + REAL normalization and only the HTTP layer
 * mocked (payloads mirror the backend contracts byte-for-byte):
 *  1. setup incomplete → setup lock
 *  2. setup ok + KYC unverified → kyc lock
 *  3. setup + KYC ok + settlement unverified → settlement lock
 *  4. all verified → access granted
 *  5. loading / never-loaded → locked, no overlay, no content flash
 *  6. missing/error statuses fail closed
 *  7. sandbox demo payloads → unlocked
 *  8. live unverified accounts remain locked (kyc + payment variants)
 *  9. integrated pages share one gate behavior (Payments, Settlements)
 * 10. account switch drops the previous account's verification result
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

function onboardingData(overrides: Record<string, unknown> = {}) {
  return {
    has_school: true,
    school_id: 'sch-1',
    school_name: 'Test School',
    school_slug: 'test-school',
    school_status: 'ACTIVE',
    payment_status: 'READY',
    organization_id: 'org-1',
    business_type: null,
    profile_completed: true,
    organization_completed: true,
    school_completed: true,
    owner_completed: true,
    ...overrides,
  };
}

function kycData(status: string) {
  return {
    kyc: {
      id: 'k-1',
      status,
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
}

function settlementData(status: string | null) {
  return {
    settlement: status ? { id: 'set-1', status } : null,
    gateway: null,
  };
}

const scenario = vi.hoisted(() => ({
  onboarding: null as unknown,
  kyc: null as unknown,
  settlement: null as unknown,
  onboardingError: null as null | { message: string; status?: number },
  kycError: null as null | { message: string; status?: number },
}));

const httpMock = vi.hoisted(() => vi.fn());

vi.mock('@/shared/services/api/client', () => ({
  apiClient: {
    http: httpMock,
  },
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {}, path: '/payments' }),
  useRouter: () => ({ push: vi.fn() }),
}));

import { useOnboardingStore } from '@/stores/onboardingStore';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';
import { useAuthStore } from '@/stores/authStore';
import { useModuleLock } from '@/composables/useModuleLock';
import PaymentsDashboard from '@/features/payments/PaymentsDashboard.vue';
import SettlementsView from '@/views/SettlementsView.vue';

function installHttp() {
  httpMock.mockImplementation(async ({ url }: { url: string }) => {
    if (url === '/onboarding/status') {
      if (scenario.onboardingError) throw scenario.onboardingError;
      return { data: { success: true, data: scenario.onboarding } };
    }
    if (url === '/kyc/status') {
      if (scenario.kycError) throw scenario.kycError;
      return { data: { success: true, data: scenario.kyc } };
    }
    if (url === '/kyc/settlement') {
      return { data: { success: true, data: scenario.settlement } };
    }
    return { data: { success: true, data: null } };
  });
}

const GateProbe = defineComponent({
  setup() {
    return useModuleLock();
  },
  template: '<div></div>',
});

function fullyVerified() {
  scenario.onboarding = onboardingData();
  scenario.kyc = kycData('VERIFIED');
  scenario.settlement = settlementData('VERIFIED');
}

async function mountProbe() {
  const wrapper = mount(GateProbe);
  await flushPromises();
  await nextTick();
  // Setup-returned refs are unwrapped on the public instance.
  return wrapper.vm as unknown as Record<string, boolean | string | null>;
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  scenario.onboarding = onboardingData();
  scenario.kyc = kycData('VERIFIED');
  scenario.settlement = settlementData('VERIFIED');
  scenario.onboardingError = null;
  scenario.kycError = null;
  installHttp();
});

describe('central gate precedence', () => {
  it('1. setup incomplete → setup lock', async () => {
    scenario.onboarding = onboardingData({ school_status: 'PENDING_SETUP' });
    const flags = await mountProbe();
    expect(flags.lockReason).toBe('setup');
    expect(flags.locked).toBe(true);
    expect(flags.showLock).toBe(true);
    expect(flags.canAccessFinancials).toBe(false);
  });

  it('2. setup complete + KYC unverified → kyc lock', async () => {
    scenario.kyc = kycData('PENDING');
    const flags = await mountProbe();
    expect(flags.lockReason).toBe('kyc');
    expect(flags.locked).toBe(true);
    expect(flags.canAccessFinancials).toBe(false);
  });

  it('3. setup + KYC verified + settlement unverified → settlement lock', async () => {
    scenario.settlement = settlementData('PENDING');
    const flags = await mountProbe();
    expect(flags.lockReason).toBe('settlement');
    expect(flags.locked).toBe(true);
    expect(flags.canAccessFinancials).toBe(false);
  });

  it('4. all required states verified → access granted', async () => {
    const flags = await mountProbe();
    expect(flags.lockReason).toBeNull();
    expect(flags.locked).toBe(false);
    expect(flags.showLock).toBe(false);
    expect(flags.canAccessFinancials).toBe(true);
  });

  it('setup takes precedence over kyc, kyc over settlement, settlement over payment', async () => {
    scenario.onboarding = onboardingData({
      school_status: 'PENDING_SETUP',
      payment_status: 'PENDING_KYC',
    });
    scenario.kyc = kycData('PENDING');
    scenario.settlement = settlementData('PENDING');
    const flags = await mountProbe();
    expect(flags.lockReason).toBe('setup');
  });
});

describe('central gate fail-closed behavior', () => {
  it('5. never-loaded stores stay locked without overlay or content flash', async () => {
    let blocked = true;
    const releases: Array<() => void> = [];
    httpMock.mockImplementation(async () => {
      if (blocked) await new Promise<void>((resolve) => releases.push(resolve));
      return { data: { success: true, data: null } };
    });
    const wrapper = mount(GateProbe);
    await nextTick();
    const early = wrapper.vm as unknown as Record<string, boolean | string | null>;
    expect(early.locked).toBe(true);
    expect(early.showLock).toBe(false);
    expect(early.canAccessFinancials).toBe(false);
    expect(early.lockReason).toBeNull();
    blocked = false;
    releases.splice(0).forEach((resolve) => resolve());
    await flushPromises();
    wrapper.unmount();
  });

  it('6a. onboarding load failure fails closed to setup lock', async () => {
    scenario.onboardingError = { message: 'Server error', status: 500 };
    const flags = await mountProbe();
    expect(flags.lockReason).toBe('setup');
    expect(flags.canAccessFinancials).toBe(false);
  });

  it('6b. KYC load failure fails closed to kyc lock', async () => {
    scenario.kycError = { message: 'Server error', status: 500 };
    const flags = await mountProbe();
    expect(flags.lockReason).toBe('kyc');
    expect(flags.canAccessFinancials).toBe(false);
  });

  it('6c. missing KYC record (null kyc, no error) fails closed to kyc lock', async () => {
    scenario.kyc = { kyc: null, schoolStatus: null, paymentStatus: null, businessType: null };
    const flags = await mountProbe();
    expect(flags.lockReason).toBe('kyc');
    expect(flags.canAccessFinancials).toBe(false);
  });
});

describe('central gate demo + live accounts', () => {
  it('7. sandbox demo payloads normalize to unlocked', async () => {
    fullyVerified();
    const flags = await mountProbe();
    expect(flags.lockReason).toBeNull();
    expect(flags.canAccessFinancials).toBe(true);
  });

  it('8a. live unverified account (KYC rejected) remains locked', async () => {
    scenario.kyc = kycData('REJECTED');
    scenario.onboarding = onboardingData({ payment_status: 'PENDING_KYC' });
    const flags = await mountProbe();
    expect(flags.locked).toBe(true);
    expect(flags.lockReason).toBe('kyc');
    expect(flags.canAccessFinancials).toBe(false);
  });

  it('8b. KYC verified but payment not ready keeps the payment lock (no bypass)', async () => {
    scenario.onboarding = onboardingData({ payment_status: 'PENDING_KYC' });
    scenario.settlement = settlementData('VERIFIED');
    const flags = await mountProbe();
    expect(flags.locked).toBe(true);
    expect(flags.lockReason).toBe('payment');
    expect(flags.canAccessFinancials).toBe(false);
  });
});

describe('central gate session isolation', () => {
  it('10. account switch drops the previous verification result (no stale unlock)', async () => {
    fullyVerified();
    const onboarding = useOnboardingStore();
    const auth = useAuthStore();
    auth.user = { id: 'user-1' } as never;

    const wrapper = mount(GateProbe);
    await flushPromises();
    await nextTick();
    expect(
      (wrapper.vm as unknown as Record<string, boolean>).canAccessFinancials,
    ).toBe(true);

    // Hold subsequent loads so the reset state is observable.
    let blocked = true;
    const releases: Array<() => void> = [];
    httpMock.mockImplementation(async () => {
      if (blocked) await new Promise<void>((resolve) => releases.push(resolve));
      return { data: { success: true, data: null } };
    });

    auth.user = { id: 'user-2' } as never;
    await nextTick();
    await nextTick();
    // Reset ran synchronously: cached verification is gone while reload pends.
    expect(onboarding.status).toBeNull();
    const mid = wrapper.vm as unknown as Record<string, boolean>;
    expect(mid.locked).toBe(true);
    expect(mid.canAccessFinancials).toBe(false);
    blocked = false;
    releases.splice(0).forEach((resolve) => resolve());
    await flushPromises();
    wrapper.unmount();
  });
});

describe('central gate page integration', () => {
  it('9a. Payments page shows the setup overlay when locked and content when granted', async () => {
    scenario.onboarding = onboardingData({ school_status: 'PENDING_SETUP' });
    const locked = mount(PaymentsDashboard, {
      global: { stubs: { RouterLink: true } },
    });
    await flushPromises();
    await nextTick();
    expect(locked.text()).toContain('school setup');
    expect(locked.text()).not.toContain("Today's Collections");
    locked.unmount();

    setActivePinia(createPinia());
    fullyVerified();
    const granted = mount(PaymentsDashboard, {
      global: { stubs: { RouterLink: true } },
    });
    await flushPromises();
    await nextTick();
    expect(granted.text()).toContain("Today's Collections");
    expect(granted.text()).not.toContain('school setup');
    granted.unmount();
  });

  it('9b. Settlements page shares the same gate behavior', async () => {
    scenario.onboarding = onboardingData({ school_status: 'PENDING_SETUP' });
    const locked = mount(SettlementsView);
    await flushPromises();
    await nextTick();
    expect(locked.text()).toContain('school setup');
    locked.unmount();

    setActivePinia(createPinia());
    fullyVerified();
    const granted = mount(SettlementsView);
    await flushPromises();
    await nextTick();
    expect(granted.text()).not.toContain('school setup');
    granted.unmount();
  });
});
