/**
 * Context Route — consolidated authenticated context for the frontend.
 *
 * Replaces the broken direct-Supabase (anon key, auth.uid()=NULL) data plane.
 * Everything here is resolved server-side from the verified WorkOS session.
 *
 * Endpoints:
 *   GET /api/context/me         — current user profile (users + user_profiles)
 *   GET /api/context/org        — organization + membership
 *   GET /api/context/school     — current school (via active membership)
 *   GET /api/context/rbac       — roles + permissions for the current scope
 *   GET /api/context           — everything above in one call
 */
import express from 'express';
import { supabase } from '../supabaseClient.js';
import requireAuth from '../middleware/requireAuth.js';

const router = express.Router();
router.use(requireAuth);

const handleError = (res, error, fallbackStatus = 500) => {
  const status = error?.statusCode || fallbackStatus;
  const message = error?.message || 'Internal server error';
  return res.status(status).json({ error: message });
};

/**
 * Resolve the user's active school membership (primary).
 */
async function getPrimaryMembership(userId) {
  const { data, error } = await supabase
    .from('school_members')
    .select('id, school_id, role_id, joined_at, left_at, is_active, roles!inner(id, name, system_role, is_system_role)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id,
    schoolId: data.school_id,
    roleId: data.role_id,
    joinedAt: data.joined_at,
    role: data.roles || null,
  };
}

/**
 * Resolve permissions for a role id.
 */
async function getRolePermissions(roleId) {
  const { data, error } = await supabase
    .from('role_permissions')
    .select('permissions!inner(id, code, resource, action)')
    .eq('role_id', roleId);
  if (error) return [];
  return (data || []).map((rp) => rp.permissions).filter(Boolean);
}

// GET /api/context/me
router.get('/me', async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });

    return res.json({
      success: true,
      data: {
        user: req.user,
        profile: profile || null,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// GET /api/context/org
router.get('/org', async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('organization_members')
      .select('organization_id, role_id, joined_at, organizations!inner(id, name, slug), roles!inner(id, name, system_role)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });

    if (!data) {
      return res.json({ success: true, data: { organization: null, membership: null } });
    }

    return res.json({
      success: true,
      data: {
        organization: data.organizations,
        membership: {
          organizationId: data.organization_id,
          roleId: data.role_id,
          role: data.roles || null,
          joinedAt: data.joined_at,
        },
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// GET /api/context/school
router.get('/school', async (req, res) => {
  try {
    const membership = await getPrimaryMembership(req.user.id);
    if (!membership) {
      return res.json({ success: true, data: { school: null, membership: null } });
    }

    const { data: school, error } = await supabase
      .from('schools')
      .select('*')
      .eq('id', membership.schoolId)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });

    return res.json({
      success: true,
      data: {
        school: school || null,
        membership: {
          id: membership.id,
          schoolId: membership.schoolId,
          roleId: membership.roleId,
          role: membership.role,
          joinedAt: membership.joinedAt,
        },
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// GET /api/context/rbac
router.get('/rbac', async (req, res) => {
  try {
    const membership = await getPrimaryMembership(req.user.id);

    if (!membership) {
      return res.json({ success: true, data: { roles: [], permissions: [], membership: null } });
    }

    const permissions = await getRolePermissions(membership.roleId);

    return res.json({
      success: true,
      data: {
        membership: {
          id: membership.id,
          schoolId: membership.schoolId,
          roleId: membership.roleId,
          role: membership.role,
          joinedAt: membership.joinedAt,
        },
        roles: [membership.role],
        permissions: permissions.map((p) => p.code),
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// GET /api/context — consolidated
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const membership = await getPrimaryMembership(userId);

    const [profileResult, orgResult, schoolResult] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase
        .from('organization_members')
        .select('organization_id, role_id, joined_at, organizations!inner(id, name, slug), roles!inner(id, name, system_role)')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle(),
      membership
        ? supabase.from('schools').select('*').eq('id', membership.schoolId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const profile = profileResult.data || null;
    const org = orgResult.data || null;
    const school = schoolResult.data || null;

    const permissions = membership
      ? await getRolePermissions(membership.roleId)
      : [];

    return res.json({
      success: true,
      data: {
        user: req.user,
        profile,
        organization: org ? org.organizations : null,
        organizationMembership: org
          ? { organizationId: org.organization_id, roleId: org.role_id, role: org.roles || null, joinedAt: org.joined_at }
          : null,
        school,
        schoolMembership: membership
          ? { id: membership.id, schoolId: membership.schoolId, roleId: membership.roleId, role: membership.role, joinedAt: membership.joinedAt }
          : null,
        roles: membership ? [membership.role] : [],
        permissions: permissions.map((p) => p.code),
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;
