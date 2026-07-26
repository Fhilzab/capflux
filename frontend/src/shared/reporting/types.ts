/**
 * Reporting Domain Types
 * Financial reporting and reconciliation derived exclusively from Ledger and Journals.
 */

export type ReportType =
  | 'STUDENT_STATEMENT'
  | 'GENERAL_LEDGER'
  | 'TRIAL_BALANCE'
  | 'RECEIVABLES_AGING'
  | 'CASH_BOOK'
  | 'REVENUE_SUMMARY'
  | 'RECONCILIATION';

export type ReportPeriod = 'DAY' | 'WEEK' | 'MONTH' | 'TERM' | 'SESSION';
export type RevenueGrouping = 'DAY' | 'WEEK' | 'MONTH' | 'TERM' | 'SESSION';
export type ReconciliationStatus = 'MATCHED' | 'MISSING' | 'EXTRA' | 'DISPUTED';

export interface ReportFilter {
  organizationId: string;
  schoolId?: string;
  accountCode?: string;
  studentId?: string;
  postingBatchId?: string;
  journalNumber?: string;
  entryNumber?: string;
  startDate: string;
  endDate: string;
}

export interface ReportMetadata {
  generatedAt: string;
  generatedBy?: string;
  organizationId: string;
  schoolId?: string;
  reportPeriod: ReportPeriod;
  reportSchemaVersion: string;
  ledgerSnapshotHash?: string;
}

export interface StudentStatementLine {
  postingDate: string;
  occurredAt: string;
  entryNumber: string;
  journalNumber?: string;
  entryType: string;
  direction: 'DEBIT' | 'CREDIT';
  amountMinor: number;
  currency: string;
  description?: string;
  balanceAfterMinor: number;
}

export interface StudentStatement {
  metadata: ReportMetadata;
  studentId: string;
  schoolId: string;
  studentName?: string;
  admissionNumber?: string;
  openingBalanceMinor: number;
  closingBalanceMinor: number;
  lines: StudentStatementLine[];
}

export interface GeneralLedgerEntry {
  entryNumber: string;
  journalNumber?: string;
  postingDate: string;
  occurredAt: string;
  accountCode: string;
  accountName: string;
  entryType: string;
  direction: 'DEBIT' | 'CREDIT';
  amountMinor: number;
  balanceAfterMinor: number;
  description?: string;
  studentId?: string;
  postingBatchId?: string;
}

export interface GeneralLedgerReport {
  metadata: ReportMetadata;
  entries: GeneralLedgerEntry[];
  totalDebitsMinor: number;
  totalCreditsMinor: number;
}

export interface TrialBalanceAccount {
  accountCode: string;
  accountName: string;
  accountType: string;
  debitTotalMinor: number;
  creditTotalMinor: number;
  balanceMinor: number;
}

export interface TrialBalance {
  metadata: ReportMetadata;
  accounts: TrialBalanceAccount[];
  totalDebitsMinor: number;
  totalCreditsMinor: number;
  balanced: boolean;
}

export interface AgingBucket {
  bucket: 'CURRENT' | '1-30' | '31-60' | '61-90' | '90+';
  label: string;
  count: number;
  totalMinor: number;
  currency: string;
}

export interface ReceivablesAging {
  metadata: ReportMetadata;
  buckets: AgingBucket[];
  totalReceivableMinor: number;
}

export interface CashBookEntry {
  postingDate: string;
  entryNumber: string;
  journalNumber?: string;
  description?: string;
  reference?: string;
  receiptsMinor: number;
  paymentsMinor: number;
  balanceMinor: number;
}

export interface CashBook {
  metadata: ReportMetadata;
  openingBalanceMinor: number;
  closingBalanceMinor: number;
  entries: CashBookEntry[];
}

export interface RevenueLine {
  period: string;
  schoolFeeIncomeMinor: number;
  platformLevyIncomeMinor: number;
  refundsMinor: number;
  waiversMinor: number;
  adjustmentsMinor: number;
  netRevenueMinor: number;
  currency: string;
}

export interface RevenueSummary {
  metadata: ReportMetadata;
  lines: RevenueLine[];
  totalRevenueMinor: number;
  totalRefundsMinor: number;
  totalNetRevenueMinor: number;
}

export interface ReconciliationItem {
  reference: string;
  postingDate: string;
  amountMinor: number;
  currency: string;
  status: ReconciliationStatus;
  ledgerEntryNumber?: string;
  journalNumber?: string;
  notes?: string;
}

export interface ReconciliationResult {
  metadata: ReportMetadata;
  settlementBatchId?: string;
  items: ReconciliationItem[];
  totalMatchedMinor: number;
  totalMissingMinor: number;
  totalExtraMinor: number;
  totalDisputedMinor: number;
}

export interface EngineInput {
  filter: ReportFilter;
  ledgerEntries: any[];
  journalEntries: any[];
  postingBatches: any[];
  settlementBatches: any[];
}

export interface ReportingResult<T> {
  data: T | null;
  error: ReportingError | null;
}

export type ReportingErrorCode =
  | 'REPORT_GENERATION_FAILED'
  | 'INVALID_DATE_RANGE'
  | 'INVALID_ORGANIZATION'
  | 'INVALID_SCHOOL'
  | 'TRIAL_BALANCE_MISMATCH'
  | 'NO_LEDGER_ENTRIES'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'UNKNOWN';

export interface ReportingError {
  code: ReportingErrorCode;
  message: string;
  raw?: unknown;
}

export interface PDFReport {
  format: 'PDF';
  buffer: ArrayBuffer;
  fileName: string;
  mimeType: 'application/pdf';
}

export interface CSVReport {
  format: 'CSV';
  content: string;
  fileName: string;
  mimeType: 'text/csv';
}

export interface ExcelReport {
  format: 'EXCEL';
  buffer: ArrayBuffer;
  fileName: string;
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

export interface ReportExport {
  reportType: ReportType;
  filter: ReportFilter;
  period?: ReportPeriod;
}

export interface ExportResult {
  pdf?: PDFReport;
  csv?: CSVReport;
  excel?: ExcelReport;
  error?: ReportingError;
}