/**
 * Validators unit tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidBvn,
  isValidNin,
  isValidCacNumber,
  isValidAccountNumber,
  isValidBankCode,
  isAllowedCacFile,
  namesPlausiblyMatch,
} from '../services/validators.js';

test('isValidBvn accepts exactly 11 digits', () => {
  assert.equal(isValidBvn('12345678901'), true);
  assert.equal(isValidBvn('1234567890'), false);
  assert.equal(isValidBvn('123456789012'), false);
  assert.equal(isValidBvn('abcdefghijk'), false);
});

test('isValidNin accepts exactly 11 digits', () => {
  assert.equal(isValidNin('98765432109'), true);
  assert.equal(isValidNin('987654321'), false);
});

test('isValidCacNumber accepts Nigerian CAC formats', () => {
  assert.equal(isValidCacNumber('RC-1234567'), true);
  assert.equal(isValidCacNumber('BN-987654'), true);
  assert.equal(isValidCacNumber('123456'), true);
  assert.equal(isValidCacNumber(''), false);
  assert.equal(isValidCacNumber('!!invalid!!'), false);
});

test('isValidAccountNumber accepts exactly 10 digits', () => {
  assert.equal(isValidAccountNumber('0123456789'), true);
  assert.equal(isValidAccountNumber('12345'), false);
  assert.equal(isValidAccountNumber('01234567890'), false);
});

test('isValidBankCode accepts 3-6 digits', () => {
  assert.equal(isValidBankCode('044'), true);
  assert.equal(isValidBankCode('000014'), true);
  assert.equal(isValidBankCode('44'), false);
});

test('isAllowedCacFile validates mime + extension + size', () => {
  assert.equal(isAllowedCacFile({ mimeType: 'application/pdf', extension: 'pdf', size: 1000 }), true);
  assert.equal(isAllowedCacFile({ mimeType: 'image/jpeg', extension: 'jpg', size: 1000 }), true);
  assert.equal(isAllowedCacFile({ mimeType: 'image/png', extension: 'png', size: 1000 }), true);
  assert.equal(isAllowedCacFile({ mimeType: 'text/html', extension: 'html', size: 1000 }), false);
  assert.equal(isAllowedCacFile({ mimeType: 'application/pdf', extension: 'exe', size: 1000 }), false);
  assert.equal(isAllowedCacFile({ mimeType: 'application/pdf', extension: 'pdf', size: 11 * 1024 * 1024 }), false);
  assert.equal(isAllowedCacFile({ mimeType: 'application/pdf', extension: 'pdf', size: 0 }), false);
});

test('namesPlausiblyMatch compares normalized tokens', () => {
  assert.equal(namesPlausiblyMatch('JOHN DOE SCHOOLS LTD', 'John Doe Schools Ltd'), true);
  assert.equal(namesPlausiblyMatch('JOHN DOE SCHOOLS LTD', 'Mary Smith Enterprises'), false);
  assert.equal(namesPlausiblyMatch(null, 'Anything'), false);
});
