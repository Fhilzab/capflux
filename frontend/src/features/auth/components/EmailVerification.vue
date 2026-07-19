<script setup lang="ts">
import { ref } from 'vue';
import CmButton from '../../../components/ui/CmButton.vue';
import CmAlert from '../../../components/ui/CmAlert.vue';

interface Emits {
  (e: 'switch-state', state: 'login' | 'signup'): void;
}

defineEmits<Emits>();

const isOffline = ref(typeof navigator !== 'undefined' ? !navigator.onLine : false);
const loading = ref(false);
const error = ref<string | null>(null);
const success = ref(false);

const handleResendEmail = async () => {
  if (isOffline.value) return;
  
  loading.value = true;
  error.value = null;
  
  try {
    const { AuthService } = await import('../../../shared/services/AuthService');
    const { error: resendError } = await AuthService.resendVerificationEmail();
    
    if (resendError) {
      error.value = resendError.message;
    } else {
      success.value = true;
    }
  } catch (err) {
    error.value = 'Failed to resend verification email';
  } finally {
    loading.value = false;
  }
};

const handleOpenEmailApp = () => {
  window.location.href = 'mailto:';
};

// Handle offline/online status
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => isOffline.value = false);
  window.addEventListener('offline', () => isOffline.value = true);
}
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

    <!-- Success Message -->
    <CmAlert
      v-if="success"
      variant="success"
      title="Email Sent"
      description="Verification email has been resent. Please check your inbox."
      class="mb-6"
    />

    <!-- Error Alert -->
    <CmAlert
      v-if="error"
      variant="danger"
      title="Resend Failed"
      :description="error"
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
      <CmButton
        variant="link"
        @click="$emit('switch-state', 'signup')"
      >
        Change Email
      </CmButton>

      <div class="text-center">
        <CmButton
          variant="link"
          @click="$emit('switch-state', 'login')"
        >
          Back to Login
        </CmButton>
      </div>
    </div>
  </div>
</template>