/**
 * DownloadSyncEngine - Synchronizes CLOUD OWNED entities from Supabase
 * 
 * CLOUD OWNED entities (created by backend, read-only in browser):
 * - payment_transactions
 * - settlement_records
 * - payment_accounts (provider responses)
 */

import { supabase, hasSupabaseConfig } from '../shared/services/api/supabase';
import type { PaymentTransaction, DataSource } from '../types/billing';

const CLOUD_OWNED_TABLES = ['payment_transactions', 'settlement_records'] as const;

/**
 * Download CLOUD OWNED entities for a school
 */
export async function downloadFinancialData(school_id: string): Promise<{
  payment_transactions: PaymentTransaction[];
  settlement_records: unknown[];
}> {
  if (!hasSupabaseConfig) {
    console.warn('Skipping download sync: Supabase is not configured.');
    return { payment_transactions: [], settlement_records: [] };
  }

  // Verify we have a valid session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.warn('Skipping download sync: No valid Supabase session.');
    return { payment_transactions: [], settlement_records: [] };
  }

  const { LocalRepository } = await import('./localDb');

  // Download payment transactions
  const { data: paymentTransactions, error: ptError } = await (supabase
    .from('payment_transactions')
    .select('*')
    .eq('school_id', school_id) as any);

  if (ptError) {
    console.error('Failed to download payment transactions:', ptError);
  } else if (paymentTransactions) {
    // Clear existing data and insert fresh
    await LocalRepository.clearFinancialData(school_id);
    for (const txn of paymentTransactions) {
      await LocalRepository.savePaymentTransaction({
        ...txn,
        source: 'SERVER' as DataSource,
        version: 1,
        updated_at: txn.verified_at || new Date().toISOString(),
      });
    }
  }

  // Download settlement records
  const { data: settlementRecords, error: srError } = await (supabase
    .from('settlement_records')
    .select('*') as any);

  if (srError) {
    console.error('Failed to download settlement records:', srError);
  } else if (settlementRecords) {
    for (const record of settlementRecords) {
      await LocalRepository.saveSettlementRecord({
        ...record,
        source: 'SERVER' as DataSource,
        version: 1,
        updated_at: record.settled_at || new Date().toISOString(),
      });
    }
  }

  return {
    payment_transactions: paymentTransactions || [],
    settlement_records: settlementRecords || [],
  };
}

/**
 * Download payment accounts (HYBRID but read-only after creation)
 */
export async function downloadPaymentAccounts(school_id: string): Promise<any[]> {
  if (!hasSupabaseConfig) {
    return [];
  }

  const { data: accounts, error } = await (supabase
    .from('payment_accounts')
    .select('*')
    .eq('school_id', school_id) as any);

  if (error) {
    console.error('Failed to download payment accounts:', error);
    return [];
  }

  const { LocalRepository } = await import('./localDb');
  for (const account of accounts || []) {
    await LocalRepository.savePaymentAccount({
      ...account,
      source: 'SERVER' as DataSource,
      version: 1,
      updated_at: account.updated_at || new Date().toISOString(),
    });
  }

  return accounts || [];
}

/**
 * Start background download synchronization
 */
export function startDownloadSync(intervalMs = 60000, school_id: string): ReturnType<typeof setInterval> {
  const interval = setInterval(async () => {
    try {
      await downloadFinancialData(school_id);
      await downloadPaymentAccounts(school_id);
    } catch (error) {
      console.error('Background download sync failed:', error);
    }
  }, intervalMs);

  return interval;
}

export default {
  downloadFinancialData,
  downloadPaymentAccounts,
  startDownloadSync,
};