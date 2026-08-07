/**
 * IdentityVerificationService — NIN/BVN verification abstraction.
 *
 * Provider is selected server-side via env:
 *   IDENTITY_VERIFICATION_PROVIDER = 'mock' | 'approved'
 *   (Production must use an approved Nigerian verification provider.
 *    'mock' is for local development/tests only and is refused in production.)
 *
 * The frontend NEVER calls providers directly. The backend decrypts the
 * stored NIN/BVN only when privileged verification requires it, calls the
 * provider, and stores only masked results + provider metadata.
 *
 * Provider response is normalized to:
 *   { verified, reference, accountName?, failureReason?, raw? }
 */
import crypto from 'crypto';

const PROVIDER = process.env.IDENTITY_VERIFICATION_PROVIDER || 'mock';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Deterministic mock provider (dev/test only). Never used in production.
 * Verifies a NIN/BVN by checksum so tests can exercise success/failure.
 */
class MockIdentityProvider {
  async verify({ type, value }) {
    const digits = String(value).replace(/\D/g, '');
    // First digit determines outcome: 0 => failure, else success.
    const verified = digits.length === 11 && digits[0] !== '0';
    const reference = `mock-${type.toLowerCase()}-${crypto
      .createHash('sha256')
      .update(`${type}:${value}`)
      .digest('hex')
      .slice(0, 16)}`;
    return {
      verified,
      reference,
      failureReason: verified ? null : 'MOCK_PROVIDER: identifier rejected',
      accountName: verified ? 'MOCK VERIFIED OWNER' : null,
    };
  }
}

/**
 * Placeholder for an approved provider integration (e.g. an NIBSS/VerifyMe/
 * Smile/Dojah adapter). Implement against the approved vendor's API using
 * server-side credentials only.
 */
class ApprovedIdentityProvider {
  async verify() {
    throw new Error(
      'Approved identity provider is not configured. Set IDENTITY_VERIFICATION_PROVIDER and provider credentials.'
    );
  }
}

function getProvider() {
  if (IS_PRODUCTION && PROVIDER !== 'approved') {
    throw new Error('Production requires an approved identity verification provider.');
  }
  if (PROVIDER === 'mock') return new MockIdentityProvider();
  return new ApprovedIdentityProvider();
}

class IdentityVerificationService {
  /**
   * Verify an identity identifier.
   * @param {Object} params
   * @param {'NIN'|'BVN'} params.type
   * @param {string} params.value - plaintext NIN or BVN (decrypted server-side)
   * @param {Object} [params.metadata] - owner name/DOB for matching
   */
  async verifyIdentity({ type, value, metadata = {} }) {
    if (!value) {
      return { verified: false, reference: null, failureReason: 'NO_VALUE' };
    }
    const provider = getProvider();
    try {
      const result = await provider.verify({ type, value, metadata });
      return {
        verified: Boolean(result.verified),
        reference: result.reference || null,
        accountName: result.accountName || null,
        failureReason: result.failureReason || null,
        provider: PROVIDER,
        verifiedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        verified: false,
        reference: null,
        failureReason: `PROVIDER_ERROR: ${err.message}`,
        provider: PROVIDER,
        verifiedAt: new Date().toISOString(),
      };
    }
  }
}

export { IdentityVerificationService };
export default new IdentityVerificationService();
