<script setup lang="ts">
/**
 * One-click demo login for sandbox mode.
 * Lists the demo personas and signs in through the SAME authStore.signIn
 * flow production uses (the sandbox auth provider answers it locally).
 */
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/authStore';
import { listDemoPersonas } from '../session/sandboxAuth';
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
    class="border-t border-divider pt-4 mt-6"
    data-testid="sandbox-demo-login"
  >
    <p class="text-xs text-text-tertiary mb-3">
      Sandbox demo access — no real accounts. Password: <code class="text-text-muted">demo1234</code>
    </p>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="persona in personas"
        :key="persona.id"
        class="inline-flex items-center gap-1.5 rounded-md border border-divider px-2.5 py-1.5 text-xs transition-colors hover:bg-background-hover disabled:opacity-50"
        :title="`${persona.fullName} — ${persona.email}`"
        :data-testid="`demo-login-${persona.id}`"
        :disabled="busy !== null"
        @click="signInAs(persona.email)"
      >
        <span class="font-medium text-text-secondary">{{ persona.title }}</span>
        <span
          v-if="busy === persona.email"
          class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-border border-t-transparent"
        />
      </button>
      <button
        v-if="platformStaff"
        class="inline-flex items-center gap-1.5 rounded-md border border-dashed border-divider px-2.5 py-1.5 text-xs transition-colors hover:bg-background-hover disabled:opacity-50"
        :title="`${platformStaff.fullName} — ${platformStaff.email}`"
        data-testid="demo-login-platform"
        :disabled="busy !== null"
        @click="signInAs(platformStaff.email)"
      >
        <span class="font-medium text-text-secondary">{{ platformStaff.title }}</span>
        <span
          v-if="busy === platformStaff.email"
          class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-border border-t-transparent"
        />
      </button>
    </div>
    <p v-if="error" class="mt-2 text-xs text-danger" role="alert">{{ error }}</p>
  </div>
</template>
