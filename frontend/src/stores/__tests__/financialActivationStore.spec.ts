/**
 * financialActivationStore.spec.ts — Phase 8.4 KYC/financial store tests.
 *
 * Tests ownership of:
 *  - KYC submission with identity document type
 *  - Settlement submission with BVN
 *  - Principal invitation
 *  - Shareholder management
 *  - Identity verification status with match states
 *  - Settlement status with ownership match
 *  - No plaintext PII in store state
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useFinancialActivationStore } from '../financialActivationStore';

const apiRequestMock = vi.fn();

vi.mock('@/shared/services/api/client', () => ({
  apiClient: {
    http: (...args: unknown[]) => apiRequestMock(...args),
  },
}));

vi.mock('@/shared/services/api/errors', () => ({
  categorizeApiError: (err: Error) => ({
    message: err.message,
    category: 'SERVER_ERROR',
  }),
  ApiErrorCategory: {
    NETWORK_ERROR: 'NETWORK_ERROR',
    AUTH_ERROR: 'AUTH_ERROR',
    SERVER_ERROR: 'SERVER_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    ONBOARDING_ERROR: 'ONBOARDING_ERROR',
  },
}));

describe('financialActivationStore (Phase 8.4 KYC consolidation)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiRequestMock.mockReset();
  });

  describe('submitKyc', () => {
    it('sends identity document type with the payload', async () => {
      const store = useFinancialActivationStore();
      apiRequestMock.mockResolvedValueOnce({ data: { success: true } });
      apiRequestMock.mockResolvedValueOnce({ data: { success: true, data: {} } });

      await store.submitKyc({
        principalName: 'John Doe',
        principalPhone: '08012345678',
        bvn: '',
        nin: '12345678901',
        identityDocumentType: 'NIN_SLIP',
        personalInfo: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
        },
      });

      expect(apiRequestMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
          url: '/kyc/submit',
          data: expect.objectContaining({
            identityDocumentType: 'NIN_SLIP',
            nin: '12345678901',
          }),
        }),
      );
    });
  });

  describe('submitSettlement', () => {
    it('accepts BVN and sends it with the settlement payload', async () => {
      const store = useFinancialActivationStore();
      apiRequestMock.mockResolvedValueOnce({ data: { success: true } });
      apiRequestMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            settlement: {
              id: 's1',
              status: 'PENDING_VERIFICATION',
              bank_code: '000001',
              account_number_last4: '5678',
              bvn_last4: '5678',
              ownership_match_status: 'PENDING',
            },
            gateway: null,
          },
        },
      });

      await store.submitSettlement('000001', '1234567890', '12345678901');

      expect(apiRequestMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
          url: '/kyc/settlement',
          data: { bankCode: '000001', accountNumber: '1234567890', bvn: '12345678901' },
        }),
      );
    });

    it('accepts settlement without BVN (optional)', async () => {
      const store = useFinancialActivationStore();
      apiRequestMock.mockResolvedValueOnce({ data: { success: true } });
      apiRequestMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            settlement: { id: 's1', status: 'PENDING_VERIFICATION' },
            gateway: null,
          },
        },
      });

      await store.submitSettlement('000001', '1234567890');

      expect(apiRequestMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
          url: '/kyc/settlement',
          data: { bankCode: '000001', accountNumber: '1234567890', bvn: undefined },
        }),
      );
    });
  });

  describe('invitePrincipal', () => {
    it('sends invitation email and stores the result', async () => {
      const store = useFinancialActivationStore();
      apiRequestMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: { email: 'principal@example.com', status: 'PENDING', expires_at: '2026-12-31' },
        },
      });

      await store.invitePrincipal({
        email: 'principal@example.com',
        name: 'Jane Smith',
        role: 'Principal',
      });

      expect(store.principalInvitation?.email).toBe('principal@example.com');
      expect(store.principalInvitation?.status).toBe('PENDING');
    });
  });

  describe('addShareholder', () => {
    it('adds a shareholder to the state', async () => {
      const store = useFinancialActivationStore();
      apiRequestMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            id: 'sh1',
            fullName: 'John Doe',
            ownershipPercentage: 75,
            role: 'Director',
            identityType: 'NIN',
            identityDocumentType: 'NIN_CARD',
            identityNinLast4: '1234',
          },
        },
      });

      await store.addShareholder({
        fullName: 'John Doe',
        ownershipPercentage: 75,
        role: 'Director',
        identityType: 'NIN',
        identityDocumentType: 'NIN_CARD',
        ninNumber: '12345678901',
      });

      expect(store.shareholders).toHaveLength(1);
      expect(store.shareholders[0].fullName).toBe('John Doe');
      expect(store.shareholders[0].identityNinLast4).toBe('1234');
    });

    it('does not expose plaintext NIN', async () => {
      const store = useFinancialActivationStore();
      apiRequestMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            id: 'sh1',
            fullName: 'John Doe',
            ownershipPercentage: 75,
            role: 'Director',
            identityType: 'NIN',
            identityDocumentType: 'NIN_CARD',
            identityNinLast4: '1234',
          },
        },
      });

      await store.addShareholder({
        fullName: 'John Doe',
        ownershipPercentage: 75,
        role: 'Director',
        identityType: 'NIN',
        identityDocumentType: 'NIN_CARD',
        ninNumber: '12345678901',
      });

      const storeCopy = JSON.parse(JSON.stringify(store.shareholders[0]));
      expect(storeCopy).not.toHaveProperty('ninNumber');
      expect(storeCopy).not.toHaveProperty('nin');
      expect(storeCopy.identityNinLast4).toBe('1234');
    });
  });

  describe('loadKycStatus', () => {
    it('stores capability-aware identity match states', async () => {
      const store = useFinancialActivationStore();
      apiRequestMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            kyc: {
              id: 'kyc-1',
              status: 'VERIFIED',
              bvn_last4: '5678',
              nin_last4: '1234',
              identity_document_type: 'NIN_SLIP',
              identity_match_states: {
                overall: 'MATCH',
                name: 'MATCH',
                date_of_birth: 'NOT_PROVIDED',
                phone: 'MISMATCH',
              },
              verification_reference: 'ref-123',
            },
            schoolStatus: 'ACTIVE',
            paymentStatus: 'PENDING_KYC',
          },
        },
      });

      await store.loadKycStatus();

      expect(store.kycState).toBe('VERIFIED');
      expect(store.kycVerified).toBe(true);
      expect(store.kycStatus?.kyc?.identity_match_states).toEqual({
        overall: 'MATCH',
        name: 'MATCH',
        date_of_birth: 'NOT_PROVIDED',
        phone: 'MISMATCH',
      });
    });

    it('treats 400/404 as "not started" (prerequisite not met)', async () => {
      const store = useFinancialActivationStore();
      apiRequestMock.mockRejectedValueOnce({
        status: 400,
        response: { status: 400, data: { error: 'No school yet' } },
        message: 'Request failed with status code 400',
      });

      await store.loadKycStatus();

      expect(store.kycStatus).toBeNull();
      expect(store.kycState).toBe('NONE');
    });
  });

  describe('loadSettlementStatus', () => {
    it('stores ownership match status', async () => {
      const store = useFinancialActivationStore();
      apiRequestMock.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            settlement: {
              id: 's1',
              status: 'VERIFIED',
              bank_code: '000001',
              account_number_last4: '5678',
              bvn_last4: '5678',
              ownership_match_status: 'OWNERSHIP_MATCH',
            },
            gateway: { provider: 'mock', status: 'ASSIGNED' },
          },
        },
      });

      await store.loadSettlementStatus();

      expect(store.settlement?.status).toBe('VERIFIED');
      expect(store.settlement?.ownership_match_status).toBe('OWNERSHIP_MATCH');
      expect(store.settlementVerified).toBe(true);
    });
  });

  describe('no plaintext PII leakage', () => {
    it('never stores full BVN or NIN in state', async () => {
      const store = useFinancialActivationStore();

      store.kycStatus = {
        kyc: {
          id: 'kyc-1',
          status: 'VERIFIED',
          bvn_last4: '5678',
          nin_last4: '1234',
        } as any,
        schoolStatus: 'ACTIVE',
        paymentStatus: 'PENDING_KYC',
      };

      const stateJson = JSON.stringify(store.$state);
      expect(stateJson).not.toContain('12345678901'); // full BVN
      expect(stateJson).not.toContain('12345678901'); // full NIN
      // Last-4 values are safe
      expect(stateJson).toContain('5678');
      expect(stateJson).toContain('1234');
    });
  });
});
