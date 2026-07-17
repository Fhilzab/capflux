<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../../stores/authStore';
import CmButton from '../../../components/ui/CmButton.vue';
import CmAlert from '../../../components/ui/CmAlert.vue';

interface Emits {
  (e: 'switch-state', state: 'login' | 'signup'): void;
}

defineEmits<Emits>();

const authStore = useAuthStore();
const router = useRouter();

const isOffline = ref(!navigator.onLine);
const loading = ref(false);

const handleResendEmail = async () => {
  if (isOffline.value) return;
  loading.value = true;
  // Supabase resend logic would go here
  loading.value = false;
};

const handleOpenEmailApp = () => {
  window.location.href = 'mailto:';
};

// Handle offline/online status
window.addEventListener('online', () => isOffline.value = false);
window.addEventListener('offline', () => isOffline.value = true);
</script>

<template>
  <div class="w-full text-center">
    <!-- Mail Icon -->
    <div class="mb-8">
      <div class="flex h-20 w-20 items-center justify-center rounded-full bg-success/10 mx-auto mb-4">
        <svg class="h-10 w-10 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>

      <h1 class="text-headline mb-2">Check your inbox</h1>
      <p class="text-text-secondary mb-2">We've sent a verification link to your email.</p>
      <p class="font-medium text-text-primary">Click the link to verify your account.</p>
    </div>

    <!-- Offline Notice -->
    <CmAlert
      v-if="isOffline"
      variant="warning"
      title="Offline"
      description="Internet access is required to verify your email."
      class="mb-6"
    />

    <!-- Action Buttons -->
    <div class="space-y-3">
      <CmButton
        @click="handleOpenEmailApp"
        variant="secondary"
        class="w-full"
      >
        Open Email App
      </CmButton>

      <CmButton
        @click="handleResendEmail"
        variant="secondary"
        class="w-full"
        :disabled="isOffline || loading"
        :loading="loading"
      >
        Resend Email
      </CmButton>
    </div>

    <!-- Links -->
    <div class="mt-6 pt-6 border-t border-divider space-y-3">
      <button
        @click="$emit('switch-state', 'signup')"
        class="text-sm font-medium text-primary hover:text-primary-hover transition-colors focus-ring"
      >
        Change Email
      </button>

      <div class="text-center">
        <button
          @click="$emit('switch-state', 'login')"
          class="text-sm font-medium text-text-muted hover:text-text-primary transition-colors focus-ring"
        >
          Back to Login
        </button>
      </div>
    </div>
  </div>
</template>