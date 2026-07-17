<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import CmInput from '../../../components/ui/CmInput.vue';
import CmButton from '../../../components/ui/CmButton.vue';
import CmAlert from '../../../components/ui/CmAlert.vue';

interface Emits {
  (e: 'switch-state', state: 'login'): void;
}

defineEmits<Emits>();

const router = useRouter();

const newPassword = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const isOffline = ref(!navigator.onLine);
const loading = ref(false);
const error = ref<string | null>(null);

const handleSubmit = async () => {
  if (isOffline.value) return;

  error.value = null;
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Passwords do not match';
    return;
  }
  if (newPassword.value.length < 8) {
    error.value = 'Password must be at least 8 characters';
    return;
  }

  loading.value = true;

  // Supabase reset password logic would go here

  loading.value = false;
  router.push({ name: 'Auth' });
};

// Handle offline/online status
window.addEventListener('online', () => isOffline.value = false);
window.addEventListener('offline', () => isOffline.value = true);
</script>

<template>
  <div class="w-full">
    <!-- Form Header -->
    <div class="mb-8 text-center">
      <h2 class="text-headline mb-2">Set new password</h2>
      <p class="text-text-secondary">Enter your new password below</p>
    </div>

    <!-- Offline Notice -->
    <CmAlert
      v-if="isOffline"
      variant="warning"
      title="Offline"
      description="Internet access is required to reset your password."
      class="mb-6"
    />

    <!-- Error Alert -->
    <CmAlert
      v-if="error"
      variant="danger"
      title="Reset Failed"
      :description="error"
      class="mb-6"
    />

    <!-- Reset Form -->
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <CmInput
        v-model="newPassword"
        label="New Password"
        :type="showPassword ? 'text' : 'password'"
        placeholder="••••••••"
        autocomplete="new-password"
        required
        :disabled="isOffline"
      />

      <CmInput
        v-model="confirmPassword"
        label="Confirm Password"
        :type="showPassword ? 'text' : 'password'"
        placeholder="••••••••"
        autocomplete="new-password"
        required
        :disabled="isOffline"
      />

      <CmButton
        type="submit"
        variant="primary"
        :loading="loading"
        :disabled="isOffline || !newPassword || !confirmPassword"
        class="w-full"
      >
        Reset Password
      </CmButton>
    </form>

    <!-- Back to Login -->
    <div class="mt-6 pt-6 border-t border-divider text-center">
      <button
        type="button"
        @click="$emit('switch-state', 'login')"
        class="text-sm font-medium text-primary hover:text-primary-hover transition-colors focus-ring"
      >
        Back to Login
      </button>
    </div>
  </div>
</template>