/**
 * PaymentActivationService — the trusted gate to payment_status = READY.
 *
 * The ONLY backend path that transitions a school to payment-ready is the
 * activate_payments() SECURITY DEFINER RPC (migration 024), which enforces:
 *   school.status == ACTIVE
 *   KYC == VERIFIED
 *   settlement account == VERIFIED
 *   gateway == ASSIGNED
 *
 * No Vue component or route may set payment_status = READY directly.
 */
import { supabase } from '../supabaseClient.js';
import type { AppError } from '../types/http.js';

export interface ReadinessConditions {
  schoolActive: boolean;
  kycVerified: boolean;
  settlementVerified: boolean;
  gatewayAssigned: boolean;
}

export interface ReadinessResult {
  ready: boolean;
  reason: string | null;
  school: {
    id: string;
    status: unknown;
    paymentStatus: unknown;
  } | null;
  conditions?: ReadinessConditions;
}

class PaymentActivationService {
  /**
   * Inspect the readiness preconditions without mutating state.
   */
  async checkReadiness(schoolId: string): Promise<ReadinessResult> {
    const { data: school, error } = await supabase
      .from('schools')
      .select('id, status, payment_status')
      .eq('id', schoolId)
      .single();
    if (error || !school) return { ready: false, reason: 'SCHOOL_NOT_FOUND', school: null };

    const s = school as { id: string; status?: unknown; payment_status?: unknown };
    const conditions: ReadinessConditions = {
      schoolActive: s.status === 'ACTIVE',
      kycVerified: false,
      settlementVerified: false,
      gatewayAssigned: false,
    };

    const [{ data: kyc }, { data: settlement }, { data: gateway }] = await Promise.all([
      supabase.from('kyc_records').select('status').eq('school_id', schoolId).maybeSingle(),
      supabase.from('settlement_accounts').select('status').eq('school_id', schoolId).eq('status', 'VERIFIED').maybeSingle(),
      supabase.from('gateway_assignments').select('status').eq('school_id', schoolId).in('status', ['ASSIGNED', 'ACTIVE']).maybeSingle(),
    ]);

    conditions.kycVerified = (kyc as { status?: unknown } | null)?.status === 'VERIFIED';
    conditions.settlementVerified = Boolean(settlement);
    conditions.gatewayAssigned = Boolean(gateway);

    const allTrue = Object.values(conditions).every(Boolean);
    const missing = Object.entries(conditions)
      .filter(([, v]) => !v)
      .map(([k]) => k);

    return {
      ready: allTrue,
      reason: allTrue ? null : `PAYMENT_ACTIVATION_REQUIRED: ${missing.join(', ')}`,
      school: {
        id: s.id,
        status: s.status,
        paymentStatus: s.payment_status,
      },
      conditions,
    };
  }

  /**
   * Transition a school to payment-ready (idempotent).
   * Returns { activated, alreadyReady } — never throws on already-ready.
   */
  async activatePayments(schoolId: string): Promise<{ activated: boolean; alreadyReady: boolean; paymentStatus: unknown }> {
    if (!schoolId) throw new Error('schoolId is required');

    const { data, error } = await supabase.rpc('activate_payments', {
      p_school_id: schoolId,
    });

    if (error) {
      const err = Object.assign(new Error(error.message), {
        code: error.message.includes('PAYMENT_ACTIVATION_REQUIRED')
          ? 'PAYMENT_ACTIVATION_REQUIRED'
          : 'ACTIVATION_FAILED',
        statusCode: 403,
      }) as AppError;
      throw err;
    }

    const result = (data ?? {}) as { success?: boolean; already_ready?: boolean; payment_status?: unknown };

    return {
      activated: result.success === true,
      alreadyReady: result.already_ready === true,
      paymentStatus: result.payment_status,
    };
  }

  /**
   * Suspend a READY school (staff/admin action). Idempotent.
   */
  async suspendPayments(schoolId: string, actorId?: string | null): Promise<{ suspended: boolean; alreadySuspended: boolean }> {
    const { data: school, error: fetchError } = await supabase
      .from('schools')
      .select('payment_status')
      .eq('id', schoolId)
      .single();
    if (fetchError || !school) throw new Error('School not found');

    const paymentStatus = (school as { payment_status?: string }).payment_status;

    if (paymentStatus === 'SUSPENDED') {
      return { suspended: true, alreadySuspended: true };
    }
    if (paymentStatus !== 'READY') {
      const err = Object.assign(new Error('Only READY schools can be suspended.'), {
        code: 'INVALID_STATE',
        statusCode: 400,
      }) as AppError;
      throw err;
    }

    const { error } = await supabase
      .from('schools')
      .update({ payment_status: 'SUSPENDED' })
      .eq('id', schoolId);
    if (error) throw error;

    await supabase.from('audit_logs').insert({
      school_id: schoolId,
      actor_id: actorId || null,
      action: 'PAYMENT_SUSPENDED',
      entity: 'school',
      entity_id: schoolId,
      metadata: { payment_status: 'SUSPENDED' },
    });

    return { suspended: true, alreadySuspended: false };
  }
}

export { PaymentActivationService };
export default new PaymentActivationService();
