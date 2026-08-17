import { createRouter, createWebHistory, RouteRecordRaw, RouteLocationNormalized } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import { useSchoolStore } from '../stores/schoolStore';
import { authorizeRoute } from '../shared/rbac/RouteGuard';
import { PERMISSIONS, type PermissionCode } from '../shared/rbac/permissions';
import type { SystemRole } from '../shared/rbac/types';
import AuthView from '../features/auth/AuthView.vue';
import KycDashboard from '../features/kyc/KycDashboard.vue';
import KycSubmission from '../features/kyc/KycSubmission.vue';
import KycStatus from '../features/kyc/KycStatus.vue';
import SettlementView from '../features/kyc/SettlementView.vue';
import LandingView from '../views/LandingView.vue';
import HomeView from '../features/dashboard/views/HomeView.vue';
import StudentListView from '../views/StudentListView.vue';
import GuardianListView from '../views/GuardianListView.vue';
import BillingView from '../views/BillingView.vue';
import PaymentsView from '../features/payments/PaymentsDashboard.vue';
import VirtualAccountsView from '../views/VirtualAccountsView.vue';
import SettlementsView from '../views/SettlementsView.vue';
import AIInsightsView from '../views/AIInsightsView.vue';
import SupportView from '../views/SupportView.vue';
import NotificationsView from '../views/NotificationsView.vue';
import ReportsView from '../views/ReportsView.vue';
import SyncView from '../views/SyncView.vue';
import SettingsView from '../views/SettingsView.vue';

interface RouteMeta {
  requiresAuth?: boolean;
  requiresOrganization?: boolean;
  requiresSchoolContext?: boolean;
  role?: SystemRole;
  permission?: PermissionCode;
}

const routes: RouteRecordRaw[] = [
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
    component: StudentListView,
    meta: { requiresAuth: true },
  },
  {
    path: '/students/:id',
    name: 'StudentDetail',
    component: () => import('../views/StudentDetailView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/billing',
    name: 'Billing',
    component: BillingView,
    meta: { requiresAuth: true, permission: PERMISSIONS.BILLING.VIEW },
  },
  {
    path: '/payments',
    name: 'Payments',
    component: PaymentsView,
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
    component: SettlementsView,
    meta: { requiresAuth: true, permission: PERMISSIONS.PAYMENT.VIEW },
  },
  {
    path: '/reports',
    name: 'Reports',
    component: ReportsView,
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
    component: SyncView,
    meta: { requiresAuth: true },
  },
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
  // AuthKit callback: WorkOS redirects here with ?code=<code>. Redirect to
  // /auth so AuthView can pick up the code via its route-query watcher.
  {
    path: '/auth/callback',
    redirect: (route: RouteLocationNormalized) => ({
      path: '/auth',
       query: { code: route.query.code, state: route.query.state },
    }),
  },
  {
    path: '/setup',
    name: 'SchoolSetup',
    component: () => import('../features/setup/SchoolSetupView.vue'),
    meta: { requiresAuth: true },
  },
  // KYC routes (Milestone 5 — Financial Activation)
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
    meta: { requiresAuth: true },
  },
  {
    path: '/kyc/status',
    name: 'KycStatus',
    component: KycStatus,
    meta: { requiresAuth: true },
  },
  {
    path: '/kyc/settlement',
    name: 'Settlement',
    component: SettlementView,
    meta: { requiresAuth: true },
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