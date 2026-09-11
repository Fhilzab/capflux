<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../../stores/authStore';
import CmButton from '../../../components/ui/CmButton.vue';
import CmInput from '../../../components/ui/CmInput.vue';
import CmCheckbox from '../../../components/ui/CmCheckbox.vue';
import CmAlert from '../../../components/ui/CmAlert.vue';
import GoogleIcon from '../../../components/ui/GoogleIcon.vue';
import { Eye, EyeOff, ChevronRight } from '@lucide/vue';
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
  <div class="w-full space-y-6">
    <!-- Header -->
    <div class="text-center">
      <h2 class="text-headline mb-1">Create your CAPFLUX account</h2>
      <p class="text-subheadline text-text-secondary">Start managing your school's finances today</p>
    </div>

    <!-- Error Alert -->
    <CmAlert
      v-if="authStore.error"
      variant="danger"
      title="Unable to create account"
      :description="authStore.error"
      class="mb-4"
    />

    <form @submit.prevent="handleSignUp" data-testid="register-form" class="space-y-5">
      <!-- First Name & Last Name — horizontal two-column layout -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="signup-first-name" class="block text-sm font-medium text-text-primary mb-1.5">
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
          <label for="signup-last-name" class="block text-sm font-medium text-text-primary mb-1.5">
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

      <!-- Email Field -->
      <div>
        <label for="signup-email" class="block text-sm font-medium text-text-primary mb-1.5">
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

      <!-- Password Field -->
      <div>
        <label for="signup-password" class="block text-sm font-medium text-text-primary mb-1.5">
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
            class="absolute inset-y-0 right-0 flex items-center justify-center w-12 text-text-muted hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-r-button"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
            :aria-pressed="showPassword"
          >
            <Eye v-if="!showPassword" class="h-5 w-5" stroke-width="2" />
            <EyeOff v-else class="h-5 w-5" stroke-width="2" />
          </button>
        </div>
        <p class="mt-1.5 text-xs text-text-muted">
          At least 8 characters. Your password must not appear in known data breaches.
        </p>
      </div>

      <!-- Terms Checkbox -->
      <div class="flex items-start gap-2">
        <CmCheckbox
          id="signup-terms"
          v-model:checked="agreeToTerms"
          :error="submitted && !agreeToTerms ? 'You must accept the terms to continue' : undefined"
        />
        <label for="signup-terms" class="mt-0.5 text-sm text-text-secondary">
          I agree to the
          <a href="/terms" class="text-brand hover:underline">Terms of Service</a>
          and
          <a href="/privacy" class="text-brand hover:underline">Privacy Policy</a>
        </label>
      </div>

      <!-- Primary CTA -->
      <CmButton
        type="submit"
        variant="primary"
        size="lg"
        :loading="authStore.loading"
        :disabled="!canSubmit || authStore.loading"
        data-testid="signup-button"
        class="w-full"
      >
        <span v-if="!authStore.loading">Create Account</span>
        <span v-else>Creating account…</span>
      </CmButton>

      <!-- Secondary Action -->
      <div class="text-center text-sm">
        <span class="text-text-secondary">Already have an account?</span>
        <button
          type="button"
          @click="switchToLogin"
          data-testid="login-link"
          class="ml-1 font-medium text-brand hover:underline min-h-[44px] inline-flex items-center"
        >
          Log In
        </button>
      </div>

      <!-- Divider -->
      <div class="relative">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-divider"></div>
        </div>
        <div class="relative flex justify-center">
          <span class="px-3 text-xs text-text-muted bg-card">Or continue with</span>
        </div>
      </div>

      <!-- Google Authentication -->
      <CmButton
        type="button"
        variant="secondary"
        size="lg"
        :disabled="authStore.loading"
        :loading="authStore.loading"
        class="w-full"
        data-testid="google-signup"
        data-google-auth
        @click="authStore.signInWithProvider('google')"
      >
        <GoogleIcon size="20" />
        <span v-if="!authStore.loading">Continue with Google</span>
        <span v-else>Connecting…</span>
      </CmButton>
    </form>
  </div>
</template>