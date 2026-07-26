import { generateUuidV7 } from '../core/IdGenerator';
import type { JournalEntry, JournalLine, ChartOfAccount, AccountingResult } from './types';
import { ChartOfAccounts } from './ChartOfAccounts';
import { AccountingValidator } from './AccountingValidator';

export interface CreateChargeJournalInput {
  organizationId: string;
  schoolId: string;
  transactionGroupId: string;
  sourceDocumentType: 'CHARGE';
  sourceDocumentId: string;
  description: string;
  amountMinor: number;
  currency: string;
  occurredAt: string;
  createdBy?: string;
}

export interface CreatePaymentJournalInput {
  organizationId: string;
  schoolId: string;
  transactionGroupId: string;
  sourceDocumentType: 'PAYMENT';
  sourceDocumentId: string;
  description: string;
  amountMinor: number;
  currency: string;
  occurredAt: string;
  createdBy?: string;
}

export interface CreateRefundJournalInput {
  organizationId: string;
  schoolId: string;
  transactionGroupId: string;
  sourceDocumentId: string;
  description: string;
  amountMinor: number;
  currency: string;
  occurredAt: string;
  createdBy?: string;
}

export interface CreateWaiverJournalInput {
  organizationId: string;
  schoolId: string;
  transactionGroupId: string;
  sourceDocumentId: string;
  description: string;
  amountMinor: number;
  currency: string;
  occurredAt: string;
  createdBy?: string;
}

export interface CreateAdjustmentJournalInput {
  organizationId: string;
  schoolId: string;
  transactionGroupId: string;
  sourceDocumentId: string;
  description: string;
  amountMinor: number;
  currency: string;
  debitAccountCode: string;
  creditAccountCode: string;
  occurredAt: string;
  createdBy?: string;
}

export class AccountingEngine {
  /**
   * Create a CHARGE journal:
   *   Debit  Accounts Receivable (1200)
   *   Credit School Fee Income (4100)
   */
  static async createChargeJournal(input: CreateChargeJournalInput): Promise<AccountingResult<JournalEntry>> {
    const accounts = ChartOfAccounts.getDefaults(input.organizationId);
    const arAccount = ChartOfAccounts.findByCode(accounts, '1200');
    const incomeAccount = ChartOfAccounts.findByCode(accounts, '4100');

    if (!arAccount) {
      return { data: null, error: { code: 'ACCOUNT_NOT_FOUND', message: 'Accounts Receivable (1200) not found in chart of accounts' } };
    }
    if (!incomeAccount) {
      return { data: null, error: { code: 'ACCOUNT_NOT_FOUND', message: 'School Fee Income (4100) not found in chart of accounts' } };
    }

    const validation = AccountingValidator.validateJournal({
      lines: [
        { accountCode: '1200', direction: 'DEBIT', amountMinor: input.amountMinor },
        { accountCode: '4100', direction: 'CREDIT', amountMinor: input.amountMinor },
      ],
    });
    if (!validation.valid) {
      return { data: null, error: { code: 'JOURNAL_NOT_BALANCED', message: Object.values(validation.errors).join(', ') } };
    }

    const id = generateUuidV7();
    const journalNumber = `JRN_${generateUuidV7()}`;
    const now = new Date().toISOString();

    const lines: JournalLine[] = [
      {
        id: `jline-${id}-1`,
        journalEntryId: id,
        accountId: arAccount.id,
        accountCode: arAccount.accountCode,
        accountName: arAccount.accountName,
        accountType: arAccount.accountType,
        direction: 'DEBIT',
        amountMinor: input.amountMinor,
        currency: input.currency,
        memo: input.description,
        createdAt: now,
      },
      {
        id: `jline-${id}-2`,
        journalEntryId: id,
        accountId: incomeAccount.id,
        accountCode: incomeAccount.accountCode,
        accountName: incomeAccount.accountName,
        accountType: incomeAccount.accountType,
        direction: 'CREDIT',
        amountMinor: input.amountMinor,
        currency: input.currency,
        memo: input.description,
        createdAt: now,
      },
    ];

    const journal: JournalEntry = {
      id,
      journalNumber,
      organizationId: input.organizationId,
      schoolId: input.schoolId,
      transactionGroupId: input.transactionGroupId,
      sourceDocumentType: input.sourceDocumentType,
      sourceDocumentId: input.sourceDocumentId,
      description: input.description,
      status: 'DRAFT',
      postingStatus: 'NOT_POSTED',
      lines,
      occurredAt: input.occurredAt,
      createdAt: now,
      createdBy: input.createdBy,
    };

    return { data: journal, error: null };
  }

  /**
   * Create a PAYMENT journal:
   *   Debit  Cash/Bank (1100/1110)
   *   Credit Accounts Receivable (1200)
   */
  static async createPaymentJournal(input: CreatePaymentJournalInput): Promise<AccountingResult<JournalEntry>> {
    const accounts = ChartOfAccounts.getDefaults(input.organizationId);
    const cashAccount = ChartOfAccounts.findByCode(accounts, '1100');
    const arAccount = ChartOfAccounts.findByCode(accounts, '1200');

    if (!cashAccount) {
      return { data: null, error: { code: 'ACCOUNT_NOT_FOUND', message: 'Cash (1100) not found in chart of accounts' } };
    }
    if (!arAccount) {
      return { data: null, error: { code: 'ACCOUNT_NOT_FOUND', message: 'Accounts Receivable (1200) not found in chart of accounts' } };
    }

    const validation = AccountingValidator.validateJournal({
      lines: [
        { accountCode: '1100', direction: 'DEBIT', amountMinor: input.amountMinor },
        { accountCode: '1200', direction: 'CREDIT', amountMinor: input.amountMinor },
      ],
    });
    if (!validation.valid) {
      return { data: null, error: { code: 'JOURNAL_NOT_BALANCED', message: Object.values(validation.errors).join(', ') } };
    }

    const id = generateUuidV7();
    const journalNumber = `JRN_${generateUuidV7()}`;
    const now = new Date().toISOString();

    const lines: JournalLine[] = [
      {
        id: `jline-${id}-1`,
        journalEntryId: id,
        accountId: cashAccount.id,
        accountCode: cashAccount.accountCode,
        accountName: cashAccount.accountName,
        accountType: cashAccount.accountType,
        direction: 'DEBIT',
        amountMinor: input.amountMinor,
        currency: input.currency,
        memo: input.description,
        createdAt: now,
      },
      {
        id: `jline-${id}-2`,
        journalEntryId: id,
        accountId: arAccount.id,
        accountCode: arAccount.accountCode,
        accountName: arAccount.accountName,
        accountType: arAccount.accountType,
        direction: 'CREDIT',
        amountMinor: input.amountMinor,
        currency: input.currency,
        memo: input.description,
        createdAt: now,
      },
    ];

    const journal: JournalEntry = {
      id,
      journalNumber,
      organizationId: input.organizationId,
      schoolId: input.schoolId,
      transactionGroupId: input.transactionGroupId,
      sourceDocumentType: input.sourceDocumentType,
      sourceDocumentId: input.sourceDocumentId,
      description: input.description,
      status: 'DRAFT',
      postingStatus: 'NOT_POSTED',
      lines,
      occurredAt: input.occurredAt,
      createdAt: now,
      createdBy: input.createdBy,
    };

    return { data: journal, error: null };
  }

  /**
   * Create a REFUND journal:
   *   Debit  Refund Expense (6100)
   *   Credit Cash/Bank (1100)
   */
  static async createRefundJournal(input: CreateRefundJournalInput): Promise<AccountingResult<JournalEntry>> {
    const accounts = ChartOfAccounts.getDefaults(input.organizationId);
    const refundAccount = ChartOfAccounts.findByCode(accounts, '6100');
    const cashAccount = ChartOfAccounts.findByCode(accounts, '1100');

    if (!refundAccount) {
      return { data: null, error: { code: 'ACCOUNT_NOT_FOUND', message: 'Refund Expense (6100) not found in chart of accounts' } };
    }
    if (!cashAccount) {
      return { data: null, error: { code: 'ACCOUNT_NOT_FOUND', message: 'Cash (1100) not found in chart of accounts' } };
    }

    const validation = AccountingValidator.validateJournal({
      lines: [
        { accountCode: '6100', direction: 'DEBIT', amountMinor: input.amountMinor },
        { accountCode: '1100', direction: 'CREDIT', amountMinor: input.amountMinor },
      ],
    });
    if (!validation.valid) {
      return { data: null, error: { code: 'JOURNAL_NOT_BALANCED', message: Object.values(validation.errors).join(', ') } };
    }

    const id = generateUuidV7();
    const journalNumber = `JRN_${generateUuidV7()}`;
    const now = new Date().toISOString();

    const lines: JournalLine[] = [
      {
        id: `jline-${id}-1`,
        journalEntryId: id,
        accountId: refundAccount.id,
        accountCode: refundAccount.accountCode,
        accountName: refundAccount.accountName,
        accountType: refundAccount.accountType,
        direction: 'DEBIT',
        amountMinor: input.amountMinor,
        currency: input.currency,
        memo: input.description,
        createdAt: now,
      },
      {
        id: `jline-${id}-2`,
        journalEntryId: id,
        accountId: cashAccount.id,
        accountCode: cashAccount.accountCode,
        accountName: cashAccount.accountName,
        accountType: cashAccount.accountType,
        direction: 'CREDIT',
        amountMinor: input.amountMinor,
        currency: input.currency,
        memo: input.description,
        createdAt: now,
      },
    ];

    const journal: JournalEntry = {
      id,
      journalNumber,
      organizationId: input.organizationId,
      schoolId: input.schoolId,
      transactionGroupId: input.transactionGroupId,
      sourceDocumentType: 'REFUND',
      sourceDocumentId: input.sourceDocumentId,
      description: input.description,
      status: 'DRAFT',
      postingStatus: 'NOT_POSTED',
      lines,
      occurredAt: input.occurredAt,
      createdAt: now,
      createdBy: input.createdBy,
    };

    return { data: journal, error: null };
  }

  /**
   * Create a WAIVER journal:
   *   Debit  Waiver Expense (defaults to Adjustments or a dedicated waiver account)
   *   Credit Accounts Receivable (1200)
   */
  static async createWaiverJournal(input: CreateWaiverJournalInput): Promise<AccountingResult<JournalEntry>> {
    const accounts = ChartOfAccounts.getDefaults(input.organizationId);
    const adjustmentAccount = ChartOfAccounts.findByCode(accounts, '6200');
    const arAccount = ChartOfAccounts.findByCode(accounts, '1200');

    if (!adjustmentAccount) {
      return { data: null, error: { code: 'ACCOUNT_NOT_FOUND', message: 'Adjustment Expense (6200) not found in chart of accounts' } };
    }
    if (!arAccount) {
      return { data: null, error: { code: 'ACCOUNT_NOT_FOUND', message: 'Accounts Receivable (1200) not found in chart of accounts' } };
    }

    const validation = AccountingValidator.validateJournal({
      lines: [
        { accountCode: '6200', direction: 'DEBIT', amountMinor: input.amountMinor },
        { accountCode: '1200', direction: 'CREDIT', amountMinor: input.amountMinor },
      ],
    });
    if (!validation.valid) {
      return { data: null, error: { code: 'JOURNAL_NOT_BALANCED', message: Object.values(validation.errors).join(', ') } };
    }

    const id = generateUuidV7();
    const journalNumber = `JRN_${generateUuidV7()}`;
    const now = new Date().toISOString();

    const lines: JournalLine[] = [
      {
        id: `jline-${id}-1`,
        journalEntryId: id,
        accountId: adjustmentAccount.id,
        accountCode: adjustmentAccount.accountCode,
        accountName: adjustmentAccount.accountName,
        accountType: adjustmentAccount.accountType,
        direction: 'DEBIT',
        amountMinor: input.amountMinor,
        currency: input.currency,
        memo: input.description,
        createdAt: now,
      },
      {
        id: `jline-${id}-2`,
        journalEntryId: id,
        accountId: arAccount.id,
        accountCode: arAccount.accountCode,
        accountName: arAccount.accountName,
        accountType: arAccount.accountType,
        direction: 'CREDIT',
        amountMinor: input.amountMinor,
        currency: input.currency,
        memo: input.description,
        createdAt: now,
      },
    ];

    const journal: JournalEntry = {
      id,
      journalNumber,
      organizationId: input.organizationId,
      schoolId: input.schoolId,
      transactionGroupId: input.transactionGroupId,
      sourceDocumentType: 'WAIVER',
      sourceDocumentId: input.sourceDocumentId,
      description: input.description,
      status: 'DRAFT',
      postingStatus: 'NOT_POSTED',
      lines,
      occurredAt: input.occurredAt,
      createdAt: now,
      createdBy: input.createdBy,
    };

    return { data: journal, error: null };
  }

  /**
   * Create an ADJUSTMENT journal using caller-provided accounts.
   */
  static async createAdjustmentJournal(input: CreateAdjustmentJournalInput): Promise<AccountingResult<JournalEntry>> {
    const accounts = ChartOfAccounts.getDefaults(input.organizationId);
    const debitAccount = ChartOfAccounts.findByCode(accounts, input.debitAccountCode);
    const creditAccount = ChartOfAccounts.findByCode(accounts, input.creditAccountCode);

    if (!debitAccount) {
      return { data: null, error: { code: 'ACCOUNT_NOT_FOUND', message: `Account ${input.debitAccountCode} not found` } };
    }
    if (!creditAccount) {
      return { data: null, error: { code: 'ACCOUNT_NOT_FOUND', message: `Account ${input.creditAccountCode} not found` } };
    }

    const validation = AccountingValidator.validateJournal({
      lines: [
        { accountCode: input.debitAccountCode, direction: 'DEBIT', amountMinor: input.amountMinor },
        { accountCode: input.creditAccountCode, direction: 'CREDIT', amountMinor: input.amountMinor },
      ],
    });
    if (!validation.valid) {
      return { data: null, error: { code: 'JOURNAL_NOT_BALANCED', message: Object.values(validation.errors).join(', ') } };
    }

    const id = generateUuidV7();
    const journalNumber = `JRN_${generateUuidV7()}`;
    const now = new Date().toISOString();

    const lines: JournalLine[] = [
      {
        id: `jline-${id}-1`,
        journalEntryId: id,
        accountId: debitAccount.id,
        accountCode: debitAccount.accountCode,
        accountName: debitAccount.accountName,
        accountType: debitAccount.accountType,
        direction: 'DEBIT',
        amountMinor: input.amountMinor,
        currency: input.currency,
        memo: input.description,
        createdAt: now,
      },
      {
        id: `jline-${id}-2`,
        journalEntryId: id,
        accountId: creditAccount.id,
        accountCode: creditAccount.accountCode,
        accountName: creditAccount.accountName,
        accountType: creditAccount.accountType,
        direction: 'CREDIT',
        amountMinor: input.amountMinor,
        currency: input.currency,
        memo: input.description,
        createdAt: now,
      },
    ];

    const journal: JournalEntry = {
      id,
      journalNumber,
      organizationId: input.organizationId,
      schoolId: input.schoolId,
      transactionGroupId: input.transactionGroupId,
      sourceDocumentType: 'ADJUSTMENT',
      sourceDocumentId: input.sourceDocumentId,
      description: input.description,
      status: 'DRAFT',
      postingStatus: 'NOT_POSTED',
      lines,
      occurredAt: input.occurredAt,
      createdAt: now,
      createdBy: input.createdBy,
    };

    return { data: journal, error: null };
  }

  /**
   * Create a REVERSAL journal by inverting the original journal's lines.
   */
  static async createReversalJournal(originalJournal: JournalEntry, reason: string): Promise<AccountingResult<JournalEntry>> {
    const validation = AccountingValidator.validateReversal({ originalJournalId: originalJournal.id, reason });
    if (!validation.valid) {
      return { data: null, error: { code: 'JOURNAL_REVERSE_FAILED', message: Object.values(validation.errors).join(', ') } };
    }

    const id = generateUuidV7();
    const journalNumber = `JRN_${generateUuidV7()}`;
    const now = new Date().toISOString();

    const lines: JournalLine[] = originalJournal.lines.map((line, index) => {
      const reversedDirection = line.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT';
      return {
        id: `jline-${id}-${index + 1}`,
        journalEntryId: id,
        accountId: line.accountId,
        accountCode: line.accountCode,
        accountName: line.accountName,
        accountType: line.accountType,
        direction: reversedDirection,
        amountMinor: line.amountMinor,
        currency: line.currency,
        memo: `Reversal: ${reason}`,
        createdAt: now,
      };
    });

    const journal: JournalEntry = {
      id,
      journalNumber,
      organizationId: originalJournal.organizationId,
      schoolId: originalJournal.schoolId,
      transactionGroupId: originalJournal.transactionGroupId,
      sourceDocumentType: originalJournal.sourceDocumentType,
      sourceDocumentId: originalJournal.sourceDocumentId,
      description: `Reversal of ${originalJournal.journalNumber}: ${reason}`,
      status: 'DRAFT',
      postingStatus: 'NOT_POSTED',
      lines,
      occurredAt: now,
      createdAt: now,
      createdBy: originalJournal.createdBy,
    };

    return { data: journal, error: null };
  }
}