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
import type { IdentityVerificationOutcome } from './IdentityVerificationService.js';
import type { SettlementVerificationResult } from './SettlementVerificationService.js';

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
export function sanitizeIdentityResult(r: unknown): Record<string, unknown> {
  if (!r) return {};
  const source = r as Record<string, unknown>;
  const safe: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    if (SAFE_IDENTITY_FIELDS.has(key)) safe[key] = source[key];
  }
  return safe;
}

/** Per-field comparison states. `PENDING`/`FAILED` are run-level and surfaced separately. */
export const FieldState = {
  MATCH: 'MATCH',
  MISMATCH: 'MISMATCH',
  NOT_PROVIDED: 'NOT_PROVIDED', // provider cannot return this field (capability absent)
  NOT_VERIFIED: 'NOT_VERIFIED', // provider can return it but did not this run / no value to compare
} as const;

export type FieldStateValue = (typeof FieldState)[keyof typeof FieldState];

/** Overall identity-verification outcomes. */
export const IdentityOutcome = {
  MATCH: 'MATCH',
  MISMATCH: 'MISMATCH',
  NOT_VERIFIED: 'NOT_VERIFIED',
  PENDING: 'PENDING',
  FAILED: 'FAILED',
} as const;

export type IdentityOutcomeValue = (typeof IdentityOutcome)[keyof typeof IdentityOutcome];

/** CAPFLUX settlement-ownership decision (provider evidence -> authorization). */
export const SettlementOutcome = {
  OWNERSHIP_MATCH: 'OWNERSHIP_MATCH',
  NAME_MISMATCH: 'NAME_MISMATCH',
  NAME_NOT_VERIFIED: 'NAME_NOT_VERIFIED',
  ACCOUNT_NOT_VERIFIED: 'ACCOUNT_NOT_VERIFIED',
  PENDING: 'PENDING',
  FAILED: 'FAILED',
} as const;

export type SettlementOutcomeValue = (typeof SettlementOutcome)[keyof typeof SettlementOutcome];

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
} as const;

export type BvnStateValue = (typeof BvnState)[keyof typeof BvnState];

interface FieldKeyMap {
  cap: string;
  provided: string;
  value: 'verifiedName' | 'verifiedDob' | 'verifiedPhone';
}

const FIELD_KEYS: Record<'name' | 'dateOfBirth' | 'phone', FieldKeyMap> = {
  name: { cap: 'canFetchName', provided: 'name', value: 'verifiedName' },
  dateOfBirth: { cap: 'canFetchDob', provided: 'dateOfBirth', value: 'verifiedDob' },
  phone: { cap: 'canFetchPhone', provided: 'phone', value: 'verifiedPhone' },
};

function normName(a: unknown): string { return String(a ?? '').trim(); }
function normDob(a: unknown): string { return String(a ?? '').trim().slice(0, 10); }
function normPhone(a: unknown): string { return String(a ?? '').replace(/\D/g, ''); }

/** Compare a single submitted value against the provider-verified value (both present). */
function compareField(field: string, submitted: unknown, verifiedValue: unknown): FieldStateValue {
  const s = submitted == null ? '' : String(submitted).trim();
  if (s === '') return FieldState.NOT_VERIFIED;
  if (field === 'name') return namesPlausiblyMatch(s, verifiedValue) ? FieldState.MATCH : FieldState.MISMATCH;
  if (field === 'dateOfBirth') return normDob(s) === normDob(verifiedValue) ? FieldState.MATCH : FieldState.MISMATCH;
  if (field === 'phone') return normPhone(s) === normPhone(verifiedValue) ? FieldState.MATCH : FieldState.MISMATCH;
  return s === String(verifiedValue).trim() ? FieldState.MATCH : FieldState.MISMATCH;
}

export interface SubmittedIdentity {
  name?: unknown;
  dateOfBirth?: unknown;
  phone?: unknown;
  identityNumber?: unknown;
  [key: string]: unknown;
}

export interface IdentityMatchResult {
  overall: IdentityOutcomeValue;
  fields: Record<'name' | 'dateOfBirth' | 'phone' | 'identityNumber', FieldStateValue>;
  matchedFields: string[];
  mismatchedFields: string[];
  notProvidedFields: string[];
}

/**
 * Capability-aware identity matching.
 * @param params.submitted - { name?, dateOfBirth?, phone?, identityNumber? } user values.
 * @param params.verification - provider result with `verificationStatus`,
 *   `verifiedFields` (per-field booleans actually returned), the `verified*` values, and
 *   `capabilities` (static provider capability matrix).
 */
export function compareIdentityAgainstSubmission({
  submitted,
  verification,
}: {
  submitted: SubmittedIdentity | null | undefined;
  verification: Partial<IdentityVerificationOutcome> & { capabilities?: unknown; verifiedFields?: unknown; verificationStatus?: unknown };
}): IdentityMatchResult {
  const cap = (verification.capabilities || {}) as Record<string, unknown>;
  const fields = (verification.verifiedFields || {}) as Record<string, unknown>;
  const result: IdentityMatchResult['fields'] = {
    name: FieldState.NOT_PROVIDED,
    dateOfBirth: FieldState.NOT_PROVIDED,
    phone: FieldState.NOT_PROVIDED,
    identityNumber: FieldState.NOT_PROVIDED,
  };

  for (const [field, map] of Object.entries(FIELD_KEYS) as Array<['name' | 'dateOfBirth' | 'phone', FieldKeyMap]>) {
    if (!cap[map.cap]) { result[field] = FieldState.NOT_PROVIDED; continue; }
    if (!fields[map.provided]) { result[field] = FieldState.NOT_VERIFIED; continue; }
    result[field] = compareField(field, submitted?.[field], (verification as Record<string, unknown>)[map.value]);
  }

  if (cap.canVerifyIdentityNumber) {
    if (fields.identityNumber && submitted?.identityNumber != null) {
      result.identityNumber =
        normName(submitted.identityNumber) === String((verification as Record<string, unknown>).verifiedIdentityNumber).trim()
          ? FieldState.MATCH
          : FieldState.MISMATCH;
    } else {
      result.identityNumber = FieldState.NOT_VERIFIED;
    }
  }

  const statuses = Object.values(result);
  let overall: IdentityOutcomeValue;
  if (verification.verificationStatus === 'PENDING') overall = IdentityOutcome.PENDING;
  else if (verification.verificationStatus === 'FAILED') overall = IdentityOutcome.FAILED;
  else if (statuses.some((s) => s === FieldState.MISMATCH)) overall = IdentityOutcome.MISMATCH;
  else if (statuses.some((s) => s === FieldState.MATCH)) overall = IdentityOutcome.MATCH;
  else overall = IdentityOutcome.NOT_VERIFIED;

  return {
    overall,
    fields: result,
    matchedFields: Object.keys(result).filter((k) => result[k as keyof IdentityMatchResult['fields']] === FieldState.MATCH),
    mismatchedFields: Object.keys(result).filter((k) => result[k as keyof IdentityMatchResult['fields']] === FieldState.MISMATCH),
    notProvidedFields: Object.keys(result).filter((k) => result[k as keyof IdentityMatchResult['fields']] === FieldState.NOT_PROVIDED),
  };
}

export interface SettlementEligibilityInput {
  accountVerification: SettlementVerificationResult;
  bvnVerification?: Partial<IdentityVerificationOutcome> | null;
  registeredOwnerName?: string | null;
  submittedOwnerName?: string | null;
}

export interface SettlementEligibilityResult {
  eligible: boolean;
  overall: SettlementOutcomeValue | typeof BvnState.PENDING | typeof BvnState.FAILED;
  account: { valid: boolean; accountName: FieldStateValue };
  ownership: { nameMatch: boolean; bvn: BvnStateValue; bvnMatchesOwner: boolean };
}

/**
 * Capability-aware settlement ownership eligibility.
 *
 * Provider supplies evidence (account-name enquiry + optional BVN check). CAPFLUX applies
 * ownership rules. BVN and account-name verification are SEPARATE: `bvnVerification` may be
 * null when only account-name enquiry was performed.
 */
export function evaluateSettlementEligibility({
  accountVerification,
  bvnVerification,
  registeredOwnerName,
  submittedOwnerName,
}: SettlementEligibilityInput): SettlementEligibilityResult {
  const ownerName: unknown = submittedOwnerName || registeredOwnerName;
  const acctCap = (accountVerification.capabilities || {}) as Record<string, unknown>;
  const acctFields = (accountVerification.verifiedFields || {}) as Record<string, unknown>;

  // --- Account existence (provider verified the account is real) ---
  const accountFound =
    Boolean(accountVerification.verified) && accountVerification.verificationStatus === 'VERIFIED';

  // --- Account-name enquiry (capability-aware; NOT_PROVIDED != MISMATCH) ---
  let accountNameState = FieldState.NOT_PROVIDED as FieldStateValue;
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
  let bvnOutcome = BvnState.BVN_NOT_VERIFIED as BvnStateValue;
  let bvnMatchesOwner = false;
  if (bvnVerification) {
    const bCap = (bvnVerification.capabilities || {}) as Record<string, unknown>;
    const bFields = (bvnVerification.verifiedFields || {}) as Record<string, unknown>;
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
  let overall: SettlementEligibilityResult['overall'];
  let eligible: boolean;
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
