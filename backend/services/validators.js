/**
 * validators — format validation for identity/financial fields.
 * Centralized so routes and tests share the same rules.
 */

export function isValidBvn(value) {
  return typeof value === 'string' && /^\d{11}$/.test(value.trim());
}

export function isValidNin(value) {
  return typeof value === 'string' && /^\d{11}$/.test(value.trim());
}

export function isValidCacNumber(value) {
  // Nigerian CAC registration numbers: alphanumeric, e.g. RC-1234567, BN-1234567, 123456.
  return typeof value === 'string' && /^[A-Za-z0-9-]{5,20}$/.test(value.trim());
}

export function isValidAccountNumber(value) {
  return typeof value === 'string' && /^\d{10}$/.test(value.trim());
}

export function isValidBankCode(value) {
  return typeof value === 'string' && /^\d{3,6}$/.test(value.trim());
}

export function normalizeIdentifier(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export const ALLOWED_CAC_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

export const ALLOWED_CAC_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];

export const MAX_CAC_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function isValidCacMimeType(mimeType) {
  return ALLOWED_CAC_MIME_TYPES.includes(mimeType);
}

export function isValidCacExtension(extensionOrFilename) {
  if (!extensionOrFilename) return false;
  // Accept either a bare extension ("png") or a filename ("cert.png").
  const ext = String(extensionOrFilename).includes('.')
    ? String(extensionOrFilename).split('.').pop().toLowerCase()
    : String(extensionOrFilename).toLowerCase();
  return ALLOWED_CAC_EXTENSIONS.includes(ext);
}

export function isAllowedCacFile({ mimeType, extension, size }) {
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
];

export const ALLOWED_GENDER = ['MIXED', 'BOYS', 'GIRLS'];

export const ALLOWED_SCHOOL_LEVELS = ['NURSERY', 'PRIMARY', 'SECONDARY'];

export function isValidDateOfBirth(value) {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  if (d > new Date()) return false;
  const year = d.getFullYear();
  if (year < 1900 || year > new Date().getFullYear()) return false;
  return true;
}

export function isValidIdentityDocumentType(value) {
  return ALLOWED_IDENTITY_DOCUMENT_TYPES.includes(value);
}

export function isValidGender(value) {
  return ALLOWED_GENDER.includes(value);
}

export function isValidSchoolLevels(levels) {
  if (!Array.isArray(levels) || levels.length === 0) return false;
  return levels.every((l) => ALLOWED_SCHOOL_LEVELS.includes(l));
}

export function isValidSchoolCategory(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 100;
}

export function isValidOwnershipPercentage(value) {
  const n = Number(value);
  return !Number.isNaN(n) && n > 0 && n <= 100;
}

export function isValidShareholder(data) {
  if (!data || typeof data !== 'object') return false;
  if (!data.fullName || typeof data.fullName !== 'string' || data.fullName.trim().length === 0) return false;
  if (!isValidOwnershipPercentage(data.ownershipPercentage)) return false;
  if (!data.role || typeof data.role !== 'string') return false;
  if (!data.phone || !/^\d{10,15}$/.test(String(data.phone).replace(/\D/g, ''))) return false;
  if (!isValidIdentityDocumentType(data.identityType)) return false;
  return true;
}

export function isValidPhone(value) {
  if (!value || typeof value !== 'string') return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Check that the verification provider's returned account name plausibly
 * matches the registered school/owner name (normalized token overlap).
 * This is a guard, not proof — a human reviewer still confirms.
 */
export function namesPlausiblyMatch(returnedName, registeredName) {
  if (!returnedName || !registeredName) return false;
  const normalize = (s) =>
    String(s).toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
  const a = new Set(normalize(returnedName));
  const b = new Set(normalize(registeredName));
  if (a.size === 0 || b.size === 0) return false;
  let overlap = 0;
  a.forEach((tok) => { if (b.has(tok)) overlap += 1; });
  return overlap / Math.min(a.size, b.size) >= 0.6;
}
