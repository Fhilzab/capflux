/**
 * LedgerService - Server-side ledger operations
 * 
 * Creates immutable CREDIT ledger entries directly in Supabase.
 * Used by webhook handlers to record verified payments.
 * 
 * This bypasses the offline-first flow for the server-side webhook processing,
 * but the sync engine will pull these down to clients, preserving offline-first architecture.
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

    const ledgerEntry = {
      school_id,
      student_id,
      amount: Number(amount),
      entry_type: 'CREDIT',
      entry_category: 'TUITION', // Default; adjust based on business logic
      reference_id: null, // Will be set if linked to a fee invoice
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

    // Log audit action
    await this.logAudit(school_id, 'payment_recorded', 'ledger_entries', data.id, {
      amount,
      reference,
      student_id,
    });

    return data;
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
   * Create settlement records for tracking
   * @param {string} payment_transaction_id - Payment transaction UUID
   * @param {Array} settlements - Settlement details from gateway
   */
  async recordSettlements(payment_transaction_id, settlements) {
    const records = settlements.map((s) => ({
      payment_transaction_id,
      destination: s.destination,
      account_number: s.account_number,
      bank_name: s.bank_name || 'N/A',
      amount: Number(s.amount),
      raw_response: s,
    }));

    const { error } = await supabase
      .from('settlement_records')
      .insert(records);

    if (error) {
      console.error('Failed to record settlements:', error);
    }

    return records;
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