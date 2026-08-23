/**
 * SettlementVerificationService — bank account name enquiry abstraction.
 *
 * Uses an approved provider (server-side credentials only). Environment:
 *   SETTLEMENT_VERIFICATION_PROVIDER = 'mock' | 'approved'
 *
 * Never trusts a client-supplied account name. The provider returns the
 * account name; CAPFLUX compares it against the registered owner and applies
 * ownership rules (see verification-matching.js). BVN ownership is a SEPARATE
 * concept verified via IdentityVerificationService — this provider does not
 * equate "account name matches" with "BVN is the owner."
 *
 * Provider contract (capability-aware):
 *   verifyAccount({ bankCode, accountNumber }) returns:
 *     verificationStatus : 'VERIFIED' | 'FAILED'
 *     verifiedFields    : { accountNumber, accountName } — only what the
 *                         provider actually returned this run (capability-dependent)
 *     capabilities      : static capability matrix (canFetchAccountName, ...)
 *     accountName       : provider-returned account holder name (when verified)
 *     providerReference : idempotency reference from the provider
 *     providerMetadata  : sanitized, non-sensitive metadata
 *
 * Backward-compatible fields preserved: { verified, reference, accountName,
 * failureReason, provider, verifiedAt }
 */
import crypto from 'crypto';
import { errorMessage } from '../types/http.js';

const PROVIDER = process.env.SETTLEMENT_VERIFICATION_PROVIDER || 'mock';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export interface SettlementCapabilities {
  canFetchAccountName: boolean;
  canFetchAccountNumber: boolean;
  canVerifyBvn: boolean;
}

/** Loose shape returned by settlement verification providers. */
export interface SettlementProviderResult {
  found?: boolean;
  verified?: boolean;
  verificationStatus?: string;
  reference?: string;
  providerReference?: unknown;
  accountName?: string | null;
  verifiedFields?: Record<string, unknown>;
  failureReason?: string | null;
  providerMetadata?: Record<string, unknown>;
}

interface SettlementVerificationProvider {
  getCapabilities?(): SettlementCapabilities;
  verifyAccount(params: { bankCode: unknown; accountNumber: unknown }): Promise<SettlementProviderResult>;
}

/** Mock settlement capabilities. Name enquiry only; BVN is handled separately
 *  by IdentityVerificationService, so this provider does NOT claim BVN power. */
const MOCK_CAPABILITIES: SettlementCapabilities = {
  canFetchAccountName: true,
  canFetchAccountNumber: true,
  canVerifyBvn: false, // correction: BVN is NOT verified by the account-name provider
};

class MockSettlementProvider implements SettlementVerificationProvider {
  getCapabilities(): SettlementCapabilities {
    return { ...MOCK_CAPABILITIES };
  }

  async verifyAccount({ bankCode, accountNumber }: { bankCode: unknown; accountNumber: unknown }): Promise<SettlementProviderResult> {
    const digits = String(accountNumber ?? '').replace(/\D/g, '');
    const reference = `mock-settle-${crypto
      .createHash('sha256')
      .update(`${bankCode}:${accountNumber}`)
      .digest('hex')
      .slice(0, 16)}`;
    const found = digits.length === 10 && digits[0] !== '0';

    if (!found) {
      return {
        found: false,
        verificationStatus: 'FAILED',
        reference,
        verifiedFields: {},
        failureReason: 'ACCOUNT_NOT_FOUND',
        providerMetadata: { mock: true },
      };
    }

    return {
      found: true,
      verificationStatus: 'VERIFIED',
      reference,
      accountName: `OWNER OF ACCOUNT ${digits.slice(-4)}`,
      verifiedFields: { accountNumber: true, accountName: true },
      providerMetadata: { mock: true },
    };
  }
}

class ApprovedSettlementProvider implements SettlementVerificationProvider {
  getCapabilities(): SettlementCapabilities {
    throw new Error(
      'Approved settlement provider capabilities are not configured. Set SETTLEMENT_VERIFICATION_PROVIDER and credentials.'
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async verifyAccount(_params?: { bankCode?: unknown; accountNumber?: unknown }): Promise<SettlementProviderResult> {
    throw new Error(
      'Approved settlement verification provider is not configured. Set SETTLEMENT_VERIFICATION_PROVIDER and credentials.'
    );
  }
}

function getProvider(): SettlementVerificationProvider {
  if (IS_PRODUCTION && PROVIDER !== 'approved') {
    throw new Error('Production requires an approved settlement verification provider.');
  }
  if (PROVIDER === 'mock') return new MockSettlementProvider();
  return new ApprovedSettlementProvider();
}

export interface SettlementVerificationResult {
  // backward-compatible
  verified: boolean;
  reference: string | null;
  accountName: string | null;
  failureReason: string | null;
  provider: string;
  verifiedAt: string;
  // capability-aware
  verificationStatus: string;
  verifiedFields: Record<string, unknown>;
  capabilities: Partial<SettlementCapabilities> | Record<string, never>;
  providerReference?: string | null;
  providerMetadata?: Record<string, unknown>;
}

class SettlementVerificationService {
  /**
   * Verify a settlement account and return the provider account name.
   * @param params.accountNumber - full account number (server-side)
   */
  async verifyAccount({ bankCode, accountNumber }: { bankCode: unknown; accountNumber: unknown }): Promise<SettlementVerificationResult> {
    const provider = getProvider();
    const capabilities = provider.getCapabilities ? provider.getCapabilities() : {};
    try {
      const result = await provider.verifyAccount({ bankCode, accountNumber });
      const verified = Boolean(result.verified || result.found);
      const reference = (result.reference || result.providerReference || null) as string | null;
      return {
        // backward-compatible
        verified,
        reference,
        accountName: result.accountName || null,
        failureReason: verified ? null : result.failureReason || 'ACCOUNT_NOT_FOUND',
        provider: PROVIDER,
        verifiedAt: new Date().toISOString(),
        // capability-aware
        verificationStatus: result.verificationStatus || (verified ? 'VERIFIED' : 'FAILED'),
        verifiedFields: result.verifiedFields || { accountNumber: verified, accountName: verified },
        capabilities,
        providerReference: reference,
        providerMetadata: result.providerMetadata || {},
      };
    } catch (err) {
      return {
        verified: false,
        verificationStatus: 'FAILED',
        reference: null,
        accountName: null,
        failureReason: `PROVIDER_ERROR: ${errorMessage(err)}`,
        provider: PROVIDER,
        verifiedAt: new Date().toISOString(),
        verifiedFields: {},
        capabilities,
        providerMetadata: {},
      };
    }
  }
}

export { SettlementVerificationService, MockSettlementProvider, ApprovedSettlementProvider };
export default new SettlementVerificationService();
