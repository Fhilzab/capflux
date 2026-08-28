import { createRouter, createWebHistory, RouteRecordRaw, RouteLocationNormalized } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import { useSchoolStore } from '../stores/schoolStore';
import { authorizeRoute } from '../shared/rbac/RouteGuard';
import { runtimeEnvironment } from '../shared/environment/runtimeEnvironment';
import { PERMISSIONS, type PermissionCode } from '../shared/rbac/permissions';
import type { SystemRole } from '../shared/rbac/types';
import AuthView from '../features/auth/AuthView.vue';
import KycDashboard from '../features/kyc/KycDashboard.vue';
import KycSubmission from '../features/kyc/KycSubmission.vue';
import KycStatus from '../features/kyc/KycStatus.vue';
import SettlementView from '../features/kyc/SettlementView.vue';
import LandingView from '../views/LandingView.vue';
import HomeView from '../features/dashboard/views/HomeView.vue';
import GuardianListView from '../views/GuardianListView.vue';
import VirtualAccountsView from '../views/VirtualAccountsView.vue';
import AIInsightsView from '../views/AIInsightsView.vue';
import SupportView from '../views/SupportView.vue';
import NotificationsView from '../views/NotificationsView.vue';
import SettingsView from '../views/SettingsView.vue';

interface RouteMeta {
  requiresAuth?: boolean;
  requiresOrganization?: boolean;
  requiresSchoolContext?: boolean;
  onboarding?: boolean;
  role?: SystemRole;
  permission?: PermissionCode;
}

const routes: RouteRecordRaw[] = [
  // Sandbox root redirects to production homepage — sandbox has no marketing landing page
  ...(runtimeEnvironment.isSandbox
    ? [
        {
          path: '/',
          redirect: () => {
            window.location.href = 'https://capflux.vercel.app';
            return '/';
          },
        },
      ]
    : []),
  {
    path: '/settings',
    name: 'Settings',
    component: SettingsView,
    meta: { requiresAuth: true, role: 'OWNER', permission: PERMISSIONS.SETTINGS.MANAGE },
  },
  {
    path: '/guardians',
    name: 'Guardians',
    component: GuardianListView,
    meta: { requiresAuth: true, permission: PERMISSIONS.USER.MANAGE },
  },
  {
    path: '/guardians/:id',
    name: 'GuardianDetail',
    component: () => import('../views/GuardianDetailView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/virtual-accounts',
    name: 'VirtualAccounts',
    component: VirtualAccountsView,
    meta: { requiresAuth: true },
  },
  {
    path: '/ai-insights',
    name: 'AIInsights',
    component: AIInsightsView,
    meta: { requiresAuth: true },
  },
  {
    path: '/support',
    name: 'Support',
    component: SupportView,
    meta: { requiresAuth: true },
  },
  {
    path: '/',
    name: 'Landing',
    component: LandingView,
  },
  {
    path: '/dashboard',
    name: 'Home',
    component: HomeView,
    meta: { requiresAuth: true },
  },
  {
    path: '/students',
    name: 'Students',
    component: () => import('../views/StudentListView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/students/:id',
    name: 'StudentDetail',
    component: () => import('../views/StudentDetailView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/students/academic-structure',
    name: 'AcademicStructure',
    component: () => import('../features/students/components/academic/AcademicStructureView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/billing',
    name: 'Billing',
    component: () => import('../views/BillingView.vue'),
    meta: { requiresAuth: true, permission: PERMISSIONS.BILLING.VIEW },
  },
  {
    path: '/payments',
    name: 'Payments',
    component: () => import('../features/payments/PaymentsDashboard.vue'),
    meta: { requiresAuth: true, permission: PERMISSIONS.PAYMENT.VIEW },
  },
  {
    path: '/notifications',
    name: 'Notifications',
    component: NotificationsView,
    meta: { requiresAuth: true },
  },
  {
    path: '/settlements',
    name: 'Settlements',
    component: () => import('../views/SettlementsView.vue'),
    meta: { requiresAuth: true, permission: PERMISSIONS.PAYMENT.VIEW },
  },
  {
    path: '/reports',
    name: 'Reports',
    component: () => import('../views/ReportsView.vue'),
    meta: { requiresAuth: true, permission: PERMISSIONS.REPORT.VIEW },
  },
  {
    path: '/reports/daily-collections',
    name: 'DailyCollections',
    component: () => import('../views/DailyCollectionsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/reports/outstanding-fees',
    name: 'OutstandingFees',
    component: () => import('../views/OutstandingFeesView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/reports/revenue-dashboard',
    name: 'RevenueDashboard',
    component: () => import('../views/RevenueDashboardView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/sync',
    name: 'Sync',
    component: () => import('../views/SyncView.vue'),
    meta: { requiresAuth: true },
  },
  // Sandbox execution mode only — the control panel itself is mode-guarded.
  ...(runtimeEnvironment.isSandbox
    ? [
        {
          path: '/sandbox',
          name: 'SandboxControl',
          component: () => import('../views/SandboxControlView.vue'),
          meta: { requiresAuth: true },
        },
      ]
    : []),
  {
    path: '/school',
    name: 'SchoolProfile',
    component: () => import('../views/SchoolProfileView.vue'),
    meta: { requiresAuth: true },
  },
  // Auth route supports ?mode=register|login query parameter
  {
    path: '/auth',
    name: 'Auth',
    component: AuthView,
    props: (route: RouteLocationNormalized) => ({
      initialMode: route.query.mode || 'login',
      provider: route.query.provider || null,
    }),
  },
  // Supabase OAuth callback: Google redirects here with ?code=<code>&state=<state>.
  // detectSessionInUrl (enabled in lib/supabase.ts) auto-exchanges the code;
  // AuthView's query watcher also calls handleOAuthCallback as a fallback.
  {
    path: '/auth/callback',
    redirect: (route: RouteLocationNormalized) => ({
      path: '/auth',
      query: { code: route.query.code, state: route.query.state },
    }),
  },
  // /setup → /kyc/submit (Phase 8.4: consolidated journey)
  {
    path: '/setup',
    redirect: { name: 'KycSubmission' },
  },
  // Legacy /onboarding URL aliases — redirect to the canonical /kyc/submit path.
  {
    path: '/onboarding',
    redirect: { name: 'KycSubmission' },
  },
  {
    path: '/onboarding/:pathMatch(.*)*',
    redirect: { name: 'KycSubmission' },
  },
  // KYC routes (Phase 8.4 — consolidated KYC/onboarding journey)
  {
    path: '/kyc',
    name: 'KycDashboard',
    component: KycDashboard,
    meta: { requiresAuth: true },
  },
  {
    path: '/kyc/submit',
    name: 'KycSubmission',
    component: KycSubmission,
    meta: { requiresAuth: true, onboarding: true },
  },
  {
    path: '/kyc/status',
    name: 'KycStatus',
    component: KycStatus,
    meta: { requiresAuth: true, onboarding: true },
  },
  // /kyc/settlement → /kyc/submit?section=settlement (Phase 8.4: consolidated)
  {
    path: '/kyc/settlement',
    redirect: { name: 'KycSubmission', query: { section: 'settlement' } },
  },
  // Staff KYC review routes (financial activation)
  {
    path: '/staff/kyc',
    name: 'StaffKycDashboard',
    component: () => import('../features/admin/kyc/KycReviewDashboard.vue'),
    meta: { requiresAuth: true, permission: PERMISSIONS.KYC.VIEW },
  },
  {
    path: '/staff/kyc/:id',
    name: 'StaffKycDetail',
    component: () => import('../features/admin/kyc/KycReviewDetail.vue'),
    meta: { requiresAuth: true, permission: PERMISSIONS.KYC.VIEW },
  },
  // Catch-all 404
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFoundView.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    // Scroll to top on route change, except for hash navigation
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth' };
    }
    return { top: 0 };
  },
});

router.beforeEach(authorizeRoute);

export default router;