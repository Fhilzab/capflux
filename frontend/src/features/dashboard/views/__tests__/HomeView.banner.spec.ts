import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import HomeView from '../HomeView.vue';
import { __resolveRuntimeEnvironmentForTests } from '../../../../shared/environment/runtimeEnvironment';

vi.mock('../../../../shared/repositories/StudentRepository', () => ({ StudentRepository: { getStudentsBySchool: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../../../shared/repositories/GuardianRepository', () => ({ GuardianRepository: { getBySchool: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../../../shared/repositories/LedgerRepository', () => ({ LedgerRepository: { getEntriesBySchool: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../../../shared/repositories/PaymentAccountRepository', () => ({ PaymentAccountRepository: { getBySchool: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../../../shared/repositories/NotificationRepository', () => ({ NotificationRepository: { getBySchool: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../../../stores/syncStore', () => ({
  useSyncStore: () => ({ pendingCount: 0, lastSyncedAt: null, refreshStatus: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('../../../../stores/onboardingStore', () => ({
  useOnboardingStore: () => ({
    statusLoaded: true,
    initialized: true,
    requiresSetup: true,
    hasSchool: false,
    loading: false,
    statusLoading: false,
    status: { requiresSetup: true },
    loadStatus: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock('../../../../stores/schoolStore', () => ({
  useSchoolStore: () => ({
    initialized: true,
    requiresSetup: true,
    school: { status: 'PENDING_SETUP', paymentStatus: 'NOT_READY' },
    loading: false,
    initialize: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('HomeView activation banner — sandbox vs production', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('sandbox does not render activation banner even when setup required', async () => {
    __resolveRuntimeEnvironmentForTests('sandbox');
    const wrapper = mount(HomeView);
    await wrapper.vm.$nextTick();
    // ActivationBanner component should not be visible in sandbox
    expect(wrapper.html()).not.toContain('Complete your school profile');
  });

  it('production preserves banner when setup required', async () => {
    __resolveRuntimeEnvironmentForTests('production');
    const wrapper = mount(HomeView);
    await wrapper.vm.$nextTick();
    // In production with requiresSetup=true, banner should appear
    // HomeView computed showActivationBanner true -> ActivationBanner visible
    // But ActivationBanner itself also checks isSandbox false -> visible
    // So HTML should contain banner text
    // Need to wait for computed; banner visibility depends on mocked stores which return requiresSetup true
    // Mount should contain Activate button
    expect(wrapper.html()).toContain('Complete your school profile');
  });

  it('does not hide banner implementation as UNKNOWN safety check', async () => {
    // Ensure useModuleLock distinction preserved — just check HomeView logic uses isSandbox narrowly
    __resolveRuntimeEnvironmentForTests('sandbox');
    const wrapperSandbox = mount(HomeView);
    await wrapperSandbox.vm.$nextTick();
    expect(wrapperSandbox.html()).not.toContain('Complete your school profile');

    __resolveRuntimeEnvironmentForTests('production');
    const wrapperProd = mount(HomeView);
    await wrapperProd.vm.$nextTick();
    expect(wrapperProd.html()).toContain('Complete your school profile');
  });
});
