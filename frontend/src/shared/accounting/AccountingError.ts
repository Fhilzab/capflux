export type AccountingErrorCode =
  | 'JOURNAL_NOT_FOUND'
  | 'JOURNAL_CREATE_FAILED'
  | 'JOURNAL_ALREADY_POSTED'
  | 'JOURNAL_REVERSE_FAILED'
  | 'JOURNAL_NOT_BALANCED'
  | 'ACCOUNT_NOT_FOUND'
  | 'ACCOUNT_INACTIVE'
  | 'POSTING_BATCH_NOT_FOUND'
  | 'POSTING_BATCH_CREATE_FAILED'
  | 'INVALID_POSTING_STATUS'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'UNKNOWN';

export interface AccountingError {
  code: AccountingErrorCode;
  message: string;
  raw?: unknown;
}

export function mapAccountingError(error: unknown, fallbackCode: AccountingErrorCode = 'UNKNOWN'): AccountingError {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const maybeError = error as { code?: unknown; message?: unknown };
    if (typeof maybeError.code === 'string') {
      return {
        code: maybeError.code as AccountingErrorCode,
        message: typeof maybeError.message === 'string' ? maybeError.message : 'Unknown accounting error',
        raw: error,
      };
    }
  }

  if (error instanceof Error) {
    return { code: fallbackCode, message: error.message, raw: error };
  }

  return { code: fallbackCode, message: 'Unknown accounting error', raw: error };
}