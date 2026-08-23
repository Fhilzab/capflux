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
import { Router, Request, Response } from 'express';
import { supabase } from '../supabaseClient.js';
import requireAuthSupabase from '../middleware/requireAuthSupabase.js';
import { errorMessage, errorStatusCode } from '../types/http.js';
import type {
  RoleRow,
  SchoolMemberWithRole,
  SchoolRow,
  UserProfileRow,
} from '../types/db.js';

interface OrganizationMemberJoined {
  organization_id: string;
  role_id: string | null;
  joined_at: string | null;
  organizations: Pick<SchoolOrgRef, 'id' | 'name' | 'slug'> | null;
  roles: Pick<RoleRow, 'id' | 'name' | 'system_role'> | null;
}
interface SchoolOrgRef { id: string; name: string | null; slug: string | null }

const router = Router();
// Phase 4: Switch to Supabase Auth (JWT Bearer token).
// WorkOS requireAuth is preserved in backend/middleware/requireAuth.ts for rollback.
router.use(requireAuthSupabase);

const handleError = (res: Response, error: unknown, fallbackStatus = 500): Response => {
  const status = errorStatusCode(error) || fallbackStatus;
  const message = errorMessage(error) || 'Internal server error';
  return res.status(status).json({ error: message });
};

interface PrimaryMembership {
  id: string;
  schoolId: string;
  roleId: string;
  joinedAt: unknown;
  role: SchoolMemberWithRole['roles'] | null;
}

/**
 * Resolve the user's active school membership (primary).
 */
async function getPrimaryMembership(userId: string): Promise<PrimaryMembership | null> {
  const { data, error } = await supabase
    .from('school_members')
    .select('id, school_id, role_id, joined_at, left_at, is_active, roles!inner(id, name, system_role, is_system_role)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as unknown as SchoolMemberWithRole & { id: string; school_id: string; role_id: string };
  return {
    id: row.id,
    schoolId: row.school_id,
    roleId: row.role_id,
    joinedAt: row.joined_at,
    role: row.roles || null,
  };
}

/**
 * Resolve permissions for a role id.
 */
async function getRolePermissions(roleId: string): Promise<Array<{ code?: string | null }>> {
  const { data, error } = await supabase
    .from('role_permissions')
    .select('permissions!inner(id, code, resource, action)')
    .eq('role_id', roleId);
  if (error) return [];
  return ((data ?? []) as Array<{ permissions?: { code?: string | null } | null }>)
    .map((rp) => rp.permissions)
    .filter((p): p is { code?: string | null } => Boolean(p));
}

// GET /api/context/me
router.get('/me', async (req: Request, res: Response) => {
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
        profile: profile ?? null,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// GET /api/context/org
router.get('/org', async (req: Request, res: Response) => {
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

    const row = data as unknown as OrganizationMemberJoined;

    return res.json({
      success: true,
      data: {
        organization: row.organizations,
        membership: {
          organizationId: row.organization_id,
          roleId: row.role_id,
          role: row.roles || null,
          joinedAt: row.joined_at,
        },
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
});

// GET /api/context/school
router.get('/school', async (req: Request, res: Response) => {
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
        school: (school as unknown as SchoolRow) ?? null,
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
router.get('/rbac', async (req: Request, res: Response) => {
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
router.get('/', async (req: Request, res: Response) => {
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

    const profile = (profileResult.data as unknown as UserProfileRow) || null;

    const org = orgResult.data
      ? (orgResult.data as unknown as OrganizationMemberJoined)
      : null;
    const school = (schoolResult.data as unknown as SchoolRow) || null;

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
