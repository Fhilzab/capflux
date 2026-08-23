/**
 * Financial Operations Routes — reconciliation + settlement.
 *
 * Reconciliation (staff): run, status, resolve issue.
 * Settlement (school + staff): history, detail, summary.
 */
import { Router, Request, Response } from 'express';
import { supabase } from '../supabaseClient.js';
import requireAuthSupabase from '../middleware/requireAuthSupabase.js';
import { requireStaff } from '../middleware/staffAuth.js';
import { reconciliationService } from '../services/ReconciliationService.js';
import SettlementService from '../services/SettlementService.js';
import { errorMessage, errorStatusCode } from '../types/http.js';

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

// ==========================================================
// RECONCILIATION
// ==========================================================

// POST /api/reconciliation/run — staff runs reconciliation for a school
router.post('/reconciliation/run', requireStaff('payments.reconcile'), async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { schoolId, startDate, endDate, provider } = body;
  if (!schoolId || !startDate || !endDate) {
    return res.status(400).json({ error: 'schoolId, startDate, and endDate are required' });
  }

  try {
    const result = await reconciliationService.reconcilePayments({
      schoolId: schoolId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      provider: provider as string | null | undefined,
      actorId: req.user.id,
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
});

// GET /api/reconciliation — status + open issues for the caller's school
router.get('/reconciliation', async (req: Request, res: Response) => {
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
router.post('/reconciliation/issues/:id/resolve', requireStaff('payments.reconcile'), async (req: Request, res: Response) => {
  try {
    const schoolId = await getCallerSchool(req.user.id);
    if (!schoolId) return res.status(403).json({ error: 'No active school membership.' });

    const result = await reconciliationService.resolveIssue(req.params.id as string, schoolId, req.user.id);
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// SETTLEMENT
// ==========================================================

// GET /api/settlements — history for the caller's school
router.get('/settlements', async (req: Request, res: Response) => {
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
router.get('/settlements/summary', async (req: Request, res: Response) => {
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
router.get('/settlements/:id', async (req: Request, res: Response) => {
  try {
    const schoolId = await getCallerSchool(req.user.id);
    if (!schoolId) return res.status(403).json({ error: 'No active school membership.' });

    const { data, error } = await supabase
      .from('settlement_records')
      .select('*, payment_transactions!inner(school_id)')
      .eq('id', req.params.id as string)
      // Tenant isolation via the parent payment transaction.
      .eq('payment_transactions.school_id', schoolId)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Settlement not found.' });

    const row = data as { account_number?: string | null } & Record<string, unknown>;

    return res.json({
      success: true,
      data: {
        ...row,
        account_number_last4: row.account_number?.slice(-4) || null,
        account_number: undefined,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;
