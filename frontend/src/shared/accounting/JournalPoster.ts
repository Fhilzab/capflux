import { ledgerService } from '../ledger/LedgerService';
import type { JournalEntry, AccountingResult, PostingBatch } from './types';
import type { LedgerEntry, LedgerEntryType } from '../ledger/types';
import { mapAccountingError } from './AccountingError';

/**
 * JournalPoster
 *
 * The ONLY component permitted to create Ledger entries from posted Journals.
 *
 * Financial Layering Rules:
 * - BillingEngine must never import LedgerService
 * - PaymentEngine must never import LedgerService
 * - AccountingService must never import LedgerService
 * - JournalPoster is the only component permitted to post Ledger entries
 * - Ledger never accepts business events directly
 *
 * Responsibilities:
 * - Transition a journal from DRAFT/APPROVED to POSTED
 * - Create corresponding Ledger entries for each journal line
 * - Group posted journals into Posting Batches
 */

export class JournalPoster {
  /**
   * Post a single journal and create ledger entries.
   */
  static async postJournal(
    journal: JournalEntry,
    batch: PostingBatch | null,
  ): Promise<AccountingResult<{ journal: JournalEntry; ledgerEntries: LedgerEntry[] }>> {
    try {
      if (journal.postingStatus === 'POSTED') {
        return { data: null, error: { code: 'JOURNAL_ALREADY_POSTED', message: 'Journal is already posted' } };
      }

      const ledgerEntries: LedgerEntry[] = [];

      for (const line of journal.lines) {
        const direction = line.direction;
        const sourceDocumentType = journal.sourceDocumentType;
        const entryType: LedgerEntryType =
          sourceDocumentType === 'CHARGE'
            ? 'CHARGE'
            : sourceDocumentType === 'PAYMENT'
              ? 'PAYMENT'
              : sourceDocumentType === 'REFUND'
                ? 'REFUND'
                : sourceDocumentType === 'WAIVER'
                  ? 'WAIVER'
                  : 'ADJUSTMENT';

        const createEntryInput = {
          organizationId: journal.organizationId,
          schoolId: journal.schoolId,
          studentId: '',
          billingProfileId: '',
          transactionGroupId: journal.transactionGroupId,
          sourceDocumentType,
          sourceDocumentId: journal.sourceDocumentId,
          academicSessionId: '',
          academicTermId: '',
          entryType,
          entryDirection: direction,
          amountMinor: line.amountMinor,
          currency: line.currency,
          sourceEntity: 'BILLING' as const,
          previousEntry: null,
          occurredAt: journal.occurredAt,
          postingDate: batch?.occurredAt || new Date().toISOString(),
          metadata: {
            journalId: journal.id,
            journalNumber: journal.journalNumber,
            postingBatchId: batch?.id,
            accountCode: line.accountCode,
            accountName: line.accountName,
            memo: line.memo,
          },
        };

        let ledgerResult;
        if (entryType === 'CHARGE') {
          ledgerResult = await ledgerService.createChargeEntry(createEntryInput);
        } else if (entryType === 'PAYMENT') {
          ledgerResult = await ledgerService.createPaymentEntry(createEntryInput);
        } else if (entryType === 'REFUND') {
          ledgerResult = await ledgerService.createRefundEntry(createEntryInput);
        } else if (entryType === 'WAIVER') {
          ledgerResult = await ledgerService.createWaiverEntry(createEntryInput);
        } else {
          ledgerResult = await ledgerService.createAdjustmentEntry(createEntryInput);
        }

        if (ledgerResult.error) {
          return { data: null, error: mapAccountingError(ledgerResult.error, 'JOURNAL_CREATE_FAILED') };
        }

        if (ledgerResult.data) {
          ledgerEntries.push(ledgerResult.data);
        }
      }

      const updatedJournal: JournalEntry = {
        ...journal,
        status: 'POSTED',
        postingStatus: 'POSTED',
        postingBatchId: batch?.id,
        postingDate: batch?.occurredAt || new Date().toISOString(),
      };

      return { data: { journal: updatedJournal, ledgerEntries }, error: null };
    } catch (e) {
      return { data: null, error: mapAccountingError(e, 'JOURNAL_CREATE_FAILED') };
    }
  }
}