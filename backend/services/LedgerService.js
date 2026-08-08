/**
 * LedgerService - Server-side ledger operations.
 *
 * Uses PaymentService.recordVerifiedPayment (atomic RPC) for
 * verified payment → ledger CREDIT. This service only provides
 * split-settlement helpers and the legacy savePaymentTransaction
 * compatibility shim.
 *
 * Payment lifecycle is canonical in PaymentService and migration 0025.
 */
import { supabase } from '../supabaseClient.js';

export const LedgerService = {

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