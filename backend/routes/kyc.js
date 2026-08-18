import express from 'express';
import { supabase } from '../supabaseClient.js';
import requireAuthSupabase from '../middleware/requireAuthSupabase.js';
import {
  encryptField,
  decryptField,
  maskIdentifier,
  last4,
} from '../services/cryptoFields.js';
import {
  isValidBvn,
  isValidNin,
  isValidCacNumber,
  isValidAccountNumber,
  isValidBankCode,
  isAllowedCacFile,
  isValidCacMimeType,
  isValidCacExtension,
} from '../services/validators.js';
import {
  storeCacDocument,
  verifySignedUrl,
  readStoredFile,
  checksum,
} from '../services/storage.js';
import settlementVerificationService from '../services/SettlementVerificationService.js';
import gatewayAssignmentService from '../services/GatewayAssignmentService.js';
import paymentActivationService from '../services/PaymentActivationService.js';

const router = express.Router();

const handleError = (res, error, fallbackStatus = 500) => {
  const status = error?.statusCode || fallbackStatus;
  const message = error?.message || 'Internal server error';
  return res.status(status).json({ error: message });
};

// Phase 4: Switch to Supabase Auth (JWT Bearer token).
router.use(requireAuthSupabase);

/**
 * Get the user's school ID from school_members
 */
async function getUserSchoolId(userId) {
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
 * Audit log for KYC access (compliance requirement)
 */
async function logKycAccess(schoolId, userId, action, metadata = {}) {
  try {
    await supabase.from('audit_logs').insert({
      school_id: schoolId,
      actor_id: userId,
      action,
      entity: 'kyc_record',
      entity_id: schoolId,
      metadata: JSON.stringify({ ...metadata, accessed_at: new Date().toISOString() }),
    });
  } catch (logErr) {
    // Audit log failure must not break the main flow
    console.error('Failed to write audit log:', logErr.message);
  }
}

// ==========================================================
// GET /api/kyc/status
// Returns KYC status (masked) for the current user's school
// ==========================================================
router.get('/status', async (req, res) => {
  try {
    const schoolId = await getUserSchoolId(req.user.id);
    if (!schoolId) {
      return res.status(400).json({ error: 'No school found. Complete onboarding first.' });
    }

    const { data: kyc, error } = await supabase
      .from('kyc_records')
      .select('id, status, submitted_at, reviewed_at, reviewed_by, rejection_reason, bvn_last4, nin_last4, bvn_verification_status, nin_verification_status, verification_provider, official_email, official_phone, cac_registration_number')
      .eq('school_id', schoolId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message });
    }

    const { data: school } = await supabase
      .from('schools')
      .select('status, payment_status')
      .eq('id', schoolId)
      .single();

    // Mask sensitive identifiers in the response
    const maskedKyc = kyc
      ? {
          ...kyc,
          bvn_last4: kyc.bvn_last4,
          bvn_masked: kyc.bvn_last4 ? maskIdentifier(kyc.bvn_last4, 0, 3).replace(/^\*+/, '***') : null,
        }
      : null;

    return res.json({
      success: true,
      data: {
        kyc: maskedKyc,
        schoolStatus: school?.status || null,
        paymentStatus: school?.payment_status || null,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/kyc/submit
// Submit KYC information for the current user's school.
// BVN and NIN are encrypted at the application layer before storage.
// No onboarding logic here — this is a separate compliance domain.
// ==========================================================
router.post('/submit', async (req, res) => {
  const {
    principalName,
    principalPhone,
    officialEmail,
    officialPhone,
    cacRegistrationNumber,
    cacCertificatePath,
    bvn,
    nin,
  } = req.body;

  if (!principalName || !principalPhone) {
    return res.status(400).json({ error: 'Principal name and phone are required.' });
  }

  if (!bvn || !nin) {
    return res.status(400).json({ error: 'Both BVN and NIN are required.' });
  }

  // Strict format validation (11-digit NIN/BVN).
  if (!isValidBvn(bvn)) {
    return res.status(400).json({ error: 'Invalid BVN format. BVN must be 11 digits.' });
  }
  if (!isValidNin(nin)) {
    return res.status(400).json({ error: 'Invalid NIN format. NIN must be 11 digits.' });
  }
  if (cacRegistrationNumber && !isValidCacNumber(cacRegistrationNumber)) {
    return res.status(400).json({ error: 'Invalid CAC registration number format.' });
  }

  try {
    const schoolId = await getUserSchoolId(req.user.id);
    if (!schoolId) {
      return res.status(400).json({ error: 'No school found. Complete onboarding first.' });
    }

    const { data: school } = await supabase
      .from('schools')
      .select('status')
      .eq('id', schoolId)
      .single();

    if (!school) {
      return res.status(404).json({ error: 'School not found.' });
    }

    if (school.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'School onboarding must be completed before submitting KYC.' });
    }

    // Encrypt BVN and NIN at the application layer
    const bvnEncrypted = encryptField(bvn);
    const ninEncrypted = encryptField(nin);
    const bvnLast4 = bvn.slice(-4);
    const ninLast4 = nin.slice(-4);

    const { data, error } = await supabase
      .from('kyc_records')
      .upsert({
        school_id: schoolId,
        principal_name: principalName,
        principal_phone: principalPhone,
        official_email: officialEmail || null,
        official_phone: officialPhone || null,
        cac_registration_number: cacRegistrationNumber || null,
        cac_certificate_path: cacCertificatePath || null,
        bvn_encrypted: bvnEncrypted,
        nin_encrypted: ninEncrypted,
        bvn_last4: bvnLast4,
        nin_last4: ninLast4,
        bvn_verification_status: 'PENDING',
        nin_verification_status: 'PENDING',
        status: 'UNDER_REVIEW',
        submitted_at: new Date().toISOString(),
      })
      .select('id, status, submitted_at, bvn_last4, nin_last4, cac_registration_number')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Update school payment status to UNDER_REVIEW
    await supabase
      .from('schools')
      .update({ payment_status: 'UNDER_REVIEW' })
      .eq('id', schoolId);

    await logKycAccess(schoolId, req.user.id, 'KYC_SUBMITTED', {
      fields: ['principal_name', 'principal_phone', 'official_email', 'official_phone', 'cac_registration_number'],
    });

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/kyc/resubmit
// Allows a REJECTED KYC record to be resubmitted.
// Re-encrypts BVN/NIN with fresh values.
// ==========================================================
router.post('/resubmit', async (req, res) => {
  const {
    principalName,
    principalPhone,
    officialEmail,
    officialPhone,
    cacRegistrationNumber,
    cacCertificatePath,
    bvn,
    nin,
  } = req.body;

  if (!bvn || !nin) {
    return res.status(400).json({ error: 'Both BVN and NIN are required.' });
  }
  if (!isValidBvn(bvn)) {
    return res.status(400).json({ error: 'Invalid BVN format. BVN must be 11 digits.' });
  }
  if (!isValidNin(nin)) {
    return res.status(400).json({ error: 'Invalid NIN format. NIN must be 11 digits.' });
  }
  if (cacRegistrationNumber && !isValidCacNumber(cacRegistrationNumber)) {
    return res.status(400).json({ error: 'Invalid CAC registration number format.' });
  }

  try {
    const schoolId = await getUserSchoolId(req.user.id);
    if (!schoolId) {
      return res.status(400).json({ error: 'No school found. Complete onboarding first.' });
    }

    // Check existing KYC record
    const { data: existing } = await supabase
      .from('kyc_records')
      .select('id, status')
      .eq('school_id', schoolId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'No KYC record found. Submit first.' });
    }

    if (existing.status !== 'REJECTED') {
      return res.status(400).json({
        error: `Cannot resubmit. Current status is ${existing.status}. Only rejected KYC records can be resubmitted.`,
      });
    }

    // Encrypt BVN and NIN
    const bvnEncrypted = encryptField(bvn);
    const ninEncrypted = encryptField(nin);
    const bvnLast4 = bvn.slice(-4);
    const ninLast4 = nin.slice(-4);

    const { data, error } = await supabase
      .from('kyc_records')
      .update({
        principal_name: principalName || undefined,
        principal_phone: principalPhone || undefined,
        official_email: officialEmail || null,
        official_phone: officialPhone || null,
        cac_registration_number: cacRegistrationNumber || null,
        cac_certificate_path: cacCertificatePath || null,
        bvn_encrypted: bvnEncrypted,
        nin_encrypted: ninEncrypted,
        bvn_last4: bvnLast4,
        nin_last4: ninLast4,
        bvn_verification_status: 'PENDING',
        nin_verification_status: 'PENDING',
        verification_provider: null,
        verification_reference: null,
        verified_at: null,
        status: 'UNDER_REVIEW',
        submitted_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq('school_id', schoolId)
      .select('id, status, submitted_at, bvn_last4, nin_last4')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Reset school payment status for re-review
    await supabase
      .from('schools')
      .update({ payment_status: 'UNDER_REVIEW' })
      .eq('id', schoolId);

    await logKycAccess(schoolId, req.user.id, 'KYC_RESUBMITTED', {
      previous_status: 'REJECTED',
      new_status: 'UNDER_REVIEW',
    });

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// GET /api/kyc/documents
// Returns CAC certificate and document metadata (no BVN/NIN)
// ==========================================================
router.get('/documents', async (req, res) => {
  try {
    const schoolId = await getUserSchoolId(req.user.id);
    if (!schoolId) {
      return res.status(400).json({ error: 'No school found. Complete onboarding first.' });
    }

    const { data: kyc, error } = await supabase
      .from('kyc_records')
      .select('id, cac_registration_number, cac_document_mime_type, cac_document_file_size, cac_document_checksum, cac_document_uploaded_at, cac_document_status, status, submitted_at, verified_at')
      .eq('school_id', schoolId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message });
    }

    const documents = kyc
      ? {
          cacRegistrationNumber: kyc.cac_registration_number,
          cacDocument: kyc.cac_document_uploaded_at
            ? {
                mime_type: kyc.cac_document_mime_type,
                file_size: kyc.cac_document_file_size,
                checksum: kyc.cac_document_checksum,
                uploaded_at: kyc.cac_document_uploaded_at,
                status: kyc.cac_document_status,
              }
            : null,
          status: kyc.status,
          submittedAt: kyc.submitted_at,
          verifiedAt: kyc.verified_at,
        }
      : null;

    return res.json({ success: true, data: documents });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// GET /api/kyc/history
// Returns audit history for KYC events (no sensitive values)
// ==========================================================
router.get('/history', async (req, res) => {
  try {
    const schoolId = await getUserSchoolId(req.user.id);
    if (!schoolId) {
      return res.status(400).json({ error: 'No school found. Complete onboarding first.' });
    }

    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('action, created_at, metadata')
      .eq('school_id', schoolId)
      .in('entity', ['kyc_record', 'school'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Sanitize: only surface compliance-safe events
    const safeEvents = logs.map((log) => ({
      action: log.action,
      timestamp: log.created_at,
      metadata: log.metadata,
    }));

    return res.json({ success: true, data: safeEvents });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/kyc/documents/cac — upload CAC certificate (private storage)
// Accepts base64 data-URL JSON payload: { filename, mimeType, dataBase64 }
// Validates MIME type, extension, size; stores in private storage; records
// metadata on the KYC record. Never exposes a permanent public URL.
// ==========================================================
router.post('/documents/cac', async (req, res) => {
  const { filename, mimeType, dataBase64 } = req.body || {};

  if (!filename || !mimeType || !dataBase64) {
    return res.status(400).json({ error: 'filename, mimeType, and dataBase64 are required.' });
  }

  const ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
  let buffer;
  try {
    buffer = Buffer.from(dataBase64, 'base64');
  } catch (_e) {
    return res.status(400).json({ error: 'Invalid file data.' });
  }

  if (!isAllowedCacFile({ mimeType, extension: ext, size: buffer.length })) {
    return res.status(400).json({
      error: 'CAC certificate must be a PDF, JPG, or PNG up to 10MB.',
    });
  }

  // Verify the buffer's magic bytes match the claimed MIME type (do not trust
  // the client-declared MIME type alone).
  const sniffed = sniffMimeType(buffer);
  if (sniffed && !sniffed.startsWith(mimeType.split('/')[0])) {
    return res.status(400).json({ error: 'File content does not match the declared type.' });
  }

  try {
    const schoolId = await getUserSchoolId(req.user.id);
    if (!schoolId) {
      return res.status(400).json({ error: 'No school found. Complete onboarding first.' });
    }

    const { data: kyc, error: kycError } = await supabase
      .from('kyc_records')
      .select('id')
      .eq('school_id', schoolId)
      .single();
    if (kycError || !kyc) {
      return res.status(400).json({ error: 'Submit KYC details first before uploading a CAC certificate.' });
    }

    const metadata = await storeCacDocument({
      buffer,
      mimeType,
      extension: ext,
      schoolId,
      kycRecordId: kyc.id,
    });

    await supabase
      .from('kyc_records')
      .update({
        cac_document_path: metadata.storage_path,
        cac_document_mime_type: metadata.mime_type,
        cac_document_file_size: metadata.file_size,
        cac_document_checksum: metadata.checksum,
        cac_document_uploaded_at: new Date().toISOString(),
        cac_document_status: 'PENDING',
      })
      .eq('id', kyc.id);

    await logKycAccess(schoolId, req.user.id, 'CAC_DOCUMENT_UPLOADED', {
      file_size: metadata.file_size,
      mime_type: metadata.mime_type,
    });

    return res.json({
      success: true,
      data: {
        mime_type: metadata.mime_type,
        file_size: metadata.file_size,
        checksum: metadata.checksum,
        uploaded_at: metadata.uploaded_at || null,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

/**
 * Sniff the MIME type from file magic bytes (PDF, JPEG, PNG).
 * Returns null when unrecognized.
 */
function sniffMimeType(buffer) {
  if (buffer.length < 4) return null;
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return 'application/pdf';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  return null;
}

// ==========================================================
// GET /api/kyc/documents/serve — serve CAC document via short-lived signed URL
// ==========================================================
router.get('/documents/serve', async (req, res) => {
  try {
    const absPath = verifySignedUrl({
      path: req.query.path,
      expires: req.query.expires,
      token: req.query.token,
    });
    if (!absPath) {
      return res.status(403).json({ error: 'Invalid or expired document link.' });
    }
    const data = await readStoredFile(absPath);
    const ext = absPath.split('.').pop()?.toLowerCase();
    const mime = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', 'inline');
    return res.send(data);
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/kyc/settlement — submit a settlement account (KYC VERIFIED required)
// ==========================================================
router.post('/settlement', async (req, res) => {
  const { bankCode, accountNumber } = req.body || {};

  if (!isValidBankCode(bankCode || '')) {
    return res.status(400).json({ error: 'A valid bank code is required.' });
  }
  if (!isValidAccountNumber(accountNumber || '')) {
    return res.status(400).json({ error: 'A valid 10-digit account number is required.' });
  }

  try {
    const schoolId = await getUserSchoolId(req.user.id);
    if (!schoolId) {
      return res.status(400).json({ error: 'No school found. Complete onboarding first.' });
    }

    const { data: school } = await supabase
      .from('schools')
      .select('status, payment_status')
      .eq('id', schoolId)
      .single();
    if (!school) return res.status(404).json({ error: 'School not found.' });
    if (school.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'School must be ACTIVE before submitting a settlement account.' });
    }

    const { data: kyc } = await supabase
      .from('kyc_records')
      .select('status')
      .eq('school_id', schoolId)
      .single();
    if (!kyc || kyc.status !== 'VERIFIED') {
      return res.status(400).json({ error: 'KYC must be VERIFIED before submitting a settlement account.' });
    }

    // Reject duplicate active submission.
    const { data: existing } = await supabase
      .from('settlement_accounts')
      .select('id, status')
      .eq('school_id', schoolId)
      .in('status', ['PENDING_VERIFICATION', 'VERIFIED'])
      .maybeSingle();
    if (existing) {
      return res.status(409).json({ error: `A settlement account is already ${existing.status.toLowerCase()}.` });
    }

    const { data, error } = await supabase
      .from('settlement_accounts')
      .insert({
        school_id: schoolId,
        bank_code: bankCode.trim(),
        account_number: accountNumber.trim(),
        status: 'PENDING_VERIFICATION',
        submitted_by: req.user.id,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    await logKycAccess(schoolId, req.user.id, 'SETTLEMENT_ACCOUNT_SUBMITTED', {
      bank_code: bankCode.trim(),
      account_number_last4: accountNumber.trim().slice(-4),
    });

    return res.json({
      success: true,
      data: {
        id: data.id,
        status: data.status,
        account_number_last4: data.account_number.slice(-4),
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// GET /api/kyc/settlement — settlement status (masked) + gateway assignment
// ==========================================================
router.get('/settlement', async (req, res) => {
  try {
    const schoolId = await getUserSchoolId(req.user.id);
    if (!schoolId) {
      return res.status(400).json({ error: 'No school found. Complete onboarding first.' });
    }

    const [settlementRes, gatewayRes] = await Promise.all([
      supabase
        .from('settlement_accounts')
        .select('*')
        .eq('school_id', schoolId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('gateway_assignments')
        .select('provider, status, assigned_at')
        .eq('school_id', schoolId)
        .in('status', ['ASSIGNED', 'ACTIVE'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const settlement = settlementRes.data || null;
    const gateway = gatewayRes.data || null;

    return res.json({
      success: true,
      data: {
        settlement: settlement
          ? {
              id: settlement.id,
              status: settlement.status,
              bank_code: settlement.bank_code,
              bank_name: settlement.bank_name,
              account_number_last4: settlement.account_number?.slice(-4) || null,
              account_name: settlement.status === 'VERIFIED' ? maskAccountName(settlement.account_name) : null,
              rejection_reason: settlement.rejection_reason,
              submitted_at: settlement.submitted_at,
              verified_at: settlement.verified_at,
            }
          : null,
        gateway: gateway
          ? { provider: gateway.provider, status: gateway.status, assigned_at: gateway.assigned_at }
          : null,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

/**
 * Mask an account name to reduce exposure (e.g. "JOHN D****").
 */
function maskAccountName(name) {
  if (!name) return null;
  const parts = String(name).split(' ');
  return parts.map((p, i) => (i === 0 ? p : p[0] ? `${p[0]}${'*'.repeat(Math.max(1, p.length - 1))}` : p)).join(' ');
}

// ==========================================================
// GET /api/kyc/activation — payment activation status (readiness gate)
// ==========================================================
router.get('/activation', async (req, res) => {
  try {
    const schoolId = await getUserSchoolId(req.user.id);
    if (!schoolId) {
      return res.status(400).json({ error: 'No school found. Complete onboarding first.' });
    }
    const result = await paymentActivationService.checkReadiness(schoolId);
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
});

export { decryptField, maskIdentifier, logKycAccess };
export default router;
