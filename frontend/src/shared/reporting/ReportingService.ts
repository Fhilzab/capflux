import type { ReportFilter, ReportingResult, StudentStatement, GeneralLedgerReport, TrialBalance, ReceivablesAging, CashBook, RevenueSummary, ReconciliationResult } from './types';
import { ReportingEngine } from './ReportingEngine';
import { ReportingValidator } from './ReportingValidator';
import type { SupabaseReportingProvider } from './SupabaseReportingProvider';

export interface ReportingServiceInput {
  provider: SupabaseReportingProvider;
  reportType: 'STUDENT_STATEMENT' | 'GENERAL_LEDGER' | 'TRIAL_BALANCE' | 'RECEIVABLES_AGING' | 'CASH_BOOK' | 'REVENUE_SUMMARY' | 'RECONCILIATION';
  filter: ReportFilter;
  settlementBatches?: any[];
}

export class ReportingService {
  static async generateStudentStatement(input: ReportingServiceInput): Promise<ReportingResult<StudentStatement>> {
    const validation = ReportingValidator.validateFilter(input.filter);
    if (!validation.valid) {
      return { data: null, error: { code: 'INVALID_DATE_RANGE', message: validation.error || 'Invalid report filter' } };
    }

    try {
      const [ledgerEntries, journalEntries, postingBatches, settlementBatches] = await Promise.all([
        input.provider.fetchLedgerEntries(input.filter),
        input.provider.fetchJournalEntries(input.filter),
        input.provider.fetchPostingBatches(input.filter),
        input.provider.fetchSettlementBatches(input.filter),
      ]);

      if (ledgerEntries.error) {
        return { data: null, error: { code: 'REPORT_GENERATION_FAILED', message: ledgerEntries.error.message } };
      }

      const engineInput = {
        filter: input.filter,
        ledgerEntries: ledgerEntries.data || [],
        journalEntries: journalEntries.data || [],
        postingBatches: postingBatches.data || [],
        settlementBatches: input.settlementBatches || [],
      };

      const statement = ReportingEngine.buildStudentStatement(engineInput);
      return { data: statement, error: null };
    } catch (e) {
      return { data: null, error: { code: 'REPORT_GENERATION_FAILED', message: 'Failed to generate student statement' } };
    }
  }

  static async generateGeneralLedger(input: ReportingServiceInput): Promise<ReportingResult<GeneralLedgerReport>> {
    const validation = ReportingValidator.validateFilter(input.filter);
    if (!validation.valid) {
      return { data: null, error: { code: 'INVALID_DATE_RANGE', message: validation.error || 'Invalid report filter' } };
    }

    try {
      const ledgerResult = await input.provider.fetchLedgerEntries(input.filter);
      if (ledgerResult.error) {
        return { data: null, error: { code: 'REPORT_GENERATION_FAILED', message: ledgerResult.error.message } };
      }

      const engineInput = {
        filter: input.filter,
        ledgerEntries: ledgerResult.data || [],
        journalEntries: [],
        postingBatches: [],
        settlementBatches: [],
      };

      const report = ReportingEngine.buildGeneralLedger(engineInput);
      return { data: report, error: null };
    } catch (e) {
      return { data: null, error: { code: 'REPORT_GENERATION_FAILED', message: 'Failed to generate general ledger' } };
    }
  }

  static async generateTrialBalance(input: ReportingServiceInput): Promise<ReportingResult<TrialBalance>> {
    const validation = ReportingValidator.validateFilter(input.filter);
    if (!validation.valid) {
      return { data: null, error: { code: 'INVALID_DATE_RANGE', message: validation.error || 'Invalid report filter' } };
    }

    try {
      const ledgerResult = await input.provider.fetchLedgerEntries(input.filter);
      if (ledgerResult.error) {
        return { data: null, error: { code: 'REPORT_GENERATION_FAILED', message: ledgerResult.error.message } };
      }

      const engineInput = {
        filter: input.filter,
        ledgerEntries: ledgerResult.data || [],
        journalEntries: [],
        postingBatches: [],
        settlementBatches: [],
      };

      const trialBalance = ReportingEngine.buildTrialBalance(engineInput);
      if (!trialBalance.balanced) {
        return { data: null, error: { code: 'TRIAL_BALANCE_MISMATCH', message: 'Trial balance does not balance' } };
      }

      return { data: trialBalance, error: null };
    } catch (e) {
      return { data: null, error: { code: 'REPORT_GENERATION_FAILED', message: 'Failed to generate trial balance' } };
    }
  }

  static async generateReceivablesAging(input: ReportingServiceInput): Promise<ReportingResult<ReceivablesAging>> {
    const validation = ReportingValidator.validateFilter(input.filter);
    if (!validation.valid) {
      return { data: null, error: { code: 'INVALID_DATE_RANGE', message: validation.error || 'Invalid report filter' } };
    }

    try {
      const ledgerResult = await input.provider.fetchLedgerEntries(input.filter);
      if (ledgerResult.error) {
        return { data: null, error: { code: 'REPORT_GENERATION_FAILED', message: ledgerResult.error.message } };
      }

      const engineInput = {
        filter: input.filter,
        ledgerEntries: ledgerResult.data || [],
        journalEntries: [],
        postingBatches: [],
        settlementBatches: [],
      };

      const aging = ReportingEngine.buildReceivablesAging(engineInput);
      return { data: aging, error: null };
    } catch (e) {
      return { data: null, error: { code: 'REPORT_GENERATION_FAILED', message: 'Failed to generate receivables aging' } };
    }
  }

  static async generateCashBook(input: ReportingServiceInput): Promise<ReportingResult<CashBook>> {
    const validation = ReportingValidator.validateFilter(input.filter);
    if (!validation.valid) {
      return { data: null, error: { code: 'INVALID_DATE_RANGE', message: validation.error || 'Invalid report filter' } };
    }

    try {
      const ledgerResult = await input.provider.fetchLedgerEntries(input.filter);
      if (ledgerResult.error) {
        return { data: null, error: { code: 'REPORT_GENERATION_FAILED', message: ledgerResult.error.message } };
      }

      const engineInput = {
        filter: input.filter,
        ledgerEntries: ledgerResult.data || [],
        journalEntries: [],
        postingBatches: [],
        settlementBatches: [],
      };

      const cashBook = ReportingEngine.buildCashBook(engineInput);
      return { data: cashBook, error: null };
    } catch (e) {
      return { data: null, error: { code: 'REPORT_GENERATION_FAILED', message: 'Failed to generate cash book' } };
    }
  }

  static async generateRevenueSummary(input: ReportingServiceInput): Promise<ReportingResult<RevenueSummary>> {
    const validation = ReportingValidator.validateFilter(input.filter);
    if (!validation.valid) {
      return { data: null, error: { code: 'INVALID_DATE_RANGE', message: validation.error || 'Invalid report filter' } };
    }

    try {
      const ledgerResult = await input.provider.fetchLedgerEntries(input.filter);
      if (ledgerResult.error) {
        return { data: null, error: { code: 'REPORT_GENERATION_FAILED', message: ledgerResult.error.message } };
      }

      const engineInput = {
        filter: input.filter,
        ledgerEntries: ledgerResult.data || [],
        journalEntries: [],
        postingBatches: [],
        settlementBatches: [],
      };

      const revenueSummary = ReportingEngine.buildRevenueSummary(engineInput);
      return { data: revenueSummary, error: null };
    } catch (e) {
      return { data: null, error: { code: 'REPORT_GENERATION_FAILED', message: 'Failed to generate revenue summary' } };
    }
  }

  static async generateReconciliation(input: ReportingServiceInput): Promise<ReportingResult<ReconciliationResult>> {
    const validation = ReportingValidator.validateFilter(input.filter);
    if (!validation.valid) {
      return { data: null, error: { code: 'INVALID_DATE_RANGE', message: validation.error || 'Invalid report filter' } };
    }

    try {
      const [ledgerResult, settlementResult] = await Promise.all([
        input.provider.fetchLedgerEntries(input.filter),
        input.provider.fetchSettlementBatches(input.filter),
      ]);

      if (ledgerResult.error) {
        return { data: null, error: { code: 'REPORT_GENERATION_FAILED', message: ledgerResult.error.message } };
      }

      const engineInput = {
        filter: input.filter,
        ledgerEntries: ledgerResult.data || [],
        journalEntries: [],
        postingBatches: [],
        settlementBatches: input.settlementBatches || settlementResult.data || [],
      };

      const reconciliation = ReportingEngine.buildReconciliation(engineInput);
      return { data: reconciliation, error: null };
    } catch (e) {
      return { data: null, error: { code: 'REPORT_GENERATION_FAILED', message: 'Failed to generate reconciliation' } };
    }
  }
}