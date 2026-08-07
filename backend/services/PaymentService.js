/**
 * PaymentService — canonical payment transaction lifecycle.
 *
 * State machine:
 *   PENDING -> PROCESSING -> SUCCESS
 *   PENDING -> FAILED
 *   SUCCESS -> REVERSED
 *
 * Only trusted backend processes may transition financial state. The browser
 * may create a PENDING intent, but SUCCESS/FAILED/REVERSED are set only from
 * verified gateway webhooks or server-side gateway verification.
 *
 * Money is handled in integer minor units (kobo) via amount_minor.
 */
import { supabase } from '../supabaseClient.js';
import { audit } from './auditService.js';

const VALID_TRANSITIONS = {
  PENDING: ['PROCESSING', 'FAILED'],
  PROCESSING: ['SUCCESS', 'FAILED'],
  SUCCESS: ['REVERSED'],
  FAILED: [],
  REVERSED: [],
};

class PaymentService {
  /**
   * Create a payment intent (client-initiated). Never marks success.
   */
  async createPaymentIntent({ schoolId, studentId, amountMinor, currency = 'NGN', reference, paymentMethod, actorId }) {
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      throw Object.assign(new Error('amountMinor must be a positive integer.'), { statusCode: 400 });
    }

    const { data, error } = await supabase
      .from('payment_transactions')
      .insert({
        school_id: schoolId,
        student_id: studentId,
        reference: reference || `CAP${Date.now()}${Math.floor(Math.random() * 1000)}`,
        gateway_txn_ref: null,
        provider_event_id: null,
        amount: amountMinor / 100,
        amount_minor: amountMinor,
        currency,
        entry_category: 'TUITION',
        settlement_status: 'PENDING',
        status: 'PENDING',
        payment_method: paymentMethod || null,
        raw_payload: {},
      })
      .select()
      .single();
    if (error) throw error;

    await audit(schoolId, actorId, 'PAYMENT_INTENT_CREATED', 'payment_transactions', data.id, {
      student_id: studentId,
      amount_minor: amountMinor,
    });

    return data;
  }

  /**
   * Server-side transition. Returns the updated row. Throws on invalid
   * transition (prevents arbitrary status manipulation).
   */
  async transition(paymentId, schoolId, toStatus, { actorId, failureReason } = {}) {
    const { data: payment, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('id', paymentId)
      .eq('school_id', schoolId)
      .single();
    if (error || !payment) throw Object.assign(new Error('Payment not found.'), { statusCode: 404 });

    const allowed = VALID_TRANSITIONS[payment.status] || [];
    if (!allowed.includes(toStatus)) {
      throw Object.assign(
        new Error(`Invalid payment state transition ${payment.status} -> ${toStatus}.`),
        { code: 'INVALID_TRANSITION', statusCode: 409 }
      );
    }

    const patch = { status: toStatus, updated_at: new Date().toISOString() };
    if (toStatus === 'FAILED' && failureReason) patch.failure_reason = failureReason;
    if (toStatus === 'REVERSED') {
      patch.reversed_at = new Date().toISOString();
      patch.reversed_by = actorId || null;
    }

    const { data: updated, error: updateError } = await supabase
      .from('payment_transactions')
      .update(patch)
      .eq('id', paymentId)
      .select()
      .single();
    if (updateError) throw updateError;

    if (toStatus === 'REVERSED') {
      await audit(schoolId, actorId, 'PAYMENT_REVERSED', 'payment_transactions', paymentId, {
        student_id: payment.student_id,
        amount_minor: payment.amount_minor,
        original_status: payment.status,
      });
    }

    return updated;
  }

  /**
   * Record a verified payment atomically (payment + ledger) via the
   * record_verified_payment RPC. Idempotent.
   */
  async recordVerifiedPayment({
    schoolId,
    studentId,
    reference,
    gatewayTxnRef,
    providerEventId,
    amountMinor,
    entryCategory = 'TUITION',
    currency = 'NGN',
    paymentMethod = null,
    rawPayload = {},
    idempotencyKey = null,
  }) {
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      throw new Error('amountMinor must be a positive integer.');
    }

    const { data, error } = await supabase.rpc('record_verified_payment', {
      p_school_id: schoolId,
      p_student_id: studentId,
      p_reference: reference,
      p_gateway_txn_ref: gatewayTxnRef,
      p_provider_event_id: providerEventId,
      p_amount_minor: amountMinor,
      p_entry_category: entryCategory,
      p_currency: currency,
      p_payment_method: paymentMethod,
      p_raw_payload: rawPayload,
      p_idempotency_key: idempotencyKey || `pay:${providerEventId || gatewayTxnRef || reference}`,
    });

    if (error) {
      const err = new Error(error.message);
      err.code = error.code;
      throw err;
    }

    if (!data?.already_processed) {
      await audit(schoolId, null, 'PAYMENT_RECEIVED', 'payment_transactions', data.payment_transaction_id, {
        student_id: studentId,
        amount_minor: amountMinor,
        reference,
        ledger_entry_id: data.ledger_entry_id,
      });
    }

    return data;
  }

  /**
   * List payments for a school (staff/school with payment.view).
   */
  async listPayments(schoolId, { studentId, status, limit = 100 } = {}) {
    let query = supabase
      .from('payment_transactions')
      .select('id, school_id, student_id, reference, gateway_txn_ref, amount_minor, currency, status, entry_category, payment_method, created_at, verified_at, students(first_name, last_name, class_name)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (studentId) query = query.eq('student_id', studentId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Payment summary for a school (dashboard).
   */
  async summary(schoolId) {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('status, amount_minor, created_at')
      .eq('school_id', schoolId);
    if (error) throw error;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const payments = data || [];
    const successful = payments.filter((p) => p.status === 'SUCCESS');
    const sumMinor = (arr) => arr.reduce((acc, p) => acc + Number(p.amount_minor || 0), 0);

    return {
      total_payments: payments.length,
      successful_payments: successful.length,
      pending_payments: payments.filter((p) => p.status === 'PENDING' || p.status === 'PROCESSING').length,
      failed_payments: payments.filter((p) => p.status === 'FAILED').length,
      reversed_payments: payments.filter((p) => p.status === 'REVERSED').length,
      today_collections_minor: sumMinor(successful.filter((p) => new Date(p.created_at) >= startOfToday)),
      month_collections_minor: sumMinor(successful.filter((p) => new Date(p.created_at) >= startOfMonth)),
      total_collected_minor: sumMinor(successful),
    };
  }
}

export { PaymentService, VALID_TRANSITIONS };
export default new PaymentService();
