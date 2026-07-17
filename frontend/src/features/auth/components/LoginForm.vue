<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../../stores/authStore';
import CmInput from '../../../components/ui/CmInput.vue';
import CmButton from '../../../components/ui/CmButton.vue';
import CmAlert from '../../../components/ui/CmAlert.vue';

interface Emits {
  (e: 'switch-state', state: 'signup' | 'forgot-password'): void;
}

defineEmits<Emits>();

const authStore = useAuthStore();
const router = useRouter();

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const isOffline = ref(!navigator.onLine);

// Handle offline/online status
window.addEventListener('online', () => isOffline.value = false);
window.addEventListener('offline', () => isOffline.value = true);

const handleSignIn = async () => {
  if (isOffline.value) {
    return;
  }

  const success = await authStore.signIn({
    email: email.value,
    password: password.value,
  });

  if (success) {
    router.push({ name: 'Home' });
  }
};

const handleGoogleSignIn = () => {
  // Placeholder for Google OAuth integration
  // Would integrate with Supabase OAuth
};
</script>

<template>
  <div class="w-full">
    <!-- Form Header -->
    <div class="mb-8 text-center">
      <h2 class="text-headline mb-2">Sign in to your account</h2>
      <p class="text-text-secondary">Access your financial workspace</p>
    </div>

    <!-- Offline Notice -->
    <CmAlert
      v-if="isOffline"
      variant="warning"
      title="Offline"
      description="You're currently offline. Internet access is required to sign in."
      class="mb-6"
    />

    <!-- Error Alert -->
    <CmAlert
      v-if="authStore.error"
      variant="danger"
      title="Sign In Failed"
      :description="authStore.error"
      class="mb-6"
    />

    <!-- Login Form -->
    <form @submit.prevent="handleSignIn" class="space-y-6">
      <!-- Email Field -->
      <CmInput
        v-model="email"
        label="Email Address"
        type="email"
        placeholder="proprietor@school.edu.ng"
        autocomplete="username"
        required
        :disabled="isOffline"
      />

      <!-- Password Field with Toggle -->
      <div class="space-y-2">
        <CmInput
          v-model="password"
          label="Password"
          :type="showPassword ? 'text' : 'password'"
          placeholder="Enter your password"
          autocomplete="current-password"
          required
          :disabled="isOffline"
        />
        <button
          type="button"
          @click="showPassword = !showPassword"
          class="text-sm font-medium text-primary hover:text-primary-hover transition-colors focus-ring"
          :disabled="isOffline"
          aria-label="Toggle password visibility"
        >
          {{ showPassword ? 'Hide' : 'Show' }} password
        </button>
      </div>

      <!-- Remember Me & Forgot Password -->
      <div class="flex items-center justify-between">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            class="w-4 h-4 rounded border-border text-primary focus:ring-primary focus-ring"
            :disabled="isOffline"
          />
          <span class="text-sm text-text-secondary">Remember me</span>
        </label>
        <button
          type="button"
          @click="$emit('switch-state', 'forgot-password')"
          class="text-sm font-medium text-primary hover:text-primary-hover transition-colors focus-ring"
          :disabled="isOffline"
        >
          Forgot password?
        </button>
      </div>

      <!-- Sign In Button -->
      <CmButton
        type="submit"
        variant="primary"
        :loading="authStore.loading"
        :disabled="isOffline || !email || !password"
        class="w-full"
      >
        Sign In
      </CmButton>
    </form>

    <!-- Divider -->
    <div class="my-6 flex items-center">
      <div class="flex-1 border-t border-divider"></div>
      <span class="px-4 text-sm text-text-muted">OR</span>
      <div class="flex-1 border-t border-divider"></div>
    </div>

    <!-- Google Sign In -->
    <CmButton
      @click="handleGoogleSignIn"
      variant="secondary"
      :disabled="isOffline"
      class="w-full"
    >
      Continue with Google
    </CmButton>
  </div>

  <!-- Footer Links -->
  <div class="mt-6 pt-6 border-t border-divider text-center">
    <span class="text-text-secondary">Don't have an account?</span>
    <button
      type="button"
      @click="$emit('switch-state', 'signup')"
      class="ml-2 text-sm font-medium text-primary hover:text-primary-hover transition-colors focus-ring"
    >
      Create Account
    </button>
  </div>
</template>