import type { EngineInput, StudentStatement, StudentStatementLine } from './types';
import type { LedgerEntry } from '../ledger/types';

export class StatementGenerator {
  static build(input: EngineInput): StudentStatement {
    const studentId = input.filter.studentId || '';
    const schoolId = input.filter.schoolId || '';

    const entries = input.ledgerEntries
      .filter(e => e.studentId === studentId)
      .slice()
      .sort((a, b) => {
        const postingCompare = a.postingDate.localeCompare(b.postingDate);
        if (postingCompare !== 0) return postingCompare;
        const occurredCompare = a.occurredAt.localeCompare(b.occurredAt);
        if (occurredCompare !== 0) return occurredCompare;
        const createdCompare = a.createdAt.localeCompare(b.createdAt);
        if (createdCompare !== 0) return createdCompare;
        return a.sequenceNumber - b.sequenceNumber;
      });

    let runningBalanceMinor = 0;
    const lines: StudentStatementLine[] = [];

    for (const entry of entries) {
      if (entry.entryDirection === 'DEBIT') {
        runningBalanceMinor += entry.amountMinor;
      } else {
        runningBalanceMinor -= entry.amountMinor;
      }

      lines.push({
        postingDate: entry.postingDate,
        occurredAt: entry.occurredAt,
        entryNumber: entry.entryNumber,
        journalNumber: entry.metadata?.journalNumber as string | undefined,
        entryType: entry.entryType,
        direction: entry.entryDirection,
        amountMinor: entry.amountMinor,
        currency: entry.currency,
        description: entry.metadata?.memo as string | undefined,
        balanceAfterMinor: runningBalanceMinor,
      });
    }

    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        organizationId: input.filter.organizationId,
        schoolId,
        reportPeriod: 'DAY',
        reportSchemaVersion: '1',
      },
      studentId,
      schoolId,
      openingBalanceMinor: 0,
      closingBalanceMinor: runningBalanceMinor,
      lines,
    };
  }
}