/**
 * LedgerService - Server-side ledger operations
 * 
 * Creates immutable CREDIT ledger entries directly in Supabase.
 * Used by webhook handlers to record verified payments.
 * 
 * This bypasses the offline-first flow for the server-side webhook processing,
 * but the sync engine will pull these down to clients, preserving offline-first architecture.
 * 
 * Platform fees are computed from fee_rules table, not hardcoded.
 */

import { supabase, hasSupabaseConfig } from '../supabaseClient.js';

export const LedgerService = {
  /**
   * Record a verified payment as a CREDIT ledger entry
   * This is called ONLY after webhook verification
   * @param {Object} params
   * @param {string} params.school_id - School UUID
   * @param {string} params.student_id - Student UUID
   * @param {number} params.amount - Payment amount
   * @param {string} params.reference - Gateway transaction reference
   * @param {Object} params.transaction - Full transaction from gateway API
   * @returns {Promise<Object>} Created ledger entry
   */
  async recordVerifiedPayment(params) {
    const { school_id, student_id, amount, reference, transaction } = params;

    // Get fee rule for platform fee calculation
    const { data: feeRule, error: feeError } = await supabase
      .from('fee_rules')
      .select('*')
      .eq('school_id', school_id)
      .eq('is_active', true)
      .single();

    // Calculate platform fee based on fee rule
    let platformFee = 0;
    if (feeRule) {
      const calculatedFee = amount * (feeRule.percentage / 100);
      platformFee = Math.max(feeRule.minimum_fee, Math.min(calculatedFee, feeRule.maximum_fee));
      // Floor to 2 decimal places
      platformFee = Math.floor(platformFee * 100) / 100;
    }

    const ledgerEntry = {
      school_id,
      student_id,
      amount: Number(amount),
      entry_type: 'CREDIT',
      entry_category: 'TUITION', // Main payment goes to tuition
      reference_id: null, // Will be set if linked to a fee invoice
      idempotency_key: `pay:${reference}`,
      metadata: {
        gateway_reference: reference,
        gateway_txn_ref: transaction.transactionReference,
        payment_date: transaction.paidOn || transaction.paymentDate,
        customer_name: transaction.customerName,
        customer_email: transaction.customerEmail,
        settlement_status: transaction.settlementStatus,
      },
    };

    // Insert directly into Supabase (authoritative source)
    const { data, error } = await supabase
      .from('ledger_entries')
      .insert(ledgerEntry)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create ledger entry: ${error.message}`);
    }

    // Create platform fee ledger entry if fee > 0
    if (platformFee > 0) {
      await supabase
        .from('ledger_entries')
        .insert({
          school_id,
          student_id,
          amount: platformFee,
          entry_type: 'CREDIT',
          entry_category: 'PLATFORM_BANKING_FEE',
          reference_id: data.id, // Link to original payment
          metadata: {
            fee_rule_id: feeRule?.id,
            percentage_applied: feeRule?.percentage,
            minimum_fee: feeRule?.minimum_fee,
            maximum_fee: feeRule?.maximum_fee,
          },
        });
    }

    // Log audit action
    await this.logAudit(school_id, 'payment_recorded', 'ledger_entries', data.id, {
      amount,
      reference,
      student_id,
      platform_fee: platformFee,
    });

    return { ...data, platform_fee: platformFee };
  },

  /**
   * Record multiple ledger entries from split settlement
   * @param {string} school_id - School UUID
   * @param {string} student_id - Student UUID
   * @param {string} payment_transaction_id - Payment transaction UUID
   * @param {Array} settlements - Array of settlement records
   */
  async recordSplitSettlement(school_id, student_id, payment_transaction_id, settlements) {
    for (const settlement of settlements) {
      const ledgerEntry = {
        school_id,
        student_id,
        amount: Number(settlement.amount),
        entry_type: 'CREDIT',
        entry_category: settlement.category || 'TUITION',
        reference_id: payment_transaction_id,
        metadata: {
          settlement_destination: settlement.destination,
          settlement_account: settlement.account_number,
        },
      };

      const { error } = await supabase
        .from('ledger_entries')
        .insert(ledgerEntry);

      if (error) {
        console.error('Failed to create split settlement ledger entry:', error);
      }
    }
  },

  /**
   * Log audit action for payment operations
   */
  async logAudit(school_id, action, entity, entity_id, metadata = {}) {
    // Get a profile ID for audit (using system profile)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('school_id', school_id)
      .limit(1)
      .single();

    const actor_id = profile?.id || null;

    await supabase.rpc('log_audit_action', {
      actor_uuid: actor_id,
      action_text: action,
      entity_name: entity,
      entity_uuid: entity_id,
      metadata_json: metadata,
    });
  },

  /**
   * Save payment transaction for idempotency
   * @param {Object} params
   */
  async savePaymentTransaction(params) {
    const { reference, ...rest } = params;

    const { data, error } = await supabase
      .from('payment_transactions')
      .insert({
        reference,
        ...rest,
      })
      .select()
      .single();

    if (error) {
      // If reference already exists, return the existing one
      if (error.code === '23505') {
        const { data: existing } = await supabase
          .from('payment_transactions')
          .select('*')
          .eq('reference', reference)
          .single();
        return { ...existing, alreadyExists: true };
      }
      throw error;
    }

    return data;
  },
};