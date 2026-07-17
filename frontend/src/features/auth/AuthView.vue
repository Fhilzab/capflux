<script setup lang="ts">
import { computed } from 'vue';
import { useAuthState } from './useAuthState';
import AuthLayout from './components/AuthLayout.vue';
import AuthIllustration from './components/AuthIllustration.vue';
import LoginForm from './components/LoginForm.vue';
import RegisterForm from './components/RegisterForm.vue';
import EmailVerification from './components/EmailVerification.vue';
import ForgotPassword from './components/ForgotPassword.vue';
import ResetPassword from './components/ResetPassword.vue';

const { state, transition } = useAuthState();

// Current form component based on state
const currentForm = computed(() => state.value);
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
      <Transition
        name="auth"
        mode="out-in"
      >
        <LoginForm
          v-if="currentForm === 'login'"
          @switch-state="transition"
          :key="'login'"
        />

        <RegisterForm
          v-else-if="currentForm === 'signup'"
          @switch-state="transition"
          :key="'signup'"
        />

        <EmailVerification
          v-else-if="currentForm === 'verify-email'"
          @switch-state="transition"
          :key="'verify-email'"
        />

        <ForgotPassword
          v-else-if="currentForm === 'forgot-password'"
          @switch-state="transition"
          :key="'forgot-password'"
        />

        <ResetPassword
          v-else-if="currentForm === 'reset-password'"
          @switch-state="transition"
          :key="'reset-password'"
        />
      </Transition>
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