import { createApp } from 'vue';
import { createPinia } from 'pinia';
import './style.css';
import App from './App.vue';
import router from './router/index';
import { useAuthStore } from './stores/authStore';
import { useRBACStore } from './stores/rbacStore';
import { SyncService } from './shared/services/SyncService';
import { useSyncStore } from './stores/syncStore';

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

async function bootstrap(): Promise<void> {
  // Prevent duplicate initialization
  if (authInitialized) {
    return;
  }
  setAuthInitialized(true);

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

  app.mount('#app');
}

bootstrap().catch((error: Error) => {
  console.error('App bootstrap failed:', error);
  // Reset flag on failure to allow retry
  setAuthInitialized(false);
  app.mount('#app');
});