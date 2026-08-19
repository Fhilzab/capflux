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
 *
 * Resilience guarantees (Phase 8.3):
 *   - Each load method deduplicates concurrent calls (no duplicate requests).
 *   - `loading` reflects the true count of in-flight loads (parallel-safe).
 *   - A failed load preserves previously cached data.
 *   - 400/404 on GET status endpoints is treated as "prerequisite not met"
 *     (no school yet) — not a display error — so new users see "Not started"
 *     instead of a panic banner.
 */
import { defineStore } from 'pinia';
import { apiClient } from '../shared/services/api/client';
import { categorizeApiError, ApiErrorCategory } from '../shared/services/api/errors';

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
    identityDocumentType?: string;
    identityMatchStates?: Record<string, string>;
    verificationReference?: string;
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
    bvnLast4?: string | null;
    ownershipMatchStatus?: string | null;
    accountVerificationReference?: string | null;
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

interface Shareholder {
  id: string;
  fullName: string;
  ownershipPercentage: number;
  role: string;
  phone?: string;
  identityType: string;
  identityDocumentType: string;
  identityNinLast4?: string;
  identityMatchStatus?: string;
  verificationReference?: string;
}

interface Readiness {
  ready: boolean;
  reason: string | null;
  conditions: Record<string, boolean>;
  school: { id: string; status: string; paymentStatus: string } | null;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await apiClient.http({
    method: method as 'get' | 'post' | 'put' | 'patch' | 'delete',
    url: path,
    data: body,
  });
  return response.data as T;
}

type EnhancedError = Error & {
  status?: number;
  isNetworkError?: boolean;
  backendMessage?: string;
  category?: ApiErrorCategory;
  userMessage?: string;
};

/**
 * Module-level request in-flight count so that parallel loads (loadAll firing
 * four loads at once) keep `loading` true until ALL of them settle.
 */
let _activeLoadCount = 0;

/** Module-level dedup map so concurrent calls to the same loader coalesce. */
const _pendingLoads = new Map<string, Promise<void>>();

export const useFinancialActivationStore = defineStore('financialActivation', {
  state: () => ({
    _loadCount: 0,
    error: null as string | null,
    errorCategory: null as ApiErrorCategory | null,
     kycStatus: null as KycStatus | null,
    settlementStatus: null as SettlementStatus | null,
    readiness: null as Readiness | null,
    shareholders: [] as Shareholder[],
    principalInvitation: null as { email: string; status: string; expiresAt?: string } | null,
    cacDocument: null as {
      mime_type?: string;
      file_size?: number;
      checksum?: string;
      uploaded_at?: string;
      status?: string;
    } | null,
    kycStatusLoaded: false,
    settlementStatusLoaded: false,
    readinessLoaded: false,
  }),

  getters: {
    loading(state): boolean {
      // Backing counter tracks parallel in-flight loads so the UI doesn't
      // flash "loaded" while a sibling request is still in-flight.
      return state._loadCount > 0;
    },
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
    settlement(state): SettlementStatus['settlement'] {
      return state.settlementStatus?.settlement || null;
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
    /**
     * Deduplicate concurrent loaders keyed by name. Returns the in-flight
     * promise when a load is already running so the backend is never hit twice
     * for the same resource within an overlapping window.
     */
    _withDedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
      if (_pendingLoads.has(key)) {
        return _pendingLoads.get(key) as Promise<T>;
      }
      _activeLoadCount++;
      this._loadCount++;
      const promise = fn().finally(() => {
        _pendingLoads.delete(key);
        _activeLoadCount--;
        this._loadCount--;
      });
      _pendingLoads.set(key, promise as Promise<void>);
      return promise;
    },

    async loadKycStatus() {
      return this._withDedup('kycStatus', async () => {
        try {
          const data = await request<{ success: boolean; data: KycStatus }>('get', '/kyc/status');
          this.kycStatus = data.data;
        } catch (err) {
          this._handleStatusError(err as EnhancedError, 'Failed to load KYC status');
        } finally {
          this.kycStatusLoaded = true;
        }
      });
    },

    async submitKyc(payload: {
      principalName: string;
      principalPhone: string;
      officialEmail?: string;
      officialPhone?: string;
      cacRegistrationNumber?: string;
      bvn: string;
      nin: string;
      identityDocumentType?: string;
      personalInfo?: Record<string, unknown>;
    }) {
      try {
        await request('post', '/kyc/submit', payload);
        await this.loadKycStatus();
      } catch (err) {
        this._setError(err as EnhancedError, 'Failed to submit KYC');
        throw err;
      }
    },

    async fetchKycStatus() {
      return this.loadKycStatus();
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
      try {
        await request('post', '/kyc/resubmit', payload);
        await this.loadKycStatus();
      } catch (err) {
        this._setError(err as EnhancedError, 'Failed to resubmit KYC');
        throw err;
      }
    },

    async uploadCacDocument(file: File) {
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
        this._setError(err as EnhancedError, 'Failed to upload CAC certificate');
        throw err;
      }
    },

    async loadKycDocuments() {
      return this._withDedup('kycDocuments', async () => {
        try {
          const data = await request<{
            success: boolean;
            data: { cacDocument: typeof this.cacDocument } | null;
          }>('get', '/kyc/documents');
          this.cacDocument = data.data?.cacDocument || null;
        } catch (err) {
          this._handleStatusError(err as EnhancedError, 'Failed to load KYC documents');
        }
      });
    },

    async loadSettlementStatus() {
      return this._withDedup('settlementStatus', async () => {
        try {
          const data = await request<{ success: boolean; data: SettlementStatus }>('get', '/kyc/settlement');
          this.settlementStatus = data.data;
        } catch (err) {
          this._handleStatusError(err as EnhancedError, 'Failed to load settlement status');
        } finally {
          this.settlementStatusLoaded = true;
        }
      });
    },

    async submitSettlement(bankCode: string, accountNumber: string, bvn?: string) {
      try {
        await request('post', '/kyc/settlement', { bankCode, accountNumber, bvn });
        await this.loadSettlementStatus();
      } catch (err) {
        this._setError(err as EnhancedError, 'Failed to submit settlement account');
        throw err;
      }
    },

    async fetchKycDocuments() {
      return this.loadKycDocuments();
    },

    async fetchKycHistory() {
      return this._withDedup('kycHistory', async () => {
        try {
          const data = await request<{ success: boolean; data: unknown }>('get', '/kyc/history');
          return data.data;
        } catch (err) {
          this._handleStatusError(err as EnhancedError, 'Failed to load KYC history');
          return null;
        }
      });
    },

    async invitePrincipal(payload: {
      email: string;
      name: string;
      role: string;
    }) {
      try {
        const data = await request<{ success: boolean; data: Record<string, unknown> }>(
          'post',
          '/kyc/principal-invitation',
          payload
        );
        this.principalInvitation = {
          email: payload.email,
          status: data.data?.status || 'PENDING',
          expiresAt: data.data?.expires_at,
        };
      } catch (err) {
        this._setError(err as EnhancedError, 'Failed to send principal invitation');
        throw err;
      }
    },

    async fetchShareholders() {
      return this._withDedup('shareholders', async () => {
        try {
          const data = await request<{ success: boolean; data: Shareholder[] }>('get', '/kyc/shareholders');
          this.shareholders = data.data || [];
        } catch (err) {
          this._handleStatusError(err as EnhancedError, 'Failed to load shareholders');
        }
      });
    },

    async addShareholder(payload: {
      fullName: string;
      ownershipPercentage: number;
      role: string;
      phone?: string;
      dateOfBirth?: string;
      identityType: string;
      identityDocumentType: string;
      ninNumber?: string;
      identityDocument?: unknown;
    }) {
      try {
        const data = await request<{ success: boolean; data: Shareholder }>(
          'post',
          '/kyc/shareholders',
          payload
        );
        this.shareholders.push(data.data);
      } catch (err) {
        this._setError(err as EnhancedError, 'Failed to add shareholder');
        throw err;
      }
    },

    async deleteShareholder(id: string) {
      try {
        await request('delete', `/kyc/shareholders/${id}`);
        this.shareholders = this.shareholders.filter((s) => s.id !== id);
      } catch (err) {
        this._setError(err as EnhancedError, 'Failed to remove shareholder');
        throw err;
      }
    },

    async loadReadiness() {
      return this._withDedup('readiness', async () => {
        try {
          const data = await request<{ success: boolean; data: Readiness }>('get', '/kyc/activation');
          this.readiness = data.data;
        } catch (err) {
          this._handleStatusError(err as EnhancedError, 'Failed to load activation status');
        } finally {
          this.readinessLoaded = true;
        }
      });
    },

    async loadAll() {
      await Promise.allSettled([
        this.loadKycStatus(),
        this.loadSettlementStatus(),
        this.loadReadiness(),
        this.loadKycDocuments(),
        this.fetchShareholders(),
      ]);
    },

    /**
     * Handle GET status-endpoint failures. A 400/404 means the prerequisite
     * (e.g. "no school yet") isn't met — this is an expected state for new
     * users, so we leave data null and do NOT set a display error.
     */
    _handleStatusError(err: EnhancedError, fallback: string) {
      const status = err.status ?? err.response?.status;
      if (status === 400 || status === 404) {
        return;
      }
      this._setError(err, fallback);
    },

    _setError(err: EnhancedError, fallback: string) {
      const ctx = categorizeApiError(err, fallback);
      this.error = ctx.message;
      this.errorCategory = ctx.category;
    },

    clearError() {
      this.error = null;
      this.errorCategory = null;
    },

    reset() {
      this._loadCount = 0;
      this.kycStatus = null;
      this.settlementStatus = null;
      this.readiness = null;
      this.shareholders = [];
      this.principalInvitation = null;
      this.cacDocument = null;
      this.error = null;
      this.errorCategory = null;
      this.kycStatusLoaded = false;
      this.settlementStatusLoaded = false;
      this.readinessLoaded = false;
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
