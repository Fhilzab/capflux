/**
 * Accounting Domain Types
 * Double-entry accounting journal layer.
 */

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
export type AccountNormalBalance = 'DEBIT' | 'CREDIT';

export type JournalStatus = 'DRAFT' | 'APPROVED' | 'POSTED' | 'REVERSED';
export type PostingStatus = 'NOT_POSTED' | 'POSTING' | 'POSTED' | 'FAILED';
export type PostingBatchStatus = 'OPEN' | 'POSTED' | 'FAILED';

export interface ChartOfAccount {
  id: string;
  accountCode: string;        // e.g. "1100", "1200", "4100"
  accountName: string;        // e.g. "Cash", "Accounts Receivable", "School Fee Income"
  accountType: AccountType;
  normalBalance: AccountNormalBalance;
  organizationId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JournalLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  direction: 'DEBIT' | 'CREDIT';
  amountMinor: number;         // kobo
  currency: string;
  memo?: string;
  createdAt: string;
}

export interface JournalEntry {
  id: string;                          // UUIDv7
  journalNumber: string;               // JRN_{UUIDv7}
  organizationId: string;
  schoolId: string;
  transactionGroupId: string;          // groups related journals (e.g. PAYMENT + LEDGER)
  sourceDocumentType: 'PAYMENT' | 'CHARGE' | 'REFUND' | 'WAIVER' | 'ADJUSTMENT';
  sourceDocumentId: string;
  description: string;
  status: JournalStatus;
  postingStatus: PostingStatus;
  postingBatchId?: string;
  lines: JournalLine[];
  occurredAt: string;
  postingDate?: string;
  createdAt: string;
  createdBy?: string;
}

export interface PostingBatch {
  id: string;                          // UUIDv7
  batchNumber: string;                 // BATCH-{UUIDv7}
  organizationId: string;
  schoolId: string;
  status: PostingBatchStatus;
  journalIds: string[];
  description?: string;
  occurredAt: string;
  createdAt: string;
  createdBy?: string;
}

export interface AccountingResult<T> {
  data: T | null;
  error: AccountingError | null;
}

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