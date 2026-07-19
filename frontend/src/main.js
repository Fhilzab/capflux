import { createApp } from 'vue';
import { createPinia } from 'pinia';
import './style.css';
import App from './App.vue';
import router from './router/index.js';
import { useAuthStore } from './stores/authStore';
import { SyncService } from './shared/services/SyncService.ts';
import { useSyncStore } from './stores/syncStore.js';
import { SessionManager } from './shared/services/SessionManager.ts';

const pinia = createPinia();
const app = createApp(App);
app.use(pinia);
app.use(router);

// Initialize session manager after auth store is ready
function initializeSessionManager() {
  SessionManager.init(
    () => {
      // onAuthenticated - session started
      console.log('Session started');
    },
    () => {
      // onLogout - session expired
      const authStore = useAuthStore(pinia);
      authStore.signOut().then(() => {
        router.push({ name: 'Auth' });
      });
    }
  );
}

// Listen for auth events to manage session
window.addEventListener('auth:session-start', () => {
  SessionManager.onAuthenticated();
});

window.addEventListener('auth:session-end', () => {
  SessionManager.onLogout();
});

async function bootstrap() {
  const authStore = useAuthStore(pinia);
  const syncStore = useSyncStore(pinia);

  await authStore.initialize();
  await syncStore.refreshStatus();
  SyncService.startBackgroundSync(30000);
  initializeSessionManager();
  app.mount('#app');
}

bootstrap().catch((error) => {
  console.error('App bootstrap failed:', error);
  app.mount('#app');
});