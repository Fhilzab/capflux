<script setup lang="ts">
/**
 * Persona-first demo access for sandbox mode.
 *
 * Sandbox users never see email/password/Google flows: they pick one of the
 * canonical demo personas and continue through the SAME real sandbox
 * authentication flow production uses (SandboxAuthProvider answers
 * authStore.signIn locally by calling POST /api/auth/demo-login, which
 * validates the persona server-side and issues a signed demo session
 * token). Demo authentication is passwordless — no credentials exist.
 *
 * Selecting a persona alone never authenticates: only a successful backend
 * demo-login navigates to the dashboard. Backend failures stay failed and
 * surface a generic, non-technical message.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/authStore';
import CmButton from '../../components/ui/CmButton.vue';
import CmAlert from '../../components/ui/CmAlert.vue';
import { listDemoPersonas } from '../session/sandboxAuth';
import { runtimeEnvironment } from '../../shared/environment/runtimeEnvironment';

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const personas = listDemoPersonas();
const selectedId = ref<string>(personas[0]?.id ?? '');
const busy = ref(false);
const error = ref<string | null>(null);

const selected = computed(() => personas.find((p) => p.id === selectedId.value) ?? null);

// The sandbox demo follows the landing-page light theme even when the
// device prefers dark mode. Scoped to this route only: remember the prior
// state and restore it on unmount without touching the global theme store.
let hadDarkClass = false;
onMounted(() => {
  hadDarkClass = document.documentElement.classList.contains('dark');
  document.documentElement.classList.remove('dark');
});
onUnmounted(() => {
  if (hadDarkClass) document.documentElement.classList.add('dark');
});

function select(id: string): void {
  if (busy.value) return;
  selectedId.value = id;
  error.value = null;
}

async function enterSandbox(): Promise<void> {
  const persona = selected.value;
  if (!persona || busy.value || !runtimeEnvironment.isSandbox) return;
  busy.value = true;
  error.value = null;
  // Passwordless demo auth: the sandbox provider ignores the password and
  // authenticates the persona via the backend demo-login allowlist + token.
  const success = await authStore.signIn({ email: persona.email, password: '' });
  busy.value = false;
  if (success) {
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard';
    await router.push(redirect);
  } else {
    error.value = 'Sandbox sign-in is temporarily unavailable. Please try again.';
  }
}
</script>

<template>
  <div
    v-if="runtimeEnvironment.isSandbox"
    class="w-full"
    data-testid="sandbox-demo-login"
  >
    <div class="text-center">
      <p
        class="inline-flex items-center gap-1.5 rounded-full border border-divider bg-background px-3 py-1 text-xs font-medium text-text-secondary"
        data-testid="sandbox-demo-badge"
      >
        Sandbox environment
      </p>
      <h2 class="text-headline mb-1 mt-3">Explore CAPFLUX Sandbox</h2>
      <p class="text-subheadline text-text-secondary">Choose how you&rsquo;d like to explore:</p>
    </div>

    <div
      class="mt-5 flex flex-col gap-2"
      role="radiogroup"
      aria-label="Demo roles"
    >
      <button
        v-for="persona in personas"
        :key="persona.id"
        type="button"
        role="radio"
        :aria-checked="selectedId === persona.id"
        :data-testid="`demo-login-${persona.id}`"
        :disabled="busy"
        class="flex min-h-[52px] w-full items-center gap-3 rounded-button border px-3.5 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
        :class="selectedId === persona.id
          ? 'border-brand bg-brand-soft'
          : 'border-divider bg-background hover:bg-background-hover'"
        @click="select(persona.id)"
      >
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
          :class="selectedId === persona.id ? 'bg-brand text-white' : 'bg-background-hover text-text-secondary'"
          aria-hidden="true"
        >
          {{ persona.fullName.charAt(0) }}
        </span>
        <span class="min-w-0">
          <span class="block truncate text-sm font-semibold text-text-primary">{{ persona.fullName }}</span>
          <span class="block truncate text-xs text-text-muted">{{ persona.title }}</span>
        </span>
        <span
          v-if="selectedId === persona.id"
          class="ml-auto inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-brand"
          aria-hidden="true"
        />
      </button>
    </div>

    <CmButton
      type="button"
      variant="primary"
      size="tall"
      :loading="busy"
      :disabled="!selected || busy"
      data-testid="demo-login-continue"
      class="mt-4 w-full"
      @click="enterSandbox"
    >
      <span v-if="!busy">Enter Sandbox{{ selected ? ` as ${selected.fullName}` : '' }}</span>
      <span v-else>Signing in…</span>
    </CmButton>

    <CmAlert
      v-if="error"
      variant="danger"
      title="Sandbox sign-in unavailable"
      :description="error"
      class="mt-4"
      data-testid="demo-login-error"
      role="alert"
    />

    <p class="mt-4 text-center text-xs text-text-muted">
      No real accounts or transactions are used.
    </p>
  </div>
</template>
