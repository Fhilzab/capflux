/**
 * Capability-aware verification matching.
 *
 * CAPFLUX never assumes a provider returns a fixed set of fields. Each provider
 * declares capabilities; a verification result declares which fields it actually
 * returned this run. Comparison happens ONLY on fields the provider returned, so an
 * unavailable field is reported as NOT_PROVIDED / NOT_VERIFIED — never MISMATCH.
 *
 * Provider verification supplies evidence; the functions here apply CAPFLUX's own
 * matching and authorization rules. The frontend never receives these decisions
 * directly — they are persisted as auditable status on the verification rows.
 */
import { namesPlausiblyMatch } from './validators.js';

const SAFE_IDENTITY_FIELDS = new Set([
  'verified',
  'verificationStatus',
  'verifiedFields',
  'capabilities',
  'reference',
  'accountName',
  'failureReason',
  'provider',
  'verifiedAt',
]);

/**
 * Allowlist-stripped copy of a provider identity-verification result.
 * Removes every `verified*` value (name/DOB/phone/identity-number/BVN), `providerMetadata`,
 * and any other provider-specific key, so a NIN/BVN/verified name/phone/date-of-birth or a
 * raw provider payload can never reach a client — only derived, non-PII match states remain.
 */
export function sanitizeIdentityResult(r) {
  if (!r) return {};
  const safe = {};
  for (const key of Object.keys(r)) {
    if (SAFE_IDENTITY_FIELDS.has(key)) safe[key] = r[key];
  }
  return safe;
}

/** Per-field comparison states. `PENDING`/`FAILED` are run-level and surfaced separately. */
export const FieldState = {
  MATCH: 'MATCH',
  MISMATCH: 'MISMATCH',
  NOT_PROVIDED: 'NOT_PROVIDED', // provider cannot return this field (capability absent)
  NOT_VERIFIED: 'NOT_VERIFIED', // provider can return it but did not this run / no value to compare
};

/** Overall identity-verification outcomes. */
export const IdentityOutcome = {
  MATCH: 'MATCH',
  MISMATCH: 'MISMATCH',
  NOT_VERIFIED: 'NOT_VERIFIED',
  PENDING: 'PENDING',
  FAILED: 'FAILED',
};

/** CAPFLUX settlement-ownership decision (provider evidence -> authorization). */
export const SettlementOutcome = {
  OWNERSHIP_MATCH: 'OWNERSHIP_MATCH',
  NAME_MISMATCH: 'NAME_MISMATCH',
  NAME_NOT_VERIFIED: 'NAME_NOT_VERIFIED',
  ACCOUNT_NOT_VERIFIED: 'ACCOUNT_NOT_VERIFIED',
  PENDING: 'PENDING',
  FAILED: 'FAILED',
};

/**
 * Sub-states for the optional BVN ownership check (auditable only, not written to the
 * account `status` column). BVN is a SEPARATE concept from account-name enquiry: a verified
 * BVN whose name cannot be matched does not by itself prove settlement ownership.
 */
export const BvnState = {
  BVN_VERIFIED: 'BVN_VERIFIED',
  BVN_NAME_MISMATCH: 'BVN_NAME_MISMATCH',
  BVN_NOT_VERIFIED: 'BVN_NOT_VERIFIED',
  PENDING: 'PENDING',
  FAILED: 'FAILED',
};

const FIELD_KEYS = {
  name: { cap: 'canFetchName', provided: 'name', value: 'verifiedName' },
  dateOfBirth: { cap: 'canFetchDob', provided: 'dateOfBirth', value: 'verifiedDob' },
  phone: { cap: 'canFetchPhone', provided: 'phone', value: 'verifiedPhone' },
};

function normName(a) { return String(a ?? '').trim(); }
function normDob(a) { return String(a ?? '').trim().slice(0, 10); }
function normPhone(a) { return String(a ?? '').replace(/\D/g, ''); }

/** Compare a single submitted value against the provider-verified value (both present). */
function compareField(field, submitted, verifiedValue) {
  const s = submitted == null ? '' : String(submitted).trim();
  if (s === '') return FieldState.NOT_VERIFIED;
  if (field === 'name') return namesPlausiblyMatch(s, verifiedValue) ? FieldState.MATCH : FieldState.MISMATCH;
  if (field === 'dateOfBirth') return normDob(s) === normDob(verifiedValue) ? FieldState.MATCH : FieldState.MISMATCH;
  if (field === 'phone') return normPhone(s) === normPhone(verifiedValue) ? FieldState.MATCH : FieldState.MISMATCH;
  return s === String(verifiedValue).trim() ? FieldState.MATCH : FieldState.MISMATCH;
}

/**
 * Capability-aware identity matching.
 * @param {Object} params
 * @param {Object} params.submitted - { name?, dateOfBirth?, phone?, identityNumber? } user values.
 * @param {Object} params.verification - provider result with `verificationStatus`,
 *   `verifiedFields` (per-field booleans actually returned), the `verified*` values, and
 *   `capabilities` (static provider capability matrix).
 * @returns {{ overall: string, fields: Object, matchedFields: string[], mismatchedFields: string[],
 *   notProvidedFields: string[] }}
 */
export function compareIdentityAgainstSubmission({ submitted, verification }) {
  const cap = verification.capabilities || {};
  const fields = verification.verifiedFields || {};
  const result = {
    name: FieldState.NOT_PROVIDED,
    dateOfBirth: FieldState.NOT_PROVIDED,
    phone: FieldState.NOT_PROVIDED,
    identityNumber: FieldState.NOT_PROVIDED,
  };

  for (const [field, map] of Object.entries(FIELD_KEYS)) {
    if (!cap[map.cap]) { result[field] = FieldState.NOT_PROVIDED; continue; }
    if (!fields[map.provided]) { result[field] = FieldState.NOT_VERIFIED; continue; }
    result[field] = compareField(field, submitted?.[field], verification[map.value]);
  }

  if (cap.canVerifyIdentityNumber) {
    if (fields.identityNumber && submitted?.identityNumber != null) {
      result.identityNumber =
        normName(submitted.identityNumber) === String(verification.verifiedIdentityNumber).trim()
          ? FieldState.MATCH
          : FieldState.MISMATCH;
    } else {
      result.identityNumber = FieldState.NOT_VERIFIED;
    }
  }

  const statuses = Object.values(result);
  let overall;
  if (verification.verificationStatus === 'PENDING') overall = IdentityOutcome.PENDING;
  else if (verification.verificationStatus === 'FAILED') overall = IdentityOutcome.FAILED;
  else if (statuses.some((s) => s === FieldState.MISMATCH)) overall = IdentityOutcome.MISMATCH;
  else if (statuses.some((s) => s === FieldState.MATCH)) overall = IdentityOutcome.MATCH;
  else overall = IdentityOutcome.NOT_VERIFIED;

  return {
    overall,
    fields: result,
    matchedFields: Object.keys(result).filter((k) => result[k] === FieldState.MATCH),
    mismatchedFields: Object.keys(result).filter((k) => result[k] === FieldState.MISMATCH),
    notProvidedFields: Object.keys(result).filter((k) => result[k] === FieldState.NOT_PROVIDED),
  };
}

/**
 * Capability-aware settlement ownership eligibility.
 *
 * Provider supplies evidence (account-name enquiry + optional BVN check). CAPFLUX applies
 * ownership rules. BVN and account-name verification are SEPARATE: `bvnVerification` may be
 * null when only account-name enquiry was performed.
 *
 * @param {Object} params
 * @param {Object} params.accountVerification - result of SettlementVerificationService.verifyAccount
 * @param {Object} [params.bvnVerification] - IdentityVerificationService.verifyIdentity({type:'BVN'}); optional
 * @param {string} params.registeredOwnerName - CAPFLUX-recorded owner/school name
 * @param {string} [params.submittedOwnerName] - owner name submitted by the user (when available)
 * @returns {{ eligible: boolean, overall: string, account: { valid: boolean, accountName: string },
 *   ownership: { nameMatch: boolean, bvn: string, bvnMatchesOwner: boolean } }}
 */
export function evaluateSettlementEligibility({ accountVerification, bvnVerification, registeredOwnerName, submittedOwnerName }) {
  const ownerName = submittedOwnerName || registeredOwnerName;
  const acctCap = accountVerification.capabilities || {};
  const acctFields = accountVerification.verifiedFields || {};

  // --- Account existence (provider verified the account is real) ---
  const accountFound =
    Boolean(accountVerification.verified) && accountVerification.verificationStatus === 'VERIFIED';

  // --- Account-name enquiry (capability-aware; NOT_PROVIDED != MISMATCH) ---
  let accountNameState = FieldState.NOT_PROVIDED;
  if (accountFound && acctCap.canFetchAccountName) {
    accountNameState = acctFields.accountName
      ? compareField('name', ownerName, accountVerification.accountName)
      : FieldState.NOT_VERIFIED;
  }

  if (!accountFound) {
    return {
      eligible: false,
      overall: accountVerification.verificationStatus === 'PENDING'
        ? SettlementOutcome.PENDING
        : (accountVerification.verified ? SettlementOutcome.FAILED : SettlementOutcome.ACCOUNT_NOT_VERIFIED),
      account: { valid: false, accountName: accountNameState },
      ownership: { nameMatch: false, bvn: BvnState.BVN_NOT_VERIFIED, bvnMatchesOwner: false },
    };
  }

  // --- BVN ownership (separate concept; optional, not assumed = account owner) ---
  let bvnOutcome = BvnState.BVN_NOT_VERIFIED;
  let bvnMatchesOwner = false;
  if (bvnVerification) {
    const bCap = bvnVerification.capabilities || {};
    const bFields = bvnVerification.verifiedFields || {};
    if (bvnVerification.verificationStatus === 'PENDING') {
      bvnOutcome = BvnState.PENDING;
    } else if (bvnVerification.verificationStatus === 'FAILED') {
      bvnOutcome = BvnState.FAILED;
    } else if (!bCap.canFetchName || !bFields.name) {
      // BVN itself verified but provider could not establish a name to match -> no owner link.
      bvnOutcome = bvnVerification.verified ? BvnState.BVN_VERIFIED : BvnState.BVN_NOT_VERIFIED;
    } else {
      bvnMatchesOwner = namesPlausiblyMatch(bvnVerification.verifiedName, ownerName);
      bvnOutcome = bvnMatchesOwner ? BvnState.BVN_VERIFIED : BvnState.BVN_NAME_MISMATCH;
    }
  }

  // --- CAPFLUX ownership authorization ---
  // A confirmed MISMATCH is a fraud signal (account exists but holder name differs from the
  // registered owner). NOT_PROVIDED / NOT_VERIFIED (provider cannot or did not return a name)
  // is indeterminate ownership, NOT a mismatch. BVN is separate: a verified BVN whose name
  // cannot be matched does not by itself prove ownership of the settlement account.
  const nameMatches = accountNameState === FieldState.MATCH;
  let overall;
  let eligible;
  if (accountNameState === FieldState.MISMATCH || bvnOutcome === BvnState.BVN_NAME_MISMATCH) {
    overall = SettlementOutcome.NAME_MISMATCH;
    eligible = false;
  } else if (bvnVerification && (bvnOutcome === BvnState.PENDING || bvnOutcome === BvnState.FAILED)) {
    overall = bvnOutcome;
    eligible = false;
  } else if (nameMatches) {
    overall = SettlementOutcome.OWNERSHIP_MATCH;
    eligible = true;
  } else {
    // Account verified but ownership could not be confirmed via a name.
    overall = SettlementOutcome.NAME_NOT_VERIFIED;
    eligible = false;
  }

  return {
    eligible,
    overall,
    account: { valid: accountFound, accountName: accountNameState },
    ownership: { nameMatch: nameMatches, bvn: bvnOutcome, bvnMatchesOwner },
  };
}
