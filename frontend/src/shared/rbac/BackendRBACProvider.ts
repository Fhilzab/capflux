/**
 * BackendRBACProvider — RBAC resolved through the CAPFLUX backend.
 *
 * Replaces the broken direct-Supabase RBAC path. Identity, membership, roles,
 * and permissions are resolved server-side from the authenticated WorkOS
 * session (/api/context/rbac). The frontend never queries Supabase directly.
 */
import { apiClient } from '@/shared/services/api/client';
import type { RBACProvider } from './RBACProvider';
import type { Role, Permission, Membership, OrganizationMembership, SystemRole } from './types';

const SYSTEM_ROLE_VALUES = new Set<string>(['SUPER_ADMIN', 'OWNER', 'ADMIN', 'BURSAR', 'PARENT']);

interface ContextRBAC {
  membership: {
    id: string;
    schoolId: string;
    roleId: string;
    role: { id: string; name: string; system_role?: string; is_system_role?: boolean } | null;
    joinedAt?: string;
  } | null;
  roles: string[];
  permissions: string[];
}

let cached: ContextRBAC | null = null;

async function loadContextRBAC(): Promise<ContextRBAC> {
  if (cached) return cached;
  const { data } = await apiClient.http.get('/context/rbac');
  cached = data?.data ?? null;
  return cached;
}

function toRole(role: { id: string; name: string; system_role?: string; is_system_role?: boolean } | null | undefined, organizationId?: string | null): Role | null {
  if (!role) return null;
  const systemRole = role.system_role && SYSTEM_ROLE_VALUES.has(role.system_role)
    ? (role.system_role as SystemRole)
    : undefined;
  return {
    id: role.id,
    organizationId: organizationId || undefined,
    name: role.name,
    systemRole: systemRole,
    isSystemRole: role.is_system_role ?? true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

export class BackendRBACProvider implements RBACProvider {
  clearCache(): void {
    cached = null;
  }

  // === ROLE OPERATIONS ===

  async getUserRoles(userId: string, schoolId: string): Promise<Role[]> {
    const ctx = await loadContextRBAC();
    const role = ctx.membership?.role;
    const roleObj = toRole(role, ctx.membership?.roleId);
    // Only return the role if it belongs to the requested school.
    if (ctx.membership?.schoolId !== schoolId) return [];
    return roleObj ? [roleObj] : [];
  }

  async getOrganizationRoles(organizationId: string): Promise<Role[]> {
    // Organization-scoped roles are not yet exposed by the backend context;
    // the school membership role is the authoritative role today.
    const ctx = await loadContextRBAC();
    const role = toRole(ctx.membership?.role);
    return role ? [role] : [];
  }

  async getSystemRoles(): Promise<Role[]> {
    const ctx = await loadContextRBAC();
    const role = toRole(ctx.membership?.role);
    return role && role.systemRole ? [role] : [];
  }

  // === PERMISSION OPERATIONS ===

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const ctx = await loadContextRBAC();
    if (ctx.membership?.roleId !== roleId) return [];
    return (ctx.permissions || []).map((code) => {
      const [resource = '', action = ''] = code.split('.');
      return {
        id: `backend:${code}`,
        code,
        resource,
        action,
        createdAt: new Date(0),
      };
    });
  }

  async getUserPermissions(userId: string, schoolId: string): Promise<Permission[]> {
    const ctx = await loadContextRBAC();
    if (ctx.membership?.schoolId !== schoolId) return [];
    return this.getRolePermissions(ctx.membership.roleId);
  }

  async getPermission(code: string): Promise<Permission | null> {
    const ctx = await loadContextRBAC();
    if (!ctx.permissions.includes(code)) return null;
    const [resource = '', action = ''] = code.split('.');
    return { id: `backend:${code}`, code, resource, action, createdAt: new Date(0) };
  }

  async listPermissions(resource?: string): Promise<Permission[]> {
    const ctx = await loadContextRBAC();
    return (ctx.permissions || [])
      .filter((code) => !resource || code.startsWith(`${resource}.`))
      .map((code) => {
        const [r = '', a = ''] = code.split('.');
        return { id: `backend:${code}`, code, resource: r, action: a, createdAt: new Date(0) };
      });
  }

  // === MEMBERSHIP OPERATIONS ===

  async getSchoolMembership(userId: string, schoolId: string): Promise<Membership | null> {
    const ctx = await loadContextRBAC();
    if (!ctx.membership || ctx.membership.schoolId !== schoolId) return null;
    return {
      id: ctx.membership.id,
      userId,
      schoolId: ctx.membership.schoolId,
      roleId: ctx.membership.roleId,
      role: toRole(ctx.membership.role) || undefined,
      joinedAt: ctx.membership.joinedAt ? new Date(ctx.membership.joinedAt) : new Date(0),
      isActive: true,
    };
  }

  async getOrganizationMembership(userId: string, organizationId: string): Promise<OrganizationMembership | null> {
    const ctx = await loadContextRBAC();
    if (!ctx.membership) return null;
    // The backend context does not yet expose org membership; the school
    // membership role is used as the organization role for now.
    return {
      id: ctx.membership.id,
      userId,
      organizationId,
      roleId: ctx.membership.roleId,
      role: toRole(ctx.membership.role) || undefined,
      joinedAt: new Date(0),
      isActive: true,
    };
  }

  async getUserMemberships(userId: string): Promise<Membership[]> {
    const m = await this.getSchoolMembership(userId, cached?.membership?.schoolId ?? '');
    return m ? [m] : [];
  }

  async getUserOrganizationMemberships(userId: string): Promise<OrganizationMembership[]> {
    const ctx = await loadContextRBAC();
    if (!ctx.membership) return [];
    return [{
      id: ctx.membership.id,
      userId,
      organizationId: '',
      roleId: ctx.membership.roleId,
      role: toRole(ctx.membership.role) || undefined,
      joinedAt: new Date(0),
      isActive: true,
    }];
  }

  async getUserSystemRoles(userId: string): Promise<Role[]> {
    return this.getSystemRoles();
  }

  // === ROLE ASSIGNMENT OPERATIONS (not supported via backend context) ===

  async assignRole(): Promise<Membership> {
    throw new Error('Role assignment is a backend-admin operation');
  }

  async removeRole(): Promise<void> {
    throw new Error('Role removal is a backend-admin operation');
  }

  async updateRole(): Promise<Membership> {
    throw new Error('Role update is a backend-admin operation');
  }

  // === BULK OPERATIONS ===

  async getMembershipsBySchool(schoolId: string): Promise<Membership[]> {
    const ctx = await loadContextRBAC();
    if (ctx.membership?.schoolId !== schoolId) return [];
    return [{
      id: ctx.membership.id,
      userId: '',
      schoolId: ctx.membership.schoolId,
      roleId: ctx.membership.roleId,
      role: toRole(ctx.membership.role) || undefined,
      joinedAt: new Date(0),
      isActive: true,
    }];
  }

  async getMembershipsByOrganization(): Promise<OrganizationMembership[]> {
    return [];
  }
}

export const backendRBACProvider = new BackendRBACProvider();
