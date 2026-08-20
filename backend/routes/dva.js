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
import express from 'express';
import { supabase } from '../supabaseClient.js';
import requireAuthSupabase from '../middleware/requireAuthSupabase.js';
import requirePaymentReady from '../middleware/requirePaymentReady.js';
import { DVAService } from '../services/DVAService.js';
import { audit } from '../services/auditService.js';

const router = express.Router();
// Phase 4: Switch to Supabase Auth (JWT Bearer token).
router.use(requireAuthSupabase);

const handleError = (res, error, fallbackStatus = 500) => {
  const status = error?.statusCode || fallbackStatus;
  const message = error?.message || 'Internal server error';
  return res.status(status).json({ error: message });
};

/**
 * Resolve the caller's active school membership.
 */
async function getCallerSchool(userId) {
  const { data, error } = await supabase
    .from('school_members')
    .select('school_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();
  if (error || !data) return null;
  return data.school_id;
}

/**
 * Verify a student belongs to the caller's school and is ACTIVE/eligible.
 */
async function verifyStudent(schoolId, studentId) {
  const { data, error } = await supabase
    .from('students')
    .select('id')
    .eq('id', studentId)
    .eq('school_id', schoolId)
    .eq('status', 'ACTIVE')
    .single();
  if (error || !data) return false;
  return true;
}

// POST /api/dva/provision
router.post('/provision', requirePaymentReady, async (req, res) => {
  const { student_id, idempotency_key } = req.body || {};

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

    const result = await DVAService.provisionDVA({
      schoolId,
      studentId: student_id,
      actorId: req.user.id,
      idempotencyKey: idempotency_key,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
});

// POST /api/dva/bulk-provision
router.post('/bulk-provision', requirePaymentReady, async (req, res) => {
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

    const results = [];
    for (const student of students) {
      try {
        const result = await DVAService.provisionDVA({
          schoolId,
          studentId: student.id,
          actorId: req.user.id,
        });
        results.push({ student_id: student.id, ...result });
      } catch (err) {
        results.push({ student_id: student.id, success: false, error: err.message });
      }
    }

    return res.json({
      success: true,
      data: {
        total: students.length,
        processed: results.filter((r) => r.success).length,
        results,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// GET /api/dva — list DVAs for the caller's school
router.get('/', async (req, res) => {
  try {
    const schoolId = await getCallerSchool(req.user.id);
    if (!schoolId) return res.status(403).json({ error: 'No active school membership.' });

    const { data, error } = await supabase
      .from('payment_accounts')
      .select('id, student_id, provider, virtual_account_number, bank_name, account_name, status, account_status, is_primary, created_at, updated_at')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    // Mask virtual account numbers to last 4.
    const masked = (data || []).map((d) => ({
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
router.get('/:id', async (req, res) => {
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

    return res.json({
      success: true,
      data: {
        ...data,
        virtual_account_number_last4: data.virtual_account_number?.slice(-4) || null,
        virtual_account_number: undefined,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// POST /api/dva/:id/deactivate
router.post('/:id/deactivate', requirePaymentReady, async (req, res) => {
  try {
    const schoolId = await getCallerSchool(req.user.id);
    if (!schoolId) return res.status(403).json({ error: 'No active school membership.' });

    const result = await DVAService.deactivateDVA({
      accountId: req.params.id,
      schoolId,
      actorId: req.user.id,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;
