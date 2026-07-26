/**
 * Ledger Domain Types
 * Append-only financial ledger — the single source of financial truth.
 */

export type LedgerEntryType = 'CHARGE' | 'PAYMENT' | 'WAIVER' | 'REVERSAL' | 'REFUND' | 'ADJUSTMENT';
export type SourceDocumentType = 'PAYMENT' | 'CHARGE' | 'REFUND' | 'WAIVER' | 'ADJUSTMENT';
export type ReconciliationStatus = 'UNRECONCILED' | 'RECONCILED' | 'DISPUTED';
export type EntryDirection = 'DEBIT' | 'CREDIT';
export type SourceEntity = 'BILLING' | 'PAYMENT' | 'WAIVER' | 'REFUND' | 'REVERSAL' | 'ADJUSTMENT';
export type HashAlgorithm = 'SHA256_V1' | 'SHA3_256_V1';

export interface LedgerEntry {
  id: string;                        // UUIDv7
  entryNumber: string;               // LED_{UUIDv7} — immutable business identifier
  sequenceNumber: number;            // 1, 2, 3... per-ledger monotonically increasing
  schemaVersion: number;             // 1 — future-proof for schema evolution
  organizationId: string;
  schoolId: string;
  studentId: string;
  billingProfileId: string;
  transactionGroupId: string;        // groups related entries (e.g. PAYMENT + VAT + SHARES)
  sourceDocumentType: SourceDocumentType;
  sourceDocumentId: string;          // replaces individual paymentId/chargeId fields
  academicSessionId: string;
  academicTermId: string;
  entryType: LedgerEntryType;
  entryDirection: EntryDirection;    // DEBIT | CREDIT
  amountMinor: number;               // monetary value in kobo (₦2,500.50 = 250050)
  balanceBeforeMinor: number;        // running balance before this entry
  balanceAfterMinor: number;         // running balance after this entry
  currency: string;
  sourceEntity: SourceEntity;
  previousHash?: string;             // hash of previous entry in chain
  entryHash: string;                 // SHA256(schemaVersion + previousHash + entryNumber + transactionGroupId + entryDirection + amountMinor + occurredAt)
  hashAlgorithm: HashAlgorithm;      // 'SHA256_V1' — typed union
  reconciliationStatus: ReconciliationStatus;
  metadata?: Record<string, unknown>;
  occurredAt: string;                // business event time
  postingDate: string;               // accounting/fiscal date
  createdBy?: string;
  createdAt: string;                 // database insertion time
}

export interface LedgerResult<T> {
  data: T | null;
  error: LedgerError | null;
}

export type LedgerErrorCode =
  | 'LEDGER_ENTRY_NOT_FOUND'
  | 'LEDGER_ENTRY_CREATE_FAILED'
  | 'DUPLICATE_LEDGER_ENTRY'
  | 'INVALID_ENTRY_DIRECTION'
  | 'INVALID_DEBIT_CREDIT'
  | 'INVALID_AMOUNT'
  | 'HASH_MISMATCH'
  | 'HASH_CHAIN_BROKEN'
  | 'REVERSAL_ALREADY_EXISTS'
  | 'SOURCE_DOCUMENT_ALREADY_RECORDED'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'UNKNOWN';

export interface LedgerError {
  code: LedgerErrorCode;
  message: string;
  raw?: unknown;
}