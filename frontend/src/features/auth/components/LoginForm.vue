<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../../stores/authStore';
import CmButton from '../../../components/ui/CmButton.vue';
import CmInput from '../../../components/ui/CmInput.vue';
import CmAlert from '../../../components/ui/CmAlert.vue';
import GoogleIcon from '../../../components/ui/GoogleIcon.vue';
import type { AuthState } from '../useAuthState';

interface Emits {
  (e: 'switch-state', state: AuthState): void;
}

const emit = defineEmits<Emits>();
const router = useRouter();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const submitted = ref(false);

// Basic client-side UX validation only — Supabase is authoritative.
const isEmailValid = computed(() => {
  const e = email.value.trim();
  return e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
});

const canSubmit = computed(() => {
  return email.value.length > 0 && password.value.length > 0 && isEmailValid.value;
});

const handleSignIn = async () => {
  if (!canSubmit.value || authStore.loading) return;

  submitted.value = true;
  const success = await authStore.signIn({
    email: email.value.trim(),
    password: password.value,
  });

  if (success) {
    router.push({ name: 'Home' });
  }
};

const switchToSignup = () => {
  emit('switch-state', 'signup');
};

const switchToForgotPassword = () => {
  emit('switch-state', 'forgot-password');
};
</script>

<template>
  <div class="w-full space-y-5 sm:space-y-6">
    <div class="text-center">
      <h2 class="text-headline mb-1">Welcome back</h2>
      <p class="text-subheadline text-text-secondary">Sign in to your CAPFLUX account</p>
    </div>

    <CmAlert
      v-if="authStore.error"
      variant="danger"
      title="Sign-in error"
      :description="authStore.error"
      class="mb-4"
    />

    <form @submit.prevent="handleSignIn" data-testid="login-form" class="space-y-4">
      <div>
        <label for="login-email" class="block text-sm font-medium text-text-primary mb-1">
          Email address
        </label>
        <CmInput
          id="login-email"
          type="email"
          v-model="email"
          :error="submitted && !isEmailValid ? 'Enter a valid email address' : undefined"
          placeholder="you@school.edu.ng"
          autocomplete="email"
        />
      </div>

      <div>
        <label for="login-password" class="block text-sm font-medium text-text-primary mb-1">
          Password
        </label>
        <div class="relative">
          <CmInput
            :type="showPassword ? 'text' : 'password'"
            v-model="password"
            :error="submitted && !password ? 'Password is required' : undefined"
            placeholder="••••••••"
            autocomplete="current-password"
            class="pr-12"
          />
          <button
            type="button"
            @click="showPassword = !showPassword"
            class="absolute inset-y-0 right-0 flex items-center pr-3 text-text-muted hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-l-none"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
          >
            <svg
              v-if="!showPassword"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-5 w-5"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-5 w-5"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          </button>
        </div>
      </div>

      <CmButton
        type="submit"
        variant="primary"
        :loading="authStore.loading"
        :disabled="!canSubmit || authStore.loading"
        data-testid="signin-button"
        class="w-full h-12"
      >
        Sign In
      </CmButton>
    </form>

    <div class="flex justify-between text-sm">
      <button
        type="button"
        @click="switchToForgotPassword"
        data-testid="forgot-password-link"
        class="text-text-secondary hover:text-text-primary transition-colors"
      >
        Forgot password?
      </button>
      <button
        type="button"
        @click="switchToSignup"
        data-testid="create-account-link"
        class="font-medium text-text-secondary hover:text-text-primary transition-colors"
      >
        Create Account
      </button>
    </div>

    <div class="relative my-5 sm:my-6">
      <div class="absolute inset-0 flex items-center">
        <div class="w-full border-t border-divider"></div>
      </div>
      <div class="relative flex justify-center">
        <span class="px-3 text-xs text-text-muted bg-card">Or continue with</span>
      </div>
    </div>

    <CmButton
      type="button"
      variant="secondary"
      :disabled="authStore.loading"
      class="w-full h-12"
      data-testid="google-signin"
      data-google-auth
      @click="authStore.signInWithProvider('google')"
    >
      <GoogleIcon size="20" />
      <span>Continue with Google</span>
    </CmButton>
  </div>
</template>