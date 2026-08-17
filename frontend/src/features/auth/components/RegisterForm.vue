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
  <div class="w-full space-y-6">
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
      data-testid="google-signup"
      data-google-auth
      @click="authStore.signInWithProvider('google')"
    >
      Continue with Google
    </CmButton>
  </div>
</template>
