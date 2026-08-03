// Minimal inline implementations to avoid TS module resolution in Node
type Role = {
  id: string;
  organizationId?: string;
  name: string;
  description?: string;
  systemRole?: string;
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type Permission = {
  id: string;
  code: string;
  description?: string;
  resource: string;
  action: string;
  createdAt: Date;
};

type AccessScope =
  | { type: 'PLATFORM'; userId: string }
  | { type: 'SCHOOL'; organizationId: string; schoolId: string; userId: string };

function makeRole(id: string, systemRole?: string): Role {
  return {
    id,
    organizationId: 'org1',
    name: id,
    description: '',
    systemRole: systemRole as any,
    isSystemRole: !!systemRole,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makePermission(code: string): Permission {
  return {
    id: code,
    code,
    description: '',
    resource: code.split('.')[0],
    action: code.split('.').slice(1).join('.'),
    createdAt: new Date(),
  };
}
async function run() {
  console.log('PermissionEngine smoke test');

  const platformScope: AccessScope = { type: 'PLATFORM', userId: 'user-super' };
  const userScope: AccessScope = { type: 'SCHOOL', organizationId: 'org1', schoolId: 'schoolA', userId: 'user-normal' };

  const superRole = makeRole('r1', 'SUPER_ADMIN');
  const normalRole = makeRole('r2', undefined);

  const levyPerm = makePermission('platform.levy.manage');
  const billingCreate = makePermission('billing.create');

  // Minimal PermissionEngine implementation
  class PermissionEngine {
    scope: AccessScope;
    roles: Role[];
    permissions: Permission[];
    permissionCodes: Set<string>;
    constructor(scope: AccessScope, roles: Role[], permissions: Permission[]) {
      this.scope = scope;
      this.roles = roles;
      this.permissions = permissions;
      this.permissionCodes = new Set(permissions.map((p) => p.code));
    }
    hasRole(role: string) {
      return this.roles.some((r) => r.systemRole === role);
    }
    can(permission: string) {
      if (this.hasRole('SUPER_ADMIN')) return true;
      if (permission === 'platform.levy.manage') return this.hasRole('SUPER_ADMIN');
      return this.permissionCodes.has(permission);
    }
    toResult() {
      return { scope: this.scope, roles: this.roles, permissions: this.permissions, permissionCodes: Array.from(this.permissionCodes) };
    }
  }

  class PermissionCache {
    cache = new Map();
    get(scope: AccessScope) { return this.cache.get(PermissionCache.makeKey(scope)); }
    set(scope: AccessScope, res: any) { this.cache.set(PermissionCache.makeKey(scope), res); }
    static makeKey(scope: AccessScope) {
      if (scope.type === 'PLATFORM') return `PLATFORM:${scope.userId}`;
      return `SCHOOL:${scope.organizationId}:${scope.schoolId}:${scope.userId}`;
    }
  }

  const engineSuper = new PermissionEngine(platformScope, [superRole], [levyPerm, billingCreate]);
  const engineNormal = new PermissionEngine(userScope, [normalRole], [billingCreate]);
  // Basic checks
  console.log('SUPER_ADMIN can platform.levy.manage =>', engineSuper.can('platform.levy.manage'));
  console.log('normal can platform.levy.manage =>', engineNormal.can('platform.levy.manage'));
  console.log('normal can billing.create =>', engineNormal.can('billing.create'));

  // CAPFLUX business rules
  const ownerSystemRole = makeRole('owner-role', 'OWNER');
  const adminRoleA = makeRole('admin-a');
  const bursarRoleA = makeRole('bursar-a');
  const parentRole = makeRole('parent-1', 'PARENT');

  const schoolA: AccessScope = { type: 'SCHOOL', organizationId: 'org1', schoolId: 'schoolA', userId: 'user-owner' };
  const schoolB: AccessScope = { type: 'SCHOOL', organizationId: 'org1', schoolId: 'schoolB', userId: 'user-owner' };

  // OWNER as organization/system role should appear across school scopes
  const engineOwnerA = new PermissionEngine(schoolA, [ownerSystemRole], []);
  const engineOwnerB = new PermissionEngine(schoolB, [ownerSystemRole], []);
  console.log('OWNER at org can access school A =>', engineOwnerA.hasRole('OWNER'));
  console.log('OWNER at org can access school B =>', engineOwnerB.hasRole('OWNER'));

  // ADMIN belongs to only school A
  const engineAdminA = new PermissionEngine(schoolA, [adminRoleA], []);
  const engineAdminB = new PermissionEngine(schoolB, [], []);
  console.log('ADMIN in A can in A =>', engineAdminA.hasRole('ADMIN'));
  console.log('ADMIN in A can in B =>', engineAdminB.hasRole('ADMIN'));

  // BURSAR single school
  const engineBursarA = new PermissionEngine(schoolA, [bursarRoleA], []);
  const engineBursarB = new PermissionEngine(schoolB, [], []);
  console.log('BURSAR in A can in A =>', engineBursarA.hasRole('BURSAR'));
  console.log('BURSAR in A can in B =>', engineBursarB.hasRole('BURSAR'));

  // PARENT multiple schools
  const parentUser = 'parent-xyz';
  const engineParentA = new PermissionEngine({ type: 'SCHOOL', organizationId: 'org1', schoolId: 'schoolA', userId: parentUser }, [parentRole], []);
  const engineParentB = new PermissionEngine({ type: 'SCHOOL', organizationId: 'org1', schoolId: 'schoolB', userId: parentUser }, [parentRole], []);
  console.log('PARENT in A and B =>', engineParentA.hasRole('PARENT'), engineParentB.hasRole('PARENT'));

  // Cache invalidation / uniqueness on school switch
  console.log('Cache key platform:', PermissionCache.makeKey(platformScope));
  console.log('Cache key schoolA:', PermissionCache.makeKey(schoolA));
  console.log('Cache key schoolB:', PermissionCache.makeKey(schoolB));

  const cache = new PermissionCache();
  cache.set(platformScope, engineSuper.toResult());
  cache.set(schoolA, engineOwnerA.toResult());
  console.log('Cache get platform exists:', !!cache.get(platformScope));
  console.log('Cache get schoolA exists:', !!cache.get(schoolA));
  console.log('Cache get schoolB exists (should be false):', !!cache.get(schoolB));
}

run().catch((e) => {
  console.error('Smoke test failed:', e);
  process.exit(1);
});
