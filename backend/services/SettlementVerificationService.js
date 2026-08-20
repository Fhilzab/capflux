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

const PROVIDER = process.env.SETTLEMENT_VERIFICATION_PROVIDER || 'mock';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** Mock settlement capabilities. Name enquiry only; BVN is handled separately
 *  by IdentityVerificationService, so this provider does NOT claim BVN power. */
const MOCK_CAPABILITIES = {
  canFetchAccountName: true,
  canFetchAccountNumber: true,
  canVerifyBvn: false, // correction: BVN is NOT verified by the account-name provider
};

class MockSettlementProvider {
  getCapabilities() {
    return { ...MOCK_CAPABILITIES };
  }

  async verifyAccount({ bankCode, accountNumber }) {
    const digits = String(accountNumber || '').replace(/\D/g, '');
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

class ApprovedSettlementProvider {
  getCapabilities() {
    throw new Error(
      'Approved settlement provider capabilities are not configured. Set SETTLEMENT_VERIFICATION_PROVIDER and credentials.'
    );
  }

  async verifyAccount() {
    throw new Error(
      'Approved settlement verification provider is not configured. Set SETTLEMENT_VERIFICATION_PROVIDER and credentials.'
    );
  }
}

function getProvider() {
  if (IS_PRODUCTION && PROVIDER !== 'approved') {
    throw new Error('Production requires an approved settlement verification provider.');
  }
  if (PROVIDER === 'mock') return new MockSettlementProvider();
  return new ApprovedSettlementProvider();
}

class SettlementVerificationService {
  /**
   * Verify a settlement account and return the provider account name.
   * @param {Object} params
   * @param {string} params.bankCode
   * @param {string} params.accountNumber - full account number (server-side)
   * @returns {Promise<Object>} capability-aware verification result
   */
  async verifyAccount({ bankCode, accountNumber }) {
    const provider = getProvider();
    const capabilities = provider.getCapabilities ? provider.getCapabilities() : {};
    try {
      const result = await provider.verifyAccount({ bankCode, accountNumber });
      const verified = Boolean(result.verified || result.found);
      return {
        // backward-compatible
        verified,
        reference: result.reference || result.providerReference || null,
        accountName: result.accountName || null,
        failureReason: verified ? null : result.failureReason || 'ACCOUNT_NOT_FOUND',
        provider: PROVIDER,
        verifiedAt: new Date().toISOString(),
        // capability-aware
        verificationStatus: result.verificationStatus || (verified ? 'VERIFIED' : 'FAILED'),
        verifiedFields: result.verifiedFields || { accountNumber: verified, accountName: verified },
        capabilities,
        providerReference: result.reference || result.providerReference || null,
        providerMetadata: result.providerMetadata || {},
      };
    } catch (err) {
      return {
        verified: false,
        verificationStatus: 'FAILED',
        reference: null,
        accountName: null,
        failureReason: `PROVIDER_ERROR: ${err.message}`,
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
