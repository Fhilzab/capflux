<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import CmButton from '../components/ui/CmButton.vue';
import CmAlert from '../components/ui/CmAlert.vue';

const router = useRouter();
const authStore = useAuthStore();

// Get email from route state or store
const email = ref('your email'); // Will be replaced with actual email
const isOffline = ref(!navigator.onLine);
const error = ref(null);

let pollInterval: ReturnType<typeof setInterval> | null = null;

const pollForVerification = async () => {
  if (isOffline.value) return;
  
  try {
    const { session } = await authStore.refreshSession();
    if (session) {
      router.push({ name: 'Home' });
    }
  } catch (e) {
    // Continue polling
  }
};

const handleResendEmail = async () => {
  // Supabase resend logic would go here
  // For now, just show a message
};

const handleChangeEmail = () => {
  router.push({ name: 'SignUp' });
};

const handleOpenEmailApp = () => {
  window.location.href = 'mailto:';
};

const handleBackToLogin = () => {
  router.push({ name: 'Login' });
};

onMounted(() => {
  // Start polling every 3 seconds
  pollInterval = setInterval(pollForVerification, 3000);
});

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval);
  }
});

// Handle offline/online status
window.addEventListener('online', () => isOffline.value = false);
window.addEventListener('offline', () => isOffline.value = true);
</script>

<template>
  <main class="min-h-screen bg-background flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="premium-card bg-card p-8 text-center">
        <!-- Mail Icon -->
        <div class="mb-8">
          <div class="flex h-20 w-20 items-center justify-center rounded-full bg-success/10 mx-auto mb-4">
            <svg class="h-10 w-10 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          
          <h1 class="text-headline mb-2">Check your inbox</h1>
          <p class="text-text-secondary mb-2">We've sent a verification link to</p>
          <p class="font-medium text-text-primary">{{ email }}</p>
        </div>

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
            :disabled="isOffline"
          >
            Resend Email
          </CmButton>
        </div>

        <!-- Links -->
        <div class="mt-6 pt-6 border-t border-divider space-y-3">
          <button
            @click="handleChangeEmail"
            class="text-sm font-medium text-primary hover:text-primary-hover transition-colors focus-ring"
          >
            Change Email
          </button>
          
          <div class="text-center">
            <button
              @click="handleBackToLogin"
              class="text-sm font-medium text-text-muted hover:text-text-primary transition-colors focus-ring"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>