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
import type {
  AmountMinor,
  PaymentTransactionRow,
  TransactionStatus,
} from '../types/db.js';
import type { AppError } from '../types/http.js';

export const VALID_TRANSITIONS: Record<TransactionStatus, readonly TransactionStatus[]> = {
  PENDING: ['PROCESSING', 'FAILED'],
  PROCESSING: ['SUCCESS', 'FAILED'],
  SUCCESS: ['REVERSED'],
  FAILED: [],
  REVERSED: [],
};

export interface PaymentIntentParams {
  schoolId: string;
  studentId: string;
  amountMinor: number;
  currency?: string;
  reference?: string;
  paymentMethod?: string | null;
  actorId: string;
}

export interface TransitionOptions {
  actorId?: string | null;
  failureReason?: string | null;
}

export interface RecordVerifiedPaymentParams {
  schoolId: string;
  studentId: string;
  reference: string;
  gatewayTxnRef?: string | null;
  providerEventId?: string | null;
  amountMinor: AmountMinor;
  entryCategory?: string;
  currency?: string;
  paymentMethod?: string | null;
  rawPayload?: Record<string, unknown>;
  idempotencyKey?: string | null;
}

export interface RecordVerifiedPaymentResult {
  already_processed?: boolean;
  payment_transaction_id?: string;
  ledger_entry_id?: string | null;
  [key: string]: unknown;
}

export interface ListPaymentsFilter {
  studentId?: string;
  status?: string;
  limit?: number;
}

class PaymentService {
  /**
   * Create a payment intent (client-initiated). Never marks success.
   */
  async createPaymentIntent({
    schoolId,
    studentId,
    amountMinor,
    currency = 'NGN',
    reference,
    paymentMethod,
    actorId,
  }: PaymentIntentParams): Promise<PaymentTransactionRow> {
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      throw Object.assign(new Error('amountMinor must be a positive integer.'), { statusCode: 400 }) as AppError;
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

    await audit(schoolId, actorId, 'PAYMENT_INTENT_CREATED', 'payment_transactions', (data as PaymentTransactionRow).id, {
      student_id: studentId,
      amount_minor: amountMinor,
    });

    return data as PaymentTransactionRow;
  }

  /**
   * Server-side transition. Returns the updated row. Throws on invalid
   * transition (prevents arbitrary status manipulation).
   */
  async transition(
    paymentId: string,
    schoolId: string,
    toStatus: TransactionStatus,
    { actorId, failureReason }: TransitionOptions = {}
  ): Promise<PaymentTransactionRow> {
    const { data: payment, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('id', paymentId)
      .eq('school_id', schoolId)
      .single();
    if (error || !payment) throw Object.assign(new Error('Payment not found.'), { statusCode: 404 }) as AppError;

    const current = (payment as PaymentTransactionRow).status;
    const allowed = VALID_TRANSITIONS[current] || [];
    if (!allowed.includes(toStatus)) {
      throw Object.assign(
        new Error(`Invalid payment state transition ${current} -> ${toStatus}.`),
        { code: 'INVALID_TRANSITION', statusCode: 409 }
      ) as AppError;
    }

    const patch: Record<string, unknown> = { status: toStatus, updated_at: new Date().toISOString() };
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
      await audit(schoolId, actorId ?? null, 'PAYMENT_REVERSED', 'payment_transactions', paymentId, {
        student_id: (payment as PaymentTransactionRow).student_id,
        amount_minor: (payment as PaymentTransactionRow).amount_minor,
        original_status: current,
      });
    }

    return updated as PaymentTransactionRow;
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
  }: RecordVerifiedPaymentParams): Promise<RecordVerifiedPaymentResult> {
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
      const err: Error & { code?: string } = new Error(error.message);
      err.code = error.code;
      throw err;
    }

    const result = data as RecordVerifiedPaymentResult;

    if (!result?.already_processed) {
      await audit(schoolId, null, 'PAYMENT_RECEIVED', 'payment_transactions', result.payment_transaction_id, {
        student_id: studentId,
        amount_minor: amountMinor,
        reference,
        ledger_entry_id: result.ledger_entry_id,
      });
    }

    return result;
  }

  /**
   * List payments for a school (staff/school with payment.view).
   */
  async listPayments(schoolId: string, { studentId, status, limit = 100 }: ListPaymentsFilter = {}): Promise<PaymentTransactionRow[]> {
    // Phase 1 fix: payment_transactions has NO created_at column (42703 at
    // runtime). Migration 0025 inserts every row with verified_at = now()
    // atomically, so verified_at IS the record-creation timestamp and the
    // correct business chronology. The wire contract keeps exposing the key
    // as `created_at` (sourced from verified_at) so frontend consumers
    // (ReportsView/PaymentsView) are unaffected.
    let query = supabase
      .from('payment_transactions')
      .select('id, school_id, student_id, reference, gateway_txn_ref, amount_minor, currency, status, entry_category, payment_method, verified_at, students(first_name, last_name, class_name)')
      .eq('school_id', schoolId)
      .order('verified_at', { ascending: false })
      .limit(limit);

    if (studentId) query = query.eq('student_id', studentId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    const rows = (data || []) as unknown as Array<PaymentTransactionRow & { created_at?: string | null }>;
    return rows.map(({ created_at: _ignored, ...row }) => ({
      ...row,
      created_at: row.verified_at,
    }));
  }

  /**
   * Payment summary for a school (dashboard).
   */
  async summary(schoolId: string): Promise<{
    total_payments: number;
    successful_payments: number;
    pending_payments: number;
    failed_payments: number;
    reversed_payments: number;
    today_collections_minor: number;
    month_collections_minor: number;
    total_collected_minor: number;
  }> {
    // Phase 1 fix: bucket by verified_at (see listPayments note) — for a
    // fee-collection platform, money counts as collected when it is VERIFIED,
    // which is also when the row comes into existence.
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('status, amount_minor, verified_at')
      .eq('school_id', schoolId);
    if (error) throw error;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const payments = (data || []) as Pick<PaymentTransactionRow, 'status' | 'amount_minor' | 'verified_at'>[];
    const successful = payments.filter((p) => p.status === 'SUCCESS');
    const sumMinor = (arr: typeof payments) => arr.reduce((acc, p) => acc + Number(p.amount_minor || 0), 0);

    return {
      total_payments: payments.length,
      successful_payments: successful.length,
      pending_payments: payments.filter((p) => p.status === 'PENDING' || p.status === 'PROCESSING').length,
      failed_payments: payments.filter((p) => p.status === 'FAILED').length,
      reversed_payments: payments.filter((p) => p.status === 'REVERSED').length,
      today_collections_minor: sumMinor(successful.filter((p) => new Date(p.verified_at) >= startOfToday)),
      month_collections_minor: sumMinor(successful.filter((p) => new Date(p.verified_at) >= startOfMonth)),
      total_collected_minor: sumMinor(successful),
    };
  }
}

export { PaymentService };
export default new PaymentService();
