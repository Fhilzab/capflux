import express from 'express';
import { supabase } from '../supabaseClient.js';
import requireAuthSupabase from '../middleware/requireAuthSupabase.js';
import { normalizeLegacyBusinessType, isValidBusinessType } from '../services/validators.js';

const router = express.Router();

const handleError = (res, error, fallbackStatus = 500) => {
  const status = error?.statusCode || fallbackStatus;
  const message = error?.message || 'Internal server error';
  return res.status(status).json({ error: message });
};

// Phase 4: Switch to Supabase Auth (JWT Bearer token).
router.use(requireAuthSupabase);

// ==========================================================
// GET /api/onboarding/status
// Returns the onboarding checklist state for the current user,
// including the school's business_type (normalized from legacy values).
// ==========================================================
router.get('/status', async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_onboarding_status', {
      p_user_id: req.user.id,
    });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Enrich with business_type from the schools table (column already exists).
    // The get_onboarding_status RPC does not return it, so we fetch it here
    // rather than modifying the DB migration.
    let enriched = data;
    if (data && data.has_school && data.school_id) {
      const { data: school } = await supabase
        .from('schools')
        .select('business_type, cac_number, tax_identification_number')
        .eq('id', data.school_id)
        .single();

      if (school) {
        enriched = {
          ...data,
          business_type: normalizeLegacyBusinessType(school.business_type),
          cac_number: school.cac_number || null,
          tax_identification_number: school.tax_identification_number || null,
        };
      }
    }

    return res.json({ success: true, data: enriched });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// GET /api/onboarding/profile
// Load saved personal information for the current user
// ==========================================================
router.get('/profile', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(
        'first_name, middle_name, last_name, phone, date_of_birth, country, state_of_origin, lga_of_origin, residential_address',
      )
      .eq('user_id', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.json({ success: true, data: null });
    }

    return res.json({
      success: true,
      data: {
        firstName: data.first_name,
        middleName: data.middle_name,
        lastName: data.last_name,
        phone: data.phone,
        dateOfBirth: data.date_of_birth,
        country: data.country,
        state: data.state_of_origin,
        lga: data.lga_of_origin,
        residentialAddress: data.residential_address,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/onboarding/profile
// Update user profile (full name, phone)
// ==========================================================
router.post('/profile', async (req, res) => {
  const {
    firstName,
    middleName,
    lastName,
    phone,
    dateOfBirth,
    country,
    state,
    lga,
    residentialAddress,
  } = req.body;

  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'First name and last name are required.' });
  }

  const resolvedFullName = [firstName, middleName, lastName].filter(Boolean).join(' ');

  try {
    // Update user_profiles
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: req.user.id,
        full_name: resolvedFullName,
        first_name: firstName,
        middle_name: middleName || null,
        last_name: lastName,
        phone: phone || null,
        date_of_birth: dateOfBirth || null,
        country: country || null,
        state_of_origin: state || null,
        lga_of_origin: lga || null,
        residential_address: residentialAddress || null,
      });

    if (profileError) {
      return res.status(500).json({ error: profileError.message });
    }

    // Mark profile as completed in onboarding_progress
    // First, find the user's school
    const { data: schoolMember } = await supabase
      .from('school_members')
      .select('school_id')
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .single();

    if (schoolMember) {
      await supabase
        .from('onboarding_progress')
        .upsert({
          school_id: schoolMember.school_id,
          profile_completed: true,
        })
        .eq('school_id', schoolMember.school_id);
    }

    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/onboarding/organization
// Create organization + OWNER membership
// ==========================================================
router.post('/organization', async (req, res) => {
  const { name, businessType } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Organization name is required.' });
  }

  // Validate business_type if provided
  let normalizedBusinessType = null;
  if (businessType) {
    normalizedBusinessType = normalizeLegacyBusinessType(businessType);
    if (!normalizedBusinessType) {
      return res.status(400).json({ error: 'Invalid business type.' });
    }
  }

  try {
    // Check if user already has an organization
    const { data: existingOrg } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .single();

    if (existingOrg) {
      return res.status(409).json({ error: 'User already has an organization.' });
    }

    // Create organization with OWNER membership
    const { data: orgId, error } = await supabase.rpc('create_organization_with_owner', {
      p_name: name,
      p_owner_user_id: req.user.id,
    });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // If school already exists (rare, e.g. school created before org), set business_type
    if (normalizedBusinessType) {
      const { data: schoolMember } = await supabase
        .from('school_members')
        .select('school_id')
        .eq('user_id', req.user.id)
        .eq('is_active', true)
        .single();

      if (schoolMember) {
        await supabase.from('schools').update({ business_type: normalizedBusinessType })
          .eq('id', schoolMember.school_id);
      }
    }

    // Mark organization step as completed
    // Find the user's school (may not exist yet)
    const { data: schoolMember } = await supabase
      .from('school_members')
      .select('school_id')
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .single();

    if (schoolMember) {
      await supabase
        .from('onboarding_progress')
        .update({ organization_completed: true })
        .eq('school_id', schoolMember.school_id);
    }

    // Fetch the created organization
    const { data: org } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single();

    return res.json({ success: true, data: { organization: org } });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/onboarding/school
// Create school + OWNER membership + onboarding_progress
// ==========================================================
router.post('/school', async (req, res) => {
  const {
    name,
    address,
    state,
    lga,
    country,
    schoolType,
    schoolCategory,
    gender,
    schoolLevels,
    academicCalendar,
    businessType,
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'School name is required.' });
  }

  try {
    // Check if user already has a school
    const { data: existingSchool } = await supabase
      .from('school_members')
      .select('school_id')
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .single();

    if (existingSchool) {
      return res.status(409).json({ error: 'User already has a school.' });
    }

    // Get user's organization
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .single();

    if (!orgMember) {
      return res.status(400).json({ error: 'Organization must be created first.' });
    }

    // Create school with onboarding progress and OWNER membership
    const { data: schoolId, error } = await supabase.rpc('create_school_with_onboarding', {
      p_organization_id: orgMember.organization_id,
      p_name: name,
      p_owner_user_id: req.user.id,
      p_address: address || null,
      p_state: state || null,
      p_lga: lga || null,
      p_country: country || 'Nigeria',
      p_school_type: schoolType || 'MIXED',
      p_academic_calendar: academicCalendar || {},
    });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Extend the school with Phase 8.4 fields (levels, category, gender)
    // The create_school_with_onboarding RPC (migration 022) predates these
    // columns; set them here as additive columns added in migration 030.
    await supabase
      .from('schools')
      .update({
        school_levels: schoolLevels || [],
        school_category: schoolCategory || null,
        gender: gender || 'MIXED',
      })
      .eq('id', schoolId);

    // Set business_type on the school if provided (already exists as a column)
    if (businessType) {
      const normalizedBt = normalizeLegacyBusinessType(businessType);
      if (normalizedBt) {
        await supabase.from('schools').update({ business_type: normalizedBt })
          .eq('id', schoolId);
      }
    }

    // Mark school step as completed
    await supabase
      .from('onboarding_progress')
      .update({ school_completed: true })
      .eq('school_id', schoolId);

    // Fetch the created school
    const { data: school } = await supabase
      .from('schools')
      .select('*')
      .eq('id', schoolId)
      .single();

    return res.json({ success: true, data: { school } });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/onboarding/owner-info
// Store owner information (phone, designation, alternate contact)
// Name and email already collected during registration
// ==========================================================
router.post('/owner-info', async (req, res) => {
  const { phone, designation, alternateContact } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone is required.' });
  }

  try {
    // Get user's school
    const { data: schoolMember } = await supabase
      .from('school_members')
      .select('school_id')
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .single();

    if (!schoolMember) {
      return res.status(400).json({ error: 'School must be created first.' });
    }

    // Update user_profiles with phone
    await supabase
      .from('user_profiles')
      .upsert({
        user_id: req.user.id,
        phone: phone,
      });

    // Store designation and alternate contact in school's academic_calendar or a metadata field
    // For now, we'll store it in the onboarding_progress completed_steps
    await supabase
      .from('onboarding_progress')
      .update({
        owner_completed: true,
        completed_steps: JSON.stringify({
          owner_phone: phone,
          designation: designation || null,
          alternate_contact: alternateContact || null,
        }),
      })
      .eq('school_id', schoolMember.school_id);

    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/onboarding/save-progress
// Persist onboarding progress (for resume later)
// ==========================================================
router.post('/save-progress', async (req, res) => {
  const { profileCompleted, organizationCompleted, schoolCompleted, ownerCompleted } = req.body;

  try {
    // Get user's school
    const { data: schoolMember } = await supabase
      .from('school_members')
      .select('school_id')
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .single();

    if (!schoolMember) {
      return res.json({ success: true, message: 'No school to save progress for.' });
    }

    const updateData = {};
    if (profileCompleted !== undefined) updateData.profile_completed = profileCompleted;
    if (organizationCompleted !== undefined) updateData.organization_completed = organizationCompleted;
    if (schoolCompleted !== undefined) updateData.school_completed = schoolCompleted;
    if (ownerCompleted !== undefined) updateData.owner_completed = ownerCompleted;

    if (Object.keys(updateData).length > 0) {
      await supabase
        .from('onboarding_progress')
        .update(updateData)
        .eq('school_id', schoolMember.school_id);
    }

    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/onboarding/complete
// Validate checklist and activate school
// ==========================================================
router.post('/complete', async (req, res) => {
  try {
    // Get user's school
    const { data: schoolMember } = await supabase
      .from('school_members')
      .select('school_id')
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .single();

    if (!schoolMember) {
      return res.status(400).json({ error: 'No school found. Complete school registration first.' });
    }

    // Call the complete_onboarding function
    const { data, error } = await supabase.rpc('complete_onboarding', {
      p_school_id: schoolMember.school_id,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Fetch updated school
    const { data: school } = await supabase
      .from('schools')
      .select('id, name, status, payment_status')
      .eq('id', schoolMember.school_id)
      .single();

    return res.json({
      success: true,
      data: {
        school,
        activated: true,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// GET /api/onboarding/schools/:schoolId/state
// Legacy endpoint for backward compatibility
// ==========================================================
router.get('/schools/:schoolId/state', async (req, res) => {
  const { schoolId } = req.params;

  try {
    const { data: progress, error } = await supabase
      .from('onboarding_progress')
      .select('*')
      .eq('school_id', schoolId)
      .single();

    if (error || !progress) {
      return res.json({
        schoolId,
        stage: 1,
        completedSteps: [],
        businessVerified: false,
        settlementVerified: false,
        paymentServiceReady: true,
      });
    }

    return res.json({
      schoolId,
      stage: progress.stage,
      completedSteps: progress.completed_steps || [],
      businessVerified: progress.business_verified,
      settlementVerified: progress.settlement_verified,
      paymentServiceReady: progress.payment_service_ready,
      profileCompleted: progress.profile_completed,
      organizationCompleted: progress.organization_completed,
      schoolCompleted: progress.school_completed,
      ownerCompleted: progress.owner_completed,
      completedAt: progress.completed_at,
      activatedAt: progress.activated_at,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/onboarding/verify-account
// Legacy endpoint for bank account verification
// ==========================================================
router.post('/verify-account', async (req, res) => {
  const { bank, accountNumber } = req.body;

  if (!bank || !accountNumber) {
    return res.status(400).json({ error: 'Bank and account number required' });
  }

  // Mock verification - in production, call provider API
  const mockAccounts = {
    '0123456789': 'Ade Johnson Educational Services',
    '0987654321': 'CAPFLUX International School',
  };

  await new Promise(resolve => setTimeout(resolve, 500));

  if (accountNumber.length >= 10) {
    return res.json({
      verified: true,
      accountName: mockAccounts[accountNumber] || 'Verified Account Name',
    });
  }

  return res.json({ verified: false, error: 'Account not found' });
});

// ==========================================================
// PUT /api/onboarding/business-type
// Update the business_type on the current user's school.
// Used by the KYC flow where the school already exists.
// ==========================================================
router.put('/business-type', async (req, res) => {
  const { businessType } = req.body;

  if (!businessType || !isValidBusinessType(businessType)) {
    return res.status(400).json({ error: 'A valid business type is required.' });
  }

  try {
    const normalized = normalizeLegacyBusinessType(businessType);
    if (!normalized) {
      return res.status(400).json({ error: 'Invalid business type.' });
    }

    const { data: schoolMember } = await supabase
      .from('school_members')
      .select('school_id')
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .single();

    if (!schoolMember) {
      return res.status(404).json({ error: 'No school found. Complete onboarding first.' });
    }

    await supabase
      .from('schools')
      .update({ business_type: normalized })
      .eq('id', schoolMember.school_id);

    return res.json({ success: true, data: { businessType: normalized } });
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;