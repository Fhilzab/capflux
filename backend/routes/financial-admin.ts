/**
 * Financial Admin Routes — CAPFLUX staff operations for financial activation.
 *
 * Staff review workflows (KYC review, settlement verification, gateway
 * assignment, payment activation). Every endpoint requires:
 *   requireAuthSupabase (verified Supabase JWT)
 *   requireStaff(permission) (platform staff permission)
 *
 * Identity/school scope is NEVER taken from client headers; the target school
 * is resolved from the KYC/settlement/assignment record.
 */
import { Router, Request, Response } from 'express';
import { supabase } from '../supabaseClient.js';
import requireAuthSupabase from '../middleware/requireAuthSupabase.js';
import { requireStaff } from '../middleware/staffAuth.js';
import { decryptField, maskIdentifier } from '../services/cryptoFields.js';
import identityVerificationService from '../services/IdentityVerificationService.js';
import settlementVerificationService from '../services/SettlementVerificationService.js';
import gatewayAssignmentService from '../services/GatewayAssignmentService.js';
import paymentActivationService from '../services/PaymentActivationService.js';
import { isValidCacNumber } from '../services/validators.js';
import { getCacSignedUrl } from '../services/storage.js';
import {
  compareIdentityAgainstSubmission,
  evaluateSettlementEligibility,
  FieldState,
  sanitizeIdentityResult,
} from '../services/verification-matching.js';
import { errorMessage } from '../types/http.js';
import type { KycRecordRow, SettlementAccountRow } from '../types/db.js';

const router = Router();
// Phase 4: Switch to Supabase Auth (JWT Bearer token).
router.use(requireAuthSupabase);

const handleError = (res: Response, error: unknown, fallbackStatus = 500): Response => {
  const status = (error as { statusCode?: number })?.statusCode || fallbackStatus;
  const message = errorMessage(error) || 'Internal server error';
  return res.status(status).json({ error: message });
};

async function audit(schoolId: string | null, actorId: string | null, action: string, entity: string, entityId: string | null | undefined, metadata: Record<string, unknown> = {}): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      school_id: schoolId,
      actor_id: actorId,
      action,
      entity,
      entity_id: entityId as string | null,
      metadata: JSON.stringify(metadata),
    });
  } catch (err) {
    console.error('audit failed:', errorMessage(err));
  }
}

type KycForReview = KycRecordRow & {
  _verifications: Record<string, unknown>[];
  _settlement: SettlementAccountRow | null;
};

/**
 * Load a KYC record with its school and verification rows.
 * Returns null when not found. Never returns raw NIN/BVN to the caller.
 */
async function loadKycForReview(kycId: string): Promise<KycForReview | null> {
  const { data, error } = await supabase
    .from('kyc_records')
    .select('*, schools!inner(id, name, organization_id, owner_user_id), organizations!inner(name)')
    .eq('id', kycId)
    .single();
  if (error) return null;

  const row = data as unknown as Pick<KycRecordRow, 'school_id'>;

  const [verifications, settlement] = await Promise.all([
    supabase.from('kyc_verifications').select('*').eq('kyc_record_id', kycId),
    supabase
      .from('settlement_accounts')
      .select('*')
      .eq('school_id', row.school_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    ...(data as unknown as KycRecordRow),
    _verifications: (verifications.data ?? []) as Record<string, unknown>[],
    _settlement: (settlement.data ?? null) as SettlementAccountRow | null,
  };
}

// ==========================================================
// GET /api/admin/kyc — list KYC records (staff)
// ==========================================================
router.get('/kyc', requireStaff('kyc.view'), async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('kyc_records')
      .select('id, school_id, status, submitted_at, reviewed_at, reviewed_by, rejection_reason, principal_name, official_email, official_phone, cac_registration_number, bvn_last4, nin_last4, bvn_verification_status, nin_verification_status, cac_document_status, schools!inner(name, organization_id)')
      .order('submitted_at', { ascending: false })
      .limit(100);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data: data ?? [] });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// GET /api/admin/kyc/:id — KYC detail (staff, privileged)
// Includes masked identity, verification history, settlement, signed CAC URL.
// ==========================================================
router.get('/kyc/:id', requireStaff('kyc.view'), async (req: Request, res: Response) => {
  try {
    const kyc = await loadKycForReview(req.params.id as string);
    if (!kyc) return res.status(404).json({ error: 'KYC record not found' });

    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _verifications: _v,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _settlement: _s,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      bvn_encrypted: _bvn,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      nin_encrypted: _nin,
      cac_document_path,
      ...safe
    } = kyc;

    void _v; void _s; void _bvn; void _nin;

    // Privileged plaintext identity is NOT returned in the normal review
    // payload. Staff verify via the dedicated /verify endpoint which runs the
    // provider server-side. Only masked values are returned here.
    const signedUrl = cac_document_path
      ? await getCacSignedUrl(cac_document_path).catch(() => null)
      : null;

    const safeRow = safe as KycRecordRow & { bvn_last4?: string | null; nin_last4?: string | null };

    return res.json({
      success: true,
      data: {
        ...safeRow,
        bvn_masked: safeRow.bvn_last4 ? maskIdentifier(safeRow.bvn_last4, 0, 3) : null,
        nin_masked: safeRow.nin_last4 ? maskIdentifier(safeRow.nin_last4, 0, 3) : null,
        verification_history: (kyc._verifications || []).map((v) => {
          const vr = v as {
            id?: string; verification_type?: string; provider?: string; provider_reference?: string;
            status?: string; failure_reason?: string; verified_at?: string; verified_by?: string;
          };
          return {
            id: vr.id,
            verification_type: vr.verification_type,
            provider: vr.provider,
            provider_reference: vr.provider_reference,
            status: vr.status,
            failure_reason: vr.failure_reason,
            verified_at: vr.verified_at,
            verified_by: vr.verified_by,
          };
        }),
        settlement: kyc._settlement
          ? {
              id: kyc._settlement.id,
              status: kyc._settlement.status,
              bank_code: kyc._settlement.bank_code,
              bank_name: kyc._settlement.bank_name,
              account_number_last4: kyc._settlement.account_number?.slice(-4) || null,
              account_name: kyc._settlement.account_name,
              rejection_reason: kyc._settlement.rejection_reason,
            }
          : null,
        cac_document: signedUrl ? { signed_url: signedUrl.url } : null,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/admin/kyc/:id/verify — staff verifies identity + CAC, then approves
// ==========================================================
router.post('/kyc/:id/verify', requireStaff('kyc.verify'), async (req: Request, res: Response) => {
  try {
    const kyc = await loadKycForReview(req.params.id as string);
    if (!kyc) return res.status(404).json({ error: 'KYC record not found' });
    if (kyc.status !== 'UNDER_REVIEW' && kyc.status !== 'REJECTED') {
      return res.status(400).json({ error: `Cannot verify KYC in status ${kyc.status}` });
    }

    const schoolId = kyc.school_id;
    const actorId = req.user.id;

    await audit(schoolId, actorId, 'KYC_REVIEW_STARTED', 'kyc_record', kyc.id, {});

    // --- Identity verification (server-side provider, decrypt only here) ---
    const bvnPlain = decryptField(kyc.bvn_encrypted);
    const ninPlain = decryptField(kyc.nin_encrypted);

    type IdentityResultRecord = {
      type: string;
      verified: boolean;
      verificationStatus: string | undefined;
      reference: string | null;
      provider: string;
      failureReason: string | null;
      verifiedAt: string;
      verifiedFields: Record<string, unknown>;
      match: ReturnType<typeof compareIdentityAgainstSubmission>;
    } & Record<string, unknown>;

    const identityResults: IdentityResultRecord[] = [];

    // Legacy note: the financial-admin route passes `metadata:` while the
    // service reads `_metadata`; preserved verbatim (metadata was ignored).
    if (ninPlain) {
      const resNin = await identityVerificationService.verifyIdentity({ type: 'NIN', value: ninPlain, metadata: { name: kyc.principal_name } });
      const match = compareIdentityAgainstSubmission({
        submitted: { name: kyc.principal_name },
        verification: resNin,
      });
      identityResults.push({ type: 'NIN', ...sanitizeIdentityResult(resNin), match } as IdentityResultRecord);
      await audit(schoolId, actorId, resNin.verified ? 'NIN_VERIFICATION_SUCCESS' : 'NIN_VERIFICATION_FAILED', 'kyc_record', kyc.id, {
        provider: resNin.provider,
        provider_reference: resNin.reference,
        match: match.overall,
      });
    }
    if (bvnPlain) {
      const resBvn = await identityVerificationService.verifyIdentity({ type: 'BVN', value: bvnPlain, metadata: { name: kyc.principal_name } });
      const match = compareIdentityAgainstSubmission({
        submitted: { name: kyc.principal_name },
        verification: resBvn,
      });
      identityResults.push({ type: 'BVN', ...sanitizeIdentityResult(resBvn), match } as IdentityResultRecord);
      await audit(schoolId, actorId, resBvn.verified ? 'BVN_VERIFICATION_SUCCESS' : 'BVN_VERIFICATION_FAILED', 'kyc_record', kyc.id, {
        provider: resBvn.provider,
        provider_reference: resBvn.reference,
        match: match.overall,
      });
    }

    // Approval requires a confirmed identity MATCH (capability-aware). An explicit
    // MISMATCH or FAILED blocks approval; fields the provider cannot return are
    // NOT_PROVIDED / NOT_VERIFIED and do NOT produce false mismatches.
    const identityVerified = identityResults.some(
      (r) => r.verified && r.match.overall !== 'MISMATCH' && r.match.overall !== 'FAILED'
    );
    if (!identityVerified) {
      await audit(schoolId, actorId, 'KYC_REJECTED', 'kyc_record', kyc.id, {
        reason: 'IDENTITY_VERIFICATION_FAILED',
        matches: identityResults.map((r) => `${r.type}:${r.match.overall}`),
      });
      await supabase.from('kyc_records').update({
        status: 'REJECTED',
        rejection_reason: 'Identity verification failed.',
        reviewed_at: new Date().toISOString(),
        reviewed_by: actorId,
      }).eq('id', kyc.id);
      return res.status(400).json({
        error: 'KYC rejected: identity verification failed.',
        identityResults: identityResults.map((r) => ({
          type: r.type,
          verified: r.verified,
          verificationStatus: r.verificationStatus,
          provider: r.provider,
          provider_reference: r.reference,
          failureReason: r.failureReason,
          verifiedAt: r.verifiedAt,
          match: { overall: r.match.overall, fields: r.match.fields },
        })),
      });
    }

    // --- CAC verification ---
    const cacNumberValid = isValidCacNumber(kyc.cac_registration_number || '');
    const cacDocumentPresent = Boolean(kyc.cac_document_path);
    if (!cacNumberValid || !cacDocumentPresent) {
      await audit(schoolId, actorId, 'KYC_REJECTED', 'kyc_record', kyc.id, {
        reason: cacNumberValid ? 'CAC_DOCUMENT_MISSING' : 'CAC_NUMBER_INVALID',
      });
      await supabase.from('kyc_records').update({
        status: 'REJECTED',
        rejection_reason: cacNumberValid ? 'CAC certificate document is required.' : 'CAC registration number is invalid.',
        reviewed_at: new Date().toISOString(),
        reviewed_by: actorId,
      }).eq('id', kyc.id);
      return res.status(400).json({ error: 'KYC rejected: CAC verification failed.' });
    }

    // Record identity verification rows (idempotent per kyc record + type).
    for (const r of identityResults) {
      const idemKey = `kyc:${kyc.id}:${r.type}`;
      const matchOutcome =
        r.match.overall === 'MATCH' ? 'VERIFIED' :
        r.match.overall === 'MISMATCH' ? 'FAILED' :
        (r.verified ? 'VERIFIED' : 'FAILED');
      await supabase.from('kyc_verifications').upsert({
        kyc_record_id: kyc.id,
        school_id: schoolId,
        verification_type: r.type,
        provider: r.provider,
        provider_reference: r.reference,
        status: matchOutcome,
        failure_reason: r.failureReason,
        verified_at: r.verifiedAt,
        verified_by: actorId,
        idempotency_key: idemKey,
        raw_response: {},
        verified_fields: r.verifiedFields || {},
        comparison: { overall: r.match.overall, fields: r.match.fields },
      }, { onConflict: 'idempotency_key' });
    }

    // Mark KYC VERIFIED.
    await supabase.from('kyc_records').update({
      status: 'VERIFIED',
      reviewed_at: new Date().toISOString(),
      reviewed_by: actorId,
      rejection_reason: null,
      bvn_verification_status: identityResults.find((r) => r.type === 'BVN')?.match?.overall === 'MATCH' ? 'VERIFIED' : kyc.bvn_verification_status,
      nin_verification_status: identityResults.find((r) => r.type === 'NIN')?.match?.overall === 'MATCH' ? 'VERIFIED' : kyc.nin_verification_status,
      cac_document_status: 'VERIFIED',
      cac_verified_at: new Date().toISOString(),
      cac_verified_by: actorId,
      identity_verified_at: new Date().toISOString(),
      identity_verified_by: actorId,
      verified_at: new Date().toISOString(),
    }).eq('id', kyc.id);

    await audit(schoolId, actorId, 'KYC_VERIFIED', 'kyc_record', kyc.id, {
      identity_provider: identityResults[0]?.provider,
    });

    return res.json({ success: true, data: { identityResults } });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/admin/kyc/:id/reject — staff rejects with mandatory reason
// ==========================================================
router.post('/kyc/:id/reject', requireStaff('kyc.reject'), async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { reason } = body;
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return res.status(400).json({ error: 'A rejection reason (min 5 chars) is required.' });
    }

    const kyc = await loadKycForReview(req.params.id as string);
    if (!kyc) return res.status(404).json({ error: 'KYC record not found' });
    if (kyc.status === 'VERIFIED') {
      return res.status(400).json({ error: 'A verified KYC record cannot be rejected.' });
    }

    const schoolId = kyc.school_id;
    const actorId = req.user.id;

    await supabase.from('kyc_records').update({
      status: 'REJECTED',
      rejection_reason: reason.trim(),
      reviewed_at: new Date().toISOString(),
      reviewed_by: actorId,
    }).eq('id', kyc.id);

    await audit(schoolId, actorId, 'KYC_REJECTED', 'kyc_record', kyc.id, { reason: reason.trim() });

    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/admin/kyc/:id/request-review — reopen for review
// ==========================================================
router.post('/kyc/:id/request-review', requireStaff('kyc.review'), async (req: Request, res: Response) => {
  try {
    const kyc = await loadKycForReview(req.params.id as string);
    if (!kyc) return res.status(404).json({ error: 'KYC record not found' });

    const actorId = req.user.id;
    const schoolId = kyc.school_id;

    await supabase.from('kyc_records').update({
      status: 'UNDER_REVIEW',
      reviewed_at: null,
      reviewed_by: null,
      rejection_reason: null,
    }).eq('id', kyc.id);

    await audit(schoolId, actorId, 'KYC_REVIEW_STARTED', 'kyc_record', kyc.id, {});

    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// GET /api/admin/settlements — list settlement accounts (staff)
// ==========================================================
router.get('/settlements', requireStaff('settlement.view'), async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('settlement_accounts')
      .select('id, school_id, bank_code, bank_name, account_number, status, submitted_at, verified_at, rejection_reason, schools!inner(name)')
      .order('submitted_at', { ascending: false })
      .limit(100);
    if (error) return res.status(500).json({ error: error.message });

    const masked = ((data ?? []) as Array<{ account_number?: string | null } & Record<string, unknown>>).map((s) => ({
      ...s,
      account_number_last4: s.account_number?.slice(-4) || null,
      account_number: undefined,
    }));

    return res.json({ success: true, data: masked });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/admin/settlements/:id/verify — verify settlement account
// Runs the provider server-side, compares returned name to school/owner.
// ==========================================================
router.post('/settlements/:id/verify', requireStaff('settlement.verify'), async (req: Request, res: Response) => {
  try {
    const { data: account, error } = await supabase
      .from('settlement_accounts')
      .select('*, schools!inner(id, name, owner_user_id)')
      .eq('id', req.params.id)
      .single();
    if (error || !account) return res.status(404).json({ error: 'Settlement account not found' });

    const acct = account as SettlementAccountRow;

    if (acct.status === 'VERIFIED') {
      return res.json({ success: true, data: { alreadyVerified: true } });
    }

    const actorId = req.user.id;
    const schoolId = acct.school_id as string;

    // Provider name enquiry (never trusts client-supplied account name).
    const result = await settlementVerificationService.verifyAccount({
      bankCode: acct.bank_code,
      accountNumber: acct.account_number,
    });

    if (!result.verified) {
      await supabase.from('settlement_accounts').update({
        status: 'REJECTED',
        rejection_reason: result.failureReason || 'Account verification failed.',
        verified_at: null,
        verified_by: null,
      }).eq('id', acct.id);

      await supabase.from('settlement_account_verifications').insert({
        settlement_account_id: acct.id,
        school_id: schoolId,
        provider: result.provider,
        provider_reference: result.reference,
        account_number_last4: acct.account_number?.slice(-4),
        account_name_returned: null,
        status: 'FAILED',
        failure_reason: result.failureReason,
        idempotency_key: `settle:${acct.id}`,
        raw_response: {},
      });

      await audit(schoolId, actorId, 'SETTLEMENT_ACCOUNT_REJECTED', 'settlement_accounts', acct.id, {
        provider: result.provider,
        provider_reference: result.reference,
      });

      return res.status(400).json({ error: 'Settlement account verification failed.', reason: result.failureReason });
    }

    // Capability-aware ownership authorization.
    const eligibility = evaluateSettlementEligibility({
      accountVerification: result,
      registeredOwnerName: acct.schools?.name || '',
      submittedOwnerName: acct.schools?.name || '',
    });

    if (eligibility.account.accountName === FieldState.MISMATCH) {
      await supabase.from('settlement_accounts').update({
        status: 'REJECTED',
        rejection_reason: 'Account name does not match the registered school/owner.',
        verified_at: null,
        verified_by: null,
        ownership_match_status: 'NAME_MISMATCH',
      }).eq('id', acct.id);

      await supabase.from('settlement_account_verifications').insert({
        settlement_account_id: acct.id,
        school_id: schoolId,
        provider: result.provider,
        provider_reference: result.reference,
        account_number_last4: acct.account_number?.slice(-4),
        account_name_returned: result.accountName || null,
        status: 'FAILED',
        failure_reason: 'NAME_MISMATCH',
        idempotency_key: `settle:${acct.id}`,
        raw_response: {},
        verified_fields: result.verifiedFields || {},
        comparison: { overall: eligibility.overall, ownership: eligibility.ownership },
      });

      await audit(schoolId, actorId, 'SETTLEMENT_ACCOUNT_REJECTED', 'settlement_accounts', acct.id, {
        reason: 'NAME_MISMATCH',
      });

      return res.status(400).json({ error: 'Account name does not match the registered school/owner.' });
    }

    if (!eligibility.eligible) {
      await supabase.from('settlement_accounts').update({
        status: 'REJECTED',
        rejection_reason: 'Settlement ownership could not be confirmed.',
        verified_at: null,
        verified_by: null,
        ownership_match_status: eligibility.overall,
      }).eq('id', acct.id);

      await supabase.from('settlement_account_verifications').insert({
        settlement_account_id: acct.id,
        school_id: schoolId,
        provider: result.provider,
        provider_reference: result.reference,
        account_number_last4: acct.account_number?.slice(-4),
        account_name_returned: result.accountName || null,
        status: 'FAILED',
        failure_reason: eligibility.overall,
        idempotency_key: `settle:${acct.id}`,
        raw_response: {},
        verified_fields: result.verifiedFields || {},
        comparison: { overall: eligibility.overall, ownership: eligibility.ownership },
      });

      await audit(schoolId, actorId, 'SETTLEMENT_ACCOUNT_REJECTED', 'settlement_accounts', acct.id, {
        reason: eligibility.overall,
      });

      return res.status(400).json({ error: 'Settlement ownership could not be confirmed.', reason: eligibility.overall });
    }

    // Ownership authorized by CAPFLUX rules.
    await supabase.from('settlement_accounts').update({
      status: 'VERIFIED',
      account_name: result.accountName,
      verified_at: new Date().toISOString(),
      verified_by: actorId,
      rejection_reason: null,
      ownership_match_status: 'OWNERSHIP_MATCH',
    }).eq('id', acct.id);

    await supabase.from('settlement_account_verifications').insert({
      settlement_account_id: acct.id,
      school_id: schoolId,
      provider: result.provider,
      provider_reference: result.reference,
      account_number_last4: acct.account_number?.slice(-4),
      account_name_returned: result.accountName || null,
      status: 'VERIFIED',
      idempotency_key: `settle:${acct.id}`,
      raw_response: {},
      verified_fields: result.verifiedFields || {},
      comparison: { overall: eligibility.overall, ownership: eligibility.ownership },
    });

    await audit(schoolId, actorId, 'SETTLEMENT_ACCOUNT_VERIFIED', 'settlement_accounts', acct.id, {
      provider: result.provider,
      provider_reference: result.reference,
    });

    return res.json({ success: true, data: { accountName: result.accountName } });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/admin/settlements/:id/reject — reject with reason
// ==========================================================
router.post('/settlements/:id/reject', requireStaff('settlement.verify'), async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { reason } = body;
    if (!reason || String(reason).trim().length < 5) {
      return res.status(400).json({ error: 'A rejection reason (min 5 chars) is required.' });
    }
    const { data: account, error } = await supabase
      .from('settlement_accounts')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error || !account) return res.status(404).json({ error: 'Settlement account not found' });

    const acct = account as SettlementAccountRow;

    await supabase.from('settlement_accounts').update({
      status: 'REJECTED',
      rejection_reason: String(reason).trim(),
      verified_at: null,
      verified_by: null,
    }).eq('id', acct.id);

    await audit(acct.school_id, req.user.id, 'SETTLEMENT_ACCOUNT_REJECTED', 'settlement_accounts', acct.id, {
      reason: String(reason).trim(),
    });

    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/admin/gateway/assign — CAPFLUX-internal gateway assignment
// ==========================================================
router.post('/gateway/assign', requireStaff('gateway.assign'), async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { schoolId, provider, notes } = body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const result = await gatewayAssignmentService.assignGateway({
      schoolId: schoolId as string,
      assignedBy: req.user.id,
      provider: provider as string | undefined,
      notes: notes as string | null | undefined,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/admin/payments/activate — payment readiness gate
// ==========================================================
router.post('/payments/activate', requireStaff('payment.activate'), async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { schoolId } = body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const result = await paymentActivationService.activatePayments(schoolId as string);
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/admin/payments/suspend — suspend a READY school
// ==========================================================
router.post('/payments/suspend', requireStaff('payment.activate'), async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { schoolId } = body;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const result = await paymentActivationService.suspendPayments(schoolId as string, req.user.id);
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// GET /api/admin/payments/readiness/:schoolId — check readiness state
// ==========================================================
router.get('/payments/readiness/:schoolId', requireStaff('payment.activate'), async (req: Request, res: Response) => {
  try {
    const result = await paymentActivationService.checkReadiness(req.params.schoolId as string);
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;
