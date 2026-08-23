/**
 * DVA Route — canonical Dedicated Virtual Account lifecycle.
 *
 * POST   /api/dva/provision           provision DVA for a student
 * POST   /api/dva/bulk-provision       provision for all eligible students
 * GET    /api/dva                      list DVAs for the caller's school
 * GET    /api/dva/:id                  get one DVA
 * POST   /api/dva/:id/deactivate       disable an ACTIVE DVA
 *
 * Every operation:
 *   - authenticates via requireAuthSupabase (Bearer JWT token)
 *   - resolves school membership server-side (never from headers)
 *   - verifies school ACTIVE + payment_status READY
 *   - verifies the student belongs to the school
 *   - uses the CAPFLUX-assigned gateway (gateway_assignments)
 *   - is idempotent (DB key + provider ref recovery)
 */
import { Router, Request, Response } from 'express';
import { supabase } from '../supabaseClient.js';
import requireAuthSupabase from '../middleware/requireAuthSupabase.js';
import requirePaymentReady from '../middleware/requirePaymentReady.js';
// Migration fix (approved): the original JavaScript did
// `import { DVAService }` (the CLASS) and called instance methods on it, so
// every request to this router threw "DVAService.provisionDVA is not a
// function" -> HTTP 500. The singleton instance (default export) was always
// the evident intent; it is used here so the documented contract works.
import dvaService from '../services/DVAService.js';
import { audit } from '../services/auditService.js'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { errorMessage, errorStatusCode } from '../types/http.js';

const router = Router();
// Phase 4: Switch to Supabase Auth (JWT Bearer token).
router.use(requireAuthSupabase);

const handleError = (res: Response, error: unknown, fallbackStatus = 500): Response => {
  const status = errorStatusCode(error) || fallbackStatus;
  const message = errorMessage(error) || 'Internal server error';
  return res.status(status).json({ error: message });
};

/**
 * Resolve the caller's active school membership.
 */
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

/**
 * Verify a student belongs to the caller's school and is ACTIVE/eligible.
 */
async function verifyStudent(schoolId: string, studentId: unknown): Promise<boolean> {
  const { data, error } = await supabase
    .from('students')
    .select('id')
    .eq('id', studentId as string)
    .eq('school_id', schoolId)
    .eq('status', 'ACTIVE')
    .single();
  if (error || !data) return false;
  return true;
}

// POST /api/dva/provision
router.post('/provision', requirePaymentReady, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { student_id, idempotency_key } = body;

  if (!student_id) {
    return res.status(400).json({ error: 'student_id is required' });
  }

  try {
    const schoolId = await getCallerSchool(req.user.id);
    if (!schoolId) return res.status(403).json({ error: 'No active school membership.' });

    const studentOk = await verifyStudent(schoolId, student_id);
    if (!studentOk) {
      return res.status(404).json({ error: 'Student not found or not active in this school.' });
    }

    const result = await dvaService.provisionDVA({
      schoolId,
      studentId: student_id as string,
      actorId: req.user.id,
      idempotencyKey: idempotency_key as string | undefined,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
});

// POST /api/dva/bulk-provision
router.post('/bulk-provision', requirePaymentReady, async (req: Request, res: Response) => {
  try {
    const schoolId = await getCallerSchool(req.user.id);
    if (!schoolId) return res.status(403).json({ error: 'No active school membership.' });

    // All active students in the school.
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id')
      .eq('school_id', schoolId)
      .eq('status', 'ACTIVE');
    if (studentsError) return res.status(500).json({ error: studentsError.message });

    const rows = (students ?? []) as Array<{ id: string }>;
    const results: Array<Record<string, unknown>> = [];
    for (const student of rows) {
      try {
        const result = await dvaService.provisionDVA({
          schoolId,
          studentId: student.id,
          actorId: req.user.id,
        });
        results.push({ student_id: student.id, ...result });
      } catch (err) {
        results.push({ student_id: student.id, success: false, error: errorMessage(err) });
      }
    }

    return res.json({
      success: true,
      data: {
        total: rows.length,
        processed: results.filter((r) => r.success).length,
        results,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// GET /api/dva — list DVAs for the caller's school
router.get('/', async (_req: Request, res: Response) => {
  try {
    const schoolId = await getCallerSchool(_req.user.id);
    if (!schoolId) return res.status(403).json({ error: 'No active school membership.' });

    const { data, error } = await supabase
      .from('payment_accounts')
      .select('id, student_id, provider, virtual_account_number, bank_name, account_name, status, account_status, is_primary, created_at, updated_at')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    // Mask virtual account numbers to last 4.
    const masked = ((data ?? []) as Array<{ virtual_account_number?: string | null } & Record<string, unknown>>).map((d) => ({
      ...d,
      virtual_account_number_last4: d.virtual_account_number?.slice(-4) || null,
      virtual_account_number: undefined,
    }));

    return res.json({ success: true, data: masked });
  } catch (error) {
    return handleError(res, error);
  }
});

// GET /api/dva/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const schoolId = await getCallerSchool(req.user.id);
    if (!schoolId) return res.status(403).json({ error: 'No active school membership.' });

    const { data, error } = await supabase
      .from('payment_accounts')
      .select('id, student_id, provider, virtual_account_number, bank_name, account_name, status, account_status, is_primary, created_at, updated_at, students(first_name, last_name, class_name)')
      .eq('id', req.params.id)
      .eq('school_id', schoolId)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Payment account not found.' });

    const row = data as { virtual_account_number?: string | null } & Record<string, unknown>;

    return res.json({
      success: true,
      data: {
        ...row,
        virtual_account_number_last4: row.virtual_account_number?.slice(-4) || null,
        virtual_account_number: undefined,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// POST /api/dva/:id/deactivate
router.post('/:id/deactivate', requirePaymentReady, async (req: Request, res: Response) => {
  try {
    const schoolId = await getCallerSchool(req.user.id);
    if (!schoolId) return res.status(403).json({ error: 'No active school membership.' });

    const result = await dvaService.deactivateDVA({
      accountId: req.params.id as string,
      schoolId,
      actorId: req.user.id,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;
