import { PermissionCache } from './PermissionCache';
import { PermissionEngine } from './PermissionEngine';
import { supabaseRBACProvider } from './SupabaseRBACProvider';
import { buildAccessScope } from './accessScope';
import { RBACError, RBACErrorCode } from './types';
import type { AccessScope, AccessScopePermissions, Permission, Role, SystemRole } from './types';

export class RBACService {
  private readonly permissionCache = new PermissionCache();
  private currentScopeResolver: (() => AccessScope | null) | null = null;

  public async getPermissionsForScope(scope: AccessScope): Promise<PermissionEngine> {
    const cached = this.permissionCache.get(scope);
    if (cached) {
      return new PermissionEngine(scope, cached.roles, cached.permissions);
    }

    const [roles, permissions] = await this.loadScopePermissions(scope);
    const engine = new PermissionEngine(scope, roles, permissions);
    this.permissionCache.set(scope, engine.toResult());
    return engine;
  }

  public setCurrentScopeResolver(resolver: () => AccessScope | null) {
    this.currentScopeResolver = resolver;
  }

  public async can(permission: string, scope?: AccessScope | null): Promise<boolean> {
    let targetScope = scope ?? null;
    if (!targetScope && this.currentScopeResolver) {
      targetScope = this.currentScopeResolver();
    }
    if (!targetScope) {
      throw new RBACError(RBACErrorCode.MEMBERSHIP_NOT_FOUND, 'No access scope available for permission check');
    }
    const engine = await this.getPermissionsForScope(targetScope);
    return engine.can(permission);
  }

  public async assertCan(permission: string, scope?: AccessScope | null): Promise<void> {
    const allowed = await this.can(permission, scope);
    if (!allowed) {
      throw new RBACError(RBACErrorCode.INSUFFICIENT_PERMISSIONS, `Missing permission: ${permission}`);
    }
  }

  public clearCache(): void {
    this.permissionCache.clear();
  }

  private async loadScopePermissions(scope: AccessScope): Promise<[Role[], Permission[]]> {
    const systemRoles = await this.loadUserSystemRoles(scope.userId);

    if (scope.type === 'PLATFORM') {
      const platformRoles = systemRoles.filter((role) => role.systemRole === SystemRole.SUPER_ADMIN);
      const permissions = await this.loadPermissionsForRoles(platformRoles);
      return [platformRoles, permissions];
    }

    const { schoolId, userId } = scope;
    const schoolRoles = await supabaseRBACProvider.getUserRoles(userId, schoolId);
    const allRoles = this.mergeRoles(schoolRoles, systemRoles);
    const permissions = await this.loadPermissionsForRoles(allRoles);
    return [allRoles, permissions];
  }

  private async loadUserSystemRoles(userId: string): Promise<Role[]> {
    return await supabaseRBACProvider.getUserSystemRoles(userId);
  }

  private mergeRoles(primary: Role[], additional: Role[]): Role[] {
    const roleMap = new Map<string, Role>();
    primary.forEach((role) => roleMap.set(role.id, role));
    additional.forEach((role) => {
      if (!roleMap.has(role.id)) {
        roleMap.set(role.id, role);
      }
    });
    return Array.from(roleMap.values());
  }

  private async loadPermissionsForRoles(roles: Role[]): Promise<Permission[]> {
    const permissionMap = new Map<string, Permission>();
    await Promise.all(
      roles.map(async (role) => {
        const rolePermissions = await supabaseRBACProvider.getRolePermissions(role.id);
        rolePermissions.forEach((permission) => {
          if (!permissionMap.has(permission.code)) {
            permissionMap.set(permission.code, permission);
          }
        });
      })
    );

    return Array.from(permissionMap.values());
  }
}

export const rbacService = new RBACService();
