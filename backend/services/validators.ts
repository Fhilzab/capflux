/**
 * validators — format validation for identity/financial fields.
 * Centralized so routes and tests share the same rules.
 */

export function isValidBvn(value: unknown): boolean {
  return typeof value === 'string' && /^\d{11}$/.test(value.trim());
}

export function isValidNin(value: unknown): boolean {
  return typeof value === 'string' && /^\d{11}$/.test(value.trim());
}

export function isValidCacNumber(value: unknown): boolean {
  // Nigerian CAC registration numbers: alphanumeric, e.g. RC-1234567, BN-1234567, 123456.
  return typeof value === 'string' && /^[A-Za-z0-9-]{5,20}$/.test(value.trim());
}

export function isValidAccountNumber(value: unknown): boolean {
  return typeof value === 'string' && /^\d{10}$/.test(value.trim());
}

export function isValidBankCode(value: unknown): boolean {
  return typeof value === 'string' && /^\d{3,6}$/.test(value.trim());
}

export function normalizeIdentifier(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export const ALLOWED_CAC_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

export const ALLOWED_CAC_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];

export const MAX_CAC_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function isValidCacMimeType(mimeType: unknown): boolean {
  return ALLOWED_CAC_MIME_TYPES.includes(mimeType as string);
}

export function isValidCacExtension(extensionOrFilename: unknown): boolean {
  if (!extensionOrFilename) return false;
  // Accept either a bare extension ("png") or a filename ("cert.png").
  const ext = String(extensionOrFilename).includes('.')
    ? String(extensionOrFilename).split('.').pop()?.toLowerCase()
    : String(extensionOrFilename).toLowerCase();
  return ALLOWED_CAC_EXTENSIONS.includes(ext ?? '');
}

export interface CacFileCheck {
  mimeType: unknown;
  extension: unknown;
  size: unknown;
}

export function isAllowedCacFile({ mimeType, extension, size }: CacFileCheck): boolean {
  return (
    isValidCacMimeType(mimeType) &&
    isValidCacExtension(extension) &&
    typeof size === 'number' &&
    size > 0 &&
    size <= MAX_CAC_FILE_SIZE
  );
}

// ==========================================================
// Phase 8.4 — KYC/Onboarding consolidation validators
// ==========================================================

export const ALLOWED_IDENTITY_DOCUMENT_TYPES = [
  'NIN_SLIP',
  'NIN_CARD',
  'INTERNATIONAL_PASSPORT',
  'VOTERS_CARD',
] as const;

export type IdentityDocumentType = (typeof ALLOWED_IDENTITY_DOCUMENT_TYPES)[number];

export const ALLOWED_GENDER = ['MIXED', 'BOYS', 'GIRLS'] as const;

export const ALLOWED_SCHOOL_LEVELS = ['NURSERY', 'PRIMARY', 'SECONDARY'] as const;

export function isValidDateOfBirth(value: unknown): boolean {
  if (!value) return false;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return false;
  if (d > new Date()) return false;
  const year = d.getFullYear();
  if (year < 1900 || year > new Date().getFullYear()) return false;
  return true;
}

export function isValidIdentityDocumentType(value: unknown): boolean {
  return (ALLOWED_IDENTITY_DOCUMENT_TYPES as readonly string[]).includes(value as string);
}

export function isValidGender(value: unknown): boolean {
  return (ALLOWED_GENDER as readonly string[]).includes(value as string);
}

export function isValidSchoolLevels(levels: unknown): boolean {
  if (!Array.isArray(levels) || levels.length === 0) return false;
  return levels.every((l) => (ALLOWED_SCHOOL_LEVELS as readonly string[]).includes(l as string));
}

export function isValidSchoolCategory(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 100;
}

export function isValidOwnershipPercentage(value: unknown): boolean {
  const n = Number(value);
  return !Number.isNaN(n) && n > 0 && n <= 100;
}

export interface ShareholderInput {
  fullName?: unknown;
  ownershipPercentage?: unknown;
  role?: unknown;
  phone?: unknown;
  identityType?: unknown;
}

export function isValidShareholder(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const sh = data as ShareholderInput;
  if (!sh.fullName || typeof sh.fullName !== 'string' || sh.fullName.trim().length === 0) return false;
  if (!isValidOwnershipPercentage(sh.ownershipPercentage)) return false;
  if (!sh.role || typeof sh.role !== 'string') return false;
  if (!sh.phone || !/^\d{10,15}$/.test(String(sh.phone).replace(/\D/g, ''))) return false;
  if (!isValidIdentityDocumentType(sh.identityType)) return false;
  return true;
}

export function isValidPhone(value: unknown): boolean {
  if (!value || typeof value !== 'string') return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Check that the verification provider's returned account name plausibly
 * matches the registered school/owner name (normalized token overlap).
 * This is a guard, not proof — a human reviewer still confirms.
 */
export function namesPlausiblyMatch(returnedName: unknown, registeredName: unknown): boolean {
  if (!returnedName || !registeredName) return false;
  const normalize = (s: unknown) =>
    String(s).toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
  const a = new Set(normalize(returnedName));
  const b = new Set(normalize(registeredName));
  if (a.size === 0 || b.size === 0) return false;
  let overlap = 0;
  a.forEach((tok) => { if (b.has(tok)) overlap += 1; });
  return overlap / Math.min(a.size, b.size) >= 0.6;
}

// ==========================================================
// Phase 8.5 — Business type validation
// ==========================================================

/**
 * Canonical CAPFLUX business-type enum values (mirrors
 * frontend/src/shared/businessTypes.ts).
 *
 * These map to legitimate CAC-recognised entity classifications:
 *   BUSINESS_NAME             — Sole proprietorship / registered business name
 *   PARTNERSHIP               — Partnership / business name with multiple owners
 *   PRIVATE_LIMITED_COMPANY   — Private company limited by shares (Ltd)
 *   PUBLIC_LIMITED_COMPANY    — Public company limited by shares (Plc)
 *   LIMITED_BY_GUARANTEE     — Company limited by guarantee (no share capital)
 *   UNLIMITED_COMPANY         — Unlimited company (no share capital)
 *   LLP                       — Limited Liability Partnership
 *   LP                        — Limited Partnership
 *   INCORPORATED_TRUSTEES     — Incorporated Trustees / Non-Profit Organisation
 */
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
];

export type BusinessType = (typeof VALID_BUSINESS_TYPE_VALUES)[number];

/**
 * Map legacy / placeholder values to their canonical equivalents.
 *
 * Old client-side values that were never persisted to the database but may
 * appear in cached frontend state:
 *   - "PRIVATE" / "Private Business"      → "PRIVATE_LIMITED_COMPANY"
 *   - "PUBLIC" / "Public Business"        → "PUBLIC_LIMITED_COMPANY"
 *   - "IS_GRADUATE" / "Graduate"          → "BUSINESS_NAME"
 */
const LEGACY_BUSINESS_TYPE_MAP: Record<string, BusinessType> = {
  PRIVATE: 'PRIVATE_LIMITED_COMPANY',
  'Private Business': 'PRIVATE_LIMITED_COMPANY',
  PUBLIC: 'PUBLIC_LIMITED_COMPANY',
  'Public Business': 'PUBLIC_LIMITED_COMPANY',
  IS_GRADUATE: 'BUSINESS_NAME',
  Graduate: 'BUSINESS_NAME',
};

/**
 * Validate that a value is one of the canonical business-type enums.
 * Rejects legacy values ("PRIVATE", "Private Business", etc.).
 */
export function isValidBusinessType(value: unknown): value is BusinessType {
  return typeof value === 'string' && (VALID_BUSINESS_TYPE_VALUES as string[]).includes(value);
}

/**
 * Normalize a legacy / cached business-type value to its canonical equivalent.
 * Returns null for unrecognized or unset values.
 */
export function normalizeLegacyBusinessType(value: unknown): BusinessType | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (isValidBusinessType(trimmed)) return trimmed;
  return LEGACY_BUSINESS_TYPE_MAP[trimmed] || null;
}
