import { ref, watchEffect } from 'vue';
import { useAuthStore } from '../../stores/authStore';
import { useSchoolStore } from '../../stores/schoolStore';
import { rbacService } from './RBACService';
import { buildAccessScope } from './accessScope';
import type { AccessScope, SystemRole } from './types';

const createScope = (userId: string, organizationId: string | null, schoolId: string | null): AccessScope => {
  return buildAccessScope(userId, organizationId, schoolId);
};

export const usePermission = () => {
  const authStore = useAuthStore();
  const schoolStore = useSchoolStore();
  const engine = ref<ReturnType<typeof rbacService.getPermissionsForScope> | null>(null);
  const scope = ref<AccessScope | null>(null);

  watchEffect(() => {
    if (!authStore.user?.id) {
      scope.value = null;
      engine.value = null;
      return;
    }

    const newScope = createScope(authStore.user.id, authStore.currentOrganizationId, schoolStore.currentSchoolId);
    scope.value = newScope;
    engine.value = rbacService.getPermissionsForScope(newScope);
  });

  const getEngine = async () => {
    if (!scope.value) {
      return null;
    }
    return await engine.value;
  };

  const canRole = async (role: SystemRole): Promise<boolean> => {
    const permissionEngine = await getEngine();
    return permissionEngine ? permissionEngine.hasRole(role) : false;
  };

  const can = async (permission: string): Promise<boolean> => {
    const permissionEngine = await getEngine();
    return permissionEngine ? permissionEngine.can(permission) : false;
  };

  const canAny = async (permissions: string[]): Promise<boolean> => {
    const permissionEngine = await getEngine();
    return permissionEngine ? permissionEngine.canAny(permissions) : false;
  };

  const canAll = async (permissions: string[]): Promise<boolean> => {
    const permissionEngine = await getEngine();
    return permissionEngine ? permissionEngine.canAll(permissions) : false;
  };

  return {
    can,
    canRole,
    canAny,
    canAll,
    scope,
  };
};
