/**
 * SettlementService — post-payment settlement tracking.
 *
 * The settlement destination ALWAYS comes from the school's VERIFIED
 * settlement_accounts record (Milestone 5). The client can never specify an
 * arbitrary bank account. Settlement processing is auditable and idempotent.
 */
import { supabase } from '../supabaseClient.js';
import { audit } from './auditService.js';

class SettlementService {
  /**
   * Get the school's verified settlement account (the only valid destination).
   */
  async getVerifiedSettlementAccount(schoolId) {
    const { data, error } = await supabase
      .from('settlement_accounts')
      .select('*')
      .eq('school_id', schoolId)
      .eq('status', 'VERIFIED')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  /**
   * Record a settlement for a verified payment.
   * Destination is resolved server-side; never from the client.
   */
  async createSettlement({ schoolId, paymentTransactionId, amountMinor, actorId }) {
    const account = await this.getVerifiedSettlementAccount(schoolId);
    if (!account) {
      throw Object.assign(new Error('No verified settlement account for this school.'), { code: 'NO_SETTLEMENT_ACCOUNT', statusCode: 403 });
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payment_transactions')
      .select('id, amount_minor, status, reference')
      .eq('id', paymentTransactionId)
      .eq('school_id', schoolId)
      .single();
    if (paymentError || !payment) throw Object.assign(new Error('Payment not found.'), { statusCode: 404 });
    if (payment.status !== 'SUCCESS') {
      throw Object.assign(new Error('Only SUCCESS payments can be settled.'), { code: 'INVALID_PAYMENT_STATUS', statusCode: 409 });
    }

    const idemKey = `settle:${paymentTransactionId}`;
    const { data: existing, error: existingError } = await supabase
      .from('settlement_records')
      .select('*')
      .eq('idempotency_key', idemKey)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return { settlement: existing, alreadyExists: true };

    const { data, error } = await supabase
      .from('settlement_records')
      .insert({
        payment_transaction_id: paymentTransactionId,
        school_id: schoolId,
        destination: 'school',
        account_number: account.account_number,
        bank_name: account.bank_name || null,
        settlement_account_id: account.id,
        amount: amountMinor / 100,
        status: 'PENDING',
        idempotency_key: idemKey,
        raw_response: { reference: payment.reference },
      })
      .select()
      .single();
    if (error) throw error;

    await audit(schoolId, actorId, 'SETTLEMENT_CREATED', 'settlement_records', data.id, {
      payment_transaction_id: paymentTransactionId,
      amount_minor: amountMinor,
      account_number_last4: account.account_number.slice(-4),
    });

    return { settlement: data, alreadyExists: false };
  }

  /**
   * Mark a settlement as completed or failed (server-side).
   */
  async updateSettlementStatus({ settlementId, schoolId, status, actorId, failureReason }) {
    const { data: settlement, error } = await supabase
      .from('settlement_records')
      .select('*')
      .eq('id', settlementId)
      .eq('school_id', schoolId)
      .single();
    if (error || !settlement) throw Object.assign(new Error('Settlement not found.'), { statusCode: 404 });

    const patch = { status, updated_at: new Date().toISOString() };
    if (status === 'FAILED' && failureReason) patch.failure_reason = failureReason;

    const { data: updated, error: updateError } = await supabase
      .from('settlement_records')
      .update(patch)
      .eq('id', settlementId)
      .select()
      .single();
    if (updateError) throw updateError;

    await audit(schoolId, actorId, status === 'SUCCESS' ? 'SETTLEMENT_COMPLETED' : 'SETTLEMENT_FAILED', 'settlement_records', settlementId, {
      payment_transaction_id: settlement.payment_transaction_id,
      amount_minor: settlement.amount ? Math.round(settlement.amount * 100) : null,
      account_number_last4: settlement.account_number?.slice(-4) || null,
      failure_reason: failureReason || null,
    });

    return updated;
  }

  /**
   * Settlement history for a school.
   */
  async listSettlements(schoolId, { limit = 100 } = {}) {
    const { data, error } = await supabase
      .from('settlement_records')
      .select('id, payment_transaction_id, destination, amount, status, settled_at, created_at, failure_reason, payment_transactions(reference, student_id)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;

    // Mask account numbers.
    return (data || []).map((s) => ({
      ...s,
      account_number_last4: s.account_number?.slice(-4) || null,
      account_number: undefined,
    }));
  }

  /**
   * Settlement summary for a school.
   */
  async summary(schoolId) {
    const { data, error } = await supabase
      .from('settlement_records')
      .select('status, amount')
      .eq('school_id', schoolId);
    if (error) throw error;

    const records = data || [];
    const sumMinor = (arr) => Math.round(arr.reduce((acc, r) => acc + Number(r.amount || 0), 0) * 100);

    return {
      total: records.length,
      pending: records.filter((r) => r.status === 'PENDING').length,
      successful: records.filter((r) => r.status === 'SUCCESS').length,
      failed: records.filter((r) => r.status === 'FAILED').length,
      settled_minor: sumMinor(records.filter((r) => r.status === 'SUCCESS')),
    };
  }
}

export { SettlementService };
export default new SettlementService();
