<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/authStore';
import type { AuthState } from './useAuthState';
import AuthLayout from './components/AuthLayout.vue';
import AuthIllustration from './components/AuthIllustration.vue';
import LoginForm from './components/LoginForm.vue';
import RegisterForm from './components/RegisterForm.vue';
import EmailVerification from './components/EmailVerification.vue';
import ForgotPassword from './components/ForgotPassword.vue';
import ResetPassword from './components/ResetPassword.vue';

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
watch(
  () => route.query,
  async (query) => {
    const code = getQueryParam(query.code);
    if (code) {
      const success = await authStore.handleOAuthCallback(code);
      if (success) {
        router.push({ name: 'Home' });
      }
    }
  },
  { immediate: true },
);

// If the URL contains ?provider=google (Google OAuth redirect), auto-click
// the Google button so the flow completes seamlessly.
if (props.provider === 'google') {
  setTimeout(() => {
    const googleButton = document.querySelector('[data-google-auth]');
    if (googleButton) {
      (googleButton as HTMLElement).click();
    }
  }, 100);
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- CAPFLUX branded auth card: layout + illustration + dynamic form -->
    <AuthLayout>
      <template #illustration>
        <AuthIllustration />
      </template>

      <template #illustration-mobile>
        <AuthIllustration />
      </template>

      <template #form>
        <div class="w-full max-w-md mx-auto">
          <Transition name="auth" mode="out-in">
            <component
              :is="formComponents[currentMode]"
              :key="currentMode"
              @switch-state="transition"
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
