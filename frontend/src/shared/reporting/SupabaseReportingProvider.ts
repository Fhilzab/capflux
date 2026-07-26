import { ReportingProvider } from './ReportingProvider';
import type { ReportingResult, ReportFilter } from './types';
import type { JournalEntry, PostingBatch } from '../accounting/types';
import type { LedgerEntry } from '../ledger/types';
import { ledgerService } from '../ledger/LedgerService';
import type { ReportingError } from './types';

function toReportingError(error: unknown, fallbackCode: string): ReportingError {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const maybeError = error as { code?: unknown; message?: unknown };
    if (typeof maybeError.code === 'string') {
      return {
        code: maybeError.code as any,
        message: typeof maybeError.message === 'string' ? maybeError.message : 'Unknown reporting error',
        raw: error,
      };
  }
  }

  if (error instanceof Error) {
    return { code: fallbackCode as any, message: error.message, raw: error };
  }

  return { code: fallbackCode as any, message: 'Unknown reporting error', raw: error };
}

export class SupabaseReportingProvider extends ReportingProvider {
  async fetchLedgerEntries(filter: ReportFilter): Promise<ReportingResult<LedgerEntry[]>> {
    try {
      if (!filter.schoolId) {
        return { data: [], error: null };
      }

      const result = await ledgerService.listEntries(filter.schoolId);
      if (result.error) {
        return { data: null, error: toReportingError(result.error, 'UNKNOWN') };
      }

      let entries = result.data || [];
      if (filter.postingBatchId) {
        entries = entries.filter(e => e.metadata?.postingBatchId === filter.postingBatchId);
      }
      if (filter.entryNumber) {
        entries = entries.filter(e => e.entryNumber === filter.entryNumber);
      }

      return { data: entries, error: null };
    } catch (e) {
      return { data: null, error: toReportingError(e, 'UNKNOWN') };
    }
  }

  async fetchAccountBalances(filter: { organizationId: string; schoolId?: string; startDate: string; endDate: string }): Promise<ReportingResult<{ accountCode: string; accountName: string; debitTotalMinor: number; creditTotalMinor: number }[]>> {
    try {
      if (!filter.schoolId) {
        return { data: [], error: null };
      }

      const result = await ledgerService.listEntries(filter.schoolId);
      if (result.error) {
        return { data: null, error: toReportingError(result.error, 'UNKNOWN') };
      }

      const entries = result.data || [];
      const balanceMap = new Map<string, { accountCode: string; accountName: string; debitTotalMinor: number; creditTotalMinor: number }>();

      for (const entry of entries) {
        const accountCode = (entry.metadata?.accountCode as string) || 'UNKNOWN';
        const accountName = (entry.metadata?.accountName as string) || 'Unknown';

        if (!balanceMap.has(accountCode)) {
          balanceMap.set(accountCode, { accountCode, accountName, debitTotalMinor: 0, creditTotalMinor: 0 });
        }

        const current = balanceMap.get(accountCode)!;
        if (entry.entryDirection === 'DEBIT') {
          current.debitTotalMinor += entry.amountMinor;
        } else {
          current.creditTotalMinor += entry.amountMinor;
        }
      }

      return { data: Array.from(balanceMap.values()), error: null };
    } catch (e) {
      return { data: null, error: toReportingError(e, 'UNKNOWN') };
    }
  }

  async fetchJournalEntries(filter: { organizationId: string; schoolId?: string; journalNumber?: string; startDate: string; endDate: string }): Promise<ReportingResult<JournalEntry[]>> {
    try {
      // In production, this would query journal provider
      return { data: [], error: null };
    } catch (e) {
      return { data: null, error: toReportingError(e, 'UNKNOWN') };
    }
  }

  async fetchPostingBatches(filter: { organizationId: string; schoolId?: string; startDate: string; endDate: string }): Promise<ReportingResult<PostingBatch[]>> {
    try {
      // In production, this would query journal provider
      return { data: [], error: null };
    } catch (e) {
      return { data: null, error: toReportingError(e, 'UNKNOWN') };
    }
  }

  async fetchSettlementBatches(filter: { organizationId: string; schoolId?: string; startDate: string; endDate: string }): Promise<ReportingResult<any[]>> {
    try {
      // In production, this would query payment provider settlement batches
      return { data: [], error: null };
    } catch (e) {
      return { data: null, error: toReportingError(e, 'UNKNOWN') };
    }
  }

  mapAccountingError(error: unknown, fallbackCode: string): { code: string; message: string; raw?: unknown } {
    return toReportingError(error, fallbackCode);
  }
}