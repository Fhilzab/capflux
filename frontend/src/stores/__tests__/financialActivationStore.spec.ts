import { setActivePinia, createPinia } from 'pinia';
import { useFinancialActivationStore } from '@/stores/financialActivationStore';

const STORAGE_KEY = 'capflux:kycSubmissionDraft';

describe('financialActivationStore - draft persistence', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('starts with empty draft', () => {
    const store = useFinancialActivationStore();
    expect(store.kycSubmissionDraft.nin).toBe(null);
    expect(store.kycSubmissionDraft.identityDocumentType).toBe(null);
    expect(store.kycSubmissionDraft.bvn).toBe(null);
  });

  it('updateKycDraft persists to localStorage', () => {
    const store = useFinancialActivationStore();
    store.updateKycDraft({
      nin: '12345678901',
      identityDocumentType: 'NIN_SLIP',
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.nin).toBe('12345678901');
    expect(saved.identityDocumentType).toBe('NIN_SLIP');
  });

  it('loadKycDraft restores from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      nin: '98765432109',
      bvn: '12345678901',
      identityDocumentType: 'NIN_CARD',
      cacRegistrationNumber: 'CAC-123',
      settlementBankCode: '000001',
      settlementAccountNumber: '1234567890',
    }));

    const store = useFinancialActivationStore();
    store.loadKycDraft();

    expect(store.kycSubmissionDraft.nin).toBe('98765432109');
    expect(store.kycSubmissionDraft.bvn).toBe('12345678901');
    expect(store.kycSubmissionDraft.identityDocumentType).toBe('NIN_CARD');
    expect(store.kycSubmissionDraft.cacRegistrationNumber).toBe('CAC-123');
    expect(store.kycSubmissionDraft.settlementBankCode).toBe('000001');
    expect(store.kycSubmissionDraft.settlementAccountNumber).toBe('1234567890');
  });

  it('reset clears localStorage draft', () => {
    const store = useFinancialActivationStore();
    store.updateKycDraft({ nin: '12345678901' });
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();

    store.reset();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(store.kycSubmissionDraft.nin).toBe(null);
  });

  it('loadKycDraft handles corrupt localStorage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, '{ invalid json');

    const store = useFinancialActivationStore();
    expect(() => store.loadKycDraft()).not.toThrow();
    expect(store.kycSubmissionDraft.nin).toBe(null);
  });

  it('draft survives simulate refresh (destroy + recreate store)', () => {
    let store = useFinancialActivationStore();
    store.updateKycDraft({
      nin: '11111111111',
      identityDocumentType: 'INTERNATIONAL_PASSPORT',
      documentNumber: 'P12345678',
    });

    // Simulate browser refresh: recreate store
    setActivePinia(createPinia());
    store = useFinancialActivationStore();
    store.loadKycDraft();

    expect(store.kycSubmissionDraft.nin).toBe('11111111111');
    expect(store.kycSubmissionDraft.identityDocumentType).toBe('INTERNATIONAL_PASSPORT');
    expect(store.kycSubmissionDraft.documentNumber).toBe('P12345678');
  });

  it('kycReadyForSubmission is false when draft is empty', () => {
    const store = useFinancialActivationStore();
    expect(store.kycReadyForSubmission).toBe(false);
  });

  it('kycReadyForSubmission is true when all required fields present', () => {
    const store = useFinancialActivationStore();
    store.updateKycDraft({
      nin: '12345678901',
      bvn: '12345678901',
      identityDocumentType: 'NIN_SLIP',
      principalName: 'John Doe',
      principalPhone: '08012345678',
      officialEmail: 'test@example.com',
      cacRegistrationNumber: 'CAC-123',
      settlementBankCode: '000001',
      settlementAccountNumber: '1234567890',
    });
    expect(store.kycReadyForSubmission).toBe(true);
  });

  it('does not store empty string values in localStorage', () => {
    const store = useFinancialActivationStore();
    store.updateKycDraft({
      nin: '',  // empty string should not be persisted
      identityDocumentType: 'NIN_SLIP',
    });

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.nin).toBeUndefined();
    expect(saved.identityDocumentType).toBe('NIN_SLIP');
  });
});
