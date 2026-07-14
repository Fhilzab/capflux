import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import LoginView from '../views/LoginView.vue';
import LandingView from '../views/LandingView.vue';
import HomeView from '../views/HomeView.vue';
import OnboardingView from '../views/OnboardingView.vue';
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
  {
    path: '/login',
    name: 'Login',
    component: LoginView,
  },
  // Onboarding routes
  {
    path: '/onboarding',
    name: 'Onboarding',
    component: OnboardingView,
  },
  {
    path: '/onboarding/financial-setup',
    name: 'OnboardingFinancialSetup',
    component: OnboardingView,
  },
  {
    path: '/onboarding/activate',
    name: 'OnboardingActivate',
    component: OnboardingView,
  },
  {
    path: '/onboarding/complete',
    name: 'OnboardingComplete',
    component: OnboardingView,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  if (!authStore.session) {
    await authStore.initialize();
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'Login' };
  }

  if (to.name === 'Login' && authStore.isAuthenticated) {
    return { name: 'Home' };
  }

  if (to.name === 'Landing' && authStore.isAuthenticated) {
    return { name: 'Home' };
  }
});

export default router;