/**
 * SettlementVerificationService — bank account name enquiry abstraction.
 *
 * Uses an approved Nigerian account-verification provider (server-side
 * credentials only). Provider is selected via env:
 *   SETTLEMENT_VERIFICATION_PROVIDER = 'mock' | 'approved'
 *
 * Never trusts a client-supplied account name. The provider returns the
 * account name; the backend compares it against the registered school/owner.
 */
import crypto from 'crypto';

const PROVIDER = process.env.SETTLEMENT_VERIFICATION_PROVIDER || 'mock';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Deterministic mock provider (dev/test only). Never used in production.
 * Account numbers starting with 0 => not found/failure; otherwise returns a
 * name derived from the bank code so tests can exercise match/mismatch.
 */
class MockSettlementProvider {
  async verifyAccount({ bankCode, accountNumber }) {
    const digits = String(accountNumber).replace(/\D/g, '');
    const found = digits.length === 10 && digits[0] !== '0';
    const reference = `mock-settle-${crypto
      .createHash('sha256')
      .update(`${bankCode}:${accountNumber}`)
      .digest('hex')
      .slice(0, 16)}`;
    return {
      found,
      reference,
      accountName: found ? `OWNER OF ACCOUNT ${digits.slice(-4)}` : null,
    };
  }
}

class ApprovedSettlementProvider {
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
   */
  async verifyAccount({ bankCode, accountNumber }) {
    const provider = getProvider();
    try {
      const result = await provider.verifyAccount({ bankCode, accountNumber });
      return {
        verified: Boolean(result.found),
        reference: result.reference || null,
        accountName: result.accountName || null,
        failureReason: result.found ? null : 'ACCOUNT_NOT_FOUND',
        provider: PROVIDER,
        verifiedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        verified: false,
        reference: null,
        accountName: null,
        failureReason: `PROVIDER_ERROR: ${err.message}`,
        provider: PROVIDER,
        verifiedAt: new Date().toISOString(),
      };
    }
  }
}

export { SettlementVerificationService };
export default new SettlementVerificationService();
