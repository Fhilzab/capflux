import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

const onboardingStoreMock = vi.hoisted(() => ({
  businessType: null as string | null,
}));

const financialStoreMock = vi.hoisted(() => ({
  kycStatus: null as unknown,
  cacDocument: null as unknown,
  updateKycDraft: vi.fn(),
  loadKycDocuments: vi.fn(),
  uploadCacDocument: vi.fn(),
}));

vi.mock('@/stores/onboardingStore', () => ({
  useOnboardingStore: () => onboardingStoreMock,
}));

vi.mock('@/stores/financialActivationStore', () => ({
  useFinancialActivationStore: () => financialStoreMock,
}));

import OrganisationDocumentsStep from '../OrganisationDocumentsStep.vue';

function mountStep() {
  return mount(OrganisationDocumentsStep, {
    global: {
      stubs: { CmAlert: true, CmTooltip: true },
    },
  });
}

describe('OrganisationDocumentsStep.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onboardingStoreMock.businessType = null;
    financialStoreMock.kycStatus = null;
    financialStoreMock.cacDocument = null;
  });

  describe('registration number field', () => {
    it('shows the correct label for Private Company (RC Number)', () => {
      onboardingStoreMock.businessType = 'PRIVATE_LIMITED_COMPANY';
      const wrapper = mountStep();
      const input = wrapper.findComponent({ name: 'CmInput' });
      expect(input.props('label')).toContain('RC Number');
    });

    it('shows "CAC Registration Number" label for Business Name', () => {
      onboardingStoreMock.businessType = 'BUSINESS_NAME';
      const wrapper = mountStep();
      const input = wrapper.findComponent({ name: 'CmInput' });
      expect(input.props('label')).toBe('CAC Registration Number');
    });

    it('shows "LLP Registration Number" label for LLP', () => {
      onboardingStoreMock.businessType = 'LLP';
      const wrapper = mountStep();
      const input = wrapper.findComponent({ name: 'CmInput' });
      expect(input.props('label')).toBe('LLP Registration Number');
    });

    it('shows "LP Registration Number" label for LP', () => {
      onboardingStoreMock.businessType = 'LP';
      const wrapper = mountStep();
      const input = wrapper.findComponent({ name: 'CmInput' });
      expect(input.props('label')).toBe('LP Registration Number');
    });

    it('shows the registration number from the KYC status draft', () => {
      onboardingStoreMock.businessType = 'PRIVATE_LIMITED_COMPANY';
      financialStoreMock.kycStatus = {
        kyc: { cacRegistrationNumber: 'RC-9999999' },
      };
      const wrapper = mountStep();
      const input = wrapper.findComponent({ name: 'CmInput' });
      expect(input.props('modelValue')).toBe('RC-9999999');
    });
  });

  describe('dynamic document checklist', () => {
    it('shows director identity and shareholder info for Private Company', () => {
      onboardingStoreMock.businessType = 'PRIVATE_LIMITED_COMPANY';
      const wrapper = mountStep();
      const text = wrapper.text();
      expect(text).toContain('Director Identity Documents');
      expect(text).toContain('Shareholder / PSC Information');
      expect(text).toContain('Required');
    });

    it('does NOT show shareholder documents for Business Name', () => {
      onboardingStoreMock.businessType = 'BUSINESS_NAME';
      const wrapper = mountStep();
      const text = wrapper.text();
      expect(text).toContain('Proprietor / Owner Identity Document');
      expect(text).not.toContain('Shareholder / PSC Information');
      expect(text).not.toContain('Director Identity Documents');
    });

    it('does NOT show shareholder documents for Incorporated Trustees', () => {
      onboardingStoreMock.businessType = 'INCORPORATED_TRUSTEES';
      const wrapper = mountStep();
      const text = wrapper.text();
      expect(text).toContain('Trustee Identity Documents');
      expect(text).not.toContain('Shareholder / PSC Information');
      expect(text).not.toContain('Director Identity Documents');
    });

    it('shows optional documents marked as Optional', () => {
      onboardingStoreMock.businessType = 'PRIVATE_LIMITED_COMPANY';
      const wrapper = mountStep();
      const text = wrapper.text();
      expect(text).toContain('Optional');
    });

    it('shows company constitution as required for Public Company (not just copy private)', () => {
      onboardingStoreMock.businessType = 'PUBLIC_LIMITED_COMPANY';
      const wrapper = mountStep();
      const text = wrapper.text();
      // Public company should require constitution (different from private)
      expect(text).toContain('Company Constitution');
    });
  });

  describe('document preservation and switching', () => {
    it('does not show warning when switching between compatible types', async () => {
      // Private → Public Ltd share the same document set, so no warning.
      onboardingStoreMock.businessType = 'PRIVATE_LIMITED_COMPANY';
      const wrapper = mountStep();
      await wrapper.findComponent({ name: 'CmSelect' }).vm.$emit('update:modelValue', 'PUBLIC_LIMITED_COMPANY');
      await nextTick();
      // warning CmAlert (variant="warning") must not be rendered
      const warningAlert = wrapper
        .findAllComponents({ name: 'CmAlert' })
        .find((a) => a.attributes('variant') === 'warning');
      expect(warningAlert).toBeUndefined();
    });

    it('warns when switching from company to non-company type', async () => {
      onboardingStoreMock.businessType = 'PRIVATE_LIMITED_COMPANY';
      const wrapper = mountStep();
      await wrapper.findComponent({ name: 'CmSelect' }).vm.$emit('update:modelValue', 'BUSINESS_NAME');
      await nextTick();
      // After switching, an incompatible-documents warning alert must render.
      // (CmAlert is stubbed, so assert on the stub's variant prop, not text.)
      const warningAlert = wrapper
        .findAllComponents({ name: 'CmAlert' })
        .find((a) => a.attributes('variant') === 'warning');
      expect(warningAlert).toBeDefined();
    });

    it('emits switch-business-type when business type is changed', async () => {
      onboardingStoreMock.businessType = 'PRIVATE_LIMITED_COMPANY';
      const wrapper = mountStep();
      const select = wrapper.findComponent({ name: 'CmSelect' });
      await select.vm.$emit('update:modelValue', 'LLP');
      await nextTick();
      expect(wrapper.emitted('switch-business-type')).toBeTruthy();
      expect(wrapper.emitted('switch-business-type')![0]).toEqual(['LLP']);
    });
  });

  describe('canProceed', () => {
    it('returns false when registration number is empty', () => {
      onboardingStoreMock.businessType = 'PRIVATE_LIMITED_COMPANY';
      const wrapper = mountStep();
      // defineExpose unwraps refs — canProceed reads as a plain boolean
      expect((wrapper.vm as any).canProceed).toBe(false);
    });

    it('returns true when registration number is provided', async () => {
      onboardingStoreMock.businessType = 'PRIVATE_LIMITED_COMPANY';
      const wrapper = mountStep();
      const input = wrapper.findComponent({ name: 'CmInput' });
      await input.vm.$emit('update:modelValue', 'RC-1234567');
      await nextTick();
      expect((wrapper.vm as any).canProceed).toBe(true);
    });
  });

  describe('saveAndContinue', () => {
    it('saves registration number to KYC draft and emits next-step', async () => {
      onboardingStoreMock.businessType = 'PRIVATE_LIMITED_COMPANY';
      const wrapper = mountStep();
      // set via the exposed reactive form object (same reference the component uses)
      ;(wrapper.vm as any).form.cacRegistrationNumber = 'RC-1234567';
      await nextTick();
      await (wrapper.vm as any).saveAndContinue();
      expect(financialStoreMock.updateKycDraft).toHaveBeenCalledWith(
        expect.objectContaining({ cacRegistrationNumber: 'RC-1234567' }),
      );
      expect(wrapper.emitted('next-step')).toBeTruthy();
    });
  });
});
