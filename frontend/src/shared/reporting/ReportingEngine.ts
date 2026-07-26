import type { ReportFilter, StudentStatement, GeneralLedgerReport, TrialBalance, ReceivablesAging, CashBook, RevenueSummary, ReconciliationResult } from './types';
import type { LedgerEntry } from '../ledger/types';
import type { JournalEntry } from '../accounting/types';
import { StatementGenerator } from './StatementGenerator';
import { TrialBalanceGenerator } from './TrialBalanceGenerator';
import { CashBookGenerator } from './CashBookGenerator';
import { ReceivableAgingEngine } from './ReceivableAgingEngine';
import { RevenueSummaryGenerator } from './RevenueSummaryGenerator';
import { ReconciliationEngine } from './ReconciliationEngine';

export interface EngineInput {
  filter: ReportFilter;
  ledgerEntries: LedgerEntry[];
  journalEntries: JournalEntry[];
  postingBatches: any[];
  settlementBatches: any[];
}

export type { JournalEntry as AccountingJournalEntry } from '../accounting/types';

export class ReportingEngine {
  static buildStudentStatement(input: EngineInput): StudentStatement {
    return StatementGenerator.build(input);
  }

  static buildGeneralLedger(input: EngineInput): GeneralLedgerReport {
    const entries = input.ledgerEntries.map(e => ({
      entryNumber: e.entryNumber,
      journalNumber: (e.metadata?.journalNumber as string | undefined) || null,
      postingDate: e.postingDate,
      occurredAt: e.occurredAt,
      accountCode: (e.metadata?.accountCode as string) || 'UNKNOWN',
      accountName: (e.metadata?.accountName as string) || 'Unknown',
      entryType: e.entryType,
      direction: e.entryDirection,
      amountMinor: e.amountMinor,
      balanceAfterMinor: e.balanceAfterMinor,
      description: (e.metadata?.memo as string | undefined) || null,
      studentId: e.studentId || undefined,
      postingBatchId: (e.metadata?.postingBatchId as string | undefined) || undefined,
    }));

    const totalDebitsMinor = entries
      .filter(e => e.direction === 'DEBIT')
      .reduce((sum, e) => sum + e.amountMinor, 0);

    const totalCreditsMinor = entries
      .filter(e => e.direction === 'CREDIT')
      .reduce((sum, e) => sum + e.amountMinor, 0);

    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        organizationId: input.filter.organizationId,
        schoolId: input.filter.schoolId || '',
        reportPeriod: 'DAY',
        reportSchemaVersion: '1',
      },
      entries,
      totalDebitsMinor,
      totalCreditsMinor,
    };
  }

  static buildTrialBalance(input: EngineInput): TrialBalance {
    return TrialBalanceGenerator.build(input);
  }

  static buildReceivablesAging(input: EngineInput): ReceivablesAging {
    return ReceivableAgingEngine.build(input);
  }

  static buildCashBook(input: EngineInput): CashBook {
    return CashBookGenerator.build(input);
  }

  static buildRevenueSummary(input: EngineInput): RevenueSummary {
    return RevenueSummaryGenerator.build(input);
  }

  static buildReconciliation(input: EngineInput): ReconciliationResult {
    return ReconciliationEngine.build(input);
  }
}