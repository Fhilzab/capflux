<script setup lang="ts">
import { watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthState } from './useAuthState';
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

const { state, transition } = useAuthState();

// Helper to normalize query param (can be string or string[])
const getQueryParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
};

// Set initial state from URL query params on mount
watch(() => route.query, (query) => {
  const mode = getQueryParam(query.mode) as string;
  if (mode && ['login', 'signup', 'verify-email', 'forgot-password', 'reset-password'].includes(mode)) {
    transition(mode as any);
  }
}, { immediate: true });

// Handle Google OAuth redirect from URL query
if (props.provider === 'google') {
  // Will trigger Google OAuth on next tick
  setTimeout(() => {
    const googleButton = document.querySelector('[data-google-auth]');
    if (googleButton) {
      (googleButton as HTMLElement).click();
    }
  }, 100);
}
</script>

<template>
  <AuthLayout>
    <!-- Left Panel - Illustration (Desktop) -->
    <template #illustration>
      <AuthIllustration />
    </template>

    <!-- Mobile Illustration -->
    <template #illustration-mobile>
      <AuthIllustration />
    </template>

    <!-- Right Panel - Forms -->
    <template #form>
      <div>
        <LoginForm
          v-if="state === 'login'"
          @switch-state="transition"
          :key="'login'"
        />

        <RegisterForm
          v-else-if="state === 'signup'"
          @switch-state="transition"
          :key="'signup'"
        />

        <EmailVerification
          v-else-if="state === 'verify-email'"
          @switch-state="transition"
          :key="'verify-email'"
        />

        <ForgotPassword
          v-else-if="state === 'forgot-password'"
          @switch-state="transition"
          :key="'forgot-password'"
        />

        <ResetPassword
          v-else-if="state === 'reset-password'"
          @switch-state="transition"
          :key="'reset-password'"
        />
      </div>
    </template>

    <!-- Footer -->
    <template #footer>
      <div class="mt-6 text-center text-xs text-text-muted">
        <p>&copy; 2024 Capstone Software Solutions Ltd. All rights reserved.</p>
      </div>
    </template>
  </AuthLayout>
</template>

<style>
/* Auth transition - fade + slide + scale */
.auth-enter-active,
.auth-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.auth-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

.auth-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .auth-enter-active,
  .auth-leave-active {
    transition: none;
  }

  .auth-enter-from,
  .auth-leave-to {
    opacity: 1;
    transform: none;
  }
}
</style>