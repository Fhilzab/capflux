import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';
import { useAuthStore } from '../../stores/authStore';
import { useSchoolStore } from '../../stores/schoolStore';
import { useRBACStore } from '../../stores/rbacStore';
import { buildAccessScope } from './accessScope';
import type { SystemRole } from './types';

/**
 * authorizeRoute — navigation guard (Phase 8.2 progressive-access model).
 *
 * AUTHENTICATION grants entry. KYC, settlement verification, and financial
 * activation grant access to *specific* sensitive capabilities, enforced at
 * the page level via useModuleLock + ModuleLockOverlay. The router never
 * globally redirects an authenticated user to /setup based on onboarding,
 * KYC, or payment-activation state.
 */
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

  // Unauthenticated users attempting protected routes → Auth.
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return next({ name: 'Auth' });
  }

  // Authenticated users on Auth/Landing → Dashboard.
  // (Onboarding completeness is NOT a global gate — see useModuleLock.)
  if (authStore.isAuthenticated && (to.name === 'Auth' || to.name === 'Landing')) {
    return next({ name: 'Home' });
  }

  // --- RBAC: role and permission checks ---
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

  return next();
}
