/**
 * Financial Operations Routes — reconciliation + settlement.
 *
 * Reconciliation (staff): run, status, resolve issue.
 * Settlement (school + staff): history, detail, summary.
 */
import express from 'express';
import { supabase } from '../supabaseClient.js';
import requireAuth from '../middleware/requireAuth.js';
import { requireStaff } from '../middleware/staffAuth.js';
import { reconciliationService } from '../services/ReconciliationService.js';
import SettlementService from '../services/SettlementService.js';

const router = express.Router();
router.use(requireAuth);

const handleError = (res, error, fallbackStatus = 500) => {
  const status = error?.statusCode || fallbackStatus;
  const message = error?.message || 'Internal server error';
  return res.status(status).json({ error: message });
};

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

// ==========================================================
// RECONCILIATION
// ==========================================================

// POST /api/reconciliation/run — staff runs reconciliation for a school
router.post('/reconciliation/run', requireStaff('payments.reconcile'), async (req, res) => {
  const { schoolId, startDate, endDate, provider } = req.body || {};
  if (!schoolId || !startDate || !endDate) {
    return res.status(400).json({ error: 'schoolId, startDate, and endDate are required' });
  }

  try {
    const result = await reconciliationService.reconcilePayments({
      schoolId,
      startDate,
      endDate,
      provider,
      actorId: req.user.id,
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
});

// GET /api/reconciliation — status + open issues for the caller's school
router.get('/reconciliation', async (req, res) => {
  try {
    const schoolId = await getCallerSchool(req.user.id);
    if (!schoolId) return res.status(403).json({ error: 'No active school membership.' });

    const result = await reconciliationService.getReconciliationStatus(schoolId);
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
});

// POST /api/reconciliation/issues/:id/resolve — staff resolves an issue
router.post('/reconciliation/issues/:id/resolve', requireStaff('payments.reconcile'), async (req, res) => {
  try {
    const schoolId = await getCallerSchool(req.user.id);
    if (!schoolId) return res.status(403).json({ error: 'No active school membership.' });

    const result = await reconciliationService.resolveIssue(req.params.id, schoolId, req.user.id);
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// SETTLEMENT
// ==========================================================

// GET /api/settlements — history for the caller's school
router.get('/settlements', async (req, res) => {
  try {
    const schoolId = await getCallerSchool(req.user.id);
    if (!schoolId) return res.status(403).json({ error: 'No active school membership.' });

    const result = await SettlementService.listSettlements(schoolId);
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
});

// GET /api/settlements/summary
router.get('/settlements/summary', async (req, res) => {
  try {
    const schoolId = await getCallerSchool(req.user.id);
    if (!schoolId) return res.status(403).json({ error: 'No active school membership.' });

    const result = await SettlementService.summary(schoolId);
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
});

// GET /api/settlements/:id
router.get('/settlements/:id', async (req, res) => {
  try {
    const schoolId = await getCallerSchool(req.user.id);
    if (!schoolId) return res.status(403).json({ error: 'No active school membership.' });

    const { data, error } = await supabase
      .from('settlement_records')
      .select('*')
      .eq('id', req.params.id)
      .eq('school_id', schoolId)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Settlement not found.' });

    return res.json({
      success: true,
      data: {
        ...data,
        account_number_last4: data.account_number?.slice(-4) || null,
        account_number: undefined,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;
