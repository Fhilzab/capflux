import type { EngineInput, CashBook, CashBookEntry } from './types';

export class CashBookGenerator {
  static build(input: EngineInput): CashBook {
    const entries = input.ledgerEntries
      .slice()
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    let runningBalanceMinor = 0;
    const cashBookEntries: CashBookEntry[] = [];

    for (const entry of entries) {
      const isReceipt = entry.entryType === 'PAYMENT' && entry.entryDirection === 'CREDIT';
      const isPayment = entry.entryType === 'REFUND' && entry.entryDirection === 'DEBIT';

      if (!isReceipt && !isPayment) continue;

      if (isReceipt) {
        runningBalanceMinor += entry.amountMinor;
      } else {
        runningBalanceMinor -= entry.amountMinor;
      }

      cashBookEntries.push({
        postingDate: entry.postingDate,
        entryNumber: entry.entryNumber,
        journalNumber: entry.metadata?.journalNumber as string | undefined,
        description: entry.metadata?.memo as string | undefined,
        reference: entry.sourceDocumentId,
        receiptsMinor: isReceipt ? entry.amountMinor : 0,
        paymentsMinor: isPayment ? entry.amountMinor : 0,
        balanceMinor: runningBalanceMinor,
      });
    }

    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        organizationId: input.filter.organizationId,
        schoolId: input.filter.schoolId || '',
        reportPeriod: 'DAY',
        reportSchemaVersion: '1',
      },
      openingBalanceMinor: 0,
      closingBalanceMinor: runningBalanceMinor,
      entries: cashBookEntries,
    };
  }
}