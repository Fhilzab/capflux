import type { EngineInput, RevenueSummary, RevenueLine } from './types';

export class RevenueSummaryGenerator {
  static build(input: EngineInput): RevenueSummary {
    const lines: RevenueLine[] = [];
    const periodMap = new Map<string, RevenueLine>();

    for (const entry of input.ledgerEntries) {
      const periodKey = entry.postingDate.slice(0, 10);
      const currency = entry.currency;

      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, {
          period: periodKey,
          schoolFeeIncomeMinor: 0,
          platformLevyIncomeMinor: 0,
          refundsMinor: 0,
          waiversMinor: 0,
          adjustmentsMinor: 0,
          netRevenueMinor: 0,
          currency,
        });
      }

      const line = periodMap.get(periodKey)!;
      const amount = entry.amountMinor;

      switch (entry.entryType) {
        case 'CHARGE':
          if (entry.metadata?.chargeSource === 'PLATFORM') {
            line.platformLevyIncomeMinor += amount;
          } else {
            line.schoolFeeIncomeMinor += amount;
          }
          break;
        case 'PAYMENT':
          // Payments are receipts, counted as revenue
          line.schoolFeeIncomeMinor += amount;
          break;
        case 'REFUND':
          line.refundsMinor += amount;
          break;
        case 'WAIVER':
          line.waiversMinor += amount;
          break;
        case 'ADJUSTMENT':
          line.adjustmentsMinor += amount;
          break;
        default:
          break;
      }
    }

    for (const line of periodMap.values()) {
      line.netRevenueMinor =
        line.schoolFeeIncomeMinor +
        line.platformLevyIncomeMinor -
        line.refundsMinor -
        line.waiversMinor -
        line.adjustmentsMinor;
      lines.push(line);
    }

    lines.sort((a, b) => a.period.localeCompare(b.period));

    const totalRevenueMinor = lines.reduce((sum, l) => sum + l.schoolFeeIncomeMinor + l.platformLevyIncomeMinor, 0);
    const totalRefundsMinor = lines.reduce((sum, l) => sum + l.refundsMinor + l.waiversMinor + l.adjustmentsMinor, 0);
    const totalNetRevenueMinor = lines.reduce((sum, l) => sum + l.netRevenueMinor, 0);

    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        organizationId: input.filter.organizationId,
        schoolId: input.filter.schoolId || '',
        reportPeriod: 'DAY',
        reportSchemaVersion: '1',
      },
      lines,
      totalRevenueMinor,
      totalRefundsMinor,
      totalNetRevenueMinor,
    };
  }
}