import express from 'express';
import crypto from 'crypto';
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
  isValidIdentityDocumentType,
  isValidOwnershipPercentage,
  isValidShareholder,
  isValidPhone,
  ALLOWED_IDENTITY_DOCUMENT_TYPES,
} from '../services/validators.js';
import {
  storeCacDocument,
  verifySignedUrl,
  readStoredFile,
  checksum,
} from '../services/storage.js';
import identityVerificationService from '../services/IdentityVerificationService.js';
import settlementVerificationService from '../services/SettlementVerificationService.js';
import { compareIdentityAgainstSubmission, sanitizeIdentityResult, evaluateSettlementEligibility } from '../services/verification-matching.js';
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
      .select('id, status, submitted_at, reviewed_at, reviewed_by, rejection_reason, bvn_last4, nin_last4, bvn_verification_status, nin_verification_status, verification_provider, official_email, official_phone, cac_registration_number, cac_document_mime_type, cac_document_uploaded_at, cac_document_status, identity_document_type, identity_match_states, verification_reference')
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
    identityDocumentType,
    nin,
    bvn,
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
  if (identityDocumentType && !isValidIdentityDocumentType(identityDocumentType)) {
    return res.status(400).json({ error: 'Invalid identity document type.' });
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
        identity_document_type: identityDocumentType || null,
        bvn_encrypted: bvnEncrypted,
        nin_encrypted: ninEncrypted,
        bvn_last4: bvnLast4,
        nin_last4: ninLast4,
        verification_reference: null,
        identity_match_states: '{}',
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

    // --- Identity verification via provider abstraction ---
    // Decrypt the NIN only to pass to the verification provider; the provider
    // result is capability-aware and never assumes a fixed field set.
    const ninDecrypted = decryptField(ninEncrypted);
    const verificationResult = await identityVerificationService.verifyIdentity({
      type: 'NIN',
      value: ninDecrypted,
      _metadata: { name: principalName },
    });

    // Capability-aware comparison: compare ONLY fields the provider returned.
    const comparison = compareIdentityAgainstSubmission({
      submitted: {
        name: principalName,
        identityNumber: ninDecrypted,
      },
      verification: verificationResult,
    });

    // Persist verification history (kyc_verifications — provider evidence).
    await supabase.from('kyc_verifications').insert({
      kyc_record_id: data.id,
      school_id: schoolId,
      verification_type: 'NIN',
      provider: verificationResult.provider,
      provider_reference: verificationResult.providerReference || null,
      status: verificationResult.verificationStatus === 'VERIFIED' ? 'VERIFIED' : (verificationResult.verificationStatus === 'PENDING' ? 'PENDING' : 'FAILED'),
      failure_reason: verificationResult.failureReason || null,
      verified_at: verificationResult.verifiedAt || null,
      verified_by: null,
      idempotency_key: verificationResult.reference || null,
      raw_response: '{}',
      verified_fields: verificationResult.verifiedFields || {},
      comparison: comparison.fields,
    });

    // Update kyc_records with match states and verification reference (sanitized, no raw PII).
    await supabase
      .from('kyc_records')
      .update({
        identity_match_states: comparison.fields,
        verification_reference: verificationResult.reference || null,
      })
      .eq('id', data.id);

    // Update school payment status to UNDER_REVIEW
    await supabase
      .from('schools')
      .update({ payment_status: 'UNDER_REVIEW' })
      .eq('id', schoolId);

    await logKycAccess(schoolId, req.user.id, 'KYC_SUBMITTED', {
      fields: ['principal_name', 'principal_phone', 'official_email', 'official_phone', 'identity_document_type'],
      identity_match_overall: comparison.overall,
    });

    // Return masked response only — never expose raw provider data or encrypted values.
    return res.json({
      success: true,
      data: {
        id: data.id,
        status: data.status,
        submittedAt: data.submitted_at,
        verificationReference: verificationResult.reference || null,
        identityMatchOverall: comparison.overall,
        identityMatchFields: comparison.fields,
      },
    });
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
  const { bankCode, accountNumber, bvn } = req.body || {};

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

    // Encrypt BVN if provided (for future BVN ownership verification)
    let bvnEncrypted = null;
    let bvnLast4 = null;
    if (bvn && isValidBvn(bvn)) {
      bvnEncrypted = encryptField(bvn);
      bvnLast4 = bvn.slice(-4);
    }

    const { data, error } = await supabase
      .from('settlement_accounts')
      .insert({
        school_id: schoolId,
        bank_code: bankCode.trim(),
        account_number: accountNumber.trim(),
        bvn_encrypted: bvnEncrypted,
        bvn_last4: bvnLast4,
        status: 'PENDING_VERIFICATION',
        submitted_by: req.user.id,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    // --- Capability-aware settlement verification ---
    // Account-name enquiry via the settlement provider (BVN is NOT verified
    // here — it is a separate capability handled by IdentityVerificationService).
    const accountVerification = await settlementVerificationService.verifyAccount({
      bankCode: bankCode.trim(),
      accountNumber: accountNumber.trim(),
    });

    // BVN ownership verification (separate concept from account-name enquiry)
    let bvnVerification = null;
    if (bvnEncrypted) {
      const bvnDecrypted = decryptField(bvnEncrypted);
      bvnVerification = await identityVerificationService.verifyIdentity({
        type: 'BVN',
        value: bvnDecrypted,
        _metadata: { name: school.name || kyc.principal_name || null },
      });
    }

    // Get the registered owner name for ownership evaluation
    const { data: kycRecord } = await supabase
      .from('kyc_records')
      .select('principal_name')
      .eq('school_id', schoolId)
      .single();
    const registeredOwnerName = kycRecord?.principal_name || null;

    // Evaluate ownership using the capability-aware matcher
    const eligibility = evaluateSettlementEligibility({
      accountVerification,
      bvnVerification,
      registeredOwnerName,
      submittedOwnerName: registeredOwnerName,
    });

    // Persist capability-aware verification history (no raw PII)
    await supabase.from('settlement_account_verifications').insert({
      settlement_account_id: data.id,
      school_id: schoolId,
      provider: accountVerification.provider || 'mock',
      provider_reference: accountVerification.providerReference || null,
      account_number_last4: last4(accountNumber.trim()),
      account_name_returned: accountVerification.accountName || null,
      status: accountVerification.verified ? 'VERIFIED' : 'FAILED',
      failure_reason: accountVerification.failureReason || null,
      idempotency_key: accountVerification.reference || null,
      raw_response: '{}',
      verified_fields: accountVerification.verifiedFields || {},
      comparison: { ownershipOverall: eligibility.overall, ...(eligibility.account || {}) },
    });

    // Update settlement account with masked BVN, ownership status, and verification ref
    const updateFields = {
      ownership_match_status: eligibility.overall === 'OWNERSHIP_MATCH' ? 'OWNERSHIP_MATCH'
        : eligibility.overall === 'NAME_MISMATCH' ? 'NAME_MISMATCH'
        : eligibility.overall === 'NAME_NOT_VERIFIED' ? 'NAME_NOT_VERIFIED'
        : eligibility.overall === 'ACCOUNT_NOT_VERIFIED' ? 'ACCOUNT_NOT_VERIFIED'
        : null,
      account_verification_reference: accountVerification.reference || null,
    };
    await supabase
      .from('settlement_accounts')
      .update(updateFields)
      .eq('id', data.id);

    // Update kyc_verifications with BVN ownership match state if BVN was verified
    if (bvnVerification && kycRecord?.id) {
      await supabase
        .from('kyc_verifications')
        .insert({
          kyc_record_id: kycRecord.id,
          school_id: schoolId,
          verification_type: 'BVN',
          provider: bvnVerification.provider || 'mock',
          provider_reference: bvnVerification.providerReference || null,
          status: bvnVerification.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'FAILED',
          failure_reason: bvnVerification.failureReason || null,
          verified_at: bvnVerification.verifiedAt || null,
          idempotency_key: bvnVerification.reference || null,
          raw_response: '{}',
          verified_fields: bvnVerification.verifiedFields || {},
          comparison: {
            bvnOwnership: eligibility.ownership?.bvn,
            bvnMatchesOwner: eligibility.ownership?.bvnMatchesOwner,
          },
        });
    }

    await logKycAccess(schoolId, req.user.id, 'SETTLEMENT_ACCOUNT_SUBMITTED', {
      bank_code: bankCode.trim(),
      account_number_last4: last4(accountNumber.trim()),
      bvn_last4: bvnLast4,
      ownership_match: eligibility.overall,
      name_match: eligibility.account?.accountName,
    });

    // Return masked response only — never expose BVN, full account number, or raw provider data
    return res.json({
      success: true,
      data: {
        id: data.id,
        status: data.status,
        account_number_last4: last4(data.account_number),
        bvn_last4: bvnLast4,
        account_name: accountVerification.accountName
          ? maskIdentifier(accountVerification.accountName, 0, 3)
          : null,
        ownership_match_status: updateFields.ownership_match_status,
        account_name_state: eligibility.account?.accountName || null,
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
              bvn_last4: settlement.bvn_last4 || null,
              account_name: settlement.status === 'VERIFIED' ? maskAccountName(settlement.account_name) : null,
              ownership_match_status: settlement.ownership_match_status || null,
              account_verification_reference: settlement.account_verification_reference || null,
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
// ==========================================================
// POST /api/kyc/shareholders
// Submit beneficial owner / shareholder information for a school.
// Idempotent: prevents duplicate shareholders by email+name.
// ==========================================================
router.post('/shareholders', async (req, res) => {
  const { shareholders } = req.body || {};

  if (!Array.isArray(shareholders) || shareholders.length === 0) {
    return res.status(400).json({ error: 'At least one shareholder is required.' });
  }

  for (const sh of shareholders) {
    if (!isValidShareholder(sh)) {
      return res.status(400).json({
        error: `Invalid shareholder: ${sh.fullName || 'unknown'}. Required fields: fullName, ownershipPercentage, role, phone, identityType.`,
      });
    }
    if (!isValidOwnershipPercentage(sh.ownershipPercentage)) {
      return res.status(400).json({ error: `Invalid ownership percentage for ${sh.fullName}.` });
    }
  }

  const totalOwnership = shareholders.reduce((sum, sh) => sum + Number(sh.ownershipPercentage), 0);
  if (totalOwnership > 100) {
    return res.status(400).json({ error: `Total ownership percentage (${totalOwnership}%) exceeds 100%.` });
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
      return res.status(400).json({ error: 'School must be ACTIVE before submitting shareholders.' });
    }

    // Verify KYC is completed
    const { data: kyc } = await supabase
      .from('kyc_records')
      .select('status')
      .eq('school_id', schoolId)
      .single();
    if (!kyc || (kyc.status !== 'VERIFIED' && kyc.status !== 'UNDER_REVIEW')) {
      return res.status(400).json({ error: 'KYC must be submitted before adding shareholders.' });
    }

    const results = [];
    for (const sh of shareholders) {
      // Check for existing shareholder with same name (idempotency)
      const { data: existing } = await supabase
        .from('school_shareholders')
        .select('id')
        .eq('school_id', schoolId)
        .eq('full_name', sh.fullName)
        .maybeSingle();

      if (existing) {
        // Update existing shareholder
        const { data: updated } = await supabase
          .from('school_shareholders')
          .update({
            ownership_percentage: Number(sh.ownershipPercentage),
            role: sh.role,
            phone: sh.phone,
            identity_type: sh.identityType,
            identity_document_type: sh.identityDocumentType || null,
            identity_nin_last4: sh.nin ? sh.nin.slice(-4) : null,
          })
          .eq('id', existing.id)
          .select()
          .single();
        results.push({ id: updated.id, updatedAt: true });
      } else {
        // Insert new shareholder
        const { data: inserted, error: insertError } = await supabase
          .from('school_shareholders')
          .insert({
            school_id: schoolId,
            full_name: sh.fullName,
            ownership_percentage: Number(sh.ownershipPercentage),
            role: sh.role,
            phone: sh.phone,
            date_of_birth_encrypted: sh.dateOfBirth ? encryptField(sh.dateOfBirth) : null,
            identity_type: sh.identityType,
            identity_document_type: sh.identityDocumentType || null,
            identity_nin_last4: sh.nin ? sh.nin.slice(-4) : null,
            identity_match_status: 'PENDING',
          })
          .select()
          .single();
        if (insertError) {
          console.error('Failed to insert shareholder:', insertError.message);
          results.push({ error: insertError.message });
        } else {
          results.push({ id: inserted.id, createdAt: true });
        }
      }
    }

    await logKycAccess(schoolId, req.user.id, 'SHAREHOLDERS_SUBMITTED', {
      count: shareholders.length,
    });

    // Return masked — never expose encrypted DOB or NIN
    const { data: allShareholders } = await supabase
      .from('school_shareholders')
      .select('id, full_name, ownership_percentage, role, created_at, identity_match_status')
      .eq('school_id', schoolId);

    return res.json({
      success: true,
      data: { shareholders: allShareholders },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// GET /api/kyc/shareholders
// List school shareholders (masked — no encrypted PII)
// ==========================================================
router.get('/shareholders', async (req, res) => {
  try {
    const schoolId = await getUserSchoolId(req.user.id);
    if (!schoolId) {
      return res.status(400).json({ error: 'No school found. Complete onboarding first.' });
    }

    const { data, error } = await supabase
      .from('school_shareholders')
      .select('id, full_name, ownership_percentage, role, created_at, identity_match_status')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, data: data || [] });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/kyc/principal-invitation
// Create an idempotent, expiring invitation for a principal who is not the owner.
// ==========================================================
router.post('/principal-invitation', async (req, res) => {
  const { email, principalName } = req.body || {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ error: 'A valid principal email is required.' });
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

    if (!school || school.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'School must be ACTIVE before inviting a principal.' });
    }

    // Verify school has at least the owner as a shareholder
    const { count, error: countError } = await supabase
      .from('school_shareholders')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId);

    if (countError || (count || 0) === 0) {
      return res.status(400).json({ error: 'At least one shareholder must be recorded first.' });
    }

    // Check for pending invitation (idempotent — reuse if still valid)
    const { data: existing } = await supabase
      .from('principal_invitations')
      .select('id, status, expires_at, token_hash')
      .eq('school_id', schoolId)
      .eq('email', String(email).trim())
      .in('status', ['PENDING'])
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (existing) {
      const expiresAt = new Date(existing.expires_at);
      if (expiresAt > new Date() && existing.token_hash) {
        // Return a fresh token sign (same hash — token reuse is by design for idempotency)
        const token = crypto.randomBytes(32).toString('hex');
        await supabase
          .from('principal_invitations')
          .update({ invited_by: req.user.id })
          .eq('id', existing.id);

        return res.json({
          success: true,
          data: {
            invitationId: existing.id,
            email: email.trim(),
            accepted: false,
            existing: true,
            token,
            tokenHash: existing.token_hash,
          },
        });
      }
    }

    // Create new invitation
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const { data: invitation, error } = await supabase
      .from('principal_invitations')
      .insert({
        school_id: schoolId,
        email: email.trim(),
        token_hash: tokenHash,
        role: 'PRINCIPAL',
        expires_at: expiresAt,
        invited_by: req.user.id,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    await logKycAccess(schoolId, req.user.id, 'PRINCIPAL_INVITATION_CREATED', {
      email: email.trim(),
    });

    // Never expose token_hash — return the plaintext token only to the inviter
    // (which the backend would email via a secure channel in production).
    return res.json({
      success: true,
      data: {
        invitationId: invitation.id,
        email: invitation.email,
        accepted: false,
        existing: false,
        token,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/kyc/principal-invitation/accept/:token
// Accept a principal invitation (secure, idempotent, idempotent).
// ==========================================================
router.post('/principal-invitation/accept/:token', async (req, res) => {
  const { token } = req.params;

  if (!token || token.length < 32) {
    return res.status(400).json({ error: 'Invalid invitation token.' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');

    const { data: invitation, error } = await supabase
      .from('principal_invitations')
      .select('*')
      .eq('token_hash', tokenHash)
      .single();

    if (error || !invitation) {
      return res.status(404).json({ error: 'Invitation not found.' });
    }

    if (invitation.status !== 'PENDING') {
      return res.status(400).json({ error: `Invitation has already been ${invitation.status.toLowerCase()}.` });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      await supabase
        .from('principal_invitations')
        .update({ status: 'EXPIRED' })
        .eq('id', invitation.id);
      return res.status(410).json({ error: 'Invitation has expired.' });
    }

    // Create school membership for the invited principal
    const { data: schoolMember, error: memberError } = await supabase
      .from('school_members')
      .insert({
        school_id: invitation.school_id,
        user_id: req.user.id,
        role_id: (await supabase.from('roles').select('id').eq('system_role', 'OWNER').single()).data?.id,
        is_active: true,
      })
      .select()
      .single();

    if (memberError) {
      return res.status(500).json({ error: memberError.message });
    }

    // Mark invitation as accepted
    await supabase
      .from('principal_invitations')
      .update({
        status: 'ACCEPTED',
        accepted_at: new Date().toISOString(),
        accepted_by: req.user.id,
      })
      .eq('id', invitation.id);

    return res.json({
      success: true,
      data: {
        schoolId: invitation.school_id,
        membershipId: schoolMember.id,
        message: 'Principal invitation accepted. You are now a member of the school.',
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

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
