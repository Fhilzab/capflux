/**
 * SandboxDemoLogin — persona-first sandbox access.
 *
 * Sandbox auth must never show credential/Google UI: five canonical
 * personas, one CTA, real backend demo-login on continue, friendly error
 * without internals on failure, and light-theme enforcement on dark-mode
 * devices.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { __resolveRuntimeEnvironmentForTests } from '../../shared/environment/runtimeEnvironment';

const { signInMock, pushMock } = vi.hoisted(() => ({
  signInMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({ loading: false, error: null as string | null, signIn: signInMock }),
}));

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>();
  return {
    ...actual,
    useRoute: () => ({ query: {} }),
    useRouter: () => ({ push: pushMock }),
  };
});

import SandboxDemoLogin from '../ui/SandboxDemoLogin.vue';
import { DEMO_PERSONAS } from '../seed/demoData';

describe('SandboxDemoLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.classList.remove('dark');
    __resolveRuntimeEnvironmentForTests('sandbox');
    signInMock.mockResolvedValue(true);
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
    __resolveRuntimeEnvironmentForTests('production');
  });

  it('renders all five canonical personas and no credential or OAuth UI', () => {
    const wrapper = mount(SandboxDemoLogin);
    for (const persona of DEMO_PERSONAS) {
      expect(wrapper.find(`[data-testid="demo-login-${persona.id}"]`).exists()).toBe(true);
    }
    expect(wrapper.find('input[type="email"]').exists()).toBe(false);
    expect(wrapper.find('input[type="password"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('demo1234');
    expect(wrapper.text()).not.toContain('Continue with Google');
    expect(wrapper.text()).not.toContain('Forgot password?');
    expect(wrapper.text()).not.toContain('Create Account');
  });

  it('selects a persona and continues through the real sign-in flow', async () => {
    const wrapper = mount(SandboxDemoLogin);
    await wrapper.find('[data-testid="demo-login-bursar"]').trigger('click');
    await wrapper.find('[data-testid="demo-login-continue"]').trigger('click');
    await nextTick();
    expect(signInMock).toHaveBeenCalledWith({ email: 'bursar@demo.capflux', password: '' });
    expect(pushMock).toHaveBeenCalledWith('/dashboard');
    expect(wrapper.find('[data-testid="demo-login-error"]').exists()).toBe(false);
  });

  it('stays on the page with a clean error when backend auth fails', async () => {
    signInMock.mockResolvedValue(false);
    const wrapper = mount(SandboxDemoLogin);
    await wrapper.find('[data-testid="demo-login-continue"]').trigger('click');
    await nextTick();
    expect(pushMock).not.toHaveBeenCalled();
    const error = wrapper.find('[data-testid="demo-login-error"]');
    expect(error.exists()).toBe(true);
    expect(error.text()).toContain('temporarily unavailable');
    expect(error.text()).not.toMatch(/demo-session|secret|token|stack/i);
  });

  it('forces light theme while mounted and restores dark afterwards', async () => {
    document.documentElement.classList.add('dark');
    const wrapper = mount(SandboxDemoLogin);
    await nextTick();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    wrapper.unmount();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
