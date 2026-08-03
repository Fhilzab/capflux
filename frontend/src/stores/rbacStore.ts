import { defineStore } from 'pinia';
import { rbacService } from '../shared/rbac/RBACService';
import type { AccessScope, Permission, Role } from '../shared/rbac/types';

export const useRBACStore = defineStore('rbac', {
  state: () => ({
    scope: null as AccessScope | null,
    roles: [] as Role[],
    permissions: [] as Permission[],
    permissionCodes: [] as string[],
    loading: false as boolean,
    initialized: false as boolean,
    error: null as string | null,
  }),
  getters: {
    hasRole: (state) => (role: string): boolean => state.roles.some((entry) => entry.systemRole === role),
    can: (state) => (permission: string): boolean => state.permissionCodes.includes(permission),
    canAny: (state) => (permissions: string[]): boolean => permissions.some((permission) => state.permissionCodes.includes(permission)),
    canAll: (state) => (permissions: string[]): boolean => permissions.every((permission) => state.permissionCodes.includes(permission)),
  },
  actions: {
    async initialize(scope: AccessScope) {
      if (this.initialized && this.scope && JSON.stringify(this.scope) === JSON.stringify(scope)) {
        return;
      }

      this.loading = true;
      this.error = null;

      try {
        const engine = await rbacService.getPermissionsForScope(scope);
        const result = engine.toResult();

        this.scope = scope;
        this.roles = result.roles;
        this.permissions = result.permissions;
        this.permissionCodes = result.permissionCodes;
        this.initialized = true;
      } catch (error: any) {
        this.error = error?.message ?? 'Failed to load RBAC permissions';
        this.scope = null;
        this.roles = [];
        this.permissions = [];
        this.permissionCodes = [];
        this.initialized = false;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    clear() {
      this.scope = null;
      this.roles = [];
      this.permissions = [];
      this.permissionCodes = [];
      this.loading = false;
      this.initialized = false;
      this.error = null;
    },
    assertCan(permission: string) {
      if (!this.permissionCodes.includes(permission)) {
        const err: any = new Error('Insufficient permissions');
        err.code = 'INSUFFICIENT_PERMISSIONS';
        throw err;
      }
    },
    registerWithService() {
      // Provide resolver to rbacService so domain services can use it without importing Pinia
      rbacService.setCurrentScopeResolver(() => this.scope);
    },
  },
});
