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
import type { NextFunction, Request, Response } from 'express';
import { supabase } from '../supabaseClient.js';
import { errorMessage } from '../types/http.js';
import type { SchoolMemberRow, SchoolRow } from '../types/db.js';

export async function requirePaymentReady(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
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
    const requestedSchoolId =
      (req.body as Record<string, unknown> | undefined)?.school_id ?? req.query.school_id;
    if (requestedSchoolId && requestedSchoolId !== (member as Pick<SchoolMemberRow, 'school_id'>).school_id) {
      return res.status(403).json({ error: 'Cross-school access is not permitted.' });
    }

    const { data: school } = await supabase
      .from('schools')
      .select('status, payment_status')
      .eq('id', (member as Pick<SchoolMemberRow, 'school_id'>).school_id)
      .single();

    const schoolRow = school as Pick<SchoolRow, 'status' | 'payment_status'> | null;

    if (!schoolRow) {
      return res.status(404).json({ error: 'School not found.' });
    }
    if (schoolRow.status !== 'ACTIVE' || schoolRow.payment_status !== 'READY') {
      return res.status(403).json({
        error: 'PAYMENT_ACTIVATION_REQUIRED',
        message: 'Payment collection is not activated for this school.',
      });
    }

    req.schoolId = (member as Pick<SchoolMemberRow, 'school_id'>).school_id;
    return next();
  } catch (err) {
    return res.status(500).json({ error: errorMessage(err) });
  }
}

export default requirePaymentReady;
