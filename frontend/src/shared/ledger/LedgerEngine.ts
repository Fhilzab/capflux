import { generateUuidV7, generateLedgerReference, computeEntryHash } from '../core/IdGenerator';
import { LedgerValidator } from './LedgerValidator';
import type { LedgerEntry, LedgerResult, EntryDirection, LedgerEntryType, SourceEntity, SourceDocumentType } from './types';

const SCHEMA_VERSION = 1;
const HASH_ALGORITHM = 'SHA256_V1' as const;

export interface CreateEntryInput {
  organizationId: string;
  schoolId: string;
  studentId: string;
  billingProfileId: string;
  transactionGroupId: string;
  sourceDocumentType: SourceDocumentType;
  sourceDocumentId: string;
  academicSessionId: string;
  academicTermId: string;
  entryType: LedgerEntryType;
  entryDirection: EntryDirection;
  amountMinor: number;
  currency: string;
  sourceEntity: SourceEntity;
  previousEntry?: LedgerEntry | null;
  reconciliationStatus?: 'UNRECONCILED' | 'RECONCILED' | 'DISPUTED';
  metadata?: Record<string, unknown>;
  occurredAt: string;
  postingDate: string;
  createdBy?: string;
}

export class LedgerEngine {
  /**
   * Create an immutable ledger entry with hash chain integrity.
   * This is the only way ledger entries are created — append-only.
   */
  static async createEntry(input: CreateEntryInput): Promise<LedgerResult<LedgerEntry>> {
    const validation = LedgerValidator.validateEntry({
      entryDirection: input.entryDirection,
      amountMinor: input.amountMinor,
      sourceDocumentType: input.sourceDocumentType,
      sourceDocumentId: input.sourceDocumentId,
      entryType: input.entryType,
      organizationId: input.organizationId,
      schoolId: input.schoolId,
      studentId: input.studentId,
    });

    if (!validation.valid) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: Object.values(validation.errors).join(', '),
        },
      };
    }

    const id = generateUuidV7();
    const entryNumber = generateLedgerReference();
    const previousHash = input.previousEntry?.entryHash;
    const balanceBeforeMinor = input.previousEntry?.balanceAfterMinor || 0;

    // Calculate running balance
    const balanceAfterMinor = this.calculateRunningBalance(
      balanceBeforeMinor,
      input.entryDirection,
      input.amountMinor,
    );

    // Compute hash chain
    const entryHash = await computeEntryHash({
      schemaVersion: SCHEMA_VERSION,
      previousHash,
      entryNumber,
      transactionGroupId: input.transactionGroupId,
      entryDirection: input.entryDirection,
      amountMinor: input.amountMinor,
      occurredAt: input.occurredAt,
      algorithm: HASH_ALGORITHM,
    });

    const entry: LedgerEntry = {
      id,
      entryNumber,
      sequenceNumber: (input.previousEntry?.sequenceNumber || 0) + 1,
      schemaVersion: SCHEMA_VERSION,
      organizationId: input.organizationId,
      schoolId: input.schoolId,
      studentId: input.studentId,
      billingProfileId: input.billingProfileId,
      transactionGroupId: input.transactionGroupId,
      sourceDocumentType: input.sourceDocumentType,
      sourceDocumentId: input.sourceDocumentId,
      academicSessionId: input.academicSessionId,
      academicTermId: input.academicTermId,
      entryType: input.entryType,
      entryDirection: input.entryDirection,
      amountMinor: input.amountMinor,
      balanceBeforeMinor,
      balanceAfterMinor,
      currency: input.currency,
      sourceEntity: input.sourceEntity,
      previousHash,
      entryHash,
      hashAlgorithm: HASH_ALGORITHM,
      reconciliationStatus: input.reconciliationStatus || 'UNRECONCILED',
      metadata: input.metadata,
      occurredAt: input.occurredAt,
      postingDate: input.postingDate,
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
    };

    return { data: entry, error: null };
  }

  /**
   * Calculate the running balance after applying an entry.
   *
   * Rules:
   *   CHARGE:    balance += debit (amountMinor)
   *   PAYMENT:   balance -= credit (amountMinor)
   *   WAIVER:    balance -= credit (amountMinor)
   *   REFUND:    balance += debit (amountMinor)
   *   ADJUSTMENT: depends on direction
   *   REVERSAL:  negates original entry's effect
   */
  static calculateRunningBalance(
    balanceBefore: number,
    entryDirection: EntryDirection,
    amountMinor: number,
  ): number {
    if (entryDirection === 'DEBIT') {
      return balanceBefore + amountMinor;
    }
    return balanceBefore - amountMinor;
  }

  /**
   * Create a reversal entry that negates an original entry.
   * The original entry is NEVER modified.
   */
  static async createReversalEntry(
    originalEntry: LedgerEntry,
    reason: string,
    previousEntry: LedgerEntry | null,
  ): Promise<LedgerResult<LedgerEntry>> {
    const reversalDirection: EntryDirection = originalEntry.entryDirection === 'DEBIT' ? 'CREDIT' : 'DEBIT';

    return this.createEntry({
      organizationId: originalEntry.organizationId,
      schoolId: originalEntry.schoolId,
      studentId: originalEntry.studentId,
      billingProfileId: originalEntry.billingProfileId,
      transactionGroupId: originalEntry.transactionGroupId,
      sourceDocumentType: 'ADJUSTMENT',
      sourceDocumentId: originalEntry.id,
      academicSessionId: originalEntry.academicSessionId,
      academicTermId: originalEntry.academicTermId,
      entryType: 'REVERSAL',
      entryDirection: reversalDirection,
      amountMinor: originalEntry.amountMinor,
      currency: originalEntry.currency,
      sourceEntity: 'REVERSAL',
      previousEntry,
      reconciliationStatus: 'RECONCILED',
      metadata: {
        originalEntryId: originalEntry.id,
        originalEntryNumber: originalEntry.entryNumber,
        reason,
      },
      occurredAt: new Date().toISOString(),
      postingDate: new Date().toISOString(),
    });
  }
}