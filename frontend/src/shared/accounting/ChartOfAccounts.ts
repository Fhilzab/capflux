/**
 * ChartOfAccounts
 *
 * Default system accounts for Capflux.
 * Accounts are identified by string codes, making the chart extensible per school/organization later.
 */

import type { ChartOfAccount } from './types';

const DEFAULT_SYSTEM_ACCOUNTS: Omit<ChartOfAccount, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // Assets
  {
    accountCode: '1100',
    accountName: 'Cash',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    organizationId: 'system',
    active: true,
  },
  {
    accountCode: '1110',
    accountName: 'Bank',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    organizationId: 'system',
    active: true,
  },
  {
    accountCode: '1200',
    accountName: 'Accounts Receivable',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    organizationId: 'system',
    active: true,
  },

  // Liabilities
  {
    accountCode: '2100',
    accountName: 'Deferred Revenue',
    accountType: 'LIABILITY',
    normalBalance: 'CREDIT',
    organizationId: 'system',
    active: true,
  },

  // Income
  {
    accountCode: '4100',
    accountName: 'School Fee Income',
    accountType: 'INCOME',
    normalBalance: 'CREDIT',
    organizationId: 'system',
    active: true,
  },
  {
    accountCode: '4110',
    accountName: 'Platform Levy Income',
    accountType: 'INCOME',
    normalBalance: 'CREDIT',
    organizationId: 'system',
    active: true,
  },

  // Expenses
  {
    accountCode: '6100',
    accountName: 'Refund Expense',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    organizationId: 'system',
    active: true,
  },
  {
    accountCode: '6200',
    accountName: 'Adjustment Expense',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
    organizationId: 'system',
    active: true,
  },
];

export class ChartOfAccounts {
  /**
   * Return the default account map for a given organization.
   * In production this would be overridable per school/organization.
   */
  static getDefaults(organizationId: string): ChartOfAccount[] {
    const now = new Date().toISOString();
    return DEFAULT_SYSTEM_ACCOUNTS.map((account, index) => ({
      ...account,
      id: `coa-${organizationId}-${index + 1}`,
      organizationId,
      createdAt: now,
      updatedAt: now,
    }));
  }

  /**
   * Lookup account by code within an organization's chart.
   */
  static findByCode(accounts: ChartOfAccount[], accountCode: string): ChartOfAccount | undefined {
    return accounts.find(a => a.accountCode === accountCode && a.active);
  }
}