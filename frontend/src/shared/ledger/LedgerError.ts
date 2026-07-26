import type { LedgerErrorCode, LedgerError } from './types';

const ERROR_MESSAGES: Record<LedgerErrorCode, string> = {
  LEDGER_ENTRY_NOT_FOUND: 'Ledger entry not found.',
  LEDGER_ENTRY_CREATE_FAILED: 'Failed to create ledger entry. Please try again.',
  DUPLICATE_LEDGER_ENTRY: 'This ledger entry already exists.',
  INVALID_ENTRY_DIRECTION: 'Entry direction must be DEBIT or CREDIT.',
  INVALID_DEBIT_CREDIT: 'Debit entries must have creditAmountMinor = 0. Credit entries must have debitAmountMinor = 0.',
  INVALID_AMOUNT: 'Amount must be greater than zero.',
  HASH_MISMATCH: 'Entry hash does not match computed hash. Data may have been tampered with.',
  HASH_CHAIN_BROKEN: 'Previous entry hash does not match. Hash chain integrity check failed.',
  REVERSAL_ALREADY_EXISTS: 'A reversal entry for this transaction already exists.',
  SOURCE_DOCUMENT_ALREADY_RECORDED: 'This source document has already been recorded in the ledger.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

export function mapLedgerError(error: unknown, fallbackCode: LedgerErrorCode = 'UNKNOWN'): LedgerError {
  if (!error) {
    return {
      code: fallbackCode,
      message: ERROR_MESSAGES[fallbackCode],
      raw: error,
    };
  }

  const supabaseError = error as { message?: string; code?: string };
  const message = supabaseError.message || supabaseError.code || '';
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('not found') || lowerMessage.includes('no rows')) {
    return { code: 'LEDGER_ENTRY_NOT_FOUND', message: ERROR_MESSAGES.LEDGER_ENTRY_NOT_FOUND, raw: error };
  }

  if (lowerMessage.includes('network') || lowerMessage.includes('failed to fetch')) {
    return { code: 'NETWORK_ERROR', message: ERROR_MESSAGES.NETWORK_ERROR, raw: error };
  }

  if (lowerMessage.includes('unauthorized') || lowerMessage.includes('permission')) {
    return { code: 'UNAUTHORIZED', message: ERROR_MESSAGES.UNAUTHORIZED, raw: error };
  }

  if (lowerMessage.includes('duplicate') || lowerMessage.includes('unique constraint')) {
    return { code: 'DUPLICATE_LEDGER_ENTRY', message: ERROR_MESSAGES.DUPLICATE_LEDGER_ENTRY, raw: error };
  }

  return {
    code: fallbackCode,
    message: ERROR_MESSAGES[fallbackCode],
    raw: error,
  };
}

export function getLedgerErrorMessage(code: LedgerErrorCode): string {
  return ERROR_MESSAGES[code];
}