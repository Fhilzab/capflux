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

class PaymentActivationService {
  /**
   * Inspect the readiness preconditions without mutating state.
   */
  async checkReadiness(schoolId) {
    const { data: school, error } = await supabase
      .from('schools')
      .select('id, status, payment_status')
      .eq('id', schoolId)
      .single();
    if (error || !school) return { ready: false, reason: 'SCHOOL_NOT_FOUND', school: null };

    const conditions = {
      schoolActive: school.status === 'ACTIVE',
      kycVerified: false,
      settlementVerified: false,
      gatewayAssigned: false,
    };

    const [{ data: kyc }, { data: settlement }, { data: gateway }] = await Promise.all([
      supabase.from('kyc_records').select('status').eq('school_id', schoolId).maybeSingle(),
      supabase.from('settlement_accounts').select('status').eq('school_id', schoolId).eq('status', 'VERIFIED').maybeSingle(),
      supabase.from('gateway_assignments').select('status').eq('school_id', schoolId).in('status', ['ASSIGNED', 'ACTIVE']).maybeSingle(),
    ]);

    conditions.kycVerified = kyc?.status === 'VERIFIED';
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
        id: school.id,
        status: school.status,
        paymentStatus: school.payment_status,
      },
      conditions,
    };
  }

  /**
   * Transition a school to payment-ready (idempotent).
   * Returns { activated, alreadyReady } — never throws on already-ready.
   */
  async activatePayments(schoolId) {
    if (!schoolId) throw new Error('schoolId is required');

    const { data, error } = await supabase.rpc('activate_payments', {
      p_school_id: schoolId,
    });

    if (error) {
      const err = new Error(error.message);
      err.code = error.message.includes('PAYMENT_ACTIVATION_REQUIRED')
        ? 'PAYMENT_ACTIVATION_REQUIRED'
        : 'ACTIVATION_FAILED';
      err.statusCode = 403;
      throw err;
    }

    return {
      activated: data?.success === true,
      alreadyReady: data?.already_ready === true,
      paymentStatus: data?.payment_status,
    };
  }

  /**
   * Suspend a READY school (staff/admin action). Idempotent.
   */
  async suspendPayments(schoolId, actorId) {
    const { data: school, error: fetchError } = await supabase
      .from('schools')
      .select('payment_status')
      .eq('id', schoolId)
      .single();
    if (fetchError || !school) throw new Error('School not found');

    if (school.payment_status === 'SUSPENDED') {
      return { suspended: true, alreadySuspended: true };
    }
    if (school.payment_status !== 'READY') {
      const err = new Error('Only READY schools can be suspended.');
      err.code = 'INVALID_STATE';
      err.statusCode = 400;
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
