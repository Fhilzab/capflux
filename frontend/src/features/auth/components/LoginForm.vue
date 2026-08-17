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
  <div class="w-full space-y-6">
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

    <div class="relative my-6">
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
      Continue with Google
    </CmButton>
  </div>
</template>
