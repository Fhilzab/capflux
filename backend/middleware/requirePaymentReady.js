/**
 * requirePaymentReady — payment-readiness guard for payment-sensitive routes.
 *
 * Enforces (server-side, never relies on the Vue overlay):
 *   authenticated session (requireAuth)
 *   school scope (from membership, not headers)
 *   school.status === ACTIVE
 *   school.payment_status === READY
 *
 * When not ready: 403 PAYMENT_ACTIVATION_REQUIRED.
 */
import { supabase } from '../supabaseClient.js';

export async function requirePaymentReady(req, res, next) {
  try {
    const { data: member, error } = await supabase
      .from('school_members')
      .select('school_id')
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .single();

    if (error || !member) {
      return res.status(403).json({ error: 'No active school membership.' });
    }

    // School scope in the request body must match the caller's membership.
    const requestedSchoolId = req.body?.school_id || req.query?.school_id;
    if (requestedSchoolId && requestedSchoolId !== member.school_id) {
      return res.status(403).json({ error: 'Cross-school access is not permitted.' });
    }

    const { data: school } = await supabase
      .from('schools')
      .select('status, payment_status')
      .eq('id', member.school_id)
      .single();

    if (!school) {
      return res.status(404).json({ error: 'School not found.' });
    }
    if (school.status !== 'ACTIVE' || school.payment_status !== 'READY') {
      return res.status(403).json({
        error: 'PAYMENT_ACTIVATION_REQUIRED',
        message: 'Payment collection is not activated for this school.',
      });
    }

    req.schoolId = member.school_id;
    return next();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export default requirePaymentReady;
