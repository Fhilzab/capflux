/**
 * RealtimeSyncService - Subscribes to Supabase realtime events for CLOUD OWNED entities
 * 
 * Listens to:
 * - payment_transactions (ledger CREDIT entries)
 * - payment_accounts (DVA creation responses)
 * - settlement_records (settlement updates)
 * - notifications (delivery status)
 */

import { supabase, hasSupabaseConfig } from '../services/api/supabase';
import type { DataSource } from './localDb';

type RealtimeCallback = (payload: unknown) => void;

// Track active subscriptions
const activeSubscriptions: Map<string, () => void> = new Map();

/**
 * Subscribe to CLOUD OWNED entity changes for a school
 */
export function subscribeToFinancialData(school_id: string, callback: RealtimeCallback): () => void {
  if (!hasSupabaseConfig) {
    console.warn('Cannot subscribe to realtime: Supabase is not configured.');
    return () => {};
  }

  // Subscribe to payment_transactions changes using type-safe approach
  const paymentTxnChannel = supabase.channel(`payment_transactions:${school_id}`);
  (paymentTxnChannel as any).on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'payment_transactions',
    filter: `school_id=eq.${school_id}`,
  }, (payload: any) => callback(payload));
  paymentTxnChannel.subscribe();

  // Subscribe to payment_accounts changes (for DVA status)
  const paymentAccountChannel = supabase.channel(`payment_accounts:${school_id}`);
  (paymentAccountChannel as any).on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'payment_accounts',
    filter: `school_id=eq.${school_id}`,
  }, (payload: any) => callback(payload));
  paymentAccountChannel.subscribe();

  // Subscribe to settlement_records changes
  const settlementChannel = supabase.channel(`settlement_records:${school_id}`);
  (settlementChannel as any).on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'settlement_records',
  }, (payload: any) => callback(payload));
  settlementChannel.subscribe();

  // Composite unsubscribe function
  const unsubscribe = () => {
    paymentTxnChannel.unsubscribe();
    paymentAccountChannel.unsubscribe();
    settlementChannel.unsubscribe();
    activeSubscriptions.delete(`financial:${school_id}`);
  };

  activeSubscriptions.set(`financial:${school_id}`, unsubscribe);
  return unsubscribe;
}

/**
 * Subscribe to ledger changes (CREDIT entries trigger from payments)
 */
export function subscribeToLedgerEntries(student_id: string, callback: RealtimeCallback): () => void {
  if (!hasSupabaseConfig) {
    return () => {};
  }

  const channel = supabase.channel(`ledger_entries:${student_id}`);
  (channel as any).on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'ledger_entries',
    filter: `student_id=eq.${student_id}`,
  }, (payload: any) => callback(payload));
  channel.subscribe();

  return () => channel.unsubscribe();
}

/**
 * Handle realtime payment transaction and write to local DB
 */
export async function handleRealtimePaymentTransaction(payload: any): Promise<void> {
  const { default: db, LocalRepository } = await import('./localDb');
  
  if (payload.eventType === 'INSERT') {
    const transaction = payload.new;
    await LocalRepository.savePaymentTransaction({
      ...transaction,
      source: 'WEBHOOK' as DataSource,
      version: 1,
      updated_at: transaction.verified_at || new Date().toISOString(),
    });
  }
}

/**
 * Handle realtime ledger entry and write to local DB
 */
export async function handleRealtimeLedgerEntry(payload: any): Promise<void> {
  const { default: db } = await import('./localDb');
  
  if (payload.eventType === 'INSERT') {
    const entry = payload.new;
    // CREDIT entries come from the server (payments/webhooks)
    await db.ledger_entries.put({
      ...entry,
      source: 'SERVER' as DataSource,
      version: 1,
      updated_at: entry.created_at || new Date().toISOString(),
    });
  }
}

/**
 * Subscribe to all financial updates for a school
 */
export function subscribeToAll(school_id: string, student_id?: string): () => void {
  const unsubscribers: Array<() => void> = [];

  // Financial data subscription
  unsubscribers.push(subscribeToFinancialData(school_id, async (payload) => {
    const p = payload as any;
    if (p.table === 'payment_transactions') {
      await handleRealtimePaymentTransaction(p);
    }
  }));

  // Ledger subscription for specific student
  if (student_id) {
    unsubscribers.push(subscribeToLedgerEntries(student_id, async (payload) => {
      await handleRealtimeLedgerEntry(payload as any);
    }));
  }

  return () => {
    unsubscribers.forEach((u) => u());
  };
}

/**
 * Unsubscribe all realtime channels
 */
export function unsubscribeAll(): void {
  activeSubscriptions.forEach((unsubscribe) => unsubscribe());
  activeSubscriptions.clear();
}

export default {
  subscribeToFinancialData,
  subscribeToLedgerEntries,
  subscribeToAll,
  unsubscribeAll,
};
