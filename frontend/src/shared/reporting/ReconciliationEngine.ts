import type { EngineInput, ReconciliationResult, ReconciliationItem } from './types';

export class ReconciliationEngine {
  static build(input: EngineInput): ReconciliationResult {
    const items: ReconciliationItem[] = [];
    let totalMatchedMinor = 0;
    let totalMissingMinor = 0;
    let totalExtraMinor = 0;
    let totalDisputedMinor = 0;

    const ledgerMap = new Map<string, typeof items[0]>();
    for (const entry of input.ledgerEntries) {
      ledgerMap.set(entry.entryNumber, {
        reference: entry.entryNumber,
        postingDate: entry.postingDate,
        amountMinor: entry.amountMinor,
        currency: entry.currency,
        status: 'MATCHED',
        ledgerEntryNumber: entry.entryNumber,
        journalNumber: entry.metadata?.journalNumber as string | undefined,
      });
    }

    // Compare settlement batches against ledger
    for (const settlement of input.settlementBatches) {
      const reference = settlement.reference || settlement.id || 'UNKNOWN';
      const existing = ledgerMap.get(reference);

      if (existing) {
        existing.status = 'MATCHED';
        totalMatchedMinor += existing.amountMinor;
      } else {
        items.push({
          reference,
          postingDate: settlement.postingDate || new Date().toISOString(),
          amountMinor: settlement.amountMinor || 0,
          currency: settlement.currency || 'NGN',
          status: 'EXTRA',
          notes: 'Found in settlement but not in ledger',
        });
        totalExtraMinor += settlement.amountMinor || 0;
      }
    }

    // Add unmatched ledger entries
    for (const entry of input.ledgerEntries) {
      const existing = items.find(i => i.ledgerEntryNumber === entry.entryNumber);
      if (!existing) {
        items.push({
          reference: entry.entryNumber,
          postingDate: entry.postingDate,
          amountMinor: entry.amountMinor,
          currency: entry.currency,
          status: 'MISSING',
          ledgerEntryNumber: entry.entryNumber,
          journalNumber: entry.metadata?.journalNumber as string | undefined,
          notes: 'Found in ledger but not in settlement',
        });
        totalMissingMinor += entry.amountMinor;
      }
    }

    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        organizationId: input.filter.organizationId,
        schoolId: input.filter.schoolId || '',
        reportPeriod: 'DAY',
        reportSchemaVersion: '1',
      },
      settlementBatchId: input.settlementBatches[0]?.id,
      items,
      totalMatchedMinor,
      totalMissingMinor,
      totalExtraMinor,
      totalDisputedMinor,
    };
  }
}