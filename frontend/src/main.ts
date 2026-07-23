import { createApp } from 'vue';
import { createPinia } from 'pinia';
import './style.css';
import App from './App.vue';
import router from './router/index';
import { useAuthStore } from './stores/authStore';
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

  await authStore.initialize();
  await syncStore.refreshStatus();
  SyncService.startBackgroundSync(30000);
  app.mount('#app');
}

bootstrap().catch((error: Error) => {
  console.error('App bootstrap failed:', error);
  // Reset flag on failure to allow retry
  setAuthInitialized(false);
  app.mount('#app');
});