import type { EngineInput, TrialBalance, TrialBalanceAccount } from './types';

export class TrialBalanceGenerator {
  static build(input: EngineInput): TrialBalance {
    const balanceMap = new Map<string, TrialBalanceAccount>();

    for (const entry of input.ledgerEntries) {
      const accountCode = (entry.metadata?.accountCode as string) || 'UNKNOWN';
      const accountName = (entry.metadata?.accountName as string) || 'Unknown';
      const accountType = (entry.metadata?.accountType as string) || 'UNKNOWN';

      if (!balanceMap.has(accountCode)) {
        balanceMap.set(accountCode, {
          accountCode,
          accountName,
          accountType,
          debitTotalMinor: 0,
          creditTotalMinor: 0,
          balanceMinor: 0,
        });
      }

      const account = balanceMap.get(accountCode)!;
      if (entry.entryDirection === 'DEBIT') {
        account.debitTotalMinor += entry.amountMinor;
      } else {
        account.creditTotalMinor += entry.amountMinor;
      }
    }

    const accounts = Array.from(balanceMap.values());
    const totalDebitsMinor = accounts.reduce((sum, a) => sum + a.debitTotalMinor, 0);
    const totalCreditsMinor = accounts.reduce((sum, a) => sum + a.creditTotalMinor, 0);

    for (const account of accounts) {
      account.balanceMinor = account.debitTotalMinor - account.creditTotalMinor;
    }

    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        organizationId: input.filter.organizationId,
        schoolId: input.filter.schoolId || '',
        reportPeriod: 'DAY',
        reportSchemaVersion: '1',
      },
      accounts,
      totalDebitsMinor,
      totalCreditsMinor,
      balanced: totalDebitsMinor === totalCreditsMinor,
    };
  }
}