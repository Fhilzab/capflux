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
import type { AppError } from '../types/http.js';
import type {
  PermissionRow,
  RoleRow,
  SchoolMemberWithRole,
  SystemRole,
} from '../types/db.js';
type OrganizationMemberJoined = {
  organization_id: string;
  role_id: string | null;
  roles?: Pick<RoleRow, 'system_role'> | null;
};

type RolePermissionCodeJoin = { permissions?: Pick<PermissionRow, 'code'> | null };

export interface SchoolMembership {
  id?: string;
  schoolId: string;
  roleId?: string | null;
  role: SystemRole | null;
}

export interface OrganizationMembership {
  organizationId: string;
  role: SystemRole | null;
}

class AuthorizationService {
  /**
   * Get the caller's active school membership with role for a given user id.
   * Returns null when the user has no active membership in the school.
   */
  async getSchoolMembership(userId: unknown, schoolId: unknown): Promise<SchoolMembership | null> {
    if (!userId || !schoolId) return null;

    const { data, error } = await supabase
      .from('school_members')
      .select('id, school_id, role_id, roles!inner(id, system_role, is_system_role)')
      .eq('user_id', userId as string)
      .eq('school_id', schoolId as string)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.warn('AuthorizationService.getSchoolMembership error:', error.message);
      return null;
    }
    if (!data) return null;

    const row = data as unknown as SchoolMemberWithRole;
    return {
      id: row.id,
      schoolId: row.school_id,
      roleId: row.role_id,
      role: row.roles?.system_role || null,
    };
  }

  /**
   * Get the caller's first active school membership (any school).
   */
  async getPrimarySchoolMembership(userId: unknown): Promise<SchoolMembership | null> {
    if (!userId) return null;

    const { data, error } = await supabase
      .from('school_members')
      .select('id, school_id, role_id, roles!inner(id, system_role)')
      .eq('user_id', userId as string)
      .eq('is_active', true)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    const row = data as unknown as SchoolMemberWithRole;
    return {
      id: row.id,
      schoolId: row.school_id,
      roleId: row.role_id,
      role: row.roles?.system_role || null,
    };
  }

  /**
   * Resolve the caller's organization membership.
   */
  async getOrganizationMembership(userId: unknown): Promise<OrganizationMembership | null> {
    if (!userId) return null;

    const { data, error } = await supabase
      .from('organization_members')
      .select('organization_id, role_id, roles!inner(id, system_role)')
      .eq('user_id', userId as string)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    const row = data as unknown as OrganizationMemberJoined;
    return {
      organizationId: row.organization_id,
      role: row.roles?.system_role || null,
    };
  }

  /**
   * Check whether a user has any of the given system roles in a school.
   */
  async checkRole(userId: unknown, schoolId: unknown, allowedRoles: SystemRole[]): Promise<boolean> {
    const membership = await this.getSchoolMembership(userId, schoolId);
    if (!membership) return false;
    return allowedRoles.includes(membership.role as SystemRole);
  }

  /**
   * Check whether a user has a specific permission code in a school.
   * Resolves role -> role_permissions -> permissions.
   */
  async checkPermission(userId: unknown, schoolId: unknown, permissionCode: string): Promise<boolean> {
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

    return ((data ?? []) as unknown as Array<RolePermissionCodeJoin>)
      .some((rp) => rp.permissions?.code === permissionCode);
  }

  async assertPermission(userId: unknown, schoolId: unknown, permissionCode: string): Promise<void> {
    const allowed = await this.checkPermission(userId, schoolId, permissionCode);
    if (!allowed) {
      const err = Object.assign(new Error('INSUFFICIENT_PERMISSIONS'), {
        code: 'INSUFFICIENT_PERMISSIONS',
        statusCode: 403,
      }) as AppError;
      throw err;
    }
  }

  /**
   * Log an audit event for an actor.
   */
  async logAudit(schoolId: string, actorId: string | null | undefined, action: string, entity: string, entityId: string | null | undefined, metadata: Record<string, unknown> = {}): Promise<void> {
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        school_id: schoolId,
        actor_id: actorId,
        action,
        entity,
        entity_id: entityId as string | null,
        metadata,
      });
    if (error) {
      console.warn('Failed to log audit event:', error.message);
    }
  }
}

export { AuthorizationService };
export default new AuthorizationService();
