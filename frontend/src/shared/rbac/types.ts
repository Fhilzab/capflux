/**
 * RBAC Domain Types
 * Defines the core models for Role-Based Access Control
 */

/**
 * System roles enumeration
 */
export enum SystemRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  BURSAR = 'BURSAR',
  PARENT = 'PARENT',
}

/**
 * Role model
 */
export interface Role {
  id: string;
  organizationId?: string;
  name: string;
  description?: string;
  systemRole?: SystemRole;
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Permission model
 */
export interface Permission {
  id: string;
  code: string; // e.g., 'billing.create', 'students.view'
  description?: string;
  resource: string; // e.g., 'billing', 'students', 'payments'
  action: string; // e.g., 'create', 'view', 'edit', 'delete'
  createdAt: Date;
}

/**
 * Membership model linking users to schools with roles
 */
export interface Membership {
  id: string;
  userId: string;
  schoolId: string;
  roleId: string;
  role?: Role;
  invitedBy?: string;
  joinedAt: Date;
  leftAt?: Date;
  isActive: boolean;
}

/**
 * Organization membership model
 */
export interface OrganizationMembership {
  id: string;
  userId: string;
  organizationId: string;
  roleId: string;
  role?: Role;
  joinedAt: Date;
  leftAt?: Date;
  isActive: boolean;
}

/**
 * Permission check result
 */
export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  permission?: string;
}

/**
 * RBAC Error codes
 */
export enum RBACErrorCode {
  ROLE_NOT_FOUND = 'ROLE_NOT_FOUND',
  PERMISSION_NOT_FOUND = 'PERMISSION_NOT_FOUND',
  MEMBERSHIP_NOT_FOUND = 'MEMBERSHIP_NOT_FOUND',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  MULTIPLE_SCHOOLS_NOT_ALLOWED = 'MULTIPLE_SCHOOLS_NOT_ALLOWED',
  SCHOOL_ACCESS_DENIED = 'SCHOOL_ACCESS_DENIED',
  ORGANIZATION_ACCESS_DENIED = 'ORGANIZATION_ACCESS_DENIED',
  PLATFORM_LEVY_ACCESS_DENIED = 'PLATFORM_LEVY_ACCESS_DENIED',
  SUPER_ADMIN_REQUIRED = 'SUPER_ADMIN_REQUIRED',
  INVALID_ROLE_ASSIGNMENT = 'INVALID_ROLE_ASSIGNMENT',
}

/**
 * RBAC Error class
 */
export class RBACError extends Error {
  public code: RBACErrorCode;
  public cause?: Error;

  constructor(code: RBACErrorCode, message?: string, cause?: Error) {
    super(message || code);
    this.name = 'RBACError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * User permissions container
 */
export interface UserPermissions {
  userId: string;
  schoolId?: string;
  organizationId?: string;
  role?: SystemRole;
  permissions: Permission[];
  memberships: Membership[];
}

export type AccessScope =
  | { type: 'PLATFORM'; userId: string }
  | { type: 'SCHOOL'; organizationId: string; schoolId: string; userId: string };

export interface AccessScopePermissions {
  scope: AccessScope;
  roles: Role[];
  permissions: Permission[];
  permissionCodes: string[];
}

/**
 * Platform levy configuration
 */
export interface PlatformLevy {
  id: string;
  schoolId: string;
  plan: string;
  platformLevy: number; // percentage or fixed amount
  currency: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  updatedBy: string; // SUPER_ADMIN user ID
  updatedAt: Date;
}