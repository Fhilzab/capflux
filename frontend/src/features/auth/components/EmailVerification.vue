<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../../stores/authStore';
import CmButton from '../../../components/ui/CmButton.vue';
import CmInput from '../../../components/ui/CmInput.vue';
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
const router = useRouter();
const authStore = useAuthStore();

const code = ref('');
const isVerifying = ref(false);
const verificationError = ref('');
const verificationSuccess = ref(false);

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
  await authStore.resendVerification(props.email);
  isResending.value = false;
  resendSuccess.value = true;
  startCountdown();
  setTimeout(() => { resendSuccess.value = false; }, 3000);
};

const handleVerify = async () => {
  if (!code.value || code.value.length !== 6 || !props.email) {
    verificationError.value = 'Verification session expired. Please request a new verification code.';
    return;
  }

  isVerifying.value = true;
  verificationError.value = '';

  const result = await authStore.verifyEmail(code.value, props.email);

  isVerifying.value = false;

  if (result.error) {
    verificationError.value = result.error;
    return;
  }

  verificationSuccess.value = true;

  // After successful verification, redirect to sign-in
  // (WorkOS requires a separate sign-in after email verification)
  setTimeout(() => {
    router.push({ name: 'Auth', query: { mode: 'login' } });
  }, 2000);
};

onMounted(() => {
  if (!props.email) {
    verificationError.value = 'Verification session expired. Please request a new verification code.';
    return;
  }
  startCountdown();
});

const isCodeComplete = computed(() => code.value.length === 6);
const isCountdownReady = computed(() => countdown.value === 0);
</script>

<template>
  <div class="w-full text-center space-y-6">
    <!-- Success state -->
    <div v-if="verificationSuccess">
      <h2 class="text-headline mb-1">Email verified</h2>
      <p class="text-sm sm:text-subheadline text-text-secondary">
        Your email has been verified. Redirecting to sign in…
      </p>
    </div>

    <!-- Verification form -->
    <div v-else>
      <div>
        <h2 class="text-headline mb-1">Verify your email</h2>
        <p class="text-sm sm:text-subheadline text-text-secondary">
          Enter the 6-digit code we sent to <span class="font-medium">{{ props.email }}</span>
        </p>
      </div>

      <CmAlert
        v-if="verificationError"
        variant="danger"
        title="Verification error"
        :description="verificationError"
      />

      <CmAlert
        v-if="resendSuccess"
        variant="success"
        title="Code sent"
        :description="isCountdownReady ? 'A new verification code has been sent.' : `Resend available in ${countdown}s`"
      />

      <form @submit.prevent="handleVerify" class="space-y-4">
        <!-- 6-digit code input -->
        <div>
          <label for="verification-code" class="block text-sm font-medium text-text-primary mb-1.5">
            Verification code
          </label>
          <CmInput
            id="verification-code"
            type="text"
            v-model="code"
            placeholder="000000"
            maxlength="6"
            pattern="[0-9]{6}"
            inputmode="numeric"
            autocomplete="one-time-code"
            input-class="h-[44px] text-center text-lg tracking-[0.5em] font-mono"
            :error="verificationError ? undefined : undefined"
          />
        </div>

        <!-- Verify button -->
        <CmButton
          type="submit"
          variant="primary"
          size="tall"
          :loading="isVerifying"
          :disabled="!isCodeComplete || isVerifying"
          class="w-full"
        >
          <span v-if="!isVerifying">Verify</span>
          <span v-else>Verifying…</span>
        </CmButton>

        <!-- Resend button -->
        <CmButton
          type="button"
          variant="secondary"
          size="tall"
          :loading="isResending"
          :disabled="!isCountdownReady || isResending"
          class="w-full"
          @click="handleResend"
        >
          <span v-if="!isResending">Resend code</span>
          <span v-else>Sending…</span>
        </CmButton>

        <!-- Back to sign in -->
        <CmButton
          type="button"
          variant="link"
          @click="emit('switch-state', 'login')"
          class="min-h-[44px] inline-flex items-center justify-center"
        >
          Back to sign in
        </CmButton>
      </form>
    </div>
  </div>
</template>
