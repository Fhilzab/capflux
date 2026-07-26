import type { JournalEntry, JournalLine, AccountingResult, PostingBatch } from './types';

/**
 * Journal Provider Interface
 *
 * INTENTIONALLY does NOT expose:
 *   - updateJournal() — journals are NEVER modified after posting
 *   - deleteJournal() — journals are NEVER deleted
 *
 * Corrections are made by creating REVERSAL journals.
 */

export abstract class JournalProvider {
  // Create — append only
  abstract createJournal(data: {
    id: string;
    journalNumber: string;
    organizationId: string;
    schoolId: string;
    transactionGroupId: string;
    sourceDocumentType: 'PAYMENT' | 'CHARGE' | 'REFUND' | 'WAIVER' | 'ADJUSTMENT';
    sourceDocumentId: string;
    description: string;
    status: 'DRAFT' | 'APPROVED' | 'POSTED' | 'REVERSED';
    postingStatus: 'NOT_POSTED' | 'POSTING' | 'POSTED' | 'FAILED';
    lines: {
      id: string;
      accountId: string;
      accountCode: string;
      accountName: string;
      accountType: string;
      direction: 'DEBIT' | 'CREDIT';
      amountMinor: number;
      currency: string;
      memo?: string;
    }[];
    occurredAt: string;
    postingDate?: string;
    createdBy?: string;
    createdAt: string;
  }): Promise<AccountingResult<JournalEntry>>;

  // Query
  abstract getJournal(journalId: string): Promise<AccountingResult<JournalEntry | null>>;
  abstract getJournalByNumber(journalNumber: string): Promise<AccountingResult<JournalEntry | null>>;
  abstract getJournalBySourceDocument(sourceDocumentType: string, sourceDocumentId: string): Promise<AccountingResult<JournalEntry | null>>;
  abstract listJournals(schoolId: string): Promise<AccountingResult<JournalEntry[]>>;
  abstract listJournalsByBatch(batchId: string): Promise<AccountingResult<JournalEntry[]>>;

  // Posting lifecycle
  abstract approveJournal(journalId: string): Promise<AccountingResult<JournalEntry>>;
  abstract postJournal(journalId: string, batchId?: string): Promise<AccountingResult<JournalEntry>>;
  abstract reverseJournal(journalId: string, reason: string): Promise<AccountingResult<JournalEntry>>;

  // Posting batches
  abstract createPostingBatch(data: {
    id: string;
    batchNumber: string;
    organizationId: string;
    schoolId: string;
    journalIds: string[];
    description?: string;
    occurredAt: string;
    createdBy?: string;
    createdAt: string;
  }): Promise<AccountingResult<PostingBatch>>;
  abstract getPostingBatch(batchId: string): Promise<AccountingResult<PostingBatch | null>>;
  abstract listPostingBatches(schoolId: string): Promise<AccountingResult<PostingBatch[]>>;

  abstract isConfigured(): boolean;
}