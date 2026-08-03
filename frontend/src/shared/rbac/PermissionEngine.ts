import { RBACError, RBACErrorCode, SystemRole } from './types';
import type { AccessScope, AccessScopePermissions, Permission, Role } from './types';

/**
 * Precomputed permission set for an access scope.
 */
export class PermissionEngine {
  private readonly scope: AccessScope;
  private readonly roles: Role[];
  private readonly permissions: Permission[];
  private readonly permissionCodes: Set<string>;

  constructor(scope: AccessScope, roles: Role[], permissions: Permission[]) {
    this.scope = scope;
    this.roles = roles;
    this.permissions = permissions;
    this.permissionCodes = new Set(permissions.map((permission) => permission.code));
  }

  public hasRole(role: SystemRole): boolean {
    return this.roles.some((r) => r.systemRole === role);
  }

  public can(permission: string): boolean {
    if (this.hasRole(SystemRole.SUPER_ADMIN)) {
      return true;
    }

    if (permission === 'platformlevy.manage') {
      return this.canManagePlatformLevy();
    }

    return this.permissionCodes.has(permission);
  }

  public canAny(permissions: string[]): boolean {
    return permissions.some((permission) => this.can(permission));
  }

  public canAll(permissions: string[]): boolean {
    return permissions.every((permission) => this.can(permission));
  }

  public canManagePlatformLevy(): boolean {
    return this.hasRole(SystemRole.SUPER_ADMIN);
  }

  public getAccessScope(): AccessScope {
    return this.scope;
  }

  public getPermissionCodes(): string[] {
    return Array.from(this.permissionCodes);
  }

  public toResult(): AccessScopePermissions {
    return {
      scope: this.scope,
      roles: this.roles,
      permissions: this.permissions,
      permissionCodes: this.getPermissionCodes(),
    };
  }
}
