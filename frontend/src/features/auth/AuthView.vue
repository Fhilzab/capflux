<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/authStore';
import type { AuthState } from './useAuthState';
import AuthLayout from './components/AuthLayout.vue';
import AuthBrandPanel from './components/AuthBrandPanel.vue';
import AuthIllustration from './components/AuthIllustration.vue';
import LoginForm from './components/LoginForm.vue';
import RegisterForm from './components/RegisterForm.vue';
import EmailVerification from './components/EmailVerification.vue';
import ForgotPassword from './components/ForgotPassword.vue';
import ResetPassword from './components/ResetPassword.vue';
import CmAlert from '../../components/ui/CmAlert.vue';
import SandboxDemoLogin from '../../sandbox/ui/SandboxDemoLogin.vue';
import { runtimeEnvironment } from '../../shared/environment/runtimeEnvironment';

interface Props {
  initialMode?: string;
  provider?: string | null;
}

const props = defineProps<Props>();

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const getQueryParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
};

// --- Single reactive source of truth: the route query drives the mode. ---
const currentMode = computed<AuthState>(() => {
  const mode = getQueryParam(route.query.mode);
  if (['login', 'signup', 'verify-email', 'forgot-password', 'reset-password'].includes(mode)) {
    return mode as AuthState;
  }
  return 'login';
});

// Map each auth state to its embedded form component.
const formComponents: Record<AuthState, any> = {
  login: LoginForm,
  signup: RegisterForm,
  'verify-email': EmailVerification,
  'forgot-password': ForgotPassword,
  'reset-password': ResetPassword,
};

// Transition updates the URL query — the same source of truth that drives
// currentMode. No competing component-local state is maintained.
const transition = (newState: AuthState) => {
  if (getQueryParam(route.query.mode) !== newState) {
    router.replace({ query: { ...route.query, mode: newState } });
  }
};

// Handle OAuth callback (Google OAuth redirect with authorization code).
// Single responsibility: when code+state are present, exchange them once.
// On success → dashboard. On failure → stay with visible error.
watch(
  () => route.query,
  async (query) => {
    const code = getQueryParam(query.code);
    const state = getQueryParam(query.state);
    if (code) {
      const success = await authStore.handleOAuthCallback(code, state);
      if (success) {
        router.push({ name: 'Home' });
      }
      // On failure, authStore.error is set and displayed via CmAlert.
      // User stays on AuthView — no silent redirect to login.
    }
  },
  { immediate: true },
);

onMounted(() => {
  if (runtimeEnvironment.isSandbox) return;
  const mode = currentMode.value;
  if (mode !== 'login' && mode !== 'signup') return;

  const code = getQueryParam(route.query.code);
  if (code) return; // Callback flow is already handled by the watch above.

  authStore.initiateAuthKit(mode);
});
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- CAPFLUX branded auth card: layout + brand panel + dynamic form -->
    <AuthLayout>
      <template #brand>
        <AuthBrandPanel />
      </template>

      <template #illustration-mobile>
        <AuthIllustration variant="mobile" />
      </template>

      <template #form>
        <!-- Sandbox mode is persona-first: no credential forms, no OAuth. -->
        <SandboxDemoLogin v-if="runtimeEnvironment.isSandbox" />
        <div v-else class="w-full">
          <!-- Global auth error (e.g. OAuth callback failure) -->
          <CmAlert
            v-if="authStore.error"
            variant="danger"
            title="Authentication error"
            :description="authStore.error"
            class="mb-4"
          />
          <Transition name="auth" mode="out-in">
            <component
              :is="formComponents[currentMode]"
              :key="currentMode"
              @switch-state="transition"
              :email="currentMode === 'verify-email' ? getQueryParam(route.query.email) : undefined"
            />
          </Transition>
        </div>
      </template>
    </AuthLayout>
  </div>
</template>

<style scoped>
.auth-enter-active,
.auth-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.auth-enter-from,
.auth-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>