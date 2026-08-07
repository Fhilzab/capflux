/**
 * FinancialActivationStore — school-facing financial activation state.
 *   - KYC submission/status
 *   - CAC document upload
 *   - settlement account submission/status
 *   - gateway assignment status (read-only, no credentials)
 *   - payment activation status (readiness)
 *
 * All calls go through the cookie-authenticated apiClient. The store NEVER
 * exposes raw NIN/BVN or full settlement account numbers; the backend returns
 * masked values only.
 */
import { defineStore } from 'pinia';
import { apiClient } from '../shared/services/api/client';

interface KycStatus {
  kyc: {
    id: string;
    status: string;
    submittedAt?: string;
    reviewedAt?: string;
    reviewedBy?: string;
    rejectionReason?: string;
    bvnLast4?: string;
    ninLast4?: string;
    bvnMasked?: string | null;
    ninMasked?: string | null;
    officialEmail?: string;
    officialPhone?: string;
    cacRegistrationNumber?: string;
  } | null;
  schoolStatus: string | null;
  paymentStatus: string | null;
}

interface SettlementStatus {
  settlement: {
    id: string;
    status: string;
    bankCode?: string;
    bankName?: string;
    accountNumberLast4?: string | null;
    accountName?: string | null;
    rejectionReason?: string | null;
    submittedAt?: string;
    verifiedAt?: string;
  } | null;
  gateway: {
    provider: string;
    status: string;
    assignedAt?: string;
  } | null;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await apiClient.http({
    method: method as 'get' | 'post' | 'put' | 'patch' | 'delete',
    url: path,
    data: body,
  });
  return response.data as T;
}

export const useFinancialActivationStore = defineStore('financialActivation', {
  state: () => ({
    loading: false,
    error: null as string | null,
    kycStatus: null as KycStatus | null,
    settlementStatus: null as SettlementStatus | null,
    readiness: null as {
      ready: boolean;
      reason: string | null;
      conditions: Record<string, boolean>;
      school: { id: string; status: string; paymentStatus: string } | null;
    } | null,
    cacDocument: null as {
      mime_type?: string;
      file_size?: number;
      checksum?: string;
      uploaded_at?: string;
      status?: string;
    } | null,
  }),

  getters: {
    kycState(state): string {
      return state.kycStatus?.kyc?.status || 'NONE';
    },
    kycRejected(state): boolean {
      return state.kycStatus?.kyc?.status === 'REJECTED';
    },
    kycVerified(state): boolean {
      return state.kycStatus?.kyc?.status === 'VERIFIED';
    },
    kycUnderReview(state): boolean {
      return state.kycStatus?.kyc?.status === 'UNDER_REVIEW';
    },
    rejectionReason(state): string | null {
      return state.kycStatus?.kyc?.rejectionReason || null;
    },
    paymentStatus(state): string | null {
      return state.kycStatus?.paymentStatus || state.readiness?.school?.paymentStatus || null;
    },
    settlementState(state): string | null {
      return state.settlementStatus?.settlement?.status || null;
    },
    settlementVerified(state): boolean {
      return state.settlementStatus?.settlement?.status === 'VERIFIED';
    },
    gatewayAssigned(state): boolean {
      return Boolean(state.settlementStatus?.gateway);
    },
    gatewayProvider(state): string | null {
      return state.settlementStatus?.gateway?.provider || null;
    },
    isReady(): boolean {
      return this.paymentStatus === 'READY';
    },
  },

  actions: {
    async loadKycStatus() {
      this.loading = true;
      this.error = null;
      try {
        const data = await request<{ success: boolean; data: KycStatus }>('get', '/kyc/status');
        this.kycStatus = data.data;
      } catch (err) {
        this.error = (err as Error).message || 'Failed to load KYC status';
      } finally {
        this.loading = false;
      }
    },

    async submitKyc(payload: {
      principalName: string;
      principalPhone: string;
      officialEmail?: string;
      officialPhone?: string;
      cacRegistrationNumber?: string;
      bvn: string;
      nin: string;
    }) {
      this.loading = true;
      this.error = null;
      try {
        await request('post', '/kyc/submit', payload);
        await this.loadKycStatus();
      } catch (err) {
        this.error = (err as Error).message || 'Failed to submit KYC';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async resubmitKyc(payload: {
      principalName?: string;
      principalPhone?: string;
      officialEmail?: string;
      officialPhone?: string;
      cacRegistrationNumber?: string;
      bvn: string;
      nin: string;
    }) {
      this.loading = true;
      this.error = null;
      try {
        await request('post', '/kyc/resubmit', payload);
        await this.loadKycStatus();
      } catch (err) {
        this.error = (err as Error).message || 'Failed to resubmit KYC';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async uploadCacDocument(file: File) {
      this.loading = true;
      this.error = null;
      try {
        const dataBase64 = await fileToBase64(file);
        const data = await request<{ success: boolean; data: Record<string, unknown> }>(
          'post',
          '/kyc/documents/cac',
          {
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            dataBase64,
          }
        );
        this.cacDocument = data.data as typeof this.cacDocument;
      } catch (err) {
        this.error = (err as Error).message || 'Failed to upload CAC certificate';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async loadKycDocuments() {
      this.loading = true;
      this.error = null;
      try {
        const data = await request<{
          success: boolean;
          data: { cacDocument: typeof this.cacDocument } | null;
        }>('get', '/kyc/documents');
        this.cacDocument = data.data?.cacDocument || null;
      } catch (err) {
        this.error = (err as Error).message || 'Failed to load KYC documents';
      } finally {
        this.loading = false;
      }
    },

    async loadSettlementStatus() {
      this.loading = true;
      this.error = null;
      try {
        const data = await request<{ success: boolean; data: SettlementStatus }>('get', '/kyc/settlement');
        this.settlementStatus = data.data;
      } catch (err) {
        this.error = (err as Error).message || 'Failed to load settlement status';
      } finally {
        this.loading = false;
      }
    },

    async submitSettlement(bankCode: string, accountNumber: string) {
      this.loading = true;
      this.error = null;
      try {
        await request('post', '/kyc/settlement', { bankCode, accountNumber });
        await this.loadSettlementStatus();
      } catch (err) {
        this.error = (err as Error).message || 'Failed to submit settlement account';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async loadReadiness() {
      this.loading = true;
      this.error = null;
      try {
        const data = await request<{
          success: boolean;
          data: typeof this.readiness;
        }>('get', '/kyc/activation');
        this.readiness = data.data;
      } catch (err) {
        this.error = (err as Error).message || 'Failed to load activation status';
      } finally {
        this.loading = false;
      }
    },

    async loadAll() {
      await Promise.allSettled([
        this.loadKycStatus(),
        this.loadSettlementStatus(),
        this.loadReadiness(),
        this.loadKycDocuments(),
      ]);
    },

    reset() {
      this.kycStatus = null;
      this.settlementStatus = null;
      this.readiness = null;
      this.cacDocument = null;
      this.error = null;
    },
  },
});

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
