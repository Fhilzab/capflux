<script setup lang="ts">
/**
 * One-click demo login for sandbox mode.
 * Lists the demo personas and signs in through the SAME authStore.signIn
 * flow production uses (the sandbox auth provider answers it locally).
 */
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CmButton from '../../components/ui/CmButton.vue';
import { useAuthStore } from '../../stores/authStore';
import { listDemoPersonas, getSandboxAuthProvider } from '../session/sandboxAuth';
import { DEMO_PASSWORD_HINT } from '../seed/demoData';
import { runtimeEnvironment } from '../../shared/environment/runtimeEnvironment';

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const personas = listDemoPersonas().filter((p) => !p.platformStaff);
const platformStaff = listDemoPersonas().find((p) => p.platformStaff);
const busy = ref<string | null>(null);
const error = ref<string | null>(null);

async function signInAs(email: string): Promise<void> {
  if (!runtimeEnvironment.isSandbox) return;
  busy.value = email;
  error.value = null;
  const success = await authStore.signIn({ email, password: DEMO_PASSWORD_HINT });
  busy.value = null;
  if (success) {
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard';
    router.push(redirect);
  } else {
    error.value = authStore.error ?? 'Demo sign-in failed.';
  }
}
</script>

<template>
  <div
    v-if="runtimeEnvironment.isSandbox"
    class="rounded-lg border border-divider bg-surface p-4"
    data-testid="sandbox-demo-login"
  >
    <p class="text-xs font-semibold uppercase tracking-wide text-text-tertiary">CAPFLUX Demo</p>
    <h2 class="mt-0.5 font-semibold">Explore with a demo role</h2>
    <p class="mt-1 text-xs text-text-secondary">
      No real accounts involved. Authorization (routes &amp; API permissions) is enforced per persona.
      Password for manual sign-in: <code>demo1234</code>
    </p>
    <div class="mt-3 space-y-2">
      <button
        v-for="persona in personas"
        :key="persona.id"
        class="flex w-full items-center justify-between rounded-md border border-divider px-3 py-2 text-left text-sm transition-colors hover:bg-background-hover"
        :data-testid="`demo-login-${persona.id}`"
        :disabled="busy !== null"
        @click="signInAs(persona.email)"
      >
        <span>
          <span class="block font-medium">{{ persona.fullName }} — {{ persona.title }}</span>
          <span class="text-xs text-text-tertiary">{{ persona.email }}</span>
        </span>
        <CmButton variant="secondary" size="sm" :loading="busy === persona.email">Sign in</CmButton>
      </button>
      <button
        v-if="platformStaff"
        class="flex w-full items-center justify-between rounded-md border border-dashed border-divider px-3 py-2 text-left text-sm transition-colors hover:bg-background-hover"
        data-testid="demo-login-platform"
        :disabled="busy !== null"
        @click="signInAs(platformStaff.email)"
      >
        <span>
          <span class="block font-medium">{{ platformStaff.fullName }} — {{ platformStaff.title }}</span>
          <span class="text-xs text-text-tertiary">{{ platformStaff.email }} · reviews KYC/settlements</span>
        </span>
        <CmButton variant="secondary" size="sm" :loading="busy === platformStaff.email">Sign in</CmButton>
      </button>
    </div>
    <p v-if="error" class="mt-2 text-xs text-danger" role="alert">{{ error }}</p>
  </div>
</template>
