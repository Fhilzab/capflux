<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../../../stores/authStore';
import CmButton from '../../../components/ui/CmButton.vue';
import CmAlert from '../../../components/ui/CmAlert.vue';
import type { AuthState } from '../useAuthState';

interface Props {
  email: string;
}

interface Emits {
  (e: 'switch-state', state: AuthState): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
const authStore = useAuthStore();

const isResending = ref(false);
const resendSuccess = ref(false);
const countdown = ref(0);

const startCountdown = () => {
  countdown.value = 30;
  const timer = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) {
      clearInterval(timer);
    }
  }, 1000);
};

const handleResend = async () => {
  isResending.value = true;
  const { error } = await authStore.resendVerification(props.email);
  isResending.value = false;
  if (!error) {
    resendSuccess.value = true;
    startCountdown();
    setTimeout(() => { resendSuccess.value = false; }, 3000);
  }
};

onMounted(() => {
  startCountdown();
});

const isCountdownReady = computed(() => countdown.value === 0);
</script>

<template>
  <div class="w-full text-center space-y-6">
    <div>
      <h2 class="text-headline mb-1">Check your email</h2>
      <p class="text-subheadline text-text-secondary">
        We've sent a verification link to <span class="font-medium">{{ props.email }}</span>.
      </p>
    </div>

    <CmAlert
      v-if="resendSuccess"
      variant="success"
      title="Email sent"
      :description="isCountdownReady ? 'Your verification email has been sent.' : `Resend available in ${countdown}s`"
    />

    <CmAlert
      v-if="authStore.error"
      variant="danger"
      title="Verification error"
      :description="authStore.error"
    />

    <div class="space-y-4">
      <CmButton
        type="button"
        variant="secondary"
        :loading="isResending"
        :disabled="!isCountdownReady || isResending"
        class="w-full"
        @click="handleResend"
      >
        Resend verification email
      </CmButton>

      <CmButton
        type="button"
        variant="link"
        @click="emit('switch-state', 'login')"
      >
        Back to sign in
      </CmButton>
    </div>
  </div>
</template>
