/**
 * Crypto field round-trip + masking tests.
 * Uses an env override for the encryption key to avoid depending on .env.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptField, decryptField, maskLast4, last4, maskIdentifier } from '../services/cryptoFields.js';

// Force a valid 32-byte key for tests.
process.env.KYC_ENCRYPTION_KEY = 'a'.repeat(32);

test('encrypt/decrypt round-trips plaintext', () => {
  const plain = '12345678901';
  const enc = encryptField(plain);
  assert.ok(enc);
  assert.notEqual(enc, plain);
  assert.equal(decryptField(enc), plain);
});

test('encrypt produces unique ciphertext per call (random IV)', () => {
  const a = encryptField('12345678901');
  const b = encryptField('12345678901');
  assert.notEqual(a, b);
});

test('decrypt returns null on garbage', () => {
  assert.equal(decryptField('not-valid-base64!!'), null);
  assert.equal(decryptField(null), null);
});

test('maskLast4 shows only last 4 digits', () => {
  assert.equal(maskLast4('1234567890'), '******7890');
  // 4 chars or fewer are fully masked (never expose the raw value).
  assert.equal(maskLast4('1234'), '****');
  assert.equal(maskLast4('12'), '**');
  assert.equal(maskLast4(null), null);
});

test('last4 returns last 4 chars (or the whole short value)', () => {
  assert.equal(last4('0123456789'), '6789');
  assert.equal(last4('1234'), '1234');
  assert.equal(last4('123'), '123');
});

test('maskIdentifier preserves first/last N digits', () => {
  assert.equal(maskIdentifier('12345678901', 3, 3), '123*****901');
});
