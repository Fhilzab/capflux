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
