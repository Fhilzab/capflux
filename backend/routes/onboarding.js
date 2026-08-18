import express from 'express';
import { supabase } from '../supabaseClient.js';
import requireAuthSupabase from '../middleware/requireAuthSupabase.js';

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
// Returns the onboarding checklist state for the current user
// ==========================================================
router.get('/status', async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_onboarding_status', {
      p_user_id: req.user.id,
    });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/onboarding/profile
// Update user profile (full name, phone)
// ==========================================================
router.post('/profile', async (req, res) => {
  const { fullName, phone } = req.body;

  if (!fullName) {
    return res.status(400).json({ error: 'Full name is required.' });
  }

  try {
    // Update user_profiles
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: req.user.id,
        full_name: fullName,
        phone: phone || null,
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
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Organization name is required.' });
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
    academicCalendar,
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

export default router;