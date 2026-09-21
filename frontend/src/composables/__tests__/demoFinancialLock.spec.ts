/**
 * Demo financial-lock pipeline spec (sandbox demo overlay fix).
 *
 * Exercises REAL onboarding/financial/auth stores + REAL normalizers + REAL
 * useModuleLock with only the HTTP layer mocked. Payloads mirror the live
 * demo endpoint responses byte-for-byte, including the auxiliary endpoints
 * (/kyc/documents → null, /kyc/shareholders → []) whose 500s used to poison
 * the shared store error field and trip the centralized settlement gate.
 *
 *  1. demo ready pipeline → no lock (no setup/kyc/settlement/payment overlay)
 *  2. legacy documents-500 behavior → settlement lock (bug sensitivity proof)
 *  8. live → demo switch cannot reuse stale live lock state
 *  9. demo → live switch cannot carry demo readiness into the live account
 * 10. routed pages share the gate (Payments, Settlements mount checks)
 *
 * Scenarios 5/6/7 (live unverified + fail-closed) are covered in
 * useCentralGate.spec.ts against the same real path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

/** Live GET /api/onboarding/status demo response (post onboarding-contract fix). */
const DEMO_ONBOARDING = {
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

/** Live GET /api/kyc/status demo response (post-886743c). */
const DEMO_KYC = {
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

/** Live GET /api/kyc/settlement demo response (synthetic VERIFIED marker, no account). */
const DEMO_SETTLEMENT = {
  settlement: {
    id: 'demo-settlement',
    status: 'VERIFIED',
    bank_code: null,
    bank_name: null,
    account_number_last4: null,
    bvn_last4: null,
    account_name: null,
    ownership_match_status: null,
    account_verification_reference: null,
    rejection_reason: null,
    submitted_at: null,
    verified_at: null,
  },
  gateway: null,
};

/** Live unverified account payloads (control group). */
const LIVE_ONBOARDING = {
  ...DEMO_ONBOARDING,
  school_id: 'sch-live-1',
  school_status: 'ACTIVE',
  payment_status: 'PENDING_KYC',
};
const LIVE_KYC = {
  ...DEMO_KYC,
  kyc: { ...DEMO_KYC.kyc, id: 'k-live-1', status: 'PENDING' },
  paymentStatus: 'PENDING_KYC',
};

type Phase = 'demo' | 'live-unverified' | 'demo-documents-500';
const phase = vi.hoisted(() => ({ current: 'demo' as Phase }));

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
import { useModuleLock, resetGateIdentityForTests } from '@/composables/useModuleLock';
import PaymentsDashboard from '@/features/payments/PaymentsDashboard.vue';
import SettlementsView from '@/views/SettlementsView.vue';

function installHttp() {
  httpMock.mockImplementation(async ({ url }: { url: string }) => {
    const demo = phase.current !== 'live-unverified';
    if (url === '/onboarding/status') {
      return { data: { success: true, data: demo ? DEMO_ONBOARDING : LIVE_ONBOARDING } };
    }
    if (url === '/kyc/status') {
      return { data: { success: true, data: demo ? DEMO_KYC : LIVE_KYC } };
    }
    if (url === '/kyc/settlement') {
      return { data: { success: true, data: DEMO_SETTLEMENT } };
    }
    if (url === '/kyc/documents') {
      if (phase.current === 'demo-documents-500') {
        throw { message: 'permission denied for schema public', status: 500 };
      }
      return { data: { success: true, data: null } };
    }
    if (url === '/kyc/shareholders') {
      return { data: { success: true, data: [] } };
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

async function loadAll() {
  const onboarding = useOnboardingStore();
  const financial = useFinancialActivationStore();
  await onboarding.loadStatus();
  await financial.loadAll();
  await flushPromises();
}

async function mountProbe() {
  const wrapper = mount(GateProbe);
  await flushPromises();
  await nextTick();
  return {
    wrapper,
    flags: wrapper.vm as unknown as Record<string, boolean | string | null>,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  phase.current = 'demo';
  resetGateIdentityForTests();
  installHttp();
});

describe('demo pipeline → no lock', () => {
  it('1. demo ready pipeline grants access with no lock reason', async () => {
    await loadAll();
    const { wrapper, flags } = await mountProbe();
    expect(flags.lockReason).toBeNull();
    expect(flags.locked).toBe(false);
    expect(flags.showLock).toBe(false);
    expect(flags.canAccessFinancials).toBe(true);
    // Explicitly: none of the overlay variants apply (scenarios 2–4).
    expect(flags.requiresSetup).toBe(false);
    expect(flags.requiresKyc).toBe(false);
    expect(flags.requiresSettlement).toBe(false);
    expect(flags.paymentsLocked).toBe(false);
    wrapper.unmount();
  });

  it('2. legacy documents-500 behavior trips the settlement lock (sensitivity proof)', async () => {
    // Pre-fix shape: null settlement (tolerant 200) + a 500 that poisons the
    // shared store error field → fail-closed settlement-unknown lock.
    phase.current = 'demo-documents-500';
    httpMock.mockImplementation(async ({ url }: { url: string }) => {
      if (url === '/onboarding/status') return { data: { success: true, data: DEMO_ONBOARDING } };
      if (url === '/kyc/status') return { data: { success: true, data: DEMO_KYC } };
      if (url === '/kyc/settlement') {
        return { data: { success: true, data: { settlement: null, gateway: null } } };
      }
      if (url === '/kyc/documents') {
        throw { message: 'permission denied for schema public', status: 500 };
      }
      return { data: { success: true, data: url === '/kyc/shareholders' ? [] : null } };
    });
    await loadAll();
    const { wrapper, flags } = await mountProbe();
    expect(flags.lockReason).toBe('settlement');
    expect(flags.locked).toBe(true);
    expect(flags.showLock).toBe(true);
    expect(flags.canAccessFinancials).toBe(false);
    wrapper.unmount();
  });
});

describe('demo ↔ live session isolation', () => {
  it('8. live → demo switch cannot reuse stale live lock state', async () => {
    phase.current = 'live-unverified';
    const auth = useAuthStore();
    auth.user = { id: 'user-live' } as never;
    const probe = mount(GateProbe);
    await flushPromises();
    await nextTick();
    const lockedFlags = probe.vm as unknown as Record<string, boolean | string | null>;
    expect(lockedFlags.locked).toBe(true);
    expect(lockedFlags.lockReason).toBe('kyc');

    // Mid-session switch on the still-mounted page: guard resets + reloads.
    phase.current = 'demo';
    auth.user = { id: 'demo-bursar' } as never;
    await flushPromises();
    await nextTick();
    const flags = probe.vm as unknown as Record<string, boolean | string | null>;
    expect(flags.lockReason).toBeNull();
    expect(flags.canAccessFinancials).toBe(true);
    probe.unmount();
  });

  it('9. demo → live switch cannot carry demo readiness into the live account', async () => {
    const auth = useAuthStore();
    auth.user = { id: 'demo-bursar' } as never;
    const probe = mount(GateProbe);
    await flushPromises();
    await nextTick();
    const granted = probe.vm as unknown as Record<string, boolean | string | null>;
    expect(granted.canAccessFinancials).toBe(true);

    phase.current = 'live-unverified';
    auth.user = { id: 'user-live' } as never;
    await flushPromises();
    await nextTick();
    const flags = probe.vm as unknown as Record<string, boolean | string | null>;
    expect(flags.locked).toBe(true);
    expect(flags.lockReason).toBe('kyc');
    expect(flags.canAccessFinancials).toBe(false);
    probe.unmount();
  });

  it('8b. remount onto another account’s cached state drops it before evaluating', async () => {
    phase.current = 'live-unverified';
    const auth = useAuthStore();
    auth.user = { id: 'user-live' } as never;
    await loadAll();
    const stale = mount(GateProbe);
    await flushPromises();
    await nextTick();
    expect((stale.vm as unknown as Record<string, string | null>).lockReason).toBe('kyc');
    stale.unmount();

    // New mount while a different account's result is cached: the gate must
    // not evaluate the stale state even for a single render.
    phase.current = 'demo';
    auth.user = { id: 'demo-bursar' } as never;
    const fresh = mount(GateProbe);
    const syncFlags = fresh.vm as unknown as Record<string, boolean | string | null>;
    expect(syncFlags.locked).toBe(true);
    expect(syncFlags.canAccessFinancials).toBe(false);
    await flushPromises();
    await nextTick();
    const flags = fresh.vm as unknown as Record<string, boolean | string | null>;
    expect(flags.lockReason).toBeNull();
    expect(flags.canAccessFinancials).toBe(true);
    fresh.unmount();
  });
});

describe('demo pipeline page integration', () => {
  it('10a. Payments page renders content (not overlay) for the demo pipeline', async () => {
    await loadAll();
    const page = mount(PaymentsDashboard, {
      global: { stubs: { RouterLink: true } },
    });
    await flushPromises();
    await nextTick();
    expect(page.text()).toContain("Today's Collections");
    expect(page.text()).not.toContain('school setup');
    expect(page.text()).not.toContain('KYC Verification Required');
    page.unmount();
  });

  it('10b. Settlements page renders content (not overlay) for the demo pipeline', async () => {
    await loadAll();
    const page = mount(SettlementsView);
    await flushPromises();
    await nextTick();
    expect(page.text()).not.toContain('school setup');
    expect(page.text()).not.toContain('KYC Verification Required');
    page.unmount();
  });
});
