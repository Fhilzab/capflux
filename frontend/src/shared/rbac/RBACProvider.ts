/**
 * RBAC Provider Interface
 * Abstract interface for RBAC data operations
 */

import type { Role, Permission, Membership, OrganizationMembership } from './types';

export interface RBACProvider {
  // Role operations
  getUserRoles(userId: string, schoolId: string): Promise<Role[]>;
  getOrganizationRoles(organizationId: string): Promise<Role[]>;
  getSystemRoles(): Promise<Role[]>;

  // Permission operations
  getRolePermissions(roleId: string): Promise<Permission[]>;
  getUserPermissions(userId: string, schoolId: string): Promise<Permission[]>;
  getPermission(code: string): Promise<Permission | null>;
  listPermissions(resource?: string): Promise<Permission[]>;

  // Membership operations
  getSchoolMembership(userId: string, schoolId: string): Promise<Membership | null>;
  getOrganizationMembership(userId: string, organizationId: string): Promise<OrganizationMembership | null>;
  getUserMemberships(userId: string): Promise<Membership[]>;
  getUserOrganizationMemberships(userId: string): Promise<OrganizationMembership[]>;
  getUserSystemRoles(userId: string): Promise<Role[]>;

  // Role assignment operations
  assignRole(userId: string, roleId: string, schoolId: string, assignedBy: string): Promise<Membership>;
  removeRole(membershipId: string): Promise<void>;
  updateRole(membershipId: string, newRoleId: string): Promise<Membership>;

  // Bulk operations
  getMembershipsBySchool(schoolId: string): Promise<Membership[]>;
  getMembershipsByOrganization(organizationId: string): Promise<OrganizationMembership[]>;
}