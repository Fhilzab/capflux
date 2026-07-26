import type { LedgerEntry } from '../ledger/types';
import type { JournalEntry, PostingBatch } from '../accounting/types';
import type { AccountingResult } from '../accounting/types';
import type { ReportingResult } from './types';

/**
 * ReportingProvider
 *
 * Data-access layer for reporting.
 *
 * IMPORTANT: This provider MUST ONLY read from Ledger and Journal sources.
 * It must never read from Billing, Payment, StudentCharge, or Receipts.
 *
 * It returns raw data; ReportingEngine transforms data into reports.
 */

export abstract class ReportingProvider {
  // Ledger data access
  abstract fetchLedgerEntries(filter: {
    organizationId: string;
    schoolId?: string;
    studentId?: string;
    accountCode?: string;
    postingBatchId?: string;
    startDate: string;
    endDate: string;
  }): Promise<ReportingResult<LedgerEntry[]>>;

  abstract fetchAccountBalances(filter: {
    organizationId: string;
    schoolId?: string;
    startDate: string;
    endDate: string;
  }): Promise<ReportingResult<{ accountCode: string; accountName: string; debitTotalMinor: number; creditTotalMinor: number }[]>>;

  // Journal data access
  abstract fetchJournalEntries(filter: {
    organizationId: string;
    schoolId?: string;
    journalNumber?: string;
    startDate: string;
    endDate: string;
  }): Promise<ReportingResult<JournalEntry[]>>;

  abstract fetchPostingBatches(filter: {
    organizationId: string;
    schoolId?: string;
    startDate: string;
    endDate: string;
  }): Promise<ReportingResult<PostingBatch[]>>;

  // Settlement / reconciliation data
  abstract fetchSettlementBatches(filter: {
    organizationId: string;
    schoolId?: string;
    startDate: string;
    endDate: string;
  }): Promise<ReportingResult<any[]>>; // SettlementBatch shape defined by payment provider

  abstract mapAccountingError(error: unknown, fallbackCode: string): { code: string; message: string; raw?: unknown };
}