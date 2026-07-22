import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import { useSchoolStore } from '../stores/schoolStore';
import AuthView from '../features/auth/AuthView.vue';
import LandingView from '../views/LandingView.vue';
import HomeView from '../features/dashboard/views/HomeView.vue';
import StudentListView from '../views/StudentListView.vue';
import GuardianListView from '../views/GuardianListView.vue';
import BillingView from '../views/BillingView.vue';
import PaymentsView from '../views/PaymentsView.vue';
import VirtualAccountsView from '../views/VirtualAccountsView.vue';
import AIInsightsView from '../views/AIInsightsView.vue';
import SupportView from '../views/SupportView.vue';
import NotificationsView from '../views/NotificationsView.vue';
import ReportsView from '../views/ReportsView.vue';
import SyncView from '../views/SyncView.vue';
import SettingsView from '../views/SettingsView.vue';

const routes = [
  {
    path: '/settings',
    name: 'Settings',
    component: SettingsView,
    meta: { requiresAuth: true },
  },
  {
    path: '/guardians',
    name: 'Guardians',
    component: GuardianListView,
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
    meta: { requiresAuth: true },
  },
  {
    path: '/payments',
    name: 'Payments',
    component: PaymentsView,
    meta: { requiresAuth: true },
  },
  {
    path: '/notifications',
    name: 'Notifications',
    component: NotificationsView,
    meta: { requiresAuth: true },
  },
  {
    path: '/reports',
    name: 'Reports',
    component: ReportsView,
    meta: { requiresAuth: true },
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
    props: (route) => ({
      initialMode: route.query.mode || 'login',
      provider: route.query.provider || null,
    }),
  },
  {
    path: '/setup',
    name: 'SchoolSetup',
    component: () => import('../features/setup/SchoolSetupView.vue'),
    meta: { requiresAuth: true },
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

const SCHOOL_SETUP_REQUIRED_ROUTES = [
  'Students', 'Billing', 'Payments', 'VirtualAccounts',
  'DailyCollections', 'OutstandingFees', 'RevenueDashboard'
];

router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  const schoolStore = useSchoolStore();

  // Debug logging - will be removed after verification
  console.log('[AUTH DEBUG] router guard', {
    route: to.fullPath,
    authenticated: authStore.isAuthenticated,
    emailVerified: authStore.emailVerified,
    hasSession: !!authStore.session,
  });

  // Protected routes - require authentication (initialization happens in bootstrap)
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'Auth' };
  }

  // Email verification required for protected routes
  if (to.meta.requiresAuth && authStore.isAuthenticated && !authStore.emailVerified) {
    return { name: 'Auth', query: { mode: 'verify-email' } };
  }

  // Redirect authenticated users from auth page
  if (to.name === 'Auth' && authStore.isAuthenticated && authStore.emailVerified) {
    return { name: 'Home' };
  }

  // Redirect authenticated users from landing page
  if (to.name === 'Landing' && authStore.isAuthenticated) {
    return { name: 'Home' };
  }

  // Feature gate for school setup - use schoolStore for readiness
  // School context is initialized during bootstrap in main.js
  if (authStore.isAuthenticated && SCHOOL_SETUP_REQUIRED_ROUTES.includes(to.name)) {
    const isSchoolReady = schoolStore.isReady;

    // Redirect to school setup if workspace not ready
    if (!isSchoolReady) {
      return { name: 'SchoolSetup' };
    }
  }
});

export default router;