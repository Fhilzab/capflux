import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { flushPromises } from '@vue/test-utils';

// Mock auth store via vi.hoisted
const { authStore, signUpMock, signInWithProviderMock } = vi.hoisted(() => {
  const signUpMock = vi.fn();
  const signInWithProviderMock = vi.fn();
  return {
    authStore: {
      loading: false,
      error: null as string | null,
      signUp: signUpMock,
      signInWithProvider: signInWithProviderMock,
      signIn: vi.fn(),
      handleOAuthCallback: vi.fn(),
    },
    signUpMock,
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
vi.mock('../../../../components/ui/CmCheckbox.vue', () => ({
  default: {
    name: 'CmCheckbox',
    emits: ['update:checked', 'update:modelValue'],
    props: ['modelValue', 'checked', 'label', 'error', 'id'],
    template: '<label><input type="checkbox" :id="id" :checked="checked" @change="$emit(\'update:checked\', $event.target.checked)" /><slot /></label>',
  },
}));
vi.mock('../../../../components/ui/CmAlert.vue', () => ({
  default: {
    name: 'CmAlert',
    template: '<div v-if="description" class="alert"><strong>{{ title }}</strong>: {{ description }}</div>',
    props: ['variant', 'title', 'description'],
  },
}));

import RegisterForm from '../RegisterForm.vue';

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStore.loading = false;
    authStore.error = null;
  });

  it('renders first name and last name as separate fields on a horizontal line', () => {
    const wrapper = mount(RegisterForm);
    const textInputs = wrapper.findAll('input[type="text"]');
    expect(textInputs.length).toBe(2);
    // Verify they are in a grid layout (horizontal on desktop)
    const gridContainer = wrapper.find('.grid');
    expect(gridContainer.exists()).toBe(true);
  });

  it('renders email, password, and terms fields', () => {
    const wrapper = mount(RegisterForm);
    const inputs = wrapper.findAll('input');
    expect(inputs.some((i) => i.attributes('type') === 'email')).toBe(true);
    expect(inputs.some((i) => i.attributes('type') === 'password')).toBe(true);
    expect(inputs.some((i) => i.attributes('type') === 'checkbox')).toBe(true);
  });

  it('submit button is disabled when all fields are empty', () => {
    const wrapper = mount(RegisterForm);
    const submitButton = wrapper.find('[data-testid="signup-button"]');
    expect(submitButton.exists()).toBe(true);
    expect(submitButton.attributes('disabled')).toBeDefined();
  });

  it('submit button is enabled when all required fields are filled and terms accepted', async () => {
    const wrapper = mount(RegisterForm);
    await wrapper.find('input[id="signup-first-name"]').setValue('Jane');
    await wrapper.find('input[id="signup-last-name"]').setValue('Doe');
    await wrapper.findAll('input[type="email"]')[0].setValue('test@example.com');
    await wrapper.find('input[type="password"]').setValue('SecurePass123!');
    const checkbox = wrapper.find('input[type="checkbox"]');
    await checkbox.setChecked();
    await flushPromises();

    const submitButton = wrapper.find('[data-testid="signup-button"]');
    expect(submitButton.attributes('disabled')).toBeFalsy();
  });

  it('submit button is NOT disabled by password strength policy (only WorkOS decides)', async () => {
    const wrapper = mount(RegisterForm);
    await wrapper.find('input[id="signup-first-name"]').setValue('Jane');
    await wrapper.find('input[id="signup-last-name"]').setValue('Doe');
    await wrapper.findAll('input[type="email"]')[0].setValue('test@example.com');
    await wrapper.find('input[type="password"]').setValue('123');
    const checkbox = wrapper.find('input[type="checkbox"]');
    await checkbox.setChecked();
    await flushPromises();

    const submitButton = wrapper.find('[data-testid="signup-button"]');
    expect(submitButton.attributes('disabled')).toBeFalsy();
  });

  it('does not display password strength meter', () => {
    const wrapper = mount(RegisterForm);
    expect(wrapper.text()).not.toContain('Password strength: Strong');
  });

  it('does not display password requirements checklist', () => {
    const wrapper = mount(RegisterForm);
    expect(wrapper.text()).not.toContain('At least 8 characters');
    expect(wrapper.text()).not.toContain('One uppercase letter');
    expect(wrapper.text()).not.toContain('One digit');
  });

  it('shows WorkOS password guidance text', () => {
    const wrapper = mount(RegisterForm);
    expect(wrapper.text()).toContain('WorkOS password requirements');
  });

  it('submits fullName (first + last), email, and password to authStore.signUp', async () => {
    signUpMock.mockResolvedValue({ error: null });
    const wrapper = mount(RegisterForm);
    await wrapper.find('input[id="signup-first-name"]').setValue('Jane');
    await wrapper.find('input[id="signup-last-name"]').setValue('Doe');
    await wrapper.findAll('input[type="email"]')[0].setValue('jane@example.com');
    await wrapper.find('input[type="password"]').setValue('SecurePass123!');
    const checkbox = wrapper.find('input[type="checkbox"]');
    await checkbox.setChecked();
    await flushPromises();
    await wrapper.find('[data-testid="register-form"]').trigger('submit.prevent');
    await flushPromises();
    await flushPromises();

    expect(signUpMock).toHaveBeenCalledWith({
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      password: 'SecurePass123!',
    });
  });

  it('redirects to dashboard on successful signup', async () => {
    signUpMock.mockResolvedValue({ error: null });
    const wrapper = mount(RegisterForm);
    await wrapper.find('input[id="signup-first-name"]').setValue('Jane');
    await wrapper.find('input[id="signup-last-name"]').setValue('Doe');
    await wrapper.findAll('input[type="email"]')[0].setValue('jane@example.com');
    await wrapper.find('input[type="password"]').setValue('SecurePass123!');
    const checkbox = wrapper.find('input[type="checkbox"]');
    await checkbox.setChecked();
    await flushPromises();
    await wrapper.find('[data-testid="register-form"]').trigger('submit.prevent');
    await flushPromises();
    await flushPromises();

    expect(pushMock).toHaveBeenCalledWith({ name: 'Home' });
  });

  it('shows DUPLICATE_ACCOUNT error from authStore', () => {
    authStore.error = 'An account with this email already exists. Please sign in instead.';
    const wrapper = mount(RegisterForm);
    const alert = wrapper.find('.alert');
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain('already exists');
  });

  it('shows WEAK_PASSWORD error from authStore', () => {
    authStore.error = "Your password does not meet CAPFLUX's security requirements. Use at least 8 characters with a mix of letters, numbers, and symbols.";
    const wrapper = mount(RegisterForm);
    const alert = wrapper.find('.alert');
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain('does not meet CAPFLUX');
  });

  it('shows BREACHED_PASSWORD error from authStore', () => {
    authStore.error = 'This password has appeared in known data breaches and cannot be used. Please choose a different password.';
    const wrapper = mount(RegisterForm);
    const alert = wrapper.find('.alert');
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain('data breaches');
  });

  it('has a Log In link that switches to login state', () => {
    const wrapper = mount(RegisterForm);
    const btn = wrapper.find('[data-testid="login-link"]');
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain('Log In');
    expect(btn.attributes('type')).toBe('button');
  });

  it('calls signInWithProvider(google) when Google button clicked', async () => {
    signInWithProviderMock.mockResolvedValue(true);
    const wrapper = mount(RegisterForm);
    const googleButton = wrapper.find('[data-testid="google-signup"]');
    expect(googleButton.exists()).toBe(true);
    await googleButton.trigger('click');
    await flushPromises();

    expect(signInWithProviderMock).toHaveBeenCalledWith('google');
  });
});
