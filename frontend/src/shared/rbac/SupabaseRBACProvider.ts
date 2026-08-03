/**
 * Supabase RBAC Provider
 * Database-backed implementation of RBACProvider
 * Contains NO business logic — only persistence/retrieval
 */

import { supabase } from '@/shared/services/api/supabase';
const client: any = supabase;
import type { RBACProvider } from './RBACProvider';
import type { Role, Permission, Membership, OrganizationMembership } from './types';

export class SupabaseRBACProvider implements RBACProvider {
  // === ROLE OPERATIONS ===

  async getUserRoles(userId: string, schoolId: string): Promise<Role[]> {
    const res: any = await client
      .from('school_members')
      .select(`
        role_id,
        roles!inner (
          id,
          organization_id,
          name,
          description,
          system_role,
          is_system_role,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', userId)
      .eq('school_id', schoolId)
      .eq('is_active', true);

    const { data, error } = res;
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.roles.id,
      organizationId: row.roles.organization_id,
      name: row.roles.name,
      description: row.roles.description,
      systemRole: row.roles.system_role,
      isSystemRole: row.roles.is_system_role,
      createdAt: new Date(row.roles.created_at),
      updatedAt: new Date(row.roles.updated_at),
    }));
  }

  async getOrganizationRoles(organizationId: string): Promise<Role[]> {
    const res2: any = await client
      .from('roles')
      .select('*')
      .eq('organization_id', organizationId);

    const { data, error } = res2;
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      description: row.description,
      systemRole: row.system_role,
      isSystemRole: row.is_system_role,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  async getSystemRoles(): Promise<Role[]> {
    const res3: any = await client
      .from('roles')
      .select('*')
      .eq('is_system_role', true);

    const { data, error } = res3;
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      description: row.description,
      systemRole: row.system_role,
      isSystemRole: row.is_system_role,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  // === PERMISSION OPERATIONS ===

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const res4: any = await client
      .from('role_permissions')
      .select(`
        permission_id,
        permissions!inner (
          id,
          code,
          description,
          resource,
          action,
          created_at
        )
      `)
      .eq('role_id', roleId);

    const { data, error } = res4;
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.permissions.id,
      code: row.permissions.code,
      description: row.permissions.description,
      resource: row.permissions.resource,
      action: row.permissions.action,
      createdAt: new Date(row.permissions.created_at),
    }));
  }

  async getUserPermissions(userId: string, schoolId: string): Promise<Permission[]> {
    const res5: any = await client
      .from('school_members')
      .select(`
        role_id,
        roles!inner (
          id,
          system_role,
          is_system_role,
          role_permissions!inner (
            permission_id,
            permissions!inner (
              id,
              code,
              description,
              resource,
              action,
              created_at
            )
          )
        )
      `)
      .eq('user_id', userId)
      .eq('school_id', schoolId)
      .eq('is_active', true);

    const { data, error } = res5;
    if (error) throw error;

    const permissionMap = new Map<string, Permission>();
    (data || []).forEach((row: any) => {
      const role = row.roles;
      role.role_permissions?.forEach((rp: any) => {
        const perm = rp.permissions;
        if (perm && !permissionMap.has(perm.code)) {
          permissionMap.set(perm.code, {
            id: perm.id,
            code: perm.code,
            description: perm.description,
            resource: perm.resource,
            action: perm.action,
            createdAt: new Date(perm.created_at),
          });
        }
      });
    });

    return Array.from(permissionMap.values());
  }

  async getPermission(code: string): Promise<Permission | null> {
    const res6: any = await client
      .from('permissions')
      .select('*')
      .eq('code', code)
      .single();

    const { data, error } = res6;
    if (error && (error as any).code !== 'PGRST116') throw error;
    if (!data) return null;

    return {
      id: data.id,
      code: data.code,
      description: data.description,
      resource: data.resource,
      action: data.action,
      createdAt: new Date(data.created_at),
    };
  }

  async listPermissions(resource?: string): Promise<Permission[]> {
    let query = client.from('permissions').select('*');
    if (resource) {
      query = query.eq('resource', resource);
    }

    const res7: any = await query;
    const { data, error } = res7;
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      code: row.code,
      description: row.description,
      resource: row.resource,
      action: row.action,
      createdAt: new Date(row.created_at),
    }));
  }

  // === MEMBERSHIP OPERATIONS ===

  async getSchoolMembership(userId: string, schoolId: string): Promise<Membership | null> {
    const res8: any = await client
      .from('school_members')
      .select(`
        id,
        user_id,
        school_id,
        role_id,
        invited_by,
        joined_at,
        left_at,
        is_active,
        roles!inner (
          id,
          organization_id,
          name,
          description,
          system_role,
          is_system_role,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', userId)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .single();

    const { data, error } = res8;
    if (error && (error as any).code !== 'PGRST116') throw error;
    if (!data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      schoolId: data.school_id,
      roleId: data.role_id,
      role: data.roles ? {
        id: data.roles.id,
        organizationId: data.roles.organization_id,
        name: data.roles.name,
        description: data.roles.description,
        systemRole: data.roles.system_role,
        isSystemRole: data.roles.is_system_role,
        createdAt: new Date(data.roles.created_at),
        updatedAt: new Date(data.roles.updated_at),
      } : undefined,
      invitedBy: data.invited_by,
      joinedAt: new Date(data.joined_at),
      leftAt: data.left_at ? new Date(data.left_at) : undefined,
      isActive: data.is_active,
    };
  }

  async getOrganizationMembership(userId: string, organizationId: string): Promise<OrganizationMembership | null> {
    const resOrg: any = await client
      .from('organization_members')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .single();

    const { data, error } = resOrg;
    if (error && (error as any).code !== 'PGRST116') throw error;
    if (!data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      organizationId: data.organization_id,
      roleId: data.role_id,
      joinedAt: new Date(data.joined_at),
      leftAt: data.left_at ? new Date(data.left_at) : undefined,
      isActive: data.is_active,
    };
  }

  async getUserMemberships(userId: string): Promise<Membership[]> {
    const resUserMems: any = await client
      .from('school_members')
      .select(`
        id,
        user_id,
        school_id,
        role_id,
        invited_by,
        joined_at,
        left_at,
        is_active,
        roles!inner (
          id,
          organization_id,
          name,
          description,
          system_role,
          is_system_role,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    const { data, error } = resUserMems;
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      schoolId: row.school_id,
      roleId: row.role_id,
      role: row.roles ? {
        id: row.roles.id,
        organizationId: row.roles.organization_id,
        name: row.roles.name,
        description: row.roles.description,
        systemRole: row.roles.system_role,
        isSystemRole: row.roles.is_system_role,
        createdAt: new Date(row.roles.created_at),
        updatedAt: new Date(row.roles.updated_at),
      } : undefined,
      invitedBy: row.invited_by,
      joinedAt: new Date(row.joined_at),
      leftAt: row.left_at ? new Date(row.left_at) : undefined,
      isActive: row.is_active,
    }));
  }

  async getUserOrganizationMemberships(userId: string): Promise<OrganizationMembership[]> {
    const res9: any = await client
      .from('organization_members')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    const { data, error } = res9;
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      organizationId: row.organization_id,
      roleId: row.role_id,
      joinedAt: new Date(row.joined_at),
      leftAt: row.left_at ? new Date(row.left_at) : undefined,
      isActive: row.is_active,
    }));
  }

  async getUserSystemRoles(userId: string): Promise<Role[]> {
    const resSysRoles: any = await client
      .from('organization_members')
      .select(`
        role_id,
        roles!inner (
          id,
          organization_id,
          name,
          description,
          system_role,
          is_system_role,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('roles.is_system_role', true);

    const { data, error } = resSysRoles;
    if (error) throw error;

    const uniqueRoles = new Map<string, Role>();
    (data || []).forEach((row: any) => {
      const role = row.roles;
      if (role && !uniqueRoles.has(role.id)) {
        uniqueRoles.set(role.id, {
          id: role.id,
          organizationId: role.organization_id,
          name: role.name,
          description: role.description,
          systemRole: role.system_role,
          isSystemRole: role.is_system_role,
          createdAt: new Date(role.created_at),
          updatedAt: new Date(role.updated_at),
        });
      }
    });

    return Array.from(uniqueRoles.values());
  }

  // === ROLE ASSIGNMENT OPERATIONS ===

  async assignRole(userId: string, roleId: string, schoolId: string, assignedBy: string): Promise<Membership> {
    const res10: any = await client
      .from('school_members')
      .insert({
        user_id: userId,
        role_id: roleId,
        school_id: schoolId,
        invited_by: assignedBy,
      })
      .select(`
        id,
        user_id,
        school_id,
        role_id,
        invited_by,
        joined_at,
        left_at,
        is_active,
        roles!inner (
          id,
          organization_id,
          name,
          description,
          system_role,
          is_system_role,
          created_at,
          updated_at
        )
      `)
      .single();

    const { data, error } = res10;
    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      schoolId: data.school_id,
      roleId: data.role_id,
      role: data.roles ? {
        id: data.roles.id,
        organizationId: data.roles.organization_id,
        name: data.roles.name,
        description: data.roles.description,
        systemRole: data.roles.system_role,
        isSystemRole: data.roles.is_system_role,
        createdAt: new Date(data.roles.created_at),
        updatedAt: new Date(data.roles.updated_at),
      } : undefined,
      invitedBy: data.invited_by,
      joinedAt: new Date(data.joined_at),
      leftAt: data.left_at ? new Date(data.left_at) : undefined,
      isActive: data.is_active,
    };
  }

  async removeRole(membershipId: string): Promise<void> {
    const res11: any = await client
      .from('school_members')
      .update({ is_active: false, left_at: new Date().toISOString() })
      .eq('id', membershipId);

    const { error } = res11;
    if (error) throw error;
  }

  async updateRole(membershipId: string, newRoleId: string): Promise<Membership> {
    const res12: any = await client
      .from('school_members')
      .update({ role_id: newRoleId })
      .eq('id', membershipId)
      .select(`
        id,
        user_id,
        school_id,
        role_id,
        invited_by,
        joined_at,
        left_at,
        is_active,
        roles!inner (
          id,
          organization_id,
          name,
          description,
          system_role,
          is_system_role,
          created_at,
          updated_at
        )
      `)
      .single();

    const { data, error } = res12;
    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      schoolId: data.school_id,
      roleId: data.role_id,
      role: data.roles ? {
        id: data.roles.id,
        organizationId: data.roles.organization_id,
        name: data.roles.name,
        description: data.roles.description,
        systemRole: data.roles.system_role,
        isSystemRole: data.roles.is_system_role,
        createdAt: new Date(data.roles.created_at),
        updatedAt: new Date(data.roles.updated_at),
      } : undefined,
      invitedBy: data.invited_by,
      joinedAt: new Date(data.joined_at),
      leftAt: data.left_at ? new Date(data.left_at) : undefined,
      isActive: data.is_active,
    };
  }

  // === BULK OPERATIONS ===

  async getMembershipsBySchool(schoolId: string): Promise<Membership[]> {
    const res13: any = await client
      .from('school_members')
      .select(`
        id,
        user_id,
        school_id,
        role_id,
        invited_by,
        joined_at,
        left_at,
        is_active,
        roles!inner (
          id,
          organization_id,
          name,
          description,
          system_role,
          is_system_role,
          created_at,
          updated_at
        )
      `)
      .eq('school_id', schoolId);
    const { data, error } = res13;
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      schoolId: row.school_id,
      roleId: row.role_id,
      role: row.roles ? {
        id: row.roles.id,
        organizationId: row.roles.organization_id,
        name: row.roles.name,
        description: row.roles.description,
        systemRole: row.roles.system_role,
        isSystemRole: row.roles.is_system_role,
        createdAt: new Date(row.roles.created_at),
        updatedAt: new Date(row.roles.updated_at),
      } : undefined,
      invitedBy: row.invited_by,
      joinedAt: new Date(row.joined_at),
      leftAt: row.left_at ? new Date(row.left_at) : undefined,
      isActive: row.is_active,
    }));
  }

  async getMembershipsByOrganization(organizationId: string): Promise<OrganizationMembership[]> {
    const res14: any = await client
      .from('organization_members')
      .select('*')
      .eq('organization_id', organizationId);

    const { data, error } = res14;
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      organizationId: row.organization_id,
      roleId: row.role_id,
      joinedAt: new Date(row.joined_at),
      leftAt: row.left_at ? new Date(row.left_at) : undefined,
      isActive: row.is_active,
    }));
  }
}

export const supabaseRBACProvider = new SupabaseRBACProvider();