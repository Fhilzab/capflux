vi.mock('@/lib/supabase', () => ({
  supabase: null,
  hasSupabaseConfig: false,
  getSupabase: () => null,
}));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

const { mockActivationStore } = vi.hoisted(() => ({
  mockActivationStore: {
    kycStatus: null as Record<string, unknown> | null,
    kycSubmissionDraft: {
      nin: null as string | null,
      bvn: null as string | null,
      identityDocumentType: null as string | null,
      documentNumber: null as string | null,
    },
    error: null as string | null,
    updateKycDraft: vi.fn(),
    clearError: vi.fn(),
    loadKycStatus: vi.fn(),
    loadSettlementStatus: vi.fn(),
    uploadIdentityDocument: vi.fn(),
  },
}));

vi.mock('@/stores/financialActivationStore', () => ({
  useFinancialActivationStore: () => mockActivationStore,
}));

import IdentityVerificationStep from '../IdentityVerificationStep.vue';
import CmButton from '@/components/ui/CmButton.vue';
import CmInput from '@/components/ui/CmInput.vue';
import CmSelect from '@/components/ui/CmSelect.vue';
import { flushPromises } from '@vue/test-utils';

function mountStep(kycStatus = null) {
  mockActivationStore.kycStatus = kycStatus;
  return mount(IdentityVerificationStep, {
    global: {
      stubs: { CmAlert: true },
    },
  });
}

describe('IdentityVerificationStep.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActivationStore.kycStatus = null;
    mockActivationStore.kycSubmissionDraft = {
      nin: null,
      bvn: null,
      identityDocumentType: null,
      documentNumber: null,
    };
    mockActivationStore.error = null;
    mockActivationStore.updateKycDraft = vi.fn();
  });

  describe('form not yet submitted', () => {
    it('does not render personal information form', () => {
      const wrapper = mountStep();
      const text = wrapper.text();

      // Identity step must not repeat personal info fields
      expect(text).not.toContain('First Name *');
      expect(text).not.toContain('Last Name *');
      expect(text).not.toContain('Date of Birth *');
    });

    it('renders document type as a dropdown/select control', () => {
      const wrapper = mountStep();
      const selects = wrapper.findAll('select');
      expect(selects.length).toBeGreaterThan(0);
    });

    it('shows NIN selector with all document options', () => {
      const wrapper = mountStep();
      const text = wrapper.text();

      expect(text).toContain('NIN Slip');
      expect(text).toContain('NIN Card');
      expect(text).toContain('International Passport');
      expect(text).toContain("Voter's Card");
    });

    it('shows document upload (image and PDF accepted)', () => {
      const wrapper = mountStep();
      const fileInput = wrapper.find('input[type="file"]');
      expect(fileInput.exists()).toBe(true);
      const accept = fileInput.attributes('accept');
      expect(accept).toContain('.jpg');
      expect(accept).toContain('.png');
      expect(accept).toContain('.pdf');
    });

    it('explains NIN is encrypted and not exposed', () => {
      const wrapper = mountStep();
      expect(wrapper.text()).toContain('encrypted');
    });

    it('shows NIN Number field only when NIN type selected', async () => {
      const wrapper = mountStep();

      // Initially no NIN number field
      expect(wrapper.text()).not.toContain('NIN Number');

      const select = wrapper.find('select');
      await select.setValue('NIN_SLIP');
      await nextTick();

      expect(wrapper.text()).toContain('NIN Number');
    });

    it('shows Document Number field for non-NIN document types', async () => {
      const wrapper = mountStep();

      const select = wrapper.find('select');
      await select.setValue('INTERNATIONAL_PASSPORT');
      await nextTick();

      expect(wrapper.text()).toContain('Document Number');
    });
  });

  describe('verification states', () => {
    function verifiedKyc(matchStates: Record<string, string>) {
      return {
        kyc: {
          id: 'kyc-1',
          status: 'VERIFIED',
          identityDocumentType: 'NIN_SLIP',
          ninLast4: '1234',
          ninVerificationStatus: 'VERIFIED',
          identityMatchStates: matchStates,
          verificationReference: 'ref-123',
          verificationProvider: 'mock',
        },
      };
    }

    it('renders MATCH state', () => {
      const wrapper = mountStep(verifiedKyc({
        overall: 'MATCH',
        name: 'MATCH',
        dateOfBirth: 'MATCH',
        phone: 'MATCH',
        identityNumber: 'MATCH',
      }));
      expect(wrapper.text()).toContain('Match');
    });

    it('renders MISMATCH state', () => {
      const wrapper = mountStep(verifiedKyc({
        overall: 'MISMATCH',
        name: 'MISMATCH',
        dateOfBirth: 'MATCH',
        phone: 'NOT_VERIFIED',
        identityNumber: 'MATCH',
      }));
      expect(wrapper.text()).toContain('Mismatch');
    });

    it('renders NOT_PROVIDED state', () => {
      const wrapper = mountStep(verifiedKyc({
        overall: 'NOT_VERIFIED',
        name: 'NOT_PROVIDED',
        dateOfBirth: 'NOT_PROVIDED',
        phone: 'NOT_VERIFIED',
        identityNumber: 'MATCH',
      }));
      const text = wrapper.text();
      expect(text).toContain('Not Provided');
      expect(text).toContain('Not Verified');
    });

    it('renders PENDING state (verifying)', () => {
      const wrapper = mountStep({
        kyc: {
          id: 'kyc-1',
          status: 'UNDER_REVIEW',
          identityDocumentType: 'NIN_SLIP',
          ninVerificationStatus: 'PENDING',
        },
      });
      expect(wrapper.text()).toContain('Verifying');
    });

    it('renders FAILED state (rejected)', () => {
      const wrapper = mountStep({
        kyc: {
          id: 'kyc-1',
          status: 'REJECTED',
          identityDocumentType: 'NIN_SLIP',
          ninVerificationStatus: 'FAILED',
          rejectionReason: 'Document could not be verified.',
        },
      });
      expect(wrapper.text()).toContain('Rejected');
    });

    it('never displays complete NIN - only last 4', () => {
      const wrapper = mountStep(verifiedKyc({
        overall: 'MATCH',
        name: 'MATCH',
        dateOfBirth: 'MATCH',
        phone: 'MATCH',
        identityNumber: 'MATCH',
      }));
      const text = wrapper.text();
      // Should NOT contain the full 11-digit NIN
      expect(text).not.toMatch(/\d{11}/);
    });
  });

  describe('submitting identity', () => {
    it('stores NIN in draft and emits next-step', async () => {
      mockActivationStore.updateKycDraft = vi.fn().mockReturnValue(undefined);

      const wrapper = mountStep();

      const select = wrapper.find('select');
      await select.setValue('NIN_SLIP');
      await nextTick();

      const ninInput = wrapper.findAllComponents(CmInput)[0];
      await ninInput.vm.$emit('update:modelValue', '12345678901');
      await nextTick();

      const file = new File(['test'], 'test.jpg', {
        type: 'image/jpeg',
      });
      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [file],
        configurable: true,
      });
      await fileInput.trigger('change');
      await nextTick();

      const buttons = wrapper.findAllComponents(CmButton);
      const saveButton = buttons[1];
      expect(saveButton?.props('disabled')).toBe(false);
      await saveButton?.vm.$emit('click');
      await flushPromises();

      expect(mockActivationStore.updateKycDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          nin: '12345678901',
          identityDocumentType: 'NIN_SLIP',
        }),
      );
    });

    it('stores document number in draft for non-NIN documents', async () => {
      mockActivationStore.updateKycDraft = vi.fn().mockReturnValue(undefined);

      const wrapper = mountStep();

      const select = wrapper.find('select');
      await select.setValue('VOTERS_CARD');
      await nextTick();

      const docNumberInput = wrapper.findAllComponents(CmInput)[0];
      await docNumberInput.vm.$emit('update:modelValue', 'VCA-123456789');
      await nextTick();

      const file = new File(['test'], 'test.pdf', {
        type: 'application/pdf',
      });
      const fileInput = wrapper.find('input[type="file"]');
      Object.defineProperty(fileInput.element, 'files', {
        value: [file],
        configurable: true,
      });
      await fileInput.trigger('change');
      await nextTick();

      const buttons = wrapper.findAllComponents(CmButton);
      const saveButton = buttons[1];
      await saveButton?.vm.$emit('click');
      await flushPromises();

      expect(mockActivationStore.updateKycDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          documentNumber: 'VCA-123456789',
          identityDocumentType: 'VOTERS_CARD',
        }),
      );
    });
  });

  describe('draft restoration', () => {
    it('restores document type from draft on mount', async () => {
      mockActivationStore.kycSubmissionDraft = {
        nin: null,
        bvn: null,
        identityDocumentType: 'NIN_SLIP',
        documentNumber: null,
      };

      const wrapper = mountStep();
      await nextTick();

      const select = wrapper.find('select');
      expect(select.element.value).toBe('NIN_SLIP');
      expect(wrapper.text()).toContain('NIN Number');
    });

    it('restores NIN number from draft on mount', async () => {
      mockActivationStore.kycSubmissionDraft = {
        nin: '98765432109',
        bvn: null,
        identityDocumentType: 'NIN_SLIP',
        documentNumber: null,
      };

      const wrapper = mountStep();
      await nextTick();

      const select = wrapper.find('select');
      expect(select.element.value).toBe('NIN_SLIP');
    });

    it('restores document number from draft on mount', async () => {
      mockActivationStore.kycSubmissionDraft = {
        nin: null,
        bvn: null,
        identityDocumentType: 'INTERNATIONAL_PASSPORT',
        documentNumber: 'P12345678',
      };

      const wrapper = mountStep();
      await nextTick();

      const select = wrapper.find('select');
      expect(select.element.value).toBe('INTERNATIONAL_PASSPORT');
      // Document Number input should show the restored value
      const docNumberInput = wrapper.findAllComponents(CmInput).find(
        (i) => i.props('label') === 'Document Number',
      );
      expect(docNumberInput?.props('modelValue')).toBe('P12345678');
    });
  });
});
