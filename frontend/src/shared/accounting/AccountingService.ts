import { AccountingEngine } from './AccountingEngine';
import type { JournalEntry, AccountingResult } from './types';
import { mapAccountingError } from './AccountingError';

export class AccountingService {
  /**
   * Create a CHARGE journal for a student charge.
   * Called by BillingEngine.
   */
  async createChargeJournal(input: {
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
  }): Promise<AccountingResult<JournalEntry>> {
    try {
      return await AccountingEngine.createChargeJournal(input);
    } catch (e) {
      return { data: null, error: mapAccountingError(e, 'JOURNAL_CREATE_FAILED') };
    }
  }

  /**
   * Create a PAYMENT journal for a payment allocation.
   * Called by PaymentEngine.
   */
  async createPaymentJournal(input: {
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
  }): Promise<AccountingResult<JournalEntry>> {
    try {
      return await AccountingEngine.createPaymentJournal(input);
    } catch (e) {
      return { data: null, error: mapAccountingError(e, 'JOURNAL_CREATE_FAILED') };
    }
  }

  /**
   * Create a REFUND journal.
   */
  async createRefundJournal(input: {
    organizationId: string;
    schoolId: string;
    transactionGroupId: string;
    sourceDocumentId: string;
    description: string;
    amountMinor: number;
    currency: string;
    occurredAt: string;
    createdBy?: string;
  }): Promise<AccountingResult<JournalEntry>> {
    try {
      return await AccountingEngine.createRefundJournal(input);
    } catch (e) {
      return { data: null, error: mapAccountingError(e, 'JOURNAL_CREATE_FAILED') };
    }
  }

  /**
   * Create a WAIVER journal.
   */
  async createWaiverJournal(input: {
    organizationId: string;
    schoolId: string;
    transactionGroupId: string;
    sourceDocumentId: string;
    description: string;
    amountMinor: number;
    currency: string;
    occurredAt: string;
    createdBy?: string;
  }): Promise<AccountingResult<JournalEntry>> {
    try {
      return await AccountingEngine.createWaiverJournal(input);
    } catch (e) {
      return { data: null, error: mapAccountingError(e, 'JOURNAL_CREATE_FAILED') };
    }
  }

  /**
   * Create an ADJUSTMENT journal.
   */
  async createAdjustmentJournal(input: {
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
  }): Promise<AccountingResult<JournalEntry>> {
    try {
      return await AccountingEngine.createAdjustmentJournal(input);
    } catch (e) {
      return { data: null, error: mapAccountingError(e, 'JOURNAL_CREATE_FAILED') };
    }
  }

  /**
   * Create a REVERSAL journal by inverting an existing journal.
   */
  async createReversalJournal(originalJournal: JournalEntry, reason: string): Promise<AccountingResult<JournalEntry>> {
    try {
      return await AccountingEngine.createReversalJournal(originalJournal, reason);
    } catch (e) {
      return { data: null, error: mapAccountingError(e, 'JOURNAL_REVERSE_FAILED') };
    }
  }
}

export const accountingService = new AccountingService();