import { createApp } from 'vue';
import { createPinia } from 'pinia';
import './style.css';
import App from './App.vue';
import router from './router/index';
import { useAuthStore } from './stores/authStore';
import { useRBACStore } from './stores/rbacStore';
import { runtimeEnvironment } from './shared/environment/runtimeEnvironment';
import { validateRuntimeConfiguration } from './shared/environment/runtimeConfiguration';
import {
  evaluateBackendMode,
  fetchBackendRuntimeInfo,
  renderEnvironmentMismatchBlocker,
} from './shared/environment/backendModeConsistency';

// Module-level flag to prevent duplicate initialization
let authInitialized = false;

const pinia = createPinia();
const app = createApp(App);
app.use(pinia);
app.use(router);

// Auth initialized flag (sync across the module)
const setAuthInitialized = (value: boolean): void => {
  authInitialized = value;
};

async function bootstrapProduction(): Promise<void> {
  // Release gate: reject inconsistent build configuration before anything initializes.
  validateRuntimeConfiguration();

  // Mode-mismatch guard: a production bundle pointed at a sandbox backend is
  // blocked (CAPFLUX_ENVIRONMENT_MISMATCH). Network failures are tolerated —
  // only an authoritative mismatch blocks.
  try {
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
    const info = await fetchBackendRuntimeInfo(apiBase);
    const evaluation = evaluateBackendMode('production', info);
    if (!evaluation.ok && info !== null) {
      console.error(
        `[startup] ${evaluation.code}: frontend=production backend=${evaluation.actual}`,
      );
      renderEnvironmentMismatchBlocker(evaluation.expected, evaluation.actual);
      return;
    }
  } catch {
    // Descriptor unavailable — existing API error surfaces handle outages.
  }

  const { useSyncStore } = await import('./stores/syncStore');
  const { SyncService } = await import('./shared/services/SyncService');
  const authStore = useAuthStore(pinia);
  const syncStore = useSyncStore(pinia);
  const rbacStore = useRBACStore(pinia);

  await authStore.initialize();
  // Register RBAC store resolver with rbacService for domain-layer checks
  rbacStore.registerWithService();
  await syncStore.refreshStatus();
  SyncService.startBackgroundSync(30000);

  // Students-domain download pull (academic structure, students, guardians,
  // enrollments). Fire-and-forget: never blocks initial render. Runs once
  // after auth when a school context exists, then rides the online event.
  void (async () => {
    try {
      const { useSchoolStore } = await import('./stores/schoolStore');
      const schoolId = useSchoolStore(pinia).currentSchoolId;
      if (!schoolId) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      await SyncService.downloadStudentsDomainData(schoolId);
    } catch (e) {
      console.error('Students-domain download sync failed:', e);
    }
  })();
  SyncService.startStudentsDomainDownloadSync();
}

async function bootstrapSandbox(): Promise<void> {
  // Release gate: sandbox builds reject inconsistent configuration too
  // (invalid explicit mode values, database-environment mismatches).
  validateRuntimeConfiguration();

  const { installSandboxMode } = await import('./sandbox');
  const { startSandboxBackgroundSync, processSandboxSyncQueue } = await import('./sandbox/sync/sandboxSyncEngine');
  const { useSyncStore } = await import('./stores/syncStore');
  const { sandboxRuntime } = await import('./sandbox/runtime/sandboxRuntime');

  await installSandboxMode();

  const authStore = useAuthStore(pinia);
  const syncStore = useSyncStore(pinia);
  const rbacStore = useRBACStore(pinia);

  await authStore.initialize();
  rbacStore.registerWithService();

  // Outbox indicators + auto-drain against the in-browser simulator.
  // The production Supabase engines are deliberately NOT started here.
  await processSandboxSyncQueue().catch(() => undefined);
  await syncStore.refreshStatus();
  startSandboxBackgroundSync(30000);
  setInterval(() => {
    void syncStore.refreshStatus();
  }, 15000);

  // Keep indicators fresh on outbox/connectivity changes.
  sandboxRuntime.on((event) => {
    if (event === 'outbox-changed' || event === 'online-changed' || event === 'sync-completed') {
      void syncStore.refreshStatus();
    }
  });
}

async function bootstrap(): Promise<void> {
  // Prevent duplicate initialization
  if (authInitialized) {
    return;
  }
  setAuthInitialized(true);

  if (runtimeEnvironment.isSandbox) {
    await bootstrapSandbox();
  } else {
    await bootstrapProduction();
  }

  app.mount('#app');
}

bootstrap().catch((error: Error) => {
  console.error('App bootstrap failed:', error);
  // Reset flag on failure to allow retry
  setAuthInitialized(false);
  app.mount('#app');
});
