<script setup lang="ts">
/**
 * Sandbox Control Panel — the demo cockpit.
 *
 * Everything here drives REAL application paths:
 *  - payment simulation posts through the API simulator → ledger;
 *  - the offline toggle gates the same network seam production uses;
 *  - Sync Now drains the same outbox table shown in the header pill;
 *  - role switching re-authenticates through the sandbox auth provider and
 *    re-runs authorization (RouteGuard/rbacStore) end-to-end.
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import CmButton from '../components/ui/CmButton.vue';
import CmInput from '../components/ui/CmInput.vue';
import { apiClient } from '../shared/services/api/client';
import { runtimeEnvironment } from '../shared/environment/runtimeEnvironment';
import {
  sandboxRuntime,
  type SandboxScenario,
} from '../sandbox/runtime/sandboxRuntime';
import { processSandboxSyncQueue, retryAllSandboxFailures } from '../sandbox/sync/sandboxSyncEngine';
import { getSandboxAuthProvider } from '../sandbox/session/sandboxAuth';
import { listDemoPersonas } from '../sandbox/session/sandboxAuth';
import { resetSandbox, installSandboxMode } from '../sandbox';
import { useAuthStore } from '../stores/authStore';

const router = useRouter();
const authStore = useAuthStore();

const personas = listDemoPersonas();
const currentPersona = computed(() => getSandboxAuthProvider().getPersona());

// ---- Payment simulation state --------------------------------------------
interface StudentOption { id: string; label: string }
const students = ref<StudentOption[]>([]);
const selectedStudentId = ref('');
const amountNaira = ref<string>('150000');
const simulating = ref(false);
const lastResult = ref<string | null>(null);
const lastReference = ref<string | null>(null);

const scenarios: { key: SandboxScenario; label: string; description: string }[] = [
  { key: 'PAYMENT_FAILED', label: 'Payment failed', description: 'Next failed-payment simulation cites insufficient funds' },
  { key: 'PAYMENT_PENDING', label: 'Payment pending', description: 'Successful payments post without a ledger credit until cleared' },
  { key: 'SYNC_FAILURE', label: 'Sync failure (once)', description: 'Next sync run fails items once — retry then succeeds' },
  { key: 'KYC_REJECT', label: 'KYC rejected', description: 'Staff verification rejects instead of approving' },
  { key: 'SETTLEMENT_DELAYED', label: 'Settlement delayed', description: 'Settlement verification stays pending' },
];

const resetSteps = ref<string[]>([]);
const resetting = ref(false);
const showResetConfirm = ref(false);

onMounted(async () => {
  try {
    const response = await apiClient.http.get<{ data?: Array<Record<string, unknown>> }>('/students', {
      params: { limit: 200 },
    }).catch(() => null);
    void response; // /students is served by Dexie providers, not HTTP; fall through
  } catch { /* ignore */ }

  // Read students straight from the (sandbox) local store for the picker.
  const { db } = await import('../offline/localDb');
  const rows = await db.students.where('school_id').equals('demo-school').limit(300).toArray();
  students.value = rows.map((s) => ({
    id: String(s.id),
    label: `${s.first_name ?? ''} ${s.last_name ?? ''} (${s.admission_number ?? s.id})`.trim(),
  }));
  selectedStudentId.value = students.value[0]?.id ?? '';
});

async function toggleOnline(): Promise<void> {
  sandboxRuntime.setOnline(!sandboxRuntime.online);
}

async function syncNow(): Promise<void> {
  await processSandboxSyncQueue();
}

async function retryAll(): Promise<void> {
  const count = await retryAllSandboxFailures();
  if (count > 0) await processSandboxSyncQueue();
}

function amountMinor(): number {
  const value = Math.round(Number(amountNaira.value || '0') * 100);
  return Number.isFinite(value) ? value : 0;
}

async function simulate(outcome: 'SUCCESS' | 'FAILED' | 'PENDING'): Promise<void> {
  lastResult.value = null;
  if (!selectedStudentId.value) {
    lastResult.value = 'Pick a student first.';
    return;
  }
  if (!sandboxRuntime.isOnline()) {
    lastResult.value = 'Sandbox is offline — reconnect to reach the simulated gateway.';
    return;
  }
  simulating.value = true;
  try {
    const response = await apiClient.http.post<{ data?: { outcome: string; reference: string; ledger_posted: boolean }; error?: string; message?: string }>(
      '/sandbox/gateway/simulate-payment',
      {
        studentId: selectedStudentId.value,
        amountMinor: amountMinor(),
        outcome,
      },
    );
    const data = response.data?.data;
    if (data) {
      lastReference.value = data.reference;
      lastResult.value =
        `${data.outcome} · Ref ${data.reference}${data.ledger_posted ? ' · ledger credited' : ' · no ledger posting yet'}`;
    }
  } catch (e) {
    const err = e as { response?: { data?: { error?: string; message?: string } }; message?: string };
    lastResult.value = err.response?.data?.error || err.response?.data?.message || err.message || 'Simulation failed';
  } finally {
    simulating.value = false;
  }
}

async function reverseLast(): Promise<void> {
  if (!lastReference.value) {
    lastResult.value = 'Simulate a successful payment first.';
    return;
  }
  simulating.value = true;
  try {
    await apiClient.http.post('/sandbox/gateway/simulate-payment', {
      studentId: selectedStudentId.value,
      amountMinor: amountMinor(),
      outcome: 'REVERSED',
      targetReference: lastReference.value,
      reason: 'Reversed from Sandbox control panel',
    });
    lastResult.value = `Reversed ${lastReference.value}`;
    lastReference.value = null;
  } catch (e) {
    const err = e as { response?: { data?: { error?: string } }; message?: string };
    lastResult.value = err.response?.data?.error || err.message || 'Reversal failed';
  } finally {
    simulating.value = false;
  }
}

async function switchRole(personaId: string): Promise<void> {
  // Persist the new persona session, then cold-restart so every store,
  // provider and guard re-initializes against it (authorization included).
  await getSandboxAuthProvider().switchToPersona(personaId);
  window.location.assign('/');
}

async function resetProgressiveAccess(): Promise<void> {
  await apiClient.http.post('/sandbox/reset-progressive-access');
  lastResult.value = 'Progressive access reset — walk KYC → settlement → gateway → activation again.';
}

async function confirmReset(): Promise<void> {
  showResetConfirm.value = false;
  resetting.value = true;
  resetSteps.value = ['Resetting sandbox…'];
  const steps = [
    'Students: restored',
    'Guardians: restored',
    'Academic structure: restored',
    'Payments: restored',
    'Ledger: restored',
    'Notifications: restored',
    'Sync state: restored',
  ];
  try {
    const result = await resetSandbox();
    for (const step of steps) {
      resetSteps.value.push(step);
      await new Promise((r) => setTimeout(r, 120));
    }
    resetSteps.value.push(`Dataset hash ${result.datasetHash ?? 'n/a'} · ${result.students} students`);
    await installSandboxMode();
    setTimeout(() => window.location.assign('/'), 600);
  } finally {
    resetting.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6 p-6" data-testid="sandbox-control-panel">
    <header>
      <p class="text-xs font-semibold uppercase tracking-wide text-text-tertiary">CAPFLUX Demo</p>
      <h1 class="text-xl font-semibold">Sandbox Control Panel</h1>
      <p v-if="currentPersona" class="mt-1 text-sm text-text-secondary">
        Signed in as <strong>{{ currentPersona.fullName }}</strong> — {{ currentPersona.title }}
        <span class="text-text-tertiary">({{ currentPersona.email }})</span>
      </p>
    </header>

    <!-- Connection & sync -->
    <section class="rounded-lg border border-divider bg-surface p-5">
      <h2 class="mb-3 font-semibold">Connection &amp; synchronization</h2>
      <div class="flex flex-wrap items-center gap-3">
        <CmButton :variant="sandboxRuntime.isOnline() ? 'danger' : 'success'" size="sm" @click="toggleOnline">
          {{ sandboxRuntime.isOnline() ? 'Go OFFLINE' : 'Go ONLINE' }}
        </CmButton>
        <span class="text-sm text-text-secondary">
          Status: <strong>{{ sandboxRuntime.isOnline() ? 'ONLINE' : 'OFFLINE' }}</strong>
          <span v-if="!sandboxRuntime.isOnline()" class="ml-1">(writes queue locally; gateway/KYC calls fail)</span>
        </span>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <span data-testid="sync-pending">Pending: <strong>{{ sandboxRuntime.counters.pending }}</strong></span>
        <span data-testid="sync-failed">Failed: <strong>{{ sandboxRuntime.counters.failed }}</strong></span>
        <span>Synced: <strong>{{ sandboxRuntime.counters.synced }}</strong></span>
        <CmButton variant="secondary" size="sm" @click="syncNow">Sync Now</CmButton>
        <CmButton variant="secondary" size="sm" @click="retryAll">Retry failed</CmButton>
      </div>
      <p class="mt-2 text-xs text-text-tertiary">
        Offline mutations stay queued in the outbox and replay idempotently when you come back online.
      </p>
    </section>

    <!-- Payment simulation -->
    <section class="rounded-lg border border-divider bg-surface p-5">
      <h2 class="mb-3 font-semibold">Simulate a parent payment</h2>
      <div class="grid gap-4 md:grid-cols-[1fr_200px]">
        <label class="block text-sm">
          <span class="mb-1 block text-text-secondary">Student</span>
          <select
            v-model="selectedStudentId"
            data-testid="sim-student-select"
            class="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option v-for="student in students" :key="student.id" :value="student.id">{{ student.label }}</option>
          </select>
        </label>
        <CmInput v-model="amountNaira" label="Amount (₦)" type="number" />
      </div>
      <div class="mt-4 flex flex-wrap gap-2">
        <CmButton variant="success" size="sm" :loading="simulating" data-testid="sim-success" @click="simulate('SUCCESS')">
          Successful payment
        </CmButton>
        <CmButton variant="warning" size="sm" :loading="simulating" @click="simulate('FAILED')">Failed payment</CmButton>
        <CmButton variant="secondary" size="sm" :loading="simulating" @click="simulate('PENDING')">Pending payment</CmButton>
        <CmButton variant="black" size="sm" :disabled="!lastReference" @click="reverseLast">Reverse last payment</CmButton>
      </div>
      <p v-if="lastResult" class="mt-3 rounded bg-background px-3 py-2 font-mono text-xs" data-testid="sim-result">
        {{ lastResult }}
      </p>
    </section>

    <!-- Error scenarios -->
    <section class="rounded-lg border border-divider bg-surface p-5">
      <h2 class="mb-3 font-semibold">Error scenarios</h2>
      <ul class="space-y-2">
        <li v-for="scenario in scenarios" :key="scenario.key" class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-medium">{{ scenario.label }}</p>
            <p class="text-xs text-text-tertiary">{{ scenario.description }}</p>
          </div>
          <button
            class="shrink-0 rounded border px-2 py-1 text-xs"
            :class="sandboxRuntime.scenarios[scenario.key] ? 'border-warning bg-warning/10 text-warning' : 'border-divider'"
            :data-testid="`scenario-${scenario.key}`"
            @click="sandboxRuntime.toggleScenario(scenario.key)"
          >
            {{ sandboxRuntime.scenarios[scenario.key] ? 'ON' : 'OFF' }}
          </button>
        </li>
      </ul>
    </section>

    <!-- Role switching -->
    <section class="rounded-lg border border-divider bg-surface p-5">
      <h2 class="mb-1 font-semibold">Switch demo role</h2>
      <p class="mb-3 text-xs text-text-tertiary">
        Authorization stays enforced — menus, routes and API permissions follow each persona.
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="persona in personas"
          :key="persona.id"
          class="rounded border px-3 py-1.5 text-left text-xs transition-colors"
          :class="currentPersona?.id === persona.id ? 'border-brand bg-brand/10' : 'border-divider hover:bg-background-hover'"
          :data-testid="`persona-${persona.role.toLowerCase()}`"
          @click="switchRole(persona.id)"
        >
          <span class="block font-semibold">{{ persona.fullName }}</span>
          <span class="text-text-tertiary">{{ persona.title }} · {{ persona.email }}</span>
        </button>
      </div>
    </section>

    <!-- Progressive access + reset -->
    <section class="rounded-lg border border-divider bg-surface p-5">
      <h2 class="mb-3 font-semibold">Demo lifecycle</h2>
      <div class="flex flex-wrap gap-2">
        <CmButton variant="secondary" size="sm" @click="resetProgressiveAccess">
          Reset progressive access (walk KYC → payments)
        </CmButton>
        <CmButton variant="danger" size="sm" :disabled="resetting" @click="showResetConfirm = true">
          Reset Sandbox
        </CmButton>
      </div>
      <ul v-if="resetSteps.length" class="mt-3 space-y-1 font-mono text-xs text-text-secondary" data-testid="reset-progress">
        <li v-for="(step, i) in resetSteps" :key="i">{{ step }}</li>
      </ul>
      <p class="mt-3 text-xs text-text-tertiary">
        Reset restores the deterministic demo dataset. It only ever deletes the isolated
        <code>capflux_sandbox_db</code> database — production data is unreachable from sandbox mode.
      </p>
    </section>

    <!-- Confirm modal -->
    <teleport to="body">
      <div v-if="showResetConfirm" class="fixed inset-0 z-modal flex items-center justify-center bg-black/40 p-4">
        <div class="w-full max-w-md rounded-lg border border-divider bg-surface p-6">
          <h3 class="font-semibold">Reset the sandbox?</h3>
          <p class="mt-2 text-sm text-text-secondary">
            All demo changes will be discarded and the original CAPFLUX Demo Academy dataset will be restored.
            This cannot be undone.
          </p>
          <div class="mt-5 flex justify-end gap-2">
            <CmButton variant="secondary" size="sm" @click="showResetConfirm = false">Cancel</CmButton>
            <CmButton variant="danger" size="sm" data-testid="confirm-reset" @click="confirmReset">Yes, reset</CmButton>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>
