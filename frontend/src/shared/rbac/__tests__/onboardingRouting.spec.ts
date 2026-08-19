/**
 * Progressive Access Routing Guard Tests (Phase 8.2)
 *
 * Verifies the authorizeRoute guard implements the progressive-access model:
 * - Unauthenticated users are sent to Auth (never onboarding)
 * - Authenticated users ALWAYS reach the Dashboard — never forced to /setup
 * - Authenticated users on Auth/Landing are redirected to Dashboard
 * - /setup is accessible to all authenticated users (voluntary verification center)
 * - RBAC permission/role checks still enforced
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';

const { authStoreMock, schoolStoreMock, rbacStoreMock } = vi.hoisted(() => {
  return {
    authStoreMock: {
      initialized: false,
      isAuthenticated: false,
      session: null,
      user: null,
      initialize: vi.fn(),
    },
    schoolStoreMock: {
      initialized: false,
      school: null,
      currentSchoolId: null,
      initialize: vi.fn(),
    },
    rbacStoreMock: {
      initialized: false,
      hasRole: vi.fn().mockReturnValue(true),
      can: vi.fn().mockReturnValue(true),
      initialize: vi.fn(),
    },
  };
});

vi.mock('pinia', () => ({
  createPinia: () => ({}),
  setActivePinia: () => ({}),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => authStoreMock,
}));

vi.mock('@/stores/schoolStore', () => ({
  useSchoolStore: () => schoolStoreMock,
}));

vi.mock('@/stores/rbacStore', () => ({
  useRBACStore: () => rbacStoreMock,
}));

vi.mock('./accessScope', () => ({
  buildAccessScope: () => ({}),
}));

vi.mock('./types', () => ({
  SystemRole: {
    OWNER: 'OWNER',
    ADMIN: 'ADMIN',
    BURSAR: 'BURSAR',
    PARENT: 'PARENT',
    SUPER_ADMIN: 'SUPER_ADMIN',
  },
}));

import { authorizeRoute } from '../RouteGuard';

function makeRoute(name: string, meta: Record<string, unknown> = {}): RouteLocationNormalized {
  return {
    name,
    path: `/${name}`,
    meta,
    params: {},
    query: {},
    hash: '',
    fullPath: `/${name}`,
    matched: [],
    href: '',
    redirectedFrom: undefined,
    parentGuards: [],
  } as unknown as RouteLocationNormalized;
}

describe('authorizeRoute — progressive access', () => {
  let nextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    nextMock = vi.fn();

    authStoreMock.initialized = false;
    authStoreMock.isAuthenticated = false;
    authStoreMock.session = null;
    authStoreMock.user = null;
    schoolStoreMock.initialized = false;
    schoolStoreMock.school = null;
  });

  // ── Authentication ──────────────────────────────────────────

  it('redirects unauthenticated user to Auth', async () => {
    authStoreMock.isAuthenticated = false;
    const to = makeRoute('Home', { requiresAuth: true });

    await authorizeRoute(to, makeRoute('Landing'), nextMock as NavigationGuardNext);

    expect(nextMock).toHaveBeenCalledWith({ name: 'Auth' });
  });

  it('allows unauthenticated user on Auth page', async () => {
    authStoreMock.isAuthenticated = false;
    const to = makeRoute('Auth', {});

    await authorizeRoute(to, makeRoute('Landing'), nextMock as NavigationGuardNext);

    expect(nextMock).toHaveBeenCalledWith();
  });

  it('allows unauthenticated user on Landing page', async () => {
    authStoreMock.isAuthenticated = false;
    const to = makeRoute('Landing', {});

    await authorizeRoute(to, makeRoute('Auth'), nextMock as NavigationGuardNext);

    expect(nextMock).toHaveBeenCalledWith();
  });

  // ── Progressive Access (Phase 8.2) ─────────────────────────

  it('authenticated user with incomplete onboarding reaches Dashboard (not /setup)', async () => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.initialized = true;
    authStoreMock.user = { id: 'user-1' };
    schoolStoreMock.initialized = true;
    schoolStoreMock.school = { id: 'school-1', status: 'PENDING_SETUP', paymentStatus: 'NOT_READY' };
    schoolStoreMock.currentSchoolId = 'school-1';

    const to = makeRoute('Home', { requiresAuth: true });

    await authorizeRoute(to, makeRoute('Auth'), nextMock as NavigationGuardNext);

    // With progressive access, the user is NOT force-redirected to /setup.
    expect(nextMock).toHaveBeenCalledWith();
  });

  it('authenticated user with NO school reaches Dashboard (not /setup)', async () => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.initialized = true;
    authStoreMock.user = { id: 'user-1' };
    schoolStoreMock.initialized = true;
    schoolStoreMock.school = null;
    schoolStoreMock.currentSchoolId = null;

    const to = makeRoute('Home', { requiresAuth: true });

    await authorizeRoute(to, makeRoute('Auth'), nextMock as NavigationGuardNext);

    // Even brand-new users reach the dashboard; /setup is voluntary.
    expect(nextMock).toHaveBeenCalledWith();
  });

  it('authenticated user on Auth page is redirected to Dashboard (not /setup)', async () => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.initialized = true;
    authStoreMock.user = { id: 'user-1' };
    schoolStoreMock.initialized = true;
    schoolStoreMock.school = { id: 'school-1', status: 'PENDING_SETUP', paymentStatus: 'NOT_READY' };

    const to = makeRoute('Auth', {});

    await authorizeRoute(to, makeRoute('Landing'), nextMock as NavigationGuardNext);

    // Always goes to Dashboard — never to SchoolSetup based on onboarding state.
    expect(nextMock).toHaveBeenCalledWith({ name: 'Home' });
  });

  it('authenticated user on Landing page is redirected to Dashboard (not /setup)', async () => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.initialized = true;
    authStoreMock.user = { id: 'user-1' };
    schoolStoreMock.initialized = true;
    schoolStoreMock.school = null;

    const to = makeRoute('Landing', {});

    await authorizeRoute(to, makeRoute('Auth'), nextMock as NavigationGuardNext);

    expect(nextMock).toHaveBeenCalledWith({ name: 'Home' });
  });

  it('authenticated user can voluntarily navigate to /setup (not redirected elsewhere)', async () => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.initialized = true;
    authStoreMock.user = { id: 'user-1' };
    schoolStoreMock.initialized = true;
    schoolStoreMock.school = { id: 'school-1', status: 'ACTIVE', paymentStatus: 'PENDING_KYC' };

    const to = makeRoute('SchoolSetup', { requiresAuth: true, onboarding: true });

    await authorizeRoute(to, makeRoute('Home'), nextMock as NavigationGuardNext);

    // /setup is always accessible — it's the voluntary Setup & Verification Center.
    expect(nextMock).toHaveBeenCalledWith();
  });

  it('authenticated user with incomplete onboarding can access Students page', async () => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.initialized = true;
    authStoreMock.user = { id: 'user-1' };
    schoolStoreMock.initialized = true;
    schoolStoreMock.school = { id: 'school-1', status: 'PENDING_SETUP', paymentStatus: 'NOT_READY' };

    const to = makeRoute('Students', { requiresAuth: true });

    await authorizeRoute(to, makeRoute('Home'), nextMock as NavigationGuardNext);

    // Normal features are accessible without KYC/activation.
    expect(nextMock).toHaveBeenCalledWith();
  });

  it('authenticated user with incomplete onboarding can access Settings', async () => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.initialized = true;
    authStoreMock.user = { id: 'user-1' };
    schoolStoreMock.initialized = true;
    schoolStoreMock.school = null;

    const to = makeRoute('Settings', {
      requiresAuth: true,
      role: 'OWNER',
      permission: 'settings.manage',
    });

    rbacStoreMock.hasRole.mockReturnValueOnce(true);
    rbacStoreMock.can.mockReturnValueOnce(true);

    await authorizeRoute(to, makeRoute('Home'), nextMock as NavigationGuardNext);

    expect(nextMock).toHaveBeenCalledWith();
  });

  // ── RBAC ────────────────────────────────────────────────────

  it('authenticated user without required role is redirected to Home', async () => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.initialized = true;
    authStoreMock.user = { id: 'user-1' };
    schoolStoreMock.initialized = true;
    schoolStoreMock.school = { id: 'school-1', status: 'ACTIVE', paymentStatus: 'READY' };
    schoolStoreMock.currentSchoolId = 'school-1';

    rbacStoreMock.hasRole.mockReturnValueOnce(false);

    const to = makeRoute('Settings', {
      requiresAuth: true,
      role: 'OWNER',
      permission: 'settings.manage',
    });

    await authorizeRoute(to, makeRoute('Home'), nextMock as NavigationGuardNext);

    expect(nextMock).toHaveBeenCalledWith({ name: 'Home' });
  });

  it('authenticated user without required permission is redirected to Home', async () => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.initialized = true;
    authStoreMock.user = { id: 'user-1' };
    schoolStoreMock.initialized = true;
    schoolStoreMock.school = { id: 'school-1', status: 'ACTIVE', paymentStatus: 'READY' };
    schoolStoreMock.currentSchoolId = 'school-1';

    rbacStoreMock.can.mockReturnValueOnce(false);

    const to = makeRoute('Billing', {
      requiresAuth: true,
      permission: 'billing.view',
    });

    await authorizeRoute(to, makeRoute('Home'), nextMock as NavigationGuardNext);

    expect(nextMock).toHaveBeenCalledWith({ name: 'Home' });
  });

  it('allows unauthenticated access to KYC route (Auth redirects)', async () => {
    authStoreMock.isAuthenticated = false;

    const to = makeRoute('KycDashboard', { requiresAuth: true });

    await authorizeRoute(to, makeRoute('Landing'), nextMock as NavigationGuardNext);

    // KYC requires authentication — unauthenticated users go to Auth.
    // (Page-level ModuleLockOverlay handles KYC state, not the router.)
    expect(nextMock).toHaveBeenCalledWith({ name: 'Auth' });
  });
});