import { defineStore } from 'pinia';
import type { StudentStatement, GeneralLedgerReport, TrialBalance, ReceivablesAging, CashBook, RevenueSummary, ReconciliationResult } from '../shared/reporting/types';
import { ReportingService } from '../shared/reporting/ReportingService';
import { SupabaseReportingProvider } from '../shared/reporting/SupabaseReportingProvider';

export interface ReportingState {
  studentStatements: Record<string, StudentStatement>;
  trialBalance: TrialBalance | null;
  generalLedger: GeneralLedgerReport | null;
  cashBook: CashBook | null;
  aging: ReceivablesAging | null;
  reconciliation: ReconciliationResult | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
}

export const useReportingStore = defineStore('reporting', {
  state: (): ReportingState => ({
    studentStatements: {},
    trialBalance: null,
    generalLedger: null,
    cashBook: null,
    aging: null,
    reconciliation: null,
    loading: false,
    initialized: false,
    error: null,
  }),

  actions: {
    async loadStudentStatement(studentId: string, filter: any) {
      this.loading = true;
      this.error = null;

      try {
        const provider = new SupabaseReportingProvider();
        const result = await ReportingService.generateStudentStatement({
          provider,
          reportType: 'STUDENT_STATEMENT',
          filter: { ...filter, studentId } as any,
        });

        if (result.error) {
          this.error = result.error.message;
          return;
        }

        if (result.data) {
          this.studentStatements[studentId] = result.data;
        }
      } catch (e: any) {
        this.error = e?.message || 'Failed to load student statement';
      } finally {
        this.loading = false;
        this.initialized = true;
      }
    },

    async loadTrialBalance(filter: any) {
      this.loading = true;
      this.error = null;

      try {
        const provider = new SupabaseReportingProvider();
        const result = await ReportingService.generateTrialBalance({
          provider,
          reportType: 'TRIAL_BALANCE',
          filter,
        });

        if (result.error) {
          this.error = result.error.message;
          return;
        }

        this.trialBalance = result.data;
      } catch (e: any) {
        this.error = e?.message || 'Failed to load trial balance';
      } finally {
        this.loading = false;
        this.initialized = true;
      }
    },

    async loadGeneralLedger(filter: any) {
      this.loading = true;
      this.error = null;

      try {
        const provider = new SupabaseReportingProvider();
        const result = await ReportingService.generateGeneralLedger({
          provider,
          reportType: 'GENERAL_LEDGER',
          filter,
        });

        if (result.error) {
          this.error = result.error.message;
          return;
        }

        this.generalLedger = result.data;
      } catch (e: any) {
        this.error = e?.message || 'Failed to load general ledger';
      } finally {
        this.loading = false;
        this.initialized = true;
      }
    },

    async loadCashBook(filter: any) {
      this.loading = true;
      this.error = null;

      try {
        const provider = new SupabaseReportingProvider();
        const result = await ReportingService.generateCashBook({
          provider,
          reportType: 'CASH_BOOK',
          filter,
        });

        if (result.error) {
          this.error = result.error.message;
          return;
        }

        this.cashBook = result.data;
      } catch (e: any) {
        this.error = e?.message || 'Failed to load cash book';
      } finally {
        this.loading = false;
        this.initialized = true;
      }
    },

    async loadAging(filter: any) {
      this.loading = true;
      this.error = null;

      try {
        const provider = new SupabaseReportingProvider();
        const result = await ReportingService.generateReceivablesAging({
          provider,
          reportType: 'RECEIVABLES_AGING',
          filter,
        });

        if (result.error) {
          this.error = result.error.message;
          return;
        }

        this.aging = result.data;
      } catch (e: any) {
        this.error = e?.message || 'Failed to load aging';
      } finally {
        this.loading = false;
        this.initialized = true;
      }
    },

    async loadRevenueSummary(filter: any) {
      this.loading = true;
      this.error = null;

      try {
        const provider = new SupabaseReportingProvider();
        const result = await ReportingService.generateRevenueSummary({
          provider,
          reportType: 'REVENUE_SUMMARY',
          filter,
        });

        if (result.error) {
          this.error = result.error.message;
          return;
        }

        // Revenue summary not stored in state yet, could add if needed
      } catch (e: any) {
        this.error = e?.message || 'Failed to load revenue summary';
      } finally {
        this.loading = false;
        this.initialized = true;
      }
    },

    async loadReconciliation(filter: any, settlementBatches?: any[]) {
      this.loading = true;
      this.error = null;

      try {
        const provider = new SupabaseReportingProvider();
        const result = await ReportingService.generateReconciliation({
          provider,
          reportType: 'RECONCILIATION',
          filter,
          settlementBatches,
        });

        if (result.error) {
          this.error = result.error.message;
          return;
        }

        this.reconciliation = result.data;
      } catch (e: any) {
        this.error = e?.message || 'Failed to load reconciliation';
      } finally {
        this.loading = false;
        this.initialized = true;
      }
    },

    clear() {
      this.studentStatements = {};
      this.trialBalance = null;
      this.generalLedger = null;
      this.cashBook = null;
      this.aging = null;
      this.reconciliation = null;
      this.loading = false;
      this.initialized = false;
      this.error = null;
    },
  },
});