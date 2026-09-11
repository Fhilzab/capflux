<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../../stores/authStore';
import CmButton from '../../../components/ui/CmButton.vue';
import CmInput from '../../../components/ui/CmInput.vue';
import CmCheckbox from '../../../components/ui/CmCheckbox.vue';
import CmAlert from '../../../components/ui/CmAlert.vue';
import GoogleIcon from '../../../components/ui/GoogleIcon.vue';
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

// Basic UX validation only — Supabase is the authority on password policy.
const isEmailValid = computed(() => {
  const e = email.value.trim();
  return e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
});

const isPasswordValid = computed(() => password.value.length >= 8);

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
        <p class="mt-1 text-xs text-text-muted">
          At least 8 characters. Your password must not appear in known data breaches.
        </p>
      </div>

      <div class="flex items-start">
        <CmCheckbox
          id="signup-terms"
          v-model:checked="agreeToTerms"
          :error="submitted && !agreeToTerms ? 'You must accept the terms to continue' : undefined"
        />
        <label for="signup-terms" class="ml-2 block text-sm text-text-secondary">
          I agree to the
          <a href="/terms" class="text-brand hover:underline">Terms of Service</a>
          and
          <a href="/privacy" class="text-brand hover:underline">Privacy Policy</a>
        </label>
      </div>

      <CmButton
        type="submit"
        variant="primary"
        :loading="authStore.loading"
        :disabled="!canSubmit || authStore.loading"
        data-testid="signup-button"
        class="w-full h-12"
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
        class="ml-1 font-medium text-brand hover:underline"
      >
        Log In
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
      data-testid="google-signup"
      data-google-auth
      @click="authStore.signInWithProvider('google')"
    >
      <GoogleIcon size="20" />
      <span>Continue with Google</span>
    </CmButton>
  </div>
</template>