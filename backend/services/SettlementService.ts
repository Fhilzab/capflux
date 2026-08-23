/**
 * SettlementService — post-payment settlement tracking.
 *
 * The settlement destination ALWAYS comes from the school's VERIFIED
 * settlement_accounts record (Milestone 5). The client can never specify an
 * arbitrary bank account. Settlement processing is auditable and idempotent.
 */
import { supabase } from '../supabaseClient.js';
import { audit } from './auditService.js';
import type {
  AmountMinor,
  SettlementAccountRow,
  SettlementRecordRow,
} from '../types/db.js';
import type { AppError } from '../types/http.js';

export interface CreateSettlementParams {
  schoolId: string;
  paymentTransactionId: string;
  amountMinor: AmountMinor;
  actorId?: string | null;
}

export interface UpdateSettlementStatusParams {
  settlementId: string;
  schoolId: string;
  status: string;
  actorId?: string | null;
  failureReason?: string | null;
}

class SettlementService {
  /**
   * Get the school's verified settlement account (the only valid destination).
   */
  async getVerifiedSettlementAccount(schoolId: string): Promise<SettlementAccountRow | null> {
    const { data, error } = await supabase
      .from('settlement_accounts')
      .select('*')
      .eq('school_id', schoolId)
      .eq('status', 'VERIFIED')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as SettlementAccountRow | null;
  }

  /**
   * Record a settlement for a verified payment.
   * Destination is resolved server-side; never from the client.
   */
  async createSettlement({ schoolId, paymentTransactionId, amountMinor, actorId }: CreateSettlementParams): Promise<{ settlement: SettlementRecordRow; alreadyExists: boolean }> {
    const account = await this.getVerifiedSettlementAccount(schoolId);
    if (!account) {
      throw Object.assign(new Error('No verified settlement account for this school.'), { code: 'NO_SETTLEMENT_ACCOUNT', statusCode: 403 }) as AppError;
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payment_transactions')
      .select('id, amount_minor, status, reference')
      .eq('id', paymentTransactionId)
      .eq('school_id', schoolId)
      .single();
    if (paymentError || !payment) throw Object.assign(new Error('Payment not found.'), { statusCode: 404 }) as AppError;
    if ((payment as Pick<SettlementRecordRow, 'status'>).status !== 'SUCCESS') {
      throw Object.assign(new Error('Only SUCCESS payments can be settled.'), { code: 'INVALID_PAYMENT_STATUS', statusCode: 409 }) as AppError;
    }

    const idemKey = `settle:${paymentTransactionId}`;
    const { data: existing, error: existingError } = await supabase
      .from('settlement_records')
      .select('*')
      .eq('idempotency_key', idemKey)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return { settlement: existing as SettlementRecordRow, alreadyExists: true };

    // Phase 1 fix (continued): settlement_records has NO school_id column;
    // tenant scope is derived through the parent payment transaction. The
    // insert previously sent a phantom school_id (42703 at runtime).
    const { data, error } = await supabase
      .from('settlement_records')
      .insert({
        payment_transaction_id: paymentTransactionId,
        destination: 'school',
        account_number: account.account_number,
        bank_name: account.bank_name || null,
        settlement_account_id: account.id,
        amount: amountMinor / 100,
        status: 'PENDING',
        idempotency_key: idemKey,
        raw_response: { reference: (payment as { reference?: string }).reference },
      })
      .select()
      .single();
    if (error) throw error;

    await audit(schoolId, actorId, 'SETTLEMENT_CREATED', 'settlement_records', (data as SettlementRecordRow).id, {
      payment_transaction_id: paymentTransactionId,
      amount_minor: amountMinor,
      account_number_last4: account.account_number?.slice(-4),
    });

    return { settlement: data as SettlementRecordRow, alreadyExists: false };
  }

  /**
   * Mark a settlement as completed or failed (server-side).
   */
  async updateSettlementStatus({ settlementId, schoolId, status, actorId, failureReason }: UpdateSettlementStatusParams): Promise<SettlementRecordRow> {
    const { data: settlement, error } = await supabase
      .from('settlement_records')
      .select('*')
      .eq('id', settlementId)
      // Tenant isolation via the parent payment transaction.
      .eq('payment_transactions.school_id', schoolId)
      .single();
    if (error || !settlement) throw Object.assign(new Error('Settlement not found.'), { statusCode: 404 }) as AppError;
    const row = settlement as SettlementRecordRow;

    // Phase 1 fix: settlement_records has no updated_at column (the legacy
    // patch failed with 42703 before ever updating status). The status change
    // itself remains the authoritative mutation; the accompanying audit_logs
    // entry records who/when.
    const patch: Record<string, unknown> = { status };
    if (status === 'FAILED' && failureReason) patch.failure_reason = failureReason;

    const { data: updated, error: updateError } = await supabase
      .from('settlement_records')
      .update(patch)
      .eq('id', settlementId)
      .eq('payment_transactions.school_id', schoolId)
      .select()
      .single();
    if (updateError) throw updateError;

    await audit(schoolId, actorId, status === 'SUCCESS' ? 'SETTLEMENT_COMPLETED' : 'SETTLEMENT_FAILED', 'settlement_records', settlementId, {
      payment_transaction_id: row.payment_transaction_id,
      amount_minor: row.amount ? Math.round(row.amount * 100) : null,
      account_number_last4: row.account_number?.slice(-4) || null,
      failure_reason: failureReason || null,
    });

    return updated as SettlementRecordRow;
  }

  /**
   * Settlement history for a school.
   */
  async listSettlements(schoolId: string, { limit = 100 }: { limit?: number } = {}): Promise<Array<Omit<SettlementRecordRow, 'account_number'> & { account_number: undefined; account_number_last4: string | null; created_at: string | null }>> {
    // Phase 1 fix: settlement_records has NO created_at/updated_at columns
    // (only settled_at). The wire contract keeps the `created_at` key —
    // sourced from settled_at (the settlement's completion time) so the
    // frontend (SettlementsView) is unaffected. PENDING rows have no settled_at
    // yet and surface as null, ordered deterministically last.
    const { data, error } = await supabase
      .from('settlement_records')
      .select('id, payment_transaction_id, destination, amount, status, settled_at, failure_reason, payment_transactions(reference, student_id)')
      // Tenant isolation via the parent payment transaction (no school_id
      // column exists on settlement_records).
      .eq('payment_transactions.school_id', schoolId)
      .order('settled_at', { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw error;

    // Mask account numbers.
    return ((data || []) as unknown as SettlementRecordRow[]).map((s) => ({
      ...s,
      created_at: s.settled_at,
      account_number_last4: s.account_number?.slice(-4) || null,
      account_number: undefined,
    })) as Array<Omit<SettlementRecordRow, 'account_number'> & { account_number: undefined; account_number_last4: string | null; created_at: string | null }>;
  }

  /**
   * Settlement summary for a school.
   */
  async summary(schoolId: string): Promise<{ total: number; pending: number; successful: number; failed: number; settled_minor: number }> {
    const { data, error } = await supabase
      .from('settlement_records')
      .select('status, amount, payment_transactions!inner(school_id)')
      // Tenant isolation via the parent payment transaction.
      .eq('payment_transactions.school_id', schoolId);
    if (error) throw error;

    const records = (data || []) as Array<Pick<SettlementRecordRow, 'status' | 'amount'>>;
    const sumMinor = (arr: typeof records) => Math.round(arr.reduce((acc, r) => acc + Number(r.amount || 0), 0) * 100);

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
