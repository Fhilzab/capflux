import { Router, Request, Response } from 'express';
import { supabase } from '../supabaseClient.js';
import requireAuthSupabase from '../middleware/requireAuthSupabase.js';
import { normalizeLegacyBusinessType, isValidBusinessType } from '../services/validators.js';
import { errorMessage } from '../types/http.js';

const router = Router();

const handleError = (res: Response, error: unknown, fallbackStatus = 500): Response => {
  const status = (error as { statusCode?: number })?.statusCode || fallbackStatus;
  const message = errorMessage(error) || 'Internal server error';
  return res.status(status).json({ error: message });
};

// Phase 4: Switch to Supabase Auth (JWT Bearer token).
router.use(requireAuthSupabase);

// ==========================================================
// GET /api/onboarding/status
// Returns the onboarding checklist state for the current user,
// including the school's business_type (normalized from legacy values).
// ==========================================================
router.get('/status', async (req: Request, res: Response) => {
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
    const base = data as { has_school?: boolean; school_id?: string } | null;
    let enriched = data;
    if (base && base.has_school && base.school_id) {
      const { data: school } = await supabase
        .from('schools')
        .select('business_type, cac_number, tax_identification_number')
        .eq('id', base.school_id)
        .single();

      if (school) {
        const s = school as { business_type?: string | null; cac_number?: string | null; tax_identification_number?: string | null };
        enriched = {
          ...base,
          business_type: normalizeLegacyBusinessType(s.business_type),
          cac_number: s.cac_number || null,
          tax_identification_number: s.tax_identification_number || null,
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
router.get('/profile', async (req: Request, res: Response) => {
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

    const p = data as Record<string, unknown>;

    return res.json({
      success: true,
      data: {
        firstName: p.first_name,
        middleName: p.middle_name,
        lastName: p.last_name,
        phone: p.phone,
        dateOfBirth: p.date_of_birth,
        country: p.country,
        state: p.state_of_origin,
        lga: p.lga_of_origin,
        residentialAddress: p.residential_address,
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
router.post('/profile', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
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
  } = body;

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
        first_name: firstName as string,
        middle_name: (middleName as string) || null,
        last_name: lastName as string,
        phone: (phone as string) || null,
        date_of_birth: (dateOfBirth as string) || null,
        country: (country as string) || null,
        state_of_origin: (state as string) || null,
        lga_of_origin: (lga as string) || null,
        residential_address: (residentialAddress as string) || null,
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
          school_id: (schoolMember as { school_id: string }).school_id,
          profile_completed: true,
        })
        .eq('school_id', (schoolMember as { school_id: string }).school_id);
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
router.post('/organization', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { name, businessType } = body;

  if (!name) {
    return res.status(400).json({ error: 'Organization name is required.' });
  }

  // Validate business_type if provided
  let normalizedBusinessType: ReturnType<typeof normalizeLegacyBusinessType> = null;
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
          .eq('id', (schoolMember as { school_id: string }).school_id);
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
        .eq('school_id', (schoolMember as { school_id: string }).school_id);
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
router.post('/school', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
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
  } = body;

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
      p_organization_id: (orgMember as { organization_id: string }).organization_id,
      p_name: name,
      p_owner_user_id: req.user.id,
      p_address: (address as string) || null,
      p_state: (state as string) || null,
      p_lga: (lga as string) || null,
      p_country: (country as string) || 'Nigeria',
      p_school_type: (schoolType as string) || 'MIXED',
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
        school_levels: (schoolLevels as unknown[]) || [],
        school_category: (schoolCategory as string) || null,
        gender: (gender as string) || 'MIXED',
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
router.post('/owner-info', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { phone, designation, alternateContact } = body;

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
          designation: (designation as string) || null,
          alternate_contact: (alternateContact as string) || null,
        }),
      })
      .eq('school_id', (schoolMember as { school_id: string }).school_id);

    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/onboarding/save-progress
// Persist onboarding progress (for resume later)
// ==========================================================
router.post('/save-progress', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { profileCompleted, organizationCompleted, schoolCompleted, ownerCompleted } = body;

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

    const updateData: Record<string, unknown> = {};
    if (profileCompleted !== undefined) updateData.profile_completed = profileCompleted;
    if (organizationCompleted !== undefined) updateData.organization_completed = organizationCompleted;
    if (schoolCompleted !== undefined) updateData.school_completed = schoolCompleted;
    if (ownerCompleted !== undefined) updateData.owner_completed = ownerCompleted;

    if (Object.keys(updateData).length > 0) {
      await supabase
        .from('onboarding_progress')
        .update(updateData)
        .eq('school_id', (schoolMember as { school_id: string }).school_id);
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
router.post('/complete', async (req: Request, res: Response) => {
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
    const memberSchoolId = (schoolMember as { school_id: string }).school_id;

    // Call the complete_onboarding function
    const { error } = await supabase.rpc('complete_onboarding', {
      p_school_id: memberSchoolId,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Fetch updated school
    const { data: school } = await supabase
      .from('schools')
      .select('id, name, status, payment_status')
      .eq('id', memberSchoolId)
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
router.get('/schools/:schoolId/state', async (req: Request, res: Response) => {
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

    const p = progress as Record<string, unknown>;

    return res.json({
      schoolId,
      stage: p.stage,
      completedSteps: p.completed_steps || [],
      businessVerified: p.business_verified,
      settlementVerified: p.settlement_verified,
      paymentServiceReady: p.payment_service_ready,
      profileCompleted: p.profile_completed,
      organizationCompleted: p.organization_completed,
      schoolCompleted: p.school_completed,
      ownerCompleted: p.owner_completed,
      completedAt: p.completed_at,
      activatedAt: p.activated_at,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// ==========================================================
// POST /api/onboarding/verify-account
// Legacy endpoint for bank account verification
// ==========================================================
router.post('/verify-account', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { bank, accountNumber } = body;

  if (!bank || !accountNumber) {
    return res.status(400).json({ error: 'Bank and account number required' });
  }

  // Mock verification - in production, call provider API
  const mockAccounts: Record<string, string> = {
    '0123456789': 'Ade Johnson Educational Services',
    '0987654321': 'CAPFLUX International School',
  };

  await new Promise(resolve => setTimeout(resolve, 500));

  if (String(accountNumber).length >= 10) {
    return res.json({
      verified: true,
      accountName: mockAccounts[String(accountNumber)] || 'Verified Account Name',
    });
  }

  return res.json({ verified: false, error: 'Account not found' });
});

// ==========================================================
// PUT /api/onboarding/business-type
// Update the business_type on the current user's school.
// Used by the KYC flow where the school already exists.
// ==========================================================
router.put('/business-type', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { businessType } = body;

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
      .eq('id', (schoolMember as { school_id: string }).school_id);

    return res.json({ success: true, data: { businessType: normalized } });
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;
