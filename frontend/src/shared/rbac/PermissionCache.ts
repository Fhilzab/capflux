import type { AccessScope, AccessScopePermissions } from './types';

export class PermissionCache {
  private cache = new Map<string, AccessScopePermissions>();

  public get(scope: AccessScope): AccessScopePermissions | undefined {
    return this.cache.get(PermissionCache.makeKey(scope));
  }

  public set(scope: AccessScope, permissions: AccessScopePermissions): void {
    this.cache.set(PermissionCache.makeKey(scope), permissions);
  }

  public clear(): void {
    this.cache.clear();
  }

  public static makeKey(scope: AccessScope): string {
    if (scope.type === 'PLATFORM') {
      return `PLATFORM:${scope.userId}`;
    }

    return `SCHOOL:${scope.organizationId}:${scope.schoolId}:${scope.userId}`;
  }
}
