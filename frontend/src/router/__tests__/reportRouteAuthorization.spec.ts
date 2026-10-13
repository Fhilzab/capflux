/**
 * P1-A.1 — report route view-permission authorization.
 *
 * Every sensitive report destination must declare `reports.view` and the
 * existing `authorizeRoute` guard must enforce it, so direct URL entry,
 * refresh, or compatibility links cannot bypass authorization.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';

const { authStoreMock, schoolStoreMock, rbacStoreMock } = vi.hoisted(() => ({
  authStoreMock: {
    initialized: true,
    isAuthenticated: true,
    session: {},
    user: { id: 'user-1' },
    currentOrganizationId: 'org-1',
    initialize: vi.fn(),
  },
  schoolStoreMock: {
    initialized: true,
    school: { id: 'school-1' },
    currentSchoolId: 'school-1',
    initialize: vi.fn(),
  },
  rbacStoreMock: {
    initialized: true,
    hasRole: vi.fn().mockReturnValue(false),
    can: vi.fn().mockReturnValue(false),
    initialize: vi.fn(),
  },
}));

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

vi.mock('@/shared/rbac/accessScope', () => ({
  buildAccessScope: () => ({}),
}));

import { authorizeRoute } from '@/shared/rbac/RouteGuard';

// Route-record metadata (reports.view on all four destinations) is asserted in
// financeIaRoutes.spec.ts; this spec proves the existing guard enforces it.

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

const REPORT_ROUTES = [
  { name: 'Reports', path: '/reports' },
  { name: 'DailyCollections', path: '/reports/daily-collections' },
  { name: 'OutstandingFees', path: '/reports/outstanding-fees' },
  { name: 'RevenueDashboard', path: '/reports/revenue-dashboard' },
] as const;

describe('report route reports.view authorization', () => {
  let nextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    nextMock = vi.fn();
    rbacStoreMock.can.mockReturnValue(false);
  });

  it.each(REPORT_ROUTES)(
    'grants direct navigation to $name when reports.view is held',
    async ({ name }) => {
      rbacStoreMock.can.mockReturnValue(true);
      const to = makeRoute(name, { requiresAuth: true, permission: 'reports.view' });
      await authorizeRoute(to, makeRoute('Home'), nextMock as NavigationGuardNext);
      expect(rbacStoreMock.can).toHaveBeenCalledWith('reports.view');
      expect(nextMock).toHaveBeenCalledWith();
    },
  );

  it.each(REPORT_ROUTES)(
    'blocks direct navigation to $name without reports.view (redirects Home)',
    async ({ name }) => {
      rbacStoreMock.can.mockReturnValue(false);
      const to = makeRoute(name, { requiresAuth: true, permission: 'reports.view' });
      await authorizeRoute(to, makeRoute('Home'), nextMock as NavigationGuardNext);
      expect(nextMock).toHaveBeenCalledWith({ name: 'Home' });
      expect(nextMock).not.toHaveBeenCalledWith();
    },
  );
});
