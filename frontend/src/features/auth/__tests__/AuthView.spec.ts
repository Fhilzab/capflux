import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';
import { flushPromises } from '@vue/test-utils';

// Mock auth store via vi.hoisted
const { authStore, handleOAuthCallbackMock } = vi.hoisted(() => {
  const handleOAuthCallbackMock = vi.fn();
  return {
    authStore: {
      loading: false,
      error: null as string | null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithProvider: vi.fn(),
      handleOAuthCallback: handleOAuthCallbackMock,
    },
    handleOAuthCallbackMock,
  };
});

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => authStore,
}));

const pushMock = vi.fn();
const replaceMock = vi.fn();
const mockRouteQuery = reactive({ mode: 'login', code: null, provider: null });

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>();
  return {
    ...actual,
    useRoute: () => ({ query: mockRouteQuery }),
    useRouter: () => ({ push: pushMock, replace: replaceMock }),
  };
});

// Inline stubs to avoid hoisting reference errors
vi.mock('../components/LoginForm.vue', () => ({
  default: {
    name: 'LoginForm',
    template: '<div data-testid="login-form" @switch-state="$emit(\'switch-state\', $event)"></div>',
    emits: ['switch-state'],
  },
}));
vi.mock('../components/RegisterForm.vue', () => ({
  default: {
    name: 'RegisterForm',
    template: '<div data-testid="register-form" @switch-state="$emit(\'switch-state\', $event)"></div>',
    emits: ['switch-state'],
  },
}));
vi.mock('../components/EmailVerification.vue', () => ({
  default: { name: 'EmailVerification', template: '<div data-testid="email-verification">' },
}));
vi.mock('../components/ForgotPassword.vue', () => ({
  default: { name: 'ForgotPassword', template: '<div data-testid="forgot-password">' },
}));
vi.mock('../components/ResetPassword.vue', () => ({
  default: { name: 'ResetPassword', template: '<div data-testid="reset-password">' },
}));
vi.mock('../components/AuthIllustration.vue', () => ({
  default: { name: 'AuthIllustration', template: '<div data-testid="illustration"></div>' },
}));
vi.mock('../components/AuthLayout.vue', () => ({
  default: {
    name: 'AuthLayout',
    template: `<div data-testid="auth-layout"><slot name="illustration"></slot><slot name="illustration-mobile"></slot><slot name="form"></slot></div>`,
  },
}));

import AuthView from '../AuthView.vue';

describe('AuthView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouteQuery.mode = 'login';
    mockRouteQuery.code = null;
    mockRouteQuery.provider = null;
  });

  it('renders LoginForm when mode=login', async () => {
    mockRouteQuery.mode = 'login';
    const wrapper = mount(AuthView);
    await nextTick();
    expect(wrapper.find('[data-testid="login-form"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="register-form"]').exists()).toBe(false);
  });

  it('renders RegisterForm when mode=signup', async () => {
    mockRouteQuery.mode = 'signup';
    const wrapper = mount(AuthView);
    await nextTick();
    expect(wrapper.find('[data-testid="register-form"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="login-form"]').exists()).toBe(false);
  });

  it('defaults to login when mode is unrecognized', async () => {
    mockRouteQuery.mode = 'bogus';
    const wrapper = mount(AuthView);
    await nextTick();
    expect(wrapper.find('[data-testid="login-form"]').exists()).toBe(true);
  });

  it('transitions from login to signup via switch-state event', async () => {
    mockRouteQuery.mode = 'login';
    const wrapper = mount(AuthView);
    await nextTick();

    expect(wrapper.find('[data-testid="login-form"]').exists()).toBe(true);

    // Simulate the LoginForm emitting switch-state = 'signup'
    const loginForm = wrapper.findComponent({ name: 'LoginForm' });
    loginForm.vm.$emit('switch-state', 'signup');
    await flushPromises();

    expect(replaceMock).toHaveBeenCalledWith(expect.objectContaining({
      query: expect.objectContaining({ mode: 'signup' }),
    }));
  });

  it('renders AuthLayout with AuthIllustration', async () => {
    mockRouteQuery.mode = 'login';
    const wrapper = mount(AuthView);
    await nextTick();

    expect(wrapper.find('[data-testid="auth-layout"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="illustration"]').exists()).toBe(true);
  });

  it('handles OAuth callback code on load', async () => {
    mockRouteQuery.mode = 'login';
    mockRouteQuery.code = 'test-auth-code';
    handleOAuthCallbackMock.mockResolvedValue(true);

    mount(AuthView);
    await flushPromises();
    await nextTick();

    expect(handleOAuthCallbackMock).toHaveBeenCalledWith('test-auth-code');
    expect(pushMock).toHaveBeenCalledWith({ name: 'Home' });
  });

  it('does not call handleOAuthCallback when no code in query', async () => {
    mockRouteQuery.mode = 'login';
    mockRouteQuery.code = null;

    mount(AuthView);
    await flushPromises();
    await nextTick();

    expect(handleOAuthCallbackMock).not.toHaveBeenCalled();
  });
});
