/**
 * ReconciliationService - Banking-grade payment reconciliation
 * 
 * Recovers missed webhook events and ensures financial data integrity.
 * 
 * Workflow:
 * 1. Query Monnify for transactions in date range
 * 2. Compare with existing ledger entries
 * 3. Create missing CREDIT entries for verified payments
 * 4. Log audit events for all recovered transactions
 */

import { supabase } from '../supabaseClient.js';
import { MonnifyGateway } from './gateways/MonnifyGateway.js';
import { LedgerService } from './LedgerService.js';

export class ReconciliationService {
  constructor() {
    this.monifyGateway = new MonnifyGateway();
  }

  /**
   * Reconcile payments for a school within a date range
   * @param {Object} params
   * @param {string} params.school_id - School UUID
   * @param {string} params.start_date - ISO date string
   * @param {string} params.end_date - ISO date string
   * @returns {Promise<Object>} Reconciliation results
   */
  async reconcilePayments(params) {
    const { school_id, start_date, end_date } = params;
    
    // Get gateway config for school
    const { data: gatewayConfig, error: configError } = await supabase
      .from('payment_gateway_config')
      .select('*')
      .eq('school_id', school_id)
      .eq('is_active', true)
      .single();

    if (configError || !gatewayConfig) {
      throw new Error(`No active payment gateway configured for school ${school_id}`);
    }

    // Get existing transaction references for idempotency
    const { data: existingRefs } = await supabase
      .from('payment_transactions')
      .select('reference, gateway_txn_ref')
      .eq('school_id', school_id)
      .gte('verified_at', start_date)
      .lte('verified_at', end_date);

    const existingReferenceSet = new Set(existingRefs?.map(r => r.reference) || []);
    const existingGatewayRefSet = new Set(existingRefs?.map(r => r.gateway_txn_ref) || []);

    // Query gateway for transactions in date range
    const gatewayTransactions = await this.monifyGateway.reconcilePayments({
      gateway_config: gatewayConfig,
      start_date,
      end_date,
    });

    const recoveredTransactions = [];
    const mismatches = [];

    for (const txn of gatewayTransactions) {
      const reference = txn.transactionReference;

      // Skip if already exists
      if (existingReferenceSet.has(reference)) {
        continue;
      }

      // Find student by virtual account number
      const { data: paymentAccount } = await supabase
        .from('payment_accounts')
        .select('student_id')
        .eq('virtual_account_number', txn.destinationAccountDetails?.accountNumber)
        .eq('school_id', school_id)
        .single();

      if (!paymentAccount) {
        mismatches.push({
          reference,
          reason: 'No payment account found for transaction',
          amount: txn.amount,
        });
        continue;
      }

      // Create payment transaction record
      const paymentTxn = await LedgerService.savePaymentTransaction({
        school_id,
        student_id: paymentAccount.student_id,
        gateway_txn_ref: reference,
        reference,
        amount: txn.amount,
        entry_category: 'TUITION',
        settlement_status: txn.settlementStatus || 'SUCCESS',
        verified_at: txn.paidOn || txn.paymentDate,
        raw_payload: txn,
      });

      // Record verified payment (creates CREDIT ledger entries)
      const result = await LedgerService.recordVerifiedPayment({
        school_id,
        student_id: paymentAccount.student_id,
        amount: txn.amount,
        reference,
        transaction: txn,
      });

      recoveredTransactions.push({
        reference,
        student_id: paymentAccount.student_id,
        amount: txn.amount,
        ...result,
      });
    }

    // Log audit for reconciliation run
    await LedgerService.logAudit(
      school_id,
      'reconciliation_completed',
      'reconciliation_run',
      null,
      {
        start_date,
        end_date,
        total_checked: gatewayTransactions.length,
        recovered_count: recoveredTransactions.length,
        mismatch_count: mismatches.length,
      }
    );

    // Notify admin if mismatches remain
    if (mismatches.length > 0) {
      await this.notifyAdminOfMismatches(school_id, mismatches);
    }

    return {
      recovered: recoveredTransactions,
      mismatches,
      summary: {
        checked: gatewayTransactions.length,
        recovered: recoveredTransactions.length,
        mismatches: mismatches.length,
      },
    };
  }

  /**
   * Notify admin of reconciliation mismatches
   * @param {string} school_id
   * @param {Array} mismatches
   */
  async notifyAdminOfMismatches(school_id, mismatches) {
    // Get school admin contact
    const { data: school } = await supabase
      .from('schools')
      .select('name')
      .eq('id', school_id)
      .single();

    // Could send to notification service or log for manual review
    console.warn(`Reconciliation mismatches for ${school?.name || school_id}:`, mismatches);

    await LedgerService.logAudit(
      school_id,
      'reconciliation_mismatches',
      'admin_notification',
      null,
      { mismatches }
    );
  }

  /**
   * Get reconciliation status for a school
   * @param {string} school_id
   */
  async getReconciliationStatus(school_id) {
    const { data: lastRun } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('school_id', school_id)
      .eq('action', 'reconciliation_completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const { data: mismatches } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('school_id', school_id)
      .eq('action', 'reconciliation_mismatches')
      .order('created_at', { ascending: false })
      .limit(5);

    return {
      last_run: lastRun || null,
      recent_mismatches: mismatches || [],
    };
  }
}

export const reconciliationService = new ReconciliationService();