import express from 'express';
import crypto from 'crypto';
import { supabase } from '../supabaseClient.js';
import requireAuth from '../middleware/requireAuth.js';

const router = express.Router();

const handleError = (res, error, fallbackStatus = 500) => {
  const status = error?.statusCode || fallbackStatus;
  const message = error?.message || 'Internal server error';
  return res.status(status).json({ error: message });
};

// All KYC routes require an authenticated WorkOS session.
router.use(requireAuth);

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
 * Application-level encryption for BVN/NIN (AES-256-GCM)
 * Key must be 32 bytes, sourced from KYC_ENCRYPTION_KEY env var.
 */
function getEncryptionKey() {
  const key = process.env.KYC_ENCRYPTION_KEY;
  if (!key || Buffer.byteLength(key, 'utf8') !== 32) {
    throw new Error('KYC_ENCRYPTION_KEY must be set to a 32-byte string');
  }
  return Buffer.from(key, 'utf8');
}

function encryptField(plaintext) {
  if (!plaintext) return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as iv:tag:ciphertext in a single field
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptField(encrypted) {
  if (!encrypted) return null;
  try {
    const key = getEncryptionKey();
    const buffer = Buffer.from(encrypted, 'base64');
    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const ciphertext = buffer.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch (_err) {
    return null;
  }
}

/**
 * Mask an identifier: show first 3 and last 3 digits.
 *   BVN  (10 digits): 221*****123
 *   NIN  (11 digits): 1234******5678
 */
function maskIdentifier(value, visibleStart = 3, visibleEnd = 3) {
  if (!value) return null;
  const str = String(value);
  if (str.length <= visibleStart + visibleEnd) return '*'.repeat(str.length);
  return str.slice(0, visibleStart) + '*'.repeat(str.length - visibleStart - visibleEnd) + str.slice(-visibleEnd);
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
      .select('id, cac_registration_number, cac_certificate_path, status, submitted_at, verified_at')
      .eq('school_id', schoolId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message });
    }

    const documents = kyc
      ? {
          cacRegistrationNumber: kyc.cac_registration_number,
          cacCertificatePath: kyc.cac_certificate_path,
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

export { decryptField, maskIdentifier, logKycAccess };
export default router;
