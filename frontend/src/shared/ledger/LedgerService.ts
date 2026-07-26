import { LedgerEngine, type CreateEntryInput } from './LedgerEngine';
import type { LedgerEntry, LedgerResult } from './types';

export class LedgerService {
  /**
   * Create a CHARGE ledger entry after a StudentCharge is created.
   * Called by BillingEngine.
   */
  async createChargeEntry(input: CreateEntryInput): Promise<LedgerResult<LedgerEntry>> {
    return LedgerEngine.createEntry(input);
  }

  /**
   * Create a PAYMENT ledger entry after a payment is allocated.
   * Called by PaymentEngine.
   */
  async createPaymentEntry(input: CreateEntryInput): Promise<LedgerResult<LedgerEntry>> {
    return LedgerEngine.createEntry(input);
  }

  /**
   * Create a WAIVER ledger entry.
   */
  async createWaiverEntry(input: CreateEntryInput): Promise<LedgerResult<LedgerEntry>> {
    return LedgerEngine.createEntry(input);
  }

  /**
   * Create a REFUND ledger entry.
   */
  async createRefundEntry(input: CreateEntryInput): Promise<LedgerResult<LedgerEntry>> {
    return LedgerEngine.createEntry(input);
  }

  /**
   * Create an ADJUSTMENT ledger entry.
   */
  async createAdjustmentEntry(input: CreateEntryInput): Promise<LedgerResult<LedgerEntry>> {
    return LedgerEngine.createEntry(input);
  }

  /**
   * Create a REVERSAL ledger entry that negates an original entry.
   * The original entry is NEVER modified.
   */
  async createReversalEntry(
    originalEntry: LedgerEntry,
    reason: string,
    previousEntry: LedgerEntry | null,
  ): Promise<LedgerResult<LedgerEntry>> {
    return LedgerEngine.createReversalEntry(originalEntry, reason, previousEntry);
  }
}

export const ledgerService = new LedgerService();