<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../../stores/authStore';
import CmButton from '../../../components/ui/CmButton.vue';
import CmInput from '../../../components/ui/CmInput.vue';
import CmAlert from '../../../components/ui/CmAlert.vue';
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

// Basic client-side UX validation only — WorkOS is authoritative.
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
          />
          <button
            type="button"
            @click="showPassword = !showPassword"
            class="absolute inset-y-0 right-0 flex items-center pr-3 text-text-muted hover:text-text-secondary"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
          >
            {{ showPassword ? 'Hide' : 'Show' }}
          </button>
        </div>
      </div>

      <CmButton
        type="submit"
        variant="primary"
        :loading="authStore.loading"
        :disabled="!canSubmit || authStore.loading"
        data-testid="signin-button"
        class="w-full"
      >
        Sign In
      </CmButton>
    </form>

    <div class="flex justify-between text-sm">
      <button
        type="button"
        @click="switchToForgotPassword"
        data-testid="forgot-password-link"
        class="text-sm text-text-secondary hover:text-text-primary"
      >
        Forgot password?
      </button>
      <button
        type="button"
        @click="switchToSignup"
        data-testid="create-account-link"
        class="text-sm font-medium text-text-secondary hover:text-text-primary"
      >
        Create Account
      </button>
    </div>

    <div class="relative my-5 sm:my-6">
      <div class="absolute inset-0 flex items-center">
        <div class="w-full border-t border-divider"></div>
      </div>
      <div class="relative flex justify-center">
        <span class="px-3 text-xs text-text-muted">Or continue with</span>
      </div>
    </div>

    <CmButton
      type="button"
      variant="secondary"
      :disabled="authStore.loading"
      class="w-full"
      data-testid="google-signin"
      data-google-auth
      @click="authStore.signInWithProvider('google')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20" class="flex-shrink-0">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.58 1.33 9.06 3.5l6.77-6.67C35.77 2.38 30.23 0 24 0 14.84 0 6.62 5.56 3.78 13.26l7.82 6.11C13.74 11.42 19.04 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.14 24.6c0-1.64-.16-3.22-.46-4.74l-1.37-.11-1.37.11c-.3.14-.6.25-.94.33.4.8.72 1.64.94 2.52l-2.58 2.02c-1.02-2.08-2.56-3.84-4.48-5.08l-3.3 1.02c-.68-.94-1.44-1.8-2.28-2.58l-.01 5.12c-.72.78-1.62 1.32-2.62 1.56.01.02.01.05.01.07v3.72c0 .02 0 .04-.01.07.98.24 1.9.56 2.74.98l3.46 1.08c.86-.5 1.66-1.06 2.38-1.72.78-.66 1.48-1.44 2.02-2.28l3.36-1.04c.32.64.58 1.3.8 2 .22.7.33 1.43.33 2.17v3.46c0 3.26-2.64 5.9-6 5.9h-1.56c-.74 0-1.4-.58-1.49-1.32l-.28-2.32c-.08-.64-.72-1.12-1.38-1.12h-2.44c-.66 0-1.2.56-1.28 1.22l-.28 2.32c-.1.84.58 1.58 1.42 1.58.78 0 1.54-.26 2.14-.72.62-.48 1.18-.96 1.6-1.5l.02 2.02c0 .78.6 1.44 1.37 1.56h4.56c2.98 0 5.42-2.26 6.22-5.24 4.16-1.46 7.28-4.8 8.8-9.6 1.4-2.86 2.22-6.06 2.22-9.4 0-2.66-.46-5.24-1.34-7.7l.06-.01c3.24-2.56 5.42-6.46 5.42-11.1 0-.02-.01-.04-.01-.06C46.66 38.04 24 47.5 24 47.5c-4.16 0-8.16-.82-11.86-2.44.88-.66 1.82-1.52 2.68-2.58-2.82-2.74-4.72-6.36-5.4-10.42C3.52 32.68 24 36.5 24 36.5c3.26 0 6.38-.5 9.32-1.46-.22.9-.64 1.78-1.26 2.58 2.94 1.86 6.62 2.82 10.4 2.8.86 0 1.7-.06 2.5-.16z"/>
        <path fill="#FBBC05" d="M16.53 30.47c-.4-1.24-.64-2.52-.64-3.85 0-1.34.24-2.62.64-3.86L9.42 18.16C7.75 20.5 6.76 23.14 6.76 26.02c0 2.88.94 5.56 2.6 7.88l4.17-3.41z"/>
        <path fill="#34A853" d="M44.5 24c0-1.64-.16-3.22-.46-4.74l-.28 2.32c-.02.16-.04.32-.04.48 0 2.6-.76 5.06-2.04 7.16 1.96 1.46 4.34 2.24 6.82 2.24.06-1.44.1-2.88.14-4.32-.4.48-.86.98-1.38 1.42z"/>
      </svg>
      <span>Continue with Google</span>
    </CmButton>
  </div>
</template>
