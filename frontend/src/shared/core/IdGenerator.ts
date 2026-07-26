/**
 * IdGenerator
 * Shared utility for generating UUIDv7 identifiers and prefixed business references.
 *
 * UUIDv7 is the database primary key for every financial entity.
 * Prefixed references (LED_, PAY_, CHR_, etc.) are immutable public business identifiers.
 */

export type HashAlgorithm = 'SHA256_V1' | 'SHA3_256_V1';

const HEX_CHARS = '0123456789abcdef';

/**
 * Generate a UUIDv7 string.
 * UUIDv7 is time-ordered, making it ideal for database primary keys.
 */
export function generateUuidV7(): string {
  const timestamp = Date.now();
  const hex = timestamp.toString(16).padStart(12, '0');

  // 8-4-4-4-12 format with version 7 and variant bits
  const segments = [
    hex.substring(0, 8),
    hex.substring(8, 12),
    '7' + hex.substring(12, 15),   // version 7
    '8' + randomHex(3),             // variant 1 (RFC 9562)
    randomHex(12),
  ];

  return segments.join('-');
}

/**
 * Generate a prefixed immutable business reference.
 * Example: generateReference('LED') → 'LED_01990e3e3a0d7cb8b7f240dc84d97d2b'
 */
export function generateReference(prefix: string): string {
  const uuid = generateUuidV7().replace(/-/g, '');
  return `${prefix}_${uuid}`;
}

/**
 * Generate a ledger entry number.
 * Example: 'LED_01990e3e3a0d7cb8b7f240dc84d97d2b'
 */
export function generateLedgerReference(): string {
  return generateReference('LED');
}

/**
 * Generate a billing profile reference.
 * Example: 'BIL_01990e3e3a0d7cb8b7f240dc84d97d2b'
 */
export function generateBillingReference(): string {
  return generateReference('BIL');
}

/**
 * Generate a billing snapshot reference.
 * Example: 'SNP_01990e3e3a0d7cb8b7f240dc84d97d2b'
 */
export function generateSnapshotReference(): string {
  return generateReference('SNP');
}

/**
 * Generate a student charge reference.
 * Example: 'CHR_01990e3e3a0d7cb8b7f240dc84d97d2b'
 */
export function generateChargeReference(): string {
  return generateReference('CHR');
}

/**
 * Generate a payment reference.
 * Example: 'PAY_01990e3e3a0d7cb8b7f240dc84d97d2b'
 */
export function generatePaymentReference(): string {
  return generateReference('PAY');
}

/**
 * Generate a DVA (student payment account) reference.
 * Example: 'DVA_01990e3e3a0d7cb8b7f240dc84d97d2b'
 */
export function generatePaymentAccountReference(): string {
  return generateReference('DVA');
}

/**
 * Compute a SHA-256 hash for the ledger hash chain.
 * Canonical serialization:
 *   SHA256_V1(schemaVersion + previousHash + entryNumber + transactionGroupId + entryDirection + amountMinor + occurredAt)
 */
export async function computeEntryHash(params: {
  schemaVersion: number;
  previousHash?: string;
  entryNumber: string;
  transactionGroupId: string;
  entryDirection: string;
  amountMinor: number;
  occurredAt: string;
  algorithm: HashAlgorithm;
}): Promise<string> {
  const payload = [
    params.schemaVersion.toString(),
    params.previousHash || '',
    params.entryNumber,
    params.transactionGroupId,
    params.entryDirection,
    params.amountMinor.toString(),
    params.occurredAt,
  ].join('|');

  // Use Web Crypto API for SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

function randomHex(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += HEX_CHARS[Math.floor(Math.random() * 16)];
  }
  return result;
}