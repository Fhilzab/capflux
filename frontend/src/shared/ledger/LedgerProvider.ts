import type { LedgerEntry, LedgerResult } from './types';

/**
 * Ledger Provider Interface
 * Abstract contract for ledger operations.
 *
 * INTENTIONALLY does NOT expose:
 *   - updateEntry() — ledger entries are NEVER updated
 *   - deleteEntry() — ledger entries are NEVER deleted
 *
 * Corrections are made by creating compensating entries (REVERSAL, REFUND, ADJUSTMENT).
 */
export abstract class LedgerProvider {
  // Create — append only
  abstract createEntry(data: {
    id: string;
    entryNumber: string;
    sequenceNumber: number;
    schemaVersion: number;
    organizationId: string;
    schoolId: string;
    studentId: string;
    billingProfileId: string;
    transactionGroupId: string;
    sourceDocumentType: 'PAYMENT' | 'CHARGE' | 'REFUND' | 'WAIVER' | 'ADJUSTMENT';
    sourceDocumentId: string;
    academicSessionId: string;
    academicTermId: string;
    entryType: 'CHARGE' | 'PAYMENT' | 'WAIVER' | 'REVERSAL' | 'REFUND' | 'ADJUSTMENT';
    entryDirection: 'DEBIT' | 'CREDIT';
    amountMinor: number;
    balanceBeforeMinor: number;
    balanceAfterMinor: number;
    currency: string;
    sourceEntity: 'BILLING' | 'PAYMENT' | 'WAIVER' | 'REFUND' | 'REVERSAL' | 'ADJUSTMENT';
    previousHash?: string;
    entryHash: string;
    hashAlgorithm: 'SHA256_V1' | 'SHA3_256_V1';
    reconciliationStatus: 'UNRECONCILED' | 'RECONCILED' | 'DISPUTED';
    metadata?: Record<string, unknown>;
    occurredAt: string;
    postingDate: string;
    createdBy?: string;
    createdAt: string;
  }): Promise<LedgerResult<LedgerEntry>>;

  // Query
  abstract getEntry(entryId: string): Promise<LedgerResult<LedgerEntry>>;
  abstract getEntryByNumber(entryNumber: string): Promise<LedgerResult<LedgerEntry | null>>;
  abstract getEntryBySourceDocument(sourceDocumentType: string, sourceDocumentId: string): Promise<LedgerResult<LedgerEntry | null>>;
  abstract listEntries(schoolId: string): Promise<LedgerResult<LedgerEntry[]>>;
  abstract listEntriesByStudent(studentId: string): Promise<LedgerResult<LedgerEntry[]>>;
  abstract listEntriesBySession(schoolId: string, sessionId: string): Promise<LedgerResult<LedgerEntry[]>>;
  abstract listEntriesByTerm(schoolId: string, termId: string): Promise<LedgerResult<LedgerEntry[]>>;
  abstract getLatestEntry(studentId: string): Promise<LedgerResult<LedgerEntry | null>>;
  abstract getNextSequenceNumber(schoolId: string): Promise<LedgerResult<number>>;

  // Compensating entries (create new entries, never modify existing)
  abstract reverseEntry?(originalEntryId: string, reason: string): Promise<LedgerResult<LedgerEntry>>;
  abstract adjustEntry?(originalEntryId: string, newAmountMinor: number, reason: string): Promise<LedgerResult<LedgerEntry>>;
  abstract refundEntry?(originalEntryId: string, amountMinor: number, reason: string): Promise<LedgerResult<LedgerEntry>>;

  // Reporting
  abstract generateStatement?(studentId: string, fromDate: string, toDate: string): Promise<LedgerResult<LedgerEntry[]>>;
  abstract recalculateRunningBalances?(studentId: string): Promise<LedgerResult<void>>;

  abstract isConfigured(): boolean;
}