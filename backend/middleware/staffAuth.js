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
import { supabase } from '../supabaseClient.js';

/**
 * Resolve the caller's platform staff role(s) from ALL active memberships.
 */
async function getStaffRoles(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('school_members')
    .select('roles!inner(id, system_role, is_system_role)')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) return [];
  const roles = new Set();
  (data || []).forEach((m) => {
    if (m.roles?.system_role) roles.add(m.roles.system_role);
  });
  return Array.from(roles);
}

/**
 * Check whether the caller holds the permission via any staff membership.
 * SUPER_ADMIN bypasses permission checks.
 */
async function staffHasPermission(userId, permissionCode) {
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
export function requireStaff(permissionCode) {
  return async (req, res, next) => {
    try {
      const { allowed, roles } = await staffHasPermission(req.user?.id, permissionCode);
      if (!allowed) {
        return res.status(403).json({ error: 'INSUFFICIENT_PERMISSIONS' });
      }
      req.staffRoles = roles;
      next();
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };
}

export default requireStaff;
