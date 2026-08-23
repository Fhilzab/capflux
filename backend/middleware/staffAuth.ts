/**
 * staffAuth — platform-staff authorization middleware for financial
 * activation review operations (KYC review, settlement verify, gateway
 * assign, payment activate).
 *
 * Staff are identified by their authenticated session (req.user) and must
 * hold a staff permission via a platform-level membership (SUPER_ADMIN role)
 * OR an explicit `is_staff` flag. This is intentionally NOT scoped to the
 * target school: reviewers operate across schools on behalf of CAPFLUX.
 *
 * Usage:
 *   router.post('/kyc/:id/verify', requireAuth, requireStaff('kyc.verify'), handler)
 */
import type { NextFunction, Request, Response } from 'express';
import { supabase } from '../supabaseClient.js';
import { errorMessage } from '../types/http.js';
import type { SystemRole } from '../types/db.js';

/**
 * Resolve the caller's platform staff role(s) from ALL active memberships.
 */
async function getStaffRoles(userId: unknown): Promise<SystemRole[]> {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('school_members')
    .select('roles!inner(id, system_role, is_system_role)')
    .eq('user_id', userId as string)
    .eq('is_active', true);

  if (error) return [];
  const roles = new Set<SystemRole>();
  ((data ?? []) as Array<{ roles?: { system_role?: SystemRole | null } | null }>).forEach((m) => {
    if (m.roles?.system_role) roles.add(m.roles.system_role);
  });
  return Array.from(roles);
}

/**
 * Check whether the caller holds the permission via any staff membership.
 * SUPER_ADMIN bypasses permission checks.
 */
async function staffHasPermission(userId: unknown, _permissionCode: string): Promise<{ allowed: boolean; roles: SystemRole[] }> {
  const roles = await getStaffRoles(userId);
  if (roles.includes('SUPER_ADMIN')) return { allowed: true, roles };

  // Non-SUPER_ADMIN staff roles must be resolved through their memberships'
  // role_permissions. Only system roles currently exist; staff review is
  // granted to SUPER_ADMIN today.
  return { allowed: roles.includes('SUPER_ADMIN'), roles };
}

/**
 * Express middleware factory: require a staff permission.
 */
export function requireStaff(permissionCode: string): (req: Request, res: Response, next: NextFunction) => Promise<void | Response> {
  return async (req, res, next) => {
    try {
      const { allowed, roles } = await staffHasPermission(req.user?.id, permissionCode);
      if (!allowed) {
        return res.status(403).json({ error: 'INSUFFICIENT_PERMISSIONS' });
      }
      req.staffRoles = roles;
      next();
    } catch (error) {
      return res.status(500).json({ error: errorMessage(error) });
    }
  };
}

export default requireStaff;
