import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { flushPromises } from '@vue/test-utils';

// Mock auth store via vi.hoisted so the factory can reference it
const { authStore, signInMock, signInWithProviderMock } = vi.hoisted(() => {
  const signInMock = vi.fn();
  const signInWithProviderMock = vi.fn();
  return {
    authStore: {
      loading: false,
      error: null as string | null,
      signIn: signInMock,
      signInWithProvider: signInWithProviderMock,
      signUp: vi.fn(),
      handleOAuthCallback: vi.fn(),
    },
    signInMock,
    signInWithProviderMock,
  };
});

vi.mock('../../../../stores/authStore', () => ({
  useAuthStore: () => authStore,
}));

const pushMock = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('../../../../components/ui/CmButton.vue', () => ({
  default: {
    name: 'CmButton',
    template: '<button :type="type || \'button\'" :disabled="disabled || loading" @click="$emit(\'click\', $event)"><slot /></button>',
    props: ['variant', 'loading', 'disabled', 'type'],
    emits: ['click'],
  },
}));
vi.mock('../../../../components/ui/CmInput.vue', () => ({
  default: {
    name: 'CmInput',
    template: '<input :type="type" :value="modelValue" :id="id" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue', 'type', 'placeholder', 'error', 'disabled', 'id', 'autocomplete'],
    emits: ['update:modelValue'],
  },
}));
vi.mock('../../../../components/ui/CmAlert.vue', () => ({
  default: {
    name: 'CmAlert',
    template: '<div v-if="description" class="alert"><strong>{{ title }}</strong>: {{ description }}</div>',
    props: ['variant', 'title', 'description'],
  },
}));

import LoginForm from '../LoginForm.vue';

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStore.loading = false;
    authStore.error = null;
  });

  it('renders email and password inputs', () => {
    const wrapper = mount(LoginForm);
    const inputs = wrapper.findAll('input');
    expect(inputs.some((i) => i.attributes('type') === 'email')).toBe(true);
    expect(inputs.some((i) => i.attributes('type') === 'password')).toBe(true);
  });

  it('submit button is disabled when fields are empty', () => {
    const wrapper = mount(LoginForm);
    const submitButton = wrapper.find('[data-testid="signin-button"]');
    expect(submitButton.exists()).toBe(true);
    expect(submitButton.attributes('disabled')).toBeDefined();
  });

  it('submit button is enabled when valid email and password are provided', async () => {
    const wrapper = mount(LoginForm);
    await wrapper.find('input[type="email"]').setValue('test@example.com');
    await wrapper.find('input[type="password"]').setValue('Password123!');
    await flushPromises();
    const submitButton = wrapper.find('[data-testid="signin-button"]');
    expect(submitButton.attributes('disabled')).toBeFalsy();
  });

  it('submit button is disabled for malformed email', async () => {
    const wrapper = mount(LoginForm);
    await wrapper.find('input[type="email"]').setValue('not-an-email');
    await wrapper.find('input[type="password"]').setValue('Password123!');
    await flushPromises();
    const submitButton = wrapper.find('[data-testid="signin-button"]');
    expect(submitButton.attributes('disabled')).toBeDefined();
  });

  it('submits email and password to authStore.signIn on form submit', async () => {
    signInMock.mockResolvedValue(true);
    const wrapper = mount(LoginForm);
    await wrapper.find('input[type="email"]').setValue('test@example.com');
    await wrapper.find('input[type="password"]').setValue('SecurePass123!');
    await flushPromises();
    await wrapper.find('[data-testid="login-form"]').trigger('submit.prevent');
    await flushPromises();

    expect(signInMock).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'SecurePass123!',
    });
  });

  it('redirects to dashboard on successful sign in', async () => {
    signInMock.mockResolvedValue(true);
    const wrapper = mount(LoginForm);
    await wrapper.find('input[type="email"]').setValue('test@example.com');
    await wrapper.find('input[type="password"]').setValue('SecurePass123!');
    await flushPromises();
    await wrapper.find('[data-testid="login-form"]').trigger('submit.prevent');
    await flushPromises();
    await flushPromises();

    expect(pushMock).toHaveBeenCalledWith({ name: 'Home' });
  });

  it('shows INVALID_CREDENTIALS error from authStore', () => {
    authStore.error = 'Invalid email or password. Please try again.';
    const wrapper = mount(LoginForm);
    const alert = wrapper.find('.alert');
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain('Invalid email or password');
  });

  it('shows NETWORK_ERROR for actual network failure', () => {
    authStore.error = 'Unable to connect. Please check your internet connection.';
    const wrapper = mount(LoginForm);
    const alert = wrapper.find('.alert');
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain('Unable to connect');
  });

  it('does not show error alert when no error', () => {
    const wrapper = mount(LoginForm);
    expect(wrapper.find('.alert').exists()).toBe(false);
  });

  it('has a Create Account link that switches to signup state', () => {
    const wrapper = mount(LoginForm);
    const btn = wrapper.find('[data-testid="create-account-link"]');
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain('Create Account');
    expect(btn.attributes('type')).toBe('button');
  });

  it('has a Forgot password link that switches to forgot-password state', () => {
    const wrapper = mount(LoginForm);
    const btn = wrapper.find('[data-testid="forgot-password-link"]');
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain('Forgot password?');
    expect(btn.attributes('type')).toBe('button');
  });

  it('calls signInWithProvider(google) when Google button clicked', async () => {
    signInWithProviderMock.mockResolvedValue(true);
    const wrapper = mount(LoginForm);
    const googleButton = wrapper.find('[data-testid="google-signin"]');
    expect(googleButton.exists()).toBe(true);
    await googleButton.trigger('click');
    await flushPromises();

    expect(signInWithProviderMock).toHaveBeenCalledWith('google');
  });
});
