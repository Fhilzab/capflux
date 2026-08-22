import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

const onboardingStoreMock = vi.hoisted(() => ({
  businessType: null as string | null,
  hasSchool: false,
  organizationName: '',
  loading: false,
  error: null as string | null,
  saveBusinessType: vi.fn().mockResolvedValue(undefined),
  createOrganization: vi.fn().mockResolvedValue({ organization: { id: 'o1', name: 'Org', slug: 'org' } }),
  clearError: vi.fn(),
}));

const financialStoreMock = vi.hoisted(() => ({
  updateKycDraft: vi.fn(),
}));

vi.mock('@/stores/onboardingStore', () => ({
  useOnboardingStore: () => onboardingStoreMock,
}));

vi.mock('@/stores/financialActivationStore', () => ({
  useFinancialActivationStore: () => financialStoreMock,
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useRoute: () => ({ query: {}, params: {} }),
}));

import OrganizationStep from '../OrganizationStep.vue';

function mountStep(props = {}) {
  return mount(OrganizationStep, {
    props: { modelValue: true, ...props },
    global: {
      stubs: { CmAlert: true },
    },
  });
}

describe('OrganizationStep.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onboardingStoreMock.businessType = null;
    onboardingStoreMock.hasSchool = false;
    onboardingStoreMock.loading = false;
    onboardingStoreMock.error = null;
  });

  it('renders all 9 legitimate Nigerian entity types in the select', async () => {
    const wrapper = mountStep();
    const select = wrapper.findComponent({ name: 'CmSelect' });
    expect(select.exists()).toBe(true);
    const options = select.props('options') as Array<{ value: string; label: string }>;
    expect(options).toHaveLength(9);
    const labels = options.map((o) => o.label);
    expect(labels).toContain('Business Name / Enterprise');
    expect(labels).toContain('Partnership / Business Name');
    expect(labels).toContain('Private Company Limited by Shares (Ltd)');
    expect(labels).toContain('Public Company Limited by Shares (Plc)');
    expect(labels).toContain('Company Limited by Guarantee');
    expect(labels).toContain('Unlimited Company');
    expect(labels).toContain('Limited Liability Partnership (LLP)');
    expect(labels).toContain('Limited Partnership (LP)');
    expect(labels).toContain('Incorporated Trustees / Non-Profit Organization');
  });

  it('does not show the vague "Private Business" option', async () => {
    const wrapper = mountStep();
    const select = wrapper.findComponent({ name: 'CmSelect' });
    const labels = select.props('options').map((o: { label: string }) => o.label);
    expect(labels).not.toContain('Private Business');
    expect(labels).not.toContain('Public Business');
    expect(labels).not.toContain('Graduate');
  });

  it('renders helper text for business type selection', async () => {
    const wrapper = mountStep();
    const select = wrapper.findComponent({ name: 'CmSelect' });
    expect(select.props('helperText')).toContain('legal structure');
  });

  it('pre-fills business type from the onboarding store', async () => {
    onboardingStoreMock.businessType = 'PRIVATE_LIMITED_COMPANY';
    const wrapper = mountStep();
    const select = wrapper.findComponent({ name: 'CmSelect' });
    expect(select.props('modelValue')).toBe('PRIVATE_LIMITED_COMPANY');
  });

  it('shows explanatory line after a business type is selected', async () => {
    const wrapper = mountStep();
    const select = wrapper.findComponent({ name: 'CmSelect' });
    // No selection initially — no per-type config description shown
    expect(wrapper.text()).not.toContain('A sole proprietorship or registered business name');
    // Simulate selection
    await select.vm.$emit('update:modelValue', 'BUSINESS_NAME');
    await nextTick();
    expect(wrapper.text()).toContain('A sole proprietorship or registered business name');
  });

  it('form is invalid when business type is not selected', () => {
    const wrapper = mountStep();
    // defineExpose unwraps computed refs — read as plain booleans
    expect((wrapper.vm as any).isFormValid).toBe(false);
  });

  it('form is invalid when only name is entered without business type', async () => {
    const wrapper = mountStep();
    const input = wrapper.findComponent({ name: 'CmInput' });
    await input.vm.$emit('update:modelValue', 'Acme Schools');
    await nextTick();
    expect((wrapper.vm as any).isFormValid).toBe(false);
  });

  it('form is valid when both name and business type are provided', async () => {
    const wrapper = mountStep();
    const select = wrapper.findComponent({ name: 'CmSelect' });
    await select.vm.$emit('update:modelValue', 'PRIVATE_LIMITED_COMPANY');
    await nextTick();
    // Find the name input (first CmInput)
    const nameInput = wrapper.findAllComponents({ name: 'CmInput' })[0];
    await nameInput.vm.$emit('update:modelValue', 'Acme Schools Ltd');
    await nextTick();
    expect((wrapper.vm as any).isFormValid).toBe(true);
  });

  describe('submission behaviour', () => {
    it('calls saveBusinessType in the KYC flow (school already exists)', async () => {
      onboardingStoreMock.hasSchool = true;
      const wrapper = mountStep();
      const select = wrapper.findComponent({ name: 'CmSelect' });
      await select.vm.$emit('update:modelValue', 'LLP');
      await nextTick();
      const nameInput = wrapper.findAllComponents({ name: 'CmInput' })[0];
      await nameInput.vm.$emit('update:modelValue', 'Acme Schools');
      await nextTick();

      await (wrapper.vm as any).handleSubmit();
      expect(onboardingStoreMock.saveBusinessType).toHaveBeenCalledWith('LLP');
      expect(onboardingStoreMock.createOrganization).not.toHaveBeenCalled();
      expect(financialStoreMock.updateKycDraft).toHaveBeenCalledWith({ businessType: 'LLP' });
    });

    it('calls createOrganization in the onboarding flow (no school yet)', async () => {
      onboardingStoreMock.hasSchool = false;
      const wrapper = mountStep();
      const select = wrapper.findComponent({ name: 'CmSelect' });
      await select.vm.$emit('update:modelValue', 'BUSINESS_NAME');
      await nextTick();
      const nameInput = wrapper.findAllComponents({ name: 'CmInput' })[0];
      await nameInput.vm.$emit('update:modelValue', 'Acme Business');
      await nextTick();

      await (wrapper.vm as any).handleSubmit();
      expect(onboardingStoreMock.createOrganization).toHaveBeenCalledWith('Acme Business', 'BUSINESS_NAME');
      expect(financialStoreMock.updateKycDraft).toHaveBeenCalledWith({ businessType: 'BUSINESS_NAME' });
    });

    it('emits next-step after successful submission in KYC flow', async () => {
      onboardingStoreMock.hasSchool = true;
      const wrapper = mountStep();
      const select = wrapper.findComponent({ name: 'CmSelect' });
      await select.vm.$emit('update:modelValue', 'INCORPORATED_TRUSTEES');
      await nextTick();
      const nameInput = wrapper.findAllComponents({ name: 'CmInput' })[0];
      await nameInput.vm.$emit('update:modelValue', 'Faith Foundation');
      await nextTick();

      await (wrapper.vm as any).handleSubmit();
      expect(wrapper.emitted('next-step')).toBeTruthy();
    });
  });
});
