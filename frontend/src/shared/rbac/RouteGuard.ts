import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';
import { useAuthStore } from '../../stores/authStore';
import { useSchoolStore } from '../../stores/schoolStore';
import { useRBACStore } from '../../stores/rbacStore';
import { buildAccessScope } from './accessScope';
import type { SystemRole } from './types';

export async function authorizeRoute(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
) {
  const authStore = useAuthStore();
  const schoolStore = useSchoolStore();
  const rbacStore = useRBACStore();

  if (!authStore.initialized) {
    await authStore.initialize();
  }

  if (!schoolStore.initialized && authStore.isAuthenticated) {
    await schoolStore.initialize();
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return next({ name: 'Auth' });
  }

  if (to.name === 'Auth' && authStore.isAuthenticated) {
    return next({ name: 'Home' });
  }

  if (to.name === 'Landing' && authStore.isAuthenticated) {
    return next({ name: 'Home' });
  }

  const permission = to.meta.permission as string | undefined;
  const requiredRole = to.meta.role as SystemRole | undefined;

  if ((requiredRole || permission) && authStore.isAuthenticated) {
    if (!authStore.user?.id) {
      return next({ name: 'Auth' });
    }

    const scope = buildAccessScope(
      authStore.user.id,
      authStore.currentOrganizationId,
      schoolStore.currentSchoolId
    );

    await rbacStore.initialize(scope);

    if (requiredRole && !rbacStore.hasRole(requiredRole)) {
      return next({ name: 'Home' });
    }

    if (permission && !rbacStore.can(permission)) {
      return next({ name: 'Home' });
    }
  }

  if (to.meta.requiresAuth && to.meta.requiresOrganization && authStore.isAuthenticated) {
    if (!authStore.organizationInitialized) {
      // Organization loading will happen on navigation, but for future use.
    }
  }

  // Do not force-redirect users to a SchoolSetup route. Dashboard should remain accessible.
  // Overlay-based module locking will handle access to specific features when setup is required.

  return next();
}
