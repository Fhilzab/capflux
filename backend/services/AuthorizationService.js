/**
 * AuthorizationService — canonical RBAC authorization.
 *
 * Canonical identity path (Phase 4 — Supabase Auth):
 *   req.user (verified from Supabase JWT via requireAuthSupabase)
 *   -> public.users.id
 *   -> school_members
 *   -> roles -> permissions
 *
 * This service derives authorization from the authenticated user's school
 * membership and role permissions. It is the single authorization layer used
 * by backend routes. Legacy x-user-id/x-school-id header auth is NOT used.
 *
 * The service uses the shared supabase client (canonical SUPABASE_SECRET_KEY
 * service-role client) so it can read membership/roles without RLS.
 */
import { supabase } from '../supabaseClient.js';

class AuthorizationService {
  /**
   * Get the caller's active school membership with role for a given user id.
   * Returns null when the user has no active membership in the school.
   */
  async getSchoolMembership(userId, schoolId) {
    if (!userId || !schoolId) return null;

    const { data, error } = await supabase
      .from('school_members')
      .select('id, school_id, role_id, roles!inner(id, system_role, is_system_role)')
      .eq('user_id', userId)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.warn('AuthorizationService.getSchoolMembership error:', error.message);
      return null;
    }
    if (!data) return null;

    return {
      id: data.id,
      schoolId: data.school_id,
      roleId: data.role_id,
      role: data.roles?.system_role || null,
    };
  }

  /**
   * Get the caller's first active school membership (any school).
   */
  async getPrimarySchoolMembership(userId) {
    if (!userId) return null;

    const { data, error } = await supabase
      .from('school_members')
      .select('id, school_id, role_id, roles!inner(id, system_role)')
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
      role: data.roles?.system_role || null,
    };
  }

  /**
   * Resolve the caller's organization membership.
   */
  async getOrganizationMembership(userId) {
    if (!userId) return null;

    const { data, error } = await supabase
      .from('organization_members')
      .select('organization_id, role_id, roles!inner(id, system_role)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return {
      organizationId: data.organization_id,
      role: data.roles?.system_role || null,
    };
  }

  /**
   * Check whether a user has any of the given system roles in a school.
   */
  async checkRole(userId, schoolId, allowedRoles) {
    const membership = await this.getSchoolMembership(userId, schoolId);
    if (!membership) return false;
    return allowedRoles.includes(membership.role);
  }

  /**
   * Check whether a user has a specific permission code in a school.
   * Resolves role -> role_permissions -> permissions.
   */
  async checkPermission(userId, schoolId, permissionCode) {
    const membership = await this.getSchoolMembership(userId, schoolId);
    if (!membership) return false;

    // SUPER_ADMIN bypass.
    if (membership.role === 'SUPER_ADMIN') return true;

    const { data, error } = await supabase
      .from('role_permissions')
      .select('permissions!inner(code)')
      .eq('role_id', membership.roleId);

    if (error) {
      console.warn('AuthorizationService.checkPermission error:', error.message);
      return false;
    }

    return (data || []).some((rp) => rp.permissions?.code === permissionCode);
  }

  async assertPermission(userId, schoolId, permissionCode) {
    const allowed = await this.checkPermission(userId, schoolId, permissionCode);
    if (!allowed) {
      const err = new Error('INSUFFICIENT_PERMISSIONS');
      err.code = 'INSUFFICIENT_PERMISSIONS';
      err.statusCode = 403;
      throw err;
    }
  }

  /**
   * Log an audit event for an actor.
   */
  async logAudit(schoolId, actorId, action, entity, entityId, metadata = {}) {
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        school_id: schoolId,
        actor_id: actorId,
        action,
        entity,
        entity_id: entityId,
        metadata,
      });
    if (error) {
      console.warn('Failed to log audit event:', error.message);
    }
  }
}

export { AuthorizationService };
export default new AuthorizationService();
