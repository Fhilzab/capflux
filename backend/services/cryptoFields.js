/**
 * cryptoFields — application-layer encryption and masking for sensitive
 * identity/financial fields (NIN, BVN, settlement account numbers).
 *
 * AES-256-GCM with a 32-byte key from KYC_ENCRYPTION_KEY (env).
 * Encrypted value is base64(iv || tag || ciphertext).
 *
 * NOTE: This preserves the existing kyc.js encryption format so existing
 * encrypted records remain decryptable. Key rotation is documented in
 * docs/security/key_management.md.
 */
import crypto from 'crypto';

export function getEncryptionKey() {
  const key = process.env.KYC_ENCRYPTION_KEY;
  if (!key || Buffer.byteLength(key, 'utf8') !== 32) {
    throw new Error('KYC_ENCRYPTION_KEY must be set to a 32-byte string');
  }
  return Buffer.from(key, 'utf8');
}

export function encryptField(plaintext) {
  if (plaintext == null) return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptField(encrypted) {
  if (!encrypted) return null;
  try {
    const key = getEncryptionKey();
    const buffer = Buffer.from(encrypted, 'base64');
    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const ciphertext = buffer.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch (_err) {
    return null;
  }
}

/**
 * Mask an identifier: show last 4 digits only: ****1234
 */
export function maskLast4(value) {
  if (value == null) return null;
  const str = String(value);
  if (str.length <= 4) return '*'.repeat(str.length);
  return '*'.repeat(str.length - 4) + str.slice(-4);
}

/**
 * Mask an identifier: show first 3 and last 3 digits (existing kyc.js format).
 */
export function maskIdentifier(value, visibleStart = 3, visibleEnd = 3) {
  if (value == null) return null;
  const str = String(value);
  if (str.length <= visibleStart + visibleEnd) return '*'.repeat(str.length);
  return str.slice(0, visibleStart) + '*'.repeat(str.length - visibleStart - visibleEnd) + str.slice(-visibleEnd);
}

export function last4(value) {
  if (value == null) return null;
  const str = String(value).trim();
  return str.length >= 4 ? str.slice(-4) : str;
}
