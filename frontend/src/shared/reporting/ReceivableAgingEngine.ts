import type { EngineInput, ReceivablesAging, AgingBucket } from './types';

export class ReceivableAgingEngine {
  static build(input: EngineInput): ReceivablesAging {
    const buckets: AgingBucket[] = [
      { bucket: 'CURRENT', label: 'Current', count: 0, totalMinor: 0, currency: 'NGN' },
      { bucket: '1-30', label: '1–30 Days', count: 0, totalMinor: 0, currency: 'NGN' },
      { bucket: '31-60', label: '31–60 Days', count: 0, totalMinor: 0, currency: 'NGN' },
      { bucket: '61-90', label: '61–90 Days', count: 0, totalMinor: 0, currency: 'NGN' },
      { bucket: '90+', label: '90+ Days', count: 0, totalMinor: 0, currency: 'NGN' },
    ];

    const today = new Date();
    let totalReceivableMinor = 0;

    for (const entry of input.ledgerEntries) {
      if (entry.entryDirection !== 'DEBIT') continue;
      
      const postingDate = new Date(entry.postingDate);
      const ageDays = Math.floor((today.getTime() - postingDate.getTime()) / (1000 * 60 * 60 * 24));

      let bucketIndex = 0;
      if (ageDays <= 0) bucketIndex = 0;
      else if (ageDays <= 30) bucketIndex = 1;
      else if (ageDays <= 60) bucketIndex = 2;
      else if (ageDays <= 90) bucketIndex = 3;
      else bucketIndex = 4;

      buckets[bucketIndex].count++;
      buckets[bucketIndex].totalMinor += entry.amountMinor;
      totalReceivableMinor += entry.amountMinor;
    }

    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        organizationId: input.filter.organizationId,
        schoolId: input.filter.schoolId || '',
        reportPeriod: 'DAY',
        reportSchemaVersion: '1',
      },
      buckets,
      totalReceivableMinor,
    };
  }
}