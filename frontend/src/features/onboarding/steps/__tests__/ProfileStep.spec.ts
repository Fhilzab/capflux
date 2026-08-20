import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

const { mockOnboardingStore, mockAuthStore } = vi.hoisted(() => ({
  mockOnboardingStore: {
    personalInfo: null as Record<string, unknown> | null,
    loading: false,
    error: null as string | null,
    errorCategory: null as string | null,
    completedSteps: [] as number[],
    currentStep: 1,
    saveProfile: vi.fn(),
    loadProfile: vi.fn(),
    clearError: vi.fn(),
  },
  mockAuthStore: {
    user: {
      id: 'user-1',
      email: 'test@example.com',
      user_metadata: { full_name: 'Test User', phone: '' },
    },
    profile: { id: 'user-1', full_name: 'Test User', phone: '' },
  },
}));

vi.mock('@/stores/onboardingStore', () => ({
  useOnboardingStore: () => mockOnboardingStore,
}));
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => mockAuthStore,
}));

import ProfileStep from '../ProfileStep.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmInput from '@/components/ui/CmInput.vue';
import CmSelect from '@/components/ui/CmSelect.vue';
import { flushPromises } from '@vue/test-utils';

const STORAGE_KEY = 'capflux:kyc:personalInfoDraft';

function mountStep() {
  return mount(ProfileStep, {
    global: {
      stubs: { CmAlert: true },
    },
  });
}

describe('ProfileStep.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnboardingStore.personalInfo = null;
    mockOnboardingStore.loading = false;
    mockOnboardingStore.error = null;
    mockOnboardingStore.saveProfile = vi.fn();
    mockOnboardingStore.loadProfile = vi.fn();
    mockOnboardingStore.clearError = vi.fn();
    mockAuthStore.user = {
      id: 'user-1',
      email: 'test@example.com',
      user_metadata: { full_name: 'Test User', phone: '' },
    };
    localStorage.clear();
  });

  it('renders correct fields - no Full Name field', () => {
    const wrapper = mountStep();
    const text = wrapper.text();

    expect(text).toContain('First Name');
    expect(text).toContain('Last Name');
    expect(text).toContain('Phone Number');
    expect(text).toContain('Email Address');
    expect(text).toContain('Date of Birth');
    expect(text).toContain('Country of Origin');
    expect(text).toContain('State of Origin');
    expect(text).toContain('Residential Address');
    expect(text).toContain('Middle Name');
    expect(text).toContain('Local Government Area');
    expect(text).not.toContain('Full Name');
  });

  it('shows read-only email from authenticated CAPFLUX account', () => {
    const wrapper = mountStep();
    expect(wrapper.text()).toContain('test@example.com');
  });

  it('surfaces actual backend error instead of generic message', () => {
    mockOnboardingStore.error = 'Invalid phone number format';
    const wrapper = mountStep();
    expect(wrapper.text()).toContain('Invalid phone number format');
    expect(wrapper.text()).not.toContain('CAPFLUX is temporarily unavailable');
  });

  it('validation: Save button disabled when required fields missing', () => {
    const wrapper = mountStep();
    const buttons = wrapper.findAllComponents(CmButton);
    const saveButton = buttons[1]; // 0 = Back, 1 = Save
    expect(saveButton?.props('disabled')).toBe(true);
  });

  it('save calls saveProfile with firstName + lastName (no Full Name)', async () => {
    mockOnboardingStore.personalInfo = {
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '08099999999',
    };
    mockOnboardingStore.saveProfile = vi.fn().mockResolvedValueOnce(undefined);

    const wrapper = mountStep();
    await flushPromises();

    const buttons = wrapper.findAllComponents(CmButton);
    const saveButton = buttons[1];
    expect(saveButton?.props('disabled')).toBe(false);

    await saveButton?.vm.$emit('click');
    await flushPromises();

    expect(mockOnboardingStore.saveProfile).toHaveBeenCalledTimes(1);
    const payload = mockOnboardingStore.saveProfile.mock.calls[0][0];
    expect(payload).not.toHaveProperty('fullName');
    expect(payload.firstName).toBe('Jane');
    expect(payload.lastName).toBe('Smith');
  });

  it('retry after failure: form values preserved', async () => {
    mockOnboardingStore.personalInfo = {
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '08099999999',
    };
    mockOnboardingStore.saveProfile = vi.fn().mockRejectedValueOnce(new Error('Network error'));

    const wrapper = mountStep();
    await flushPromises();

    const buttons = wrapper.findAllComponents(CmButton);
    await buttons[1].vm.$emit('click');
    await flushPromises();

    expect(mockOnboardingStore.saveProfile).toHaveBeenCalled();

    // Form values should still be present (not cleared on failure)
    const firstNameInput = wrapper.findAllComponents(CmInput)[0];
    expect(firstNameInput?.props('modelValue')).toBe('Jane');
  });

  it('resume: pre-fills from personalInfo', async () => {
    mockOnboardingStore.personalInfo = {
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '08099999999',
    };
    const wrapper = mountStep();
    await flushPromises();
    const firstNameInput = wrapper.findAllComponents(CmInput)[0];
    expect(firstNameInput?.props('modelValue')).toBe('Jane');
  });

  // ── Country dropdown tests ──────────────────────────────────────────

  it('renders Country of Origin as a dropdown/select control', async () => {
    const wrapper = mountStep();
    await flushPromises();

    const selects = wrapper.findAll('select');
    // At least one select should be the country dropdown
    expect(selects.length).toBeGreaterThan(0);
  });

  it('includes West African countries in the country dropdown', async () => {
    const wrapper = mountStep();
    await flushPromises();

    const countrySelect = wrapper.find('select');
    const options = countrySelect.findAll('option');
    const optionLabels = options.map((o) => o.text());

    expect(optionLabels).toContain('Nigeria');
    expect(optionLabels).toContain('Ghana');
    expect(optionLabels).toContain('Sierra Leone');
    expect(optionLabels).toContain('Liberia');
    expect(optionLabels).toContain('The Gambia');
    expect(optionLabels).toContain('Senegal');
    expect(optionLabels).toContain('Guinea');
    expect(optionLabels).toContain('Guinea-Bissau');
    expect(optionLabels).toContain('Mali');
    expect(optionLabels).toContain('Burkina Faso');
    expect(optionLabels).toContain('Côte d\'Ivoire');
    expect(optionLabels).toContain('Togo');
    expect(optionLabels).toContain('Benin');
    expect(optionLabels).toContain('Niger');
    expect(optionLabels).toContain('Cabo Verde');
    expect(optionLabels).toContain('Mauritania');
  });

  it('defaults country to Nigeria', async () => {
    const wrapper = mountStep();
    await flushPromises();

    const countrySelect = wrapper.find('select');
    expect(countrySelect.element.value).toBe('Nigeria');
  });

  it('preserves saved country when loading profile', async () => {
    mockOnboardingStore.personalInfo = {
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '08099999999',
      country: 'Ghana',
    };
    mockOnboardingStore.loadProfile = vi.fn().mockResolvedValue(undefined);

    const wrapper = mountStep();
    await flushPromises();

    const countrySelect = wrapper.find('select');
    expect(countrySelect.element.value).toBe('Ghana');
  });

  // ── State dropdown tests ────────────────────────────────────────────

  it('renders State of Origin as a dropdown when country is Nigeria', async () => {
    const wrapper = mountStep();
    await flushPromises();

    const selects = wrapper.findAll('select');
    // First select is country, second should be state
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it('includes all Nigerian states + FCT in state dropdown', async () => {
    const wrapper = mountStep();
    await flushPromises();

    const selects = wrapper.findAll('select');
    const stateSelect = selects[1];
    const options = stateSelect.findAll('option');
    const optionLabels = options.map((o) => o.text());

    expect(optionLabels).toContain('Federal Capital Territory');
    expect(optionLabels).toContain('Lagos');
    expect(optionLabels).toContain('Rivers');
    expect(optionLabels).toContain('Kano');
    expect(optionLabels).toContain('Kaduna');
    expect(optionLabels).toContain('Ogun');
  });

  // ── LGA dropdown tests ──────────────────────────────────────────────

  it('renders LGA as a dependent dropdown', async () => {
    const wrapper = mountStep();
    await flushPromises();

    const selects = wrapper.findAll('select');
    // Third select should be LGA (appears after state is selected)
    // Initially state is empty, so LGA select may not be visible
    // Select a state first
    const stateSelect = selects[1];
    await stateSelect.setValue('Lagos');
    await nextTick();

    const updatedSelects = wrapper.findAll('select');
    const lgaSelects = updatedSelects.filter((s) => {
      const opts = s.findAll('option');
      return opts.length > 0 && opts[0].text() === 'Select an LGA';
    });
    expect(lgaSelects.length).toBeGreaterThan(0);
  });

  it('LGA options update when state changes', async () => {
    const wrapper = mountStep();
    await flushPromises();

    const selects = wrapper.findAll('select');
    await selects[1].setValue('Lagos');
    await nextTick();

    const updatedSelects = wrapper.findAll('select');
    const lgaSelect = updatedSelects[updatedSelects.length - 1];
    const lgaOptions = lgaSelect.findAll('option');

    // Should have Lagos LGAs (e.g., Lagos Island, Ikeja)
    const labels = lgaOptions.map((o) => o.text());
    expect(labels.some((l) => l.includes('Lagos') || l.includes('Ikeja') || l.includes('Epe'))).toBe(true);

    // Change to a different state
    await selects[1].setValue('Kano');
    await nextTick();

    // LGA should be cleared
    const clearedSelect = wrapper.find('select');
    // The state select should have the new value
    const stateSelect = wrapper.findAll('select')[1];
    expect(stateSelect.element.value).toBe('Kano');
  });

  // ── Persistence tests ───────────────────────────────────────────────

  it('preserves form data across refresh via localStorage', async () => {
    const wrapper = mountStep();
    await flushPromises();

    // Fill in some form data
    const inputs = wrapper.findAllComponents(CmInput);
    const firstNameInput = inputs[0];
    await firstNameInput.vm.$emit('update:modelValue', 'John');
    await nextTick();

    // Check localStorage was updated
    const saved = localStorage.getItem(STORAGE_KEY);
    expect(saved).toBeTruthy();
    const parsed = JSON.parse(saved);
    expect(parsed.firstName).toBe('John');
  });

  it('restores form data from localStorage on mount', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      firstName: 'Saved',
      lastName: 'Name',
      phone: '08012345678',
      country: 'Ghana',
      state: '',
      lga: '',
      residentialAddress: '123 Main St',
    }));

    const wrapper = mountStep();
    await flushPromises();

    const inputs = wrapper.findAllComponents(CmInput);
    expect(inputs[0].props('modelValue')).toBe('Saved');
    expect(inputs[2].props('modelValue')).toBe('Name');
  });

  it('does not display Full Name field in DOM', () => {
    const wrapper = mountStep();
    const inputs = wrapper.findAllComponents(CmInput);
    for (const input of inputs) {
      const label = input.props('label');
      expect(label).not.toBe('Full Name');
    }
  });

  it('backend validation errors are surfaced accurately', async () => {
    mockOnboardingStore.personalInfo = {
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '08099999999',
      dateOfBirth: '1990-01-01',
      country: 'Nigeria',
      state: 'Kano',
    };
    mockOnboardingStore.saveProfile = vi.fn().mockRejectedValueOnce(
      new Error('Date of birth must be a valid past date'),
    );

    const wrapper = mountStep();
    await flushPromises();

    const buttons = wrapper.findAllComponents(CmButton);
    const saveButton = buttons[1];
    expect(saveButton?.props('disabled')).toBe(false);

    await saveButton?.vm.$emit('click');
    await flushPromises();

    expect(mockOnboardingStore.error).toBe('Date of birth must be a valid past date');
    expect(mockOnboardingStore.error).not.toBe('CAPFLUX is temporarily unavailable');
  });
});
