/**
 * Payments Route — payment transaction read/query + intent + reversal.
 *
 * GET    /api/payments               list payments (school-scoped)
 * GET    /api/payments/:id           payment detail
 * GET    /api/payments/student/:studentId
 * GET    /api/payments/summary       dashboard summary
 * POST   /api/payments/intent        create a PENDING payment intent
 * POST   /api/payments/:id/reverse   reverse a SUCCESS payment (staff)
 *
 * The browser may create an intent but NEVER set SUCCESS. Success originates
 * from the verified webhook pipeline or server-side gateway verification.
 */
import { Router, Request, Response } from 'express';
import { supabase } from '../supabaseClient.js';
import requireAuthSupabase from '../middleware/requireAuthSupabase.js';
import requirePaymentReady from '../middleware/requirePaymentReady.js';
import { requireStaff } from '../middleware/staffAuth.js';
import PaymentService from '../services/PaymentService.js';
import { errorMessage, errorStatusCode } from '../types/http.js';
import type { PaymentTransactionRow, StudentRow } from '../types/db.js';

const router = Router();

// Phase 4: Switch to Supabase Auth (JWT Bearer token).
router.use(requireAuthSupabase);

const handleError = (res: Response, error: unknown, fallbackStatus = 500): Response => {
  const status = errorStatusCode(error) || fallbackStatus;
  const message = errorMessage(error) || 'Internal server error';
  return res.status(status).json({ error: message });
};

async function getCallerSchool(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('school_members')
    .select('school_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();
  if (error || !data) return null;
  return (data as { school_id: string }).school_id;
}

// GET /api/payments
router.get('/', async (req: Request, res: Response) => {
  try {
    const schoolId = await getCallerSchool(req.user.id);
    if (!schoolId) return res.status(403).json({ error: 'No active school membership.' });

    const { studentId, status } = req.query as { studentId?: string; status?: string };
    const payments = await PaymentService.listPayments(schoolId, {
      studentId: studentId || undefined,
      status: status || undefined,
    });
    return res.json({ success: true, data: payments });
  } catch (error) {
    return handleError(res, error);
  }
});

// GET /api/payments/summary
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const schoolId = await getCallerSchool(req.user.id);
    if (!schoolId) return res.status(403).json({ error: 'No active school membership.' });

    const summary = await PaymentService.summary(schoolId);
    return res.json({ success: true, data: summary });
  } catch (error) {
    return handleError(res, error);
  }
});

// GET /api/payments/student/:studentId
router.get('/student/:studentId', async (req: Request, res: Response) => {
  try {
    const schoolId = await getCallerSchool(req.user.id);
    if (!schoolId) return res.status(403).json({ error: 'No active school membership.' });

    // Verify the student belongs to the caller's school.
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('id', req.params.studentId)
      .eq('school_id', schoolId)
      .single();
    if (studentError || !student) return res.status(404).json({ error: 'Student not found in this school.' });

    const payments = await PaymentService.listPayments(schoolId, { studentId: req.params.studentId });
    return res.json({ success: true, data: payments });
  } catch (error) {
    return handleError(res, error);
  }
});

// GET /api/payments/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const schoolId = await getCallerSchool(req.user.id);
    if (!schoolId) return res.status(403).json({ error: 'No active school membership.' });

    // Phase 1 fix: no created_at column exists; verified_at is the row-creation
    // timestamp (migration 0025). The response keeps the `created_at` key —
    // sourced from verified_at — so the API contract is preserved.
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('id, school_id, student_id, reference, gateway_txn_ref, amount_minor, currency, status, entry_category, payment_method, failure_reason, reversed_at, verified_at, students(first_name, last_name, class_name)')
      .eq('id', req.params.id)
      .eq('school_id', schoolId)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Payment not found.' });

    const row = data as unknown as PaymentTransactionRow;
    return res.json({
      success: true,
      data: { ...row, created_at: row.verified_at },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// POST /api/payments/intent — create a PENDING intent (requires READY)
router.post('/intent', requirePaymentReady, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { student_id, amount_minor, currency, reference, payment_method } = body;

  if (!student_id || !amount_minor) {
    return res.status(400).json({ error: 'student_id and amount_minor are required' });
  }

  try {
    const schoolId = await getCallerSchool(req.user.id);
    if (!schoolId) return res.status(403).json({ error: 'No active school membership.' });

    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('id', student_id as string)
      .eq('school_id', schoolId)
      .single();
    if (!student) return res.status(404).json({ error: 'Student not found in this school.' });

    const payment = await PaymentService.createPaymentIntent({
      schoolId,
      studentId: student_id as string,
      amountMinor: Number(amount_minor),
      currency: (currency as string) || 'NGN',
      reference: reference as string | undefined,
      paymentMethod: (payment_method as string | null) ?? null,
      actorId: req.user.id,
    });

    return res.status(201).json({ success: true, data: payment });
  } catch (error) {
    return handleError(res, error);
  }
});

// POST /api/payments/:id/reverse — reverse a SUCCESS payment (staff only)
router.post('/:id/reverse', requireStaff('payment.reconcile'), async (req: Request, res: Response) => {
  try {
    const schoolId = await getCallerSchool(req.user.id);
    if (!schoolId) return res.status(403).json({ error: 'No active school membership.' });

    const payment = await PaymentService.transition(req.params.id as string, schoolId, 'REVERSED', {
      actorId: req.user.id,
    });

    return res.json({ success: true, data: payment });
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;
