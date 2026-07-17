<script setup lang="ts">
import { ref } from 'vue';
import CmInput from '../../../components/ui/CmInput.vue';
import CmButton from '../../../components/ui/CmButton.vue';
import CmAlert from '../../../components/ui/CmAlert.vue';

interface Emits {
  (e: 'switch-state', state: 'login'): void;
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const email = ref('');
const isOffline = ref(!navigator.onLine);
const loading = ref(false);
const error = ref<string | null>(null);

const handleSubmit = async () => {
  if (isOffline.value) return;
  loading.value = true;
  error.value = null;

  // Supabase password reset logic would go here
  // For now, simulate success

  loading.value = false;
  emit('submitted');
};

// Handle offline/online status
window.addEventListener('online', () => isOffline.value = false);
window.addEventListener('offline', () => isOffline.value = true);
</script>

<template>
  <div class="w-full">
    <!-- Form Header -->
    <div class="mb-8 text-center">
      <h2 class="text-headline mb-2">Reset your password</h2>
      <p class="text-text-secondary">Enter your email to receive a reset link</p>
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
        v-model="email"
        label="Email Address"
        type="email"
        placeholder="proprietor@school.edu.ng"
        autocomplete="email"
        required
        :disabled="isOffline"
      />

      <CmButton
        type="submit"
        variant="primary"
        :loading="loading"
        :disabled="isOffline || !email"
        class="w-full"
      >
        Send Reset Link
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