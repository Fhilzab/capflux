<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../../stores/authStore';
import CmButton from '../../../components/ui/CmButton.vue';
import CmInput from '../../../components/ui/CmInput.vue';
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
  <div class="w-full space-y-6">
    <!-- Header -->
    <div class="text-center">
      <h2 class="text-headline mb-1">Welcome back</h2>
      <p class="text-subheadline text-text-secondary">Sign in to your CAPFLUX account</p>
    </div>

    <!-- Error Alert -->
    <CmAlert
      v-if="authStore.error"
      variant="danger"
      title="Sign-in error"
      :description="authStore.error"
      class="mb-4"
    />

    <form @submit.prevent="handleSignIn" data-testid="login-form" class="space-y-5">
      <!-- Email Field -->
      <div>
        <label for="login-email" class="block text-sm font-medium text-text-primary mb-1.5">
          Email address
        </label>
        <CmInput
          id="login-email"
          type="email"
          v-model="email"
          :error="submitted && !isEmailValid ? 'Enter a valid email address' : undefined"
          placeholder="you@school.edu.ng"
          autocomplete="email"
          input-class="h-[44px]"
        />
      </div>

      <!-- Password Field -->
      <div>
        <label for="login-password" class="block text-sm font-medium text-text-primary mb-1.5">
          Password
        </label>
        <CmInput
          :type="showPassword ? 'text' : 'password'"
          v-model="password"
          :error="submitted && !password ? 'Password is required' : undefined"
          placeholder="••••••••"
          autocomplete="current-password"
          input-class="h-[44px]"
        >
          <template #append>
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="flex h-[44px] w-[44px] items-center justify-center text-text-muted hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-button"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              :aria-pressed="showPassword"
            >
              <Eye v-if="!showPassword" class="h-5 w-5" stroke-width="2" />
              <EyeOff v-else class="h-5 w-5" stroke-width="2" />
            </button>
          </template>
        </CmInput>
      </div>

      <!-- Primary CTA -->
      <CmButton
        type="submit"
        variant="primary"
        size="tall"
        :loading="authStore.loading"
        :disabled="!canSubmit || authStore.loading"
        data-testid="signin-button"
        class="w-full"
      >
        <span v-if="!authStore.loading">Sign In</span>
        <span v-else>Signing in…</span>
      </CmButton>

      <!-- Secondary Actions -->
      <div class="flex justify-between items-center text-sm">
        <button
          type="button"
          @click="switchToForgotPassword"
          data-testid="forgot-password-link"
          class="text-text-secondary hover:text-text-primary transition-colors min-h-[44px] flex items-center"
        >
          Forgot password?
        </button>
        <button
          type="button"
          @click="switchToSignup"
          data-testid="create-account-link"
          class="font-medium text-text-secondary hover:text-text-primary transition-colors min-h-[44px] flex items-center gap-1"
        >
          Create Account
          <ChevronRight class="h-4 w-4" stroke-width="2.5" />
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
        size="tall"
        :disabled="authStore.loading"
        :loading="authStore.loading"
        class="w-full"
        data-testid="google-signin"
        data-google-auth
        @click="authStore.signInWithProvider('google')"
      >
        <GoogleIcon :size="20" />
        <span v-if="!authStore.loading">Continue with Google</span>
        <span v-else>Connecting…</span>
      </CmButton>
    </form>
  </div>
</template>