/**
 * IdentityVerificationService — NIN/BVN verification abstraction.
 *
 * Provider is selected server-side via env:
 *   IDENTITY_VERIFICATION_PROVIDER = 'mock' | 'approved'
 *   ('approved' is reserved for a verified Nigerian identity provider; 'mock' is
 *    for local development/tests only and is refused when NODE_ENV=production.)
 *
 * The frontend NEVER calls providers directly. The backend decrypts the stored
 * NIN/BVN only when privileged verification requires it, calls the provider, and
 * stores only masked results + provider metadata.
 *
 * Provider contract (capability-aware):
 *   A provider returns:
 *     verificationStatus : 'VERIFIED' | 'FAILED' | 'PENDING'
 *     verifiedFields    : { name, dateOfBirth, phone, identityNumber } — only the
 *                         fields the provider actually returned+verified THIS run
 *                         (capability-dependent, NOT fixed per type)
 *     capabilities      : static capability matrix for the provider (what it CAN return)
 *     verifiedName/verifiedDob/verifiedPhone/verifiedIdentityNumber : authoritative
 *                         values when the provider returned them
 *     providerReference : idempotency reference from the provider
 *     providerMetadata  : sanitized, non-sensitive metadata
 *
 * CAPFLUX comparison (see verification-matching.js) compares ONLY fields the provider
 * returned. An unavailable field is NOT_PROVIDED / NOT_VERIFIED, never MISMATCH.
 *
 * Backward-compatible fields are preserved on the result:
 *   { verified, reference, accountName?, failureReason?, provider, verifiedAt }
 */
import crypto from 'crypto';

const PROVIDER = process.env.IDENTITY_VERIFICATION_PROVIDER || 'mock';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** Mock identity capabilities. Honest dev stub: the mock verifies the NIN/BVN
 *  identifier (proves it is a real, provider-validated number) but does NOT claim
 *  to return a verified name, DOB, or phone. Name/DOB/phone matching is exercised
 *  with capability-aware provider results (see verification-matching.js). This keeps
 *  the domain from assuming a fixed field set and prevents the mock from producing
 *  false name MISMATCHES against real submitted data. */
const MOCK_CAPABILITIES = {
  nin: { canVerifyIdentityNumber: true, canFetchName: false, canFetchDob: false, canFetchPhone: false },
  bvn: { canVerifyIdentityNumber: true, canFetchName: false, canFetchDob: false, canFetchPhone: false },
};

/**
 * Deterministic mock provider (dev/test only). Never used in production.
 * Verifies a NIN/BVN by checksum so tests can exercise success/failure.
 * Returns ONLY the fields its declared capabilities allow.
 */
class MockIdentityProvider {
  getCapabilities(type) {
    if (type === 'NIN') return { ...MOCK_CAPABILITIES.nin };
    if (type === 'BVN') return { ...MOCK_CAPABILITIES.bvn };
    return { canVerifyIdentityNumber: false, canFetchName: false, canFetchDob: false, canFetchPhone: false };
  }

  async verify({ type, value }) {
    const digits = String(value || '').replace(/\D/g, '');
    const reference = `mock-${String(type).toLowerCase()}-${crypto
      .createHash('sha256')
      .update(`${type}:${value}`)
      .digest('hex')
      .slice(0, 16)}`;
    // First digit determines outcome: 0 => failure, else success.
    const verified = digits.length === 11 && digits[0] !== '0';
    const capabilities = this.getCapabilities(type);

    if (!verified) {
      return {
        verificationStatus: 'FAILED',
        failureReason: 'MOCK_PROVIDER: identifier rejected',
        reference,
        verifiedFields: {},
        providerMetadata: { mock: true },
      };
    }

    const verifiedFields = { identityNumber: true, name: capabilities.canFetchName };
    const result = {
      verificationStatus: 'VERIFIED',
      reference,
      verifiedFields,
      providerMetadata: { mock: true },
    };
    if (capabilities.canFetchName) {
      result.verifiedName = 'MOCK VERIFIED OWNER';
      result.accountName = 'MOCK VERIFIED OWNER'; // backward-compatible alias
    }
    if (capabilities.canFetchDob) {
      result.verifiedFields.dateOfBirth = true;
      result.verifiedDob = '1990-01-01';
    }
    if (capabilities.canFetchPhone) {
      result.verifiedFields.phone = true;
      result.verifiedPhone = '08000000000';
    }
    if (capabilities.canVerifyIdentityNumber) {
      result.verifiedIdentityNumber = digits;
    }
    return result;
  }
}

/**
 * Placeholder for an approved provider integration (e.g. an NIBSS/VerifyMe/
 * Smile/Dojah adapter). Implement verify() against the approved vendor's API using
 * server-side credentials only. It must return the SAME shape as MockIdentityProvider
 * (verificationStatus, verifiedFields, capabilities, verified*, providerReference,
 * providerMetadata) — including getCapabilities().
 */
class ApprovedIdentityProvider {
  getCapabilities() {
    throw new Error(
      'Approved identity provider capabilities are not configured. Set IDENTITY_VERIFICATION_PROVIDER and provider credentials.'
    );
  }

  async verify() {
    throw new Error(
      'Approved identity provider is not configured. Set IDENTITY_VERIFICATION_PROVIDER and provider credentials.'
    );
  }
}

// Test-only escape hatch: inject a provider (e.g. one that throws) to prove the
// service normalizes provider failures without leaking raw errors to callers.
let _injectedProvider = null;
export const __setIdentityProviderForTest = (provider) => {
  _injectedProvider = provider;
};

function getProvider() {
  if (_injectedProvider) return _injectedProvider;
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
   * @param {Object} [params.metadata] - owner name/DOB for optional matching
   * @returns {Promise<Object>} capability-aware verification result
   */
  async verifyIdentity({ type, value, _metadata = {} }) {
    if (!value) {
      return {
        verified: false,
        verificationStatus: 'FAILED',
        reference: null,
        accountName: null,
        failureReason: 'NO_VALUE',
        provider: PROVIDER,
        verifiedAt: new Date().toISOString(),
        verifiedFields: {},
        capabilities: {},
      };
    }
    const provider = getProvider();
    const capabilities = provider.getCapabilities ? provider.getCapabilities(type) : {};
    try {
      const result = await provider.verify({ type, value, _metadata });
      const verifiedFields = result.verifiedFields || {};
      return {
        // backward-compatible
        verified: Boolean(result.verified || result.verificationStatus === 'VERIFIED'),
        reference: result.reference || result.providerReference || null,
        accountName: result.accountName || result.verifiedName || null,
        failureReason: result.failureReason || null,
        provider: provider.providerName || PROVIDER,
        verifiedAt: new Date().toISOString(),
        // capability-aware
        verificationStatus: result.verificationStatus || (result.verified ? 'VERIFIED' : 'FAILED'),
        verifiedFields,
        verifiedName: result.verifiedName || null,
        verifiedDob: result.verifiedDob || null,
        verifiedPhone: result.verifiedPhone || null,
        verifiedIdentityNumber: result.verifiedIdentityNumber || null,
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
        provider: provider.providerName || PROVIDER,
        verifiedAt: new Date().toISOString(),
        verifiedFields: {},
        capabilities,
        providerMetadata: {},
      };
    }
  }
}

export { IdentityVerificationService, MockIdentityProvider, ApprovedIdentityProvider };
export default new IdentityVerificationService();
