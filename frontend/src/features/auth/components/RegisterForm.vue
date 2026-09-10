<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../../stores/authStore';
import CmButton from '../../../components/ui/CmButton.vue';
import CmInput from '../../../components/ui/CmInput.vue';
import CmCheckbox from '../../../components/ui/CmCheckbox.vue';
import CmAlert from '../../../components/ui/CmAlert.vue';
import type { AuthState } from '../useAuthState';

interface Emits {
  (e: 'switch-state', state: AuthState): void;
}

const emit = defineEmits<Emits>();
const router = useRouter();
const authStore = useAuthStore();

const firstName = ref('');
const lastName = ref('');
const email = ref('');
const password = ref('');
const agreeToTerms = ref(false);
const showPassword = ref(false);
const submitted = ref(false);

// Basic UX validation only — WorkOS is the authority on password policy.
// The submit button is disabled only for obvious local requirements.
const isEmailValid = computed(() => {
  const e = email.value.trim();
  return e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
});

const canSubmit = computed(() => {
  return (
    firstName.value.trim().length > 0 &&
    lastName.value.trim().length > 0 &&
    email.value.trim().length > 0 &&
    password.value.length > 0 &&
    isEmailValid.value &&
    agreeToTerms.value
  );
});

const fullName = computed(() => {
  return `${firstName.value.trim()} ${lastName.value.trim()}`.trim();
});

const handleSignUp = async () => {
  if (!canSubmit.value || authStore.loading) return;

  submitted.value = true;
  const response = await authStore.signUp({
    fullName: fullName.value,
    email: email.value.trim(),
    password: password.value,
  });

  if (response?.error) {
    // Error is already set in authStore and surfaced via authStore.error
    return;
  }

  // On success, redirect to dashboard
  router.push({ name: 'Home' });
};

const switchToLogin = () => {
  emit('switch-state', 'login');
};
</script>

<template>
  <div class="w-full space-y-5 sm:space-y-6">
    <div class="text-center">
      <h2 class="text-headline mb-1">Create your CAPFLUX account</h2>
      <p class="text-subheadline text-text-secondary">Start managing your school's finances today</p>
    </div>

    <CmAlert
      v-if="authStore.error"
      variant="danger"
      title="Unable to create account"
      :description="authStore.error"
      class="mb-4"
    />

    <form @submit.prevent="handleSignUp" data-testid="register-form" class="space-y-4">
      <!-- First Name & Last Name — horizontal two-column layout -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="signup-first-name" class="block text-sm font-medium text-text-primary mb-1">
            First name
          </label>
          <CmInput
            id="signup-first-name"
            type="text"
            v-model="firstName"
            :error="submitted && !firstName.trim() ? 'First name is required' : undefined"
            placeholder="Jane"
            autocomplete="given-name"
          />
        </div>
        <div>
          <label for="signup-last-name" class="block text-sm font-medium text-text-primary mb-1">
            Last name
          </label>
          <CmInput
            id="signup-last-name"
            type="text"
            v-model="lastName"
            :error="submitted && !lastName.trim() ? 'Last name is required' : undefined"
            placeholder="Doe"
            autocomplete="family-name"
          />
        </div>
      </div>

      <div>
        <label for="signup-email" class="block text-sm font-medium text-text-primary mb-1">
          Email address
        </label>
        <CmInput
          id="signup-email"
          type="email"
          v-model="email"
          :error="submitted && !isEmailValid ? 'Enter a valid email address' : undefined"
          placeholder="you@school.edu.ng"
          autocomplete="email"
        />
      </div>

      <div>
        <label for="signup-password" class="block text-sm font-medium text-text-primary mb-1">
          Password
        </label>
        <div class="relative">
          <CmInput
            :type="showPassword ? 'text' : 'password'"
            v-model="password"
            :error="submitted && !password ? 'Password is required' : undefined"
            placeholder="At least 8 characters"
            autocomplete="new-password"
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
        <p class="mt-1 text-xs text-text-muted">
          CAPFLUX follows WorkOS password requirements. Your password must be at least 8
          characters and not appear in known data breaches.
        </p>
      </div>

      <div class="flex items-start">
        <div class="flex items-start">
          <CmCheckbox
            id="signup-terms"
            v-model:checked="agreeToTerms"
            :error="submitted && !agreeToTerms ? 'You must accept the terms to continue' : undefined"
          />
        </div>
        <label for="signup-terms" class="ml-2 block text-sm text-text-secondary">
          I agree to the
          <a href="/terms" class="text-primary hover:underline">Terms of Service</a>
          and
          <a href="/privacy" class="text-primary hover:underline">Privacy Policy</a>
        </label>
      </div>

      <CmButton
        type="submit"
        variant="primary"
        :loading="authStore.loading"
        :disabled="!canSubmit || authStore.loading"
        data-testid="signup-button"
        class="w-full"
      >
        Create Account
      </CmButton>
    </form>

    <div class="text-center text-sm">
      <span class="text-text-secondary">Already have an account?</span>
      <button
        type="button"
        @click="switchToLogin"
        data-testid="login-link"
        class="ml-1 font-medium text-primary hover:underline"
      >
        Log In
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
      data-testid="google-signup"
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
