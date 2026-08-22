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
 * Canonical boundary contract:
 *   The backend API returns snake_case fields (matching the PostgreSQL schema).
 *   The store NORMALIZES them once into a camelCase frontend model. Components
 *   consume ONLY the normalized model — never raw backend fields.
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

// ---------------------------------------------------------------------------
// Canonical frontend model (camelCase). Components consume ONLY these types.
// ---------------------------------------------------------------------------

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'FAILED' | 'NOT_VERIFIED' | 'UNDER_REVIEW' | 'REJECTED';

export type MatchState = 'MATCH' | 'MISMATCH' | 'NOT_PROVIDED' | 'NOT_VERIFIED' | 'PENDING' | 'FAILED';

export type OverallMatch = 'MATCH' | 'MISMATCH' | 'NOT_PROVIDED' | 'NOT_VERIFIED' | 'PENDING' | 'FAILED';

export interface IdentityMatchStates {
  overall: OverallMatch;
  name: MatchState;
  dateOfBirth: MatchState;
  phone: MatchState;
  identityNumber: MatchState;
}

export interface KycStatusModel {
  id: string;
  status: VerificationStatus;
  businessType: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  bvnLast4: string | null;
  ninLast4: string | null;
  bvnMasked: string | null;
  ninMasked: string | null;
  officialEmail: string | null;
  officialPhone: string | null;
  cacRegistrationNumber: string | null;
  cacDocumentMimeType: string | null;
  cacDocumentUploadedAt: string | null;
  cacDocumentStatus: VerificationStatus | null;
  identityDocumentType: string | null;
  identityMatchStates: IdentityMatchStates | null;
  verificationReference: string | null;
  verificationProvider: string | null;
  bvnVerificationStatus: VerificationStatus;
  ninVerificationStatus: VerificationStatus;
}

export interface SettlementModel {
  id: string;
  status: string;
  bankCode: string | null;
  bankName: string | null;
  accountNumberLast4: string | null;
  accountName: string | null;
  bvnLast4: string | null;
  ownershipMatchStatus: string | null;
  accountVerificationReference: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
}

export interface GatewayModel {
  provider: string;
  status: string;
  assignedAt: string | null;
}

export interface ShareholderModel {
  id: string;
  fullName: string;
  ownershipPercentage: number;
  role: string;
  phone: string | null;
  identityType: string;
  identityDocumentType: string | null;
  identityNinLast4: string | null;
  identityMatchStatus: string | null;
  verificationReference: string | null;
  createdAt: string | null;
}

export interface PrincipalInvitationModel {
  id: string;
  email: string;
  status: string;
  token: string | null;
  expiresAt: string | null;
  accepted: boolean;
  existing: boolean;
}

export interface CacDocumentModel {
  mimeType: string | null;
  fileSize: number | null;
  checksum: string | null;
  uploadedAt: string | null;
  status: string | null;
  storagePath: string | null;
}

export interface KycStatus {
  kyc: KycStatusModel | null;
  schoolStatus: string | null;
  paymentStatus: string | null;
  businessType: string | null;
}

export interface SettlementStatus {
  settlement: SettlementModel | null;
  gateway: GatewayModel | null;
}

export interface ReadinessState {
  ready: boolean;
  reason: string | null;
  conditions: Record<string, boolean>;
  school: { id: string; status: string; paymentStatus: string } | null;
}

// ---------------------------------------------------------------------------
// Normalization: snake_case (backend) → camelCase (frontend model)
// ---------------------------------------------------------------------------

const FIELD_DISPLAY: Record<string, string> = {
  name: 'Name',
  dateOfBirth: 'Date of Birth',
  phone: 'Phone',
  identityNumber: 'NIN/BVN',
};

/** Derive overall identity match from per-field states + verification status. */
function deriveOverall(
  fields: Record<string, string>,
  ninVerificationStatus?: string,
): OverallMatch {
  const vals = Object.values(fields) as string[];
  if (vals.includes('MISMATCH')) return 'MISMATCH';
  if (vals.includes('MATCH')) return 'MATCH';
  if (ninVerificationStatus === 'PENDING' || vals.includes('PENDING')) return 'PENDING';
  if (ninVerificationStatus === 'FAILED' || vals.includes('FAILED')) return 'FAILED';
  return 'NOT_VERIFIED';
}

/** Normalize raw identity_match_states from DB into the frontend model. */
function normalizeMatchStates(raw: unknown, ninVerificationStatus?: string): IdentityMatchStates | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.overall === 'string') {
    // Already has an overall — use it (backward compat with submit response)
    return {
      overall: r.overall as OverallMatch,
      name: (r.name as MatchState) || 'NOT_PROVIDED',
      dateOfBirth: (r.dateOfBirth || (r as Record<string, unknown>).date_of_birth || 'NOT_PROVIDED') as MatchState,
      phone: (r.phone as MatchState) || 'NOT_PROVIDED',
      identityNumber: (r.identityNumber || (r as Record<string, unknown>).identity_number || 'NOT_PROVIDED') as MatchState,
    };
  }

  // Derive overall from field states (backend stores comparison.fields, not comparison.overall)
  const fields: Record<string, string> = {};
  fields.name = (r.name as MatchState) || (r as Record<string, unknown>).name || 'NOT_PROVIDED';
  fields.dateOfBirth = (r.dateOfBirth as MatchState) || (r as Record<string, unknown>).date_of_birth || 'NOT_PROVIDED';
  fields.phone = (r.phone as MatchState) || (r as Record<string, unknown>).phone || 'NOT_PROVIDED';
  fields.identityNumber = (r.identityNumber as MatchState) || (r as Record<string, unknown>).identity_number || 'NOT_PROVIDED';

  return {
    overall: deriveOverall(fields, ninVerificationStatus),
    name: fields.name as MatchState,
    dateOfBirth: fields.dateOfBirth as MatchState,
    phone: fields.phone as MatchState,
    identityNumber: fields.identityNumber as MatchState,
  };
}

function maskLast4(value: string | null | undefined): string | null {
  if (!value) return null;
  // Show last 4 digits with asterisks prefix
  return '****-****-****-' + value;
}

/** Normalize the /kyc/status response into the canonical frontend model. */
function normalizeKycStatus(raw: unknown): KycStatus {
  if (!raw || typeof raw !== 'object') {
    return { kyc: null, schoolStatus: null, paymentStatus: null, businessType: null };
  }

  const r = raw as Record<string, unknown>;
  const kyc = (r.kyc || r) as Record<string, unknown> | null;

  if (!kyc) {
    return {
      kyc: null,
      schoolStatus: (r.schoolStatus as string) || r.school_status || null,
      paymentStatus: (r.paymentStatus as string) || r.payment_status || null,
      businessType: (r.businessType as string) || null,
    };
  }

  const matchStates = normalizeMatchStates(
    kyc.identity_match_states,
    kyc.nin_verification_status || (kyc as Record<string, unknown>).ninVerificationStatus,
  );

  const bvnLast4 = kyc.bvn_last4 || kyc.bvnLast4;
  const ninLast4 = kyc.nin_last4 || kyc.ninLast4;

  return {
    kyc: {
      id: (kyc.id as string) || '',
      status: (kyc.status as VerificationStatus) || 'PENDING',
      submittedAt: (kyc.submitted_at || kyc.submittedAt) as string | null,
      reviewedAt: (kyc.reviewed_at || kyc.reviewedAt) as string | null,
      reviewedBy: (kyc.reviewed_by || kyc.reviewedBy) as string | null,
      rejectionReason: (kyc.rejection_reason || kyc.rejectionReason) as string | null,
      bvnLast4: bvnLast4 || null,
      ninLast4: ninLast4 || null,
      bvnMasked: maskLast4(bvnLast4 as string),
      ninMasked: maskLast4(ninLast4 as string),
      officialEmail: (kyc.official_email || kyc.officialEmail) as string | null,
      officialPhone: (kyc.official_phone || kyc.officialPhone) as string | null,
      cacRegistrationNumber: (kyc.cac_registration_number || kyc.cacRegistrationNumber) as string | null,
      cacDocumentMimeType: (kyc.cac_document_mime_type || kyc.cacDocumentMimeType) as string | null,
      cacDocumentUploadedAt: (kyc.cac_document_uploaded_at || kyc.cacDocumentUploadedAt) as string | null,
      cacDocumentStatus: (kyc.cac_document_status || kyc.cacDocumentStatus) as VerificationStatus | null,
      identityDocumentType: (kyc.identity_document_type || kyc.identityDocumentType) as string | null,
      identityMatchStates: matchStates,
      verificationReference: (kyc.verification_reference || kyc.verificationReference) as string | null,
      verificationProvider: (kyc.verification_provider || kyc.verificationProvider) as string | null,
      bvnVerificationStatus: (kyc.bvn_verification_status || kyc.bvnVerificationStatus || 'PENDING') as VerificationStatus,
      ninVerificationStatus: (kyc.nin_verification_status || kyc.ninVerificationStatus || 'PENDING') as VerificationStatus,
    },
    schoolStatus: (r.schoolStatus as string) || r.school_status || null,
    paymentStatus: (r.paymentStatus as string) || r.payment_status || null,
    businessType:
      (r.businessType as string) || (kyc.businessType as string) || kyc.business_type || null,
  };
}

/** Normalize the /kyc/settlement response into the canonical frontend model. */
function normalizeSettlementStatus(raw: unknown): SettlementStatus {
  if (!raw || typeof raw !== 'object') {
    return { settlement: null, gateway: null };
  }

  const r = raw as Record<string, unknown>;
  const settlement = (r.settlement || r) as Record<string, unknown> | null | undefined;

  return {
    settlement: settlement
      ? {
          id: (settlement.id as string) || '',
          status: (settlement.status as string) || 'NEW',
          bankCode: (settlement.bank_code || settlement.bankCode) as string | null,
          bankName: (settlement.bank_name || settlement.bankName) as string | null,
          accountNumberLast4:
            (settlement.account_number_last4 || settlement.accountNumberLast4 ||
              (settlement.account_number as string)?.slice(-4)) as string | null,
          accountName: (settlement.account_name || settlement.accountName) as string | null,
          bvnLast4: (settlement.bvn_last4 || settlement.bvnLast4) as string | null,
          ownershipMatchStatus:
            (settlement.ownership_match_status || settlement.ownershipMatchStatus) as string | null,
          accountVerificationReference:
            (settlement.account_verification_reference || settlement.accountVerificationReference) as string | null,
          rejectionReason: (settlement.rejection_reason || settlement.rejectionReason) as string | null,
          submittedAt: (settlement.submitted_at || settlement.submittedAt) as string | null,
          verifiedAt: (settlement.verified_at || settlement.verifiedAt) as string | null,
        }
      : null,
    gateway: r.gateway
      ? {
          provider: (r.gateway as Record<string, unknown>).provider as string,
          status: (r.gateway as Record<string, unknown>).status as string,
          assignedAt: ((r.gateway as Record<string, unknown>).assigned_at ||
            (r.gateway as Record<string, unknown>).assignedAt) as string | null,
        }
      : null,
  };
}

/** Normalize /kyc/shareholders response (snake_case → camelCase). */
function normalizeShareholders(raw: unknown[]): ShareholderModel[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((sh) => {
    const s = sh as Record<string, unknown>;
    return {
      id: (s.id as string) || '',
      fullName: (s.full_name || s.fullName) as string,
      ownershipPercentage: Number(s.ownership_percentage || s.ownershipPercentage || 0),
      role: (s.role as string) || '',
      phone: (s.phone as string) || null,
      identityType: (s.identity_type || s.identityType) as string,
      identityDocumentType: (s.identity_document_type || s.identityDocumentType) as string | null,
      identityNinLast4: (s.identity_nin_last4 || s.identityNinLast4) as string | null,
      identityMatchStatus: (s.identity_match_status || s.identityMatchStatus) as string | null,
      verificationReference: (s.verification_reference || s.verificationReference) as string | null,
      createdAt: (s.created_at || s.createdAt) as string | null,
    };
  });
}

/** Normalize /kyc/documents response. */
function normalizeCacDocument(raw: unknown): CacDocumentModel | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  return {
    mimeType: (d.mime_type || d.mimeType) as string | null,
    fileSize: (d.file_size || d.fileSize) as number | null,
    checksum: (d.checksum as string) || null,
    uploadedAt: (d.uploaded_at || d.uploadedAt) as string | null,
    status: (d.status as string) || null,
    storagePath: (d.storage_path || d.storagePath) as string | null,
  };
}

/** Normalize /kyc/principal-invitation response. */
function normalizePrincipalInvitation(raw: unknown): PrincipalInvitationModel | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    id: (r.id as string) || '',
    email: (r.email as string) || '',
    status: (r.status as string) || 'PENDING',
    token: (r.token as string) || null,
    expiresAt: (r.expires_at || r.expiresAt) as string | null,
    accepted: Boolean(r.accepted),
    existing: Boolean(r.existing),
  };
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

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

/** localStorage key for the transient KYC submission draft. */
const KYC_DRAFT_STORAGE_KEY = 'capflux:kycSubmissionDraft';

/** Fields that are safe to persist locally as a draft. Sensitive raw PII
 *  (NIN/BVN numbers, document numbers) are stored only as transient drafts
 *  and never synced to server-side tables until final encrypted submission. */
const DRAFT_FIELDS = [
  'nin',
  'bvn',
  'identityDocumentType',
  'documentNumber',
  'cacRegistrationNumber',
  'officialEmail',
  'officialPhone',
  'principalName',
  'principalPhone',
  'settlementBankCode',
  'settlementAccountNumber',
  'businessType',
] as const;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useFinancialActivationStore = defineStore('financialActivation', {
  state: () => ({
    _loadCount: 0,
    error: null as string | null,
    errorCategory: null as ApiErrorCategory | null,
    kycStatus: null as KycStatus | null,
    settlementStatus: null as SettlementStatus | null,
    readiness: null as ReadinessState | null,
    shareholders: [] as ShareholderModel[],
    principalInvitation: null as PrincipalInvitationModel | null,
    cacDocument: null as CacDocumentModel | null,
    kycStatusLoaded: false,
    settlementStatusLoaded: false,
    readinessLoaded: false,
    /**
     * Transient wizard data. Persisted to localStorage so that a browser
     * refresh, accidental reload, or closing/reopening the browser does
     * not destroy in-progress user input. Sensitive verification PII is
     * only held here transiently before final encrypted submission.
     */
    kycSubmissionDraft: {
      nin: null as string | null,
      bvn: null as string | null,
      identityDocumentType: null as string | null,
      documentNumber: null as string | null,
      cacRegistrationNumber: null as string | null,
      officialEmail: null as string | null,
      officialPhone: null as string | null,
      principalName: null as string | null,
      principalPhone: null as string | null,
      settlementBankCode: null as string | null,
      settlementAccountNumber: null as string | null,
      businessType: null as string | null,
    },
  }),

  getters: {
    loading(state): boolean {
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
    settlementState(state): string | number | null {
      return state.settlementStatus?.settlement?.status || null;
    },
    settlementVerified(state): boolean {
      return state.settlementStatus?.settlement?.status === 'VERIFIED';
    },
    settlement(state): SettlementModel | null {
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
    /** Convenience: identity match states (camelCase, derived overall). */
    identityMatchStates(state): IdentityMatchStates | null {
      return state.kycStatus?.kyc?.identityMatchStates || null;
    },
    /** Convenience: identity overall match state. */
    identityOverall(state): OverallMatch {
      return state.kycStatus?.kyc?.identityMatchStates?.overall || 'NOT_VERIFIED';
    },
    /** Convenience: whether the settlement ownership is confirmed. */
    settlementOwnershipMatch(state): boolean {
      return state.settlementStatus?.settlement?.ownershipMatchStatus === 'OWNERSHIP_MATCH';
    },
    /** Whether the draft has enough data to attempt final KYC submission. */
    kycReadyForSubmission(state): boolean {
      const d = state.kycSubmissionDraft;
      return Boolean(
        d.businessType &&
          d.nin &&
          d.bvn &&
          d.identityDocumentType &&
          d.principalName &&
          d.principalPhone &&
          (d.officialEmail || d.officialPhone) &&
          (d.cacRegistrationNumber || d.officialEmail) &&
          (d.settlementBankCode || d.settlementAccountNumber),
      );
    },
  },

  actions: {
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

    /** Store transient wizard data (NIN, BVN, etc.) and persist to localStorage. */
    updateKycDraft(patch: Partial<NonNullable<typeof this.kycSubmissionDraft>>) {
      this.kycSubmissionDraft = { ...this.kycSubmissionDraft, ...patch };
      this.saveKycDraft();
    },

    /** Persist the current draft to localStorage so it survives refresh. */
    saveKycDraft() {
      const safe: Record<string, string> = {};
      for (const field of DRAFT_FIELDS) {
        const val = this.kycSubmissionDraft[field];
        if (val !== null && val !== undefined && val !== '') {
          safe[field] = String(val);
        }
      }
      try {
        localStorage.setItem(KYC_DRAFT_STORAGE_KEY, JSON.stringify(safe));
      } catch {
        // localStorage quota exceeded or disabled — non-fatal.
      }
    },

    /** Restore the draft from localStorage into the in-memory store. */
    loadKycDraft() {
      try {
        const raw = localStorage.getItem(KYC_DRAFT_STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as Record<string, string>;
        const patch: Record<string, string | null> = {};
        for (const field of DRAFT_FIELDS) {
          patch[field] = saved[field] ?? null;
        }
        this.kycSubmissionDraft = { ...this.kycSubmissionDraft, ...patch };
      } catch {
        // Corrupt or unreadable draft — start fresh.
      }
    },

    async loadKycStatus() {
      return this._withDedup('kycStatus', async () => {
        try {
          const data = await request<{ success: boolean; data: unknown }>('get', '/kyc/status');
          this.kycStatus = normalizeKycStatus(data.data);
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
      businessType?: string;
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
        const response = await apiClient.http({
          method: 'post',
          url: '/kyc/documents/cac',
          data: file,
          params: {
            filename: file.name,
            mimetype: file.type || 'application/octet-stream',
          },
          headers: { 'Content-Type': 'application/octet-stream' },
        });
        this.cacDocument = normalizeCacDocument(response.data.data);
      } catch (err) {
        this._setError(err as EnhancedError, 'Failed to upload CAC certificate');
        throw err;
      }
    },

    async uploadIdentityDocument(file: File) {
      try {
        const response = await apiClient.http({
          method: 'post',
          url: '/kyc/documents/identity',
          data: file,
          params: {
            filename: file.name,
            mimetype: file.type || 'application/octet-stream',
          },
          headers: { 'Content-Type': 'application/octet-stream' },
        });
        return normalizeCacDocument(response.data.data);
      } catch (err) {
        this._setError(err as EnhancedError, 'Failed to upload identity document');
        throw err;
      }
    },

    async loadKycDocuments() {
      return this._withDedup('kycDocuments', async () => {
        try {
          const data = await request<{ success: boolean; data: unknown }>('get', '/kyc/documents');
          const docData = (data.data as Record<string, unknown> | null)?.cacDocument;
          this.cacDocument = normalizeCacDocument(docData);
        } catch (err) {
          this._handleStatusError(err as EnhancedError, 'Failed to load KYC documents');
        }
      });
    },

    async loadSettlementStatus() {
      return this._withDedup('settlementStatus', async () => {
        try {
          const data = await request<{ success: boolean; data: unknown }>('get', '/kyc/settlement');
          this.settlementStatus = normalizeSettlementStatus(data.data);
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
        const data = await request<{ success: boolean; data: unknown }>(
          'post',
          '/kyc/principal-invitation',
          payload
        );
        this.principalInvitation = normalizePrincipalInvitation(data.data);
      } catch (err) {
        this._setError(err as EnhancedError, 'Failed to send principal invitation');
        throw err;
      }
    },

    async fetchShareholders() {
      return this._withDedup('shareholders', async () => {
        try {
          const data = await request<{ success: boolean; data: unknown }>('get', '/kyc/shareholders');
          this.shareholders = normalizeShareholders((data.data as ShareholderModel[] | unknown) || []);
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
        const data = await request<{ success: boolean; data: unknown }>(
          'post',
          '/kyc/shareholders',
          payload
        );
        this.shareholders = normalizeShareholders(
          [data.data as Record<string, unknown>, ...this.shareholders] as unknown[] as ShareholderModel[],
        );
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
          const data = await request<{ success: boolean; data: ReadinessState }>('get', '/kyc/activation');
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
      this.kycSubmissionDraft = {
        nin: null,
        bvn: null,
        identityDocumentType: null,
        documentNumber: null,
        cacRegistrationNumber: null,
        officialEmail: null,
        officialPhone: null,
        principalName: null,
        principalPhone: null,
        settlementBankCode: null,
        settlementAccountNumber: null,
      };
      try {
        localStorage.removeItem(KYC_DRAFT_STORAGE_KEY);
      } catch {
        // Ignore — localStorage may be unavailable.
      }
    },
  },
});

// Export normalization functions for testing
export { normalizeKycStatus, normalizeSettlementStatus, normalizeShareholders, normalizeMatchStates };
