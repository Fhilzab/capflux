import { createApp } from 'vue';
import { createPinia } from 'pinia';
import './style.css';
import App from './App.vue';
import router from './router/index.js';
import { useAuthStore } from './stores/authStore.js';
import { SyncService } from './services/domain/syncService.js';
import { useSyncStore } from './stores/syncStore.js';

const pinia = createPinia();
const app = createApp(App);
app.use(pinia);
app.use(router);

async function bootstrap() {
  const authStore = useAuthStore(pinia);
  const syncStore = useSyncStore(pinia);

  await authStore.initialize();
  await syncStore.refreshStatus();
  SyncService.startBackgroundSync(30000);
  app.mount('#app');
}

bootstrap().catch((error) => {
  console.error('App bootstrap failed:', error);
  app.mount('#app');
});
