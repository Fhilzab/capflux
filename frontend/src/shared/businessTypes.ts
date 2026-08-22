/**
 * CAPFLUX Business Type Configuration
 *
 * Centralized, data-driven configuration for Nigerian business/entity
 * structures recognised by the Corporate Affairs Commission (CAC).
 *
 * This file is the SINGLE SOURCE OF TRUTH for:
 *   - Business type dropdown options
 *   - Entity-category classification
 *   - Registration-number field labelling
 *   - Document requirements (required + optional) per entity type
 *   - Legacy value normalization ("PRIVATE" → "PRIVATE_LIMITED_COMPANY", etc.)
 *   - Validation of business-type enum values
 *
 * Design rules:
 *   - No fabricated legal requirements — the required/optional document lists
 *     reflect CAPFLUX's KYC verification policy, not universal CAC mandates.
 *   - The configuration is consumed by the onboarding store, the KYC wizard,
 *     the document checklist, and the backend (re-exported via validators.js).
 *   - Stable internal enum values are suitable for database/API persistence.
 */

// ── Valid business-type enum values ───────────────────────────────────

export const VALID_BUSINESS_TYPE_VALUES = [
  'BUSINESS_NAME',
  'PARTNERSHIP',
  'PRIVATE_LIMITED_COMPANY',
  'PUBLIC_LIMITED_COMPANY',
  'LIMITED_BY_GUARANTEE',
  'UNLIMITED_COMPANY',
  'LLP',
  'LP',
  'INCORPORATED_TRUSTEES',
] as const;

export type BusinessType = (typeof VALID_BUSINESS_TYPE_VALUES)[number];

// ── Entity categories (broad classification) ──────────────────────────

export type EntityCategory = 'COMPANY' | 'BUSINESS_NAME' | 'PARTNERSHIP' | 'NON_PROFIT';

// ── Document type identifiers ──────────────────────────────────────────

export type DocumentTypeId =
  | 'CAC_REGISTRATION_EVIDENCE'
  | 'PROPRIETOR_IDENTITY'
  | 'PARTNER_IDENTITY'
  | 'DIRECTOR_IDENTITY'
  | 'COMPANY_CONSTITUTION'
  | 'SHAREHOLDER_INFO'
  | 'TRUSTEE_IDENTITY'
  | 'GOVERNING_DOCUMENT'
  | 'ADDITIONAL_OWNERSHIP_EVIDENCE';

export interface DocumentTypeConfig {
  id: DocumentTypeId;
  label: string;
  description: string;
}

export const DOCUMENT_DEFINITIONS: Record<DocumentTypeId, DocumentTypeConfig> = {
  CAC_REGISTRATION_EVIDENCE: {
    id: 'CAC_REGISTRATION_EVIDENCE',
    label: 'CAC Registration Certificate',
    description: 'Current CAC registration certificate or E-status report.',
  },
  PROPRIETOR_IDENTITY: {
    id: 'PROPRIETOR_IDENTITY',
    label: 'Proprietor / Owner Identity Document',
    description: 'Valid government-issued ID of the business owner or proprietor.',
  },
  PARTNER_IDENTITY: {
    id: 'PARTNER_IDENTITY',
    label: 'Partner Identity Documents',
    description: 'Valid government-issued ID(s) of partner(s) in the partnership.',
  },
  DIRECTOR_IDENTITY: {
    id: 'DIRECTOR_IDENTITY',
    label: 'Director Identity Documents',
    description: 'Valid government-issued ID(s) of company director(s) or authorized representative.',
  },
  COMPANY_CONSTITUTION: {
    id: 'COMPANY_CONSTITUTION',
    label: 'Company Constitution / Agreement',
    description: 'Articles of Association, Memorandum of Incorporation, or LLP Agreement, where CAPFLUX verification policy requires it.',
  },
  SHAREHOLDER_INFO: {
    id: 'SHAREHOLDER_INFO',
    label: 'Shareholder / PSC Information',
    description: 'Details of shareholders and people with significant control (PSC).',
  },
  TRUSTEE_IDENTITY: {
    id: 'TRUSTEE_IDENTITY',
    label: 'Trustee Identity Documents',
    description: 'Valid government-issued ID(s) of trustee(s) or authorized representatives.',
  },
  GOVERNING_DOCUMENT: {
    id: 'GOVERNING_DOCUMENT',
    label: 'Governing Document',
    description: 'Constitution or governing document for the non-profit entity, where CAPFLUX verification policy requires it.',
  },
  ADDITIONAL_OWNERSHIP_EVIDENCE: {
    id: 'ADDITIONAL_OWNERSHIP_EVIDENCE',
    label: 'Additional Ownership Evidence',
    description: 'Any additional documents evidencing ownership or control, where CAPFLUX verification policy requires it.',
  },
};

// ── Business type configuration ────────────────────────────────────────

export interface BusinessTypeConfig {
  value: BusinessType;
  label: string;
  description: string;
  entityCategory: EntityCategory;
  /** Label for the registration-number input field. */
  registrationNumberLabel: string;
  /** Placeholder hint for the registration-number input. */
  registrationNumberPlaceholder: string;
  /** Whether the entity is expected to have directors. */
  expectsDirectors: boolean;
  /** Whether the entity has shareholders with ownership stakes. */
  expectsShareholders: boolean;
  /** Whether the entity has trustees (non-profit). */
  expectsTrustees: boolean;
  /** Whether the entity has partners (partnership / LLP / LP). */
  expectsPartners: boolean;
  /** Whether the entity has guarantors or members. */
  expectsGuarantors: boolean;
  /** Document type IDs that MUST be uploaded for this entity type. */
  requiredDocuments: DocumentTypeId[];
  /** Document type IDs that are OPTIONAL for this entity type. */
  optionalDocuments: DocumentTypeId[];
}

export const BUSINESS_TYPE_CONFIGS: BusinessTypeConfig[] = [
  {
    value: 'BUSINESS_NAME',
    label: 'Business Name / Enterprise',
    description: 'A sole proprietorship or registered business name.',
    entityCategory: 'BUSINESS_NAME',
    registrationNumberLabel: 'CAC Registration Number',
    registrationNumberPlaceholder: 'e.g. BN-1234567',
    expectsDirectors: false,
    expectsShareholders: false,
    expectsTrustees: false,
    expectsPartners: false,
    expectsGuarantors: false,
    requiredDocuments: ['CAC_REGISTRATION_EVIDENCE', 'PROPRIETOR_IDENTITY'],
    optionalDocuments: ['ADDITIONAL_OWNERSHIP_EVIDENCE'],
  },
  {
    value: 'PARTNERSHIP',
    label: 'Partnership / Business Name',
    description: 'A registered partnership or business name with multiple owners.',
    entityCategory: 'PARTNERSHIP',
    registrationNumberLabel: 'CAC Registration Number',
    registrationNumberPlaceholder: 'e.g. BN-1234567',
    expectsDirectors: false,
    expectsShareholders: false,
    expectsTrustees: false,
    expectsPartners: true,
    expectsGuarantors: false,
    requiredDocuments: ['CAC_REGISTRATION_EVIDENCE', 'PARTNER_IDENTITY'],
    optionalDocuments: ['ADDITIONAL_OWNERSHIP_EVIDENCE'],
  },
  {
    value: 'PRIVATE_LIMITED_COMPANY',
    label: 'Private Company Limited by Shares (Ltd)',
    description: 'A private limited company with share capital.',
    entityCategory: 'COMPANY',
    registrationNumberLabel: 'RC Number',
    registrationNumberPlaceholder: 'e.g. RC-1234567',
    expectsDirectors: true,
    expectsShareholders: true,
    expectsTrustees: false,
    expectsPartners: false,
    expectsGuarantors: false,
    requiredDocuments: ['CAC_REGISTRATION_EVIDENCE', 'DIRECTOR_IDENTITY'],
    optionalDocuments: ['SHAREHOLDER_INFO', 'COMPANY_CONSTITUTION'],
  },
  {
    value: 'PUBLIC_LIMITED_COMPANY',
    label: 'Public Company Limited by Shares (Plc)',
    description: 'A public company with shares offered to the public. Subject to additional regulatory compliance.',
    entityCategory: 'COMPANY',
    registrationNumberLabel: 'RC Number',
    registrationNumberPlaceholder: 'e.g. RC-1234567',
    expectsDirectors: true,
    expectsShareholders: true,
    expectsTrustees: false,
    expectsPartners: false,
    expectsGuarantors: false,
    // Plc differs from private company: constitution is mandatory,
    // and governing documents are optionally requested.
    requiredDocuments: [
      'CAC_REGISTRATION_EVIDENCE',
      'DIRECTOR_IDENTITY',
      'COMPANY_CONSTITUTION',
    ],
    optionalDocuments: ['SHAREHOLDER_INFO', 'GOVERNING_DOCUMENT'],
  },
  {
    value: 'LIMITED_BY_GUARANTEE',
    label: 'Company Limited by Guarantee',
    description: 'A company where members guarantee payment of debts, with no share capital.',
    entityCategory: 'COMPANY',
    registrationNumberLabel: 'CAC Registration Number',
    registrationNumberPlaceholder: 'e.g. CAC-1234567',
    expectsDirectors: true,
    expectsShareholders: false,
    expectsTrustees: false,
    expectsPartners: false,
    expectsGuarantors: true,
    requiredDocuments: ['CAC_REGISTRATION_EVIDENCE', 'DIRECTOR_IDENTITY'],
    optionalDocuments: ['GOVERNING_DOCUMENT'],
  },
  {
    value: 'UNLIMITED_COMPANY',
    label: 'Unlimited Company',
    description: 'A company whose members have unlimited liability, with no share capital.',
    entityCategory: 'COMPANY',
    registrationNumberLabel: 'RC Number',
    registrationNumberPlaceholder: 'e.g. RC-1234567',
    expectsDirectors: true,
    expectsShareholders: false,
    expectsTrustees: false,
    expectsPartners: false,
    expectsGuarantors: false,
    requiredDocuments: ['CAC_REGISTRATION_EVIDENCE', 'DIRECTOR_IDENTITY'],
    optionalDocuments: ['COMPANY_CONSTITUTION'],
  },
  {
    value: 'LLP',
    label: 'Limited Liability Partnership (LLP)',
    description: 'A partnership with limited liability protection for partners.',
    entityCategory: 'PARTNERSHIP',
    registrationNumberLabel: 'LLP Registration Number',
    registrationNumberPlaceholder: 'e.g. LLP-1234567',
    expectsDirectors: false,
    expectsShareholders: false,
    expectsTrustees: false,
    expectsPartners: true,
    expectsGuarantors: false,
    requiredDocuments: ['CAC_REGISTRATION_EVIDENCE', 'PARTNER_IDENTITY'],
    optionalDocuments: ['COMPANY_CONSTITUTION'],
  },
  {
    value: 'LP',
    label: 'Limited Partnership (LP)',
    description: 'A partnership with both general and limited partners. Limited partners have liability limited to their investment.',
    entityCategory: 'PARTNERSHIP',
    registrationNumberLabel: 'LP Registration Number',
    registrationNumberPlaceholder: 'e.g. LP-1234567',
    expectsDirectors: false,
    expectsShareholders: false,
    expectsTrustees: false,
    expectsPartners: true,
    expectsGuarantors: false,
    requiredDocuments: ['CAC_REGISTRATION_EVIDENCE', 'PARTNER_IDENTITY'],
    optionalDocuments: ['GOVERNING_DOCUMENT'],
  },
  {
    value: 'INCORPORATED_TRUSTEES',
    label: 'Incorporated Trustees / Non-Profit Organization',
    description: 'A non-profit organisation registered as incorporated trustees with CAC.',
    entityCategory: 'NON_PROFIT',
    registrationNumberLabel: 'CAC Registration Number',
    registrationNumberPlaceholder: 'e.g. IT-1234567',
    expectsDirectors: false,
    expectsShareholders: false,
    expectsTrustees: true,
    expectsPartners: false,
    expectsGuarantors: false,
    requiredDocuments: ['CAC_REGISTRATION_EVIDENCE', 'TRUSTEE_IDENTITY'],
    optionalDocuments: ['GOVERNING_DOCUMENT'],
  },
];

// ── Derived selectors ──────────────────────────────────────────────────

/** Dropdown options for CmSelect (value + label only). */
export const BUSINESS_TYPE_OPTIONS: { value: string; label: string }[] =
  BUSINESS_TYPE_CONFIGS.map((c) => ({ value: c.value, label: c.label }));

/** Look up a single business type config by its enum value. */
export function getBusinessTypeConfig(value: string | null | undefined): BusinessTypeConfig | undefined {
  if (!value) return undefined;
  return BUSINESS_TYPE_CONFIGS.find((c) => c.value === value);
}

/** Human-readable label for a business type value. */
export function getBusinessTypeLabel(value: string | null | undefined): string {
  return getBusinessTypeConfig(value)?.label ?? '—';
}

/**
 * Whether the documents required for `newType` are a subset of (or equal to)
 * the documents required for `oldType`. Used to decide whether existing
 * uploaded documents can be preserved when the user switches business type.
 */
export function canPreserveDocuments(oldType: string | null, newType: string | null): boolean {
  if (!oldType || !newType) return true;
  const oldCfg = getBusinessTypeConfig(oldType);
  const newCfg = getBusinessTypeConfig(newType);
  if (!oldCfg || !newCfg) return true;

  const oldSet = new Set([...oldCfg.requiredDocuments, ...oldCfg.optionalDocuments]);
  const newRequired = new Set(newCfg.requiredDocuments);

  // Every required document in the new type must also be compatible with the old type.
  for (const doc of newRequired) {
    if (!oldSet.has(doc)) return false;
  }
  return true;
}

/**
 * Documents that are required under the old type but not applicable under the
 * new type. Used to warn the user before discarding.
 */
export function getIncompatibleDocuments(
  oldType: string | null,
  newType: string | null,
): DocumentTypeConfig[] {
  if (!oldType || !newType) return [];
  const oldCfg = getBusinessTypeConfig(oldType);
  const newCfg = getBusinessTypeConfig(newType);
  if (!oldCfg || !newCfg) return [];

  const newSet = new Set([...newCfg.requiredDocuments, ...newCfg.optionalDocuments]);
  return (
    [...new Set([...oldCfg.requiredDocuments, ...oldCfg.optionalDocuments])]
      .filter((doc) => !newSet.has(doc))
      .map((doc) => DOCUMENT_DEFINITIONS[doc])
  );
}

// ── Legacy normalization ────────────────────────────────────────────────

/**
 * Return the required and optional document IDs for a given business type.
 * Returns empty arrays when no type is selected.
 */
export function getDocumentsForBusinessType(
  businessType: string | null | undefined,
): { required: DocumentTypeId[]; optional: DocumentTypeId[] } {
  const cfg = getBusinessTypeConfig(businessType);
  if (!cfg) return { required: [], optional: [] };
  return {
    required: cfg.requiredDocuments,
    optional: cfg.optionalDocuments,
  };
}

// ── Legacy normalization ────────────────────────────────────────────────

/**
 * Map legacy / placeholder business-type values to their canonical equivalents.
 *
 * Old client-side values that were never persisted to the database but may
 * appear in cached frontend state or test fixtures:
 *   - "PRIVATE" / "Private Business"      → "PRIVATE_LIMITED_COMPANY"
 *   - "PUBLIC" / "Public Business"        → "PUBLIC_LIMITED_COMPANY"
 *   - "IS_GRADUATE" / "Graduate"          → "BUSINESS_NAME"
 *
 * Any value not in this map and not already a valid enum is returned as `null`
 * so the caller can treat it as "unset".
 */
const LEGACY_BUSINESS_TYPE_MAP: Record<string, BusinessType> = {
  PRIVATE: 'PRIVATE_LIMITED_COMPANY',
  'Private Business': 'PRIVATE_LIMITED_COMPANY',
  PUBLIC: 'PUBLIC_LIMITED_COMPANY',
  'Public Business': 'PUBLIC_LIMITED_COMPANY',
  IS_GRADUATE: 'BUSINESS_NAME',
  Graduate: 'BUSINESS_NAME',
};

export function normalizeLegacyBusinessType(value: string | null | undefined): BusinessType | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (isValidBusinessType(trimmed)) return trimmed as BusinessType;
  return LEGACY_BUSINESS_TYPE_MAP[trimmed] ?? null;
}

/**
 * Validate that a value is one of the canonical business-type enums.
 * Rejects legacy values ("PRIVATE", "Private Business", etc.).
 */
export function isValidBusinessType(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && VALID_BUSINESS_TYPE_VALUES.includes(value as BusinessType);
}

export default {
  VALID_BUSINESS_TYPE_VALUES,
  BUSINESS_TYPE_CONFIGS,
  BUSINESS_TYPE_OPTIONS,
  DOCUMENT_DEFINITIONS,
  getBusinessTypeConfig,
  getBusinessTypeLabel,
  normalizeLegacyBusinessType,
  isValidBusinessType,
  canPreserveDocuments,
  getIncompatibleDocuments,
};
