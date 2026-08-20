<template>
  <div v-if="isDashboardRoute" class="flex min-h-screen bg-background text-text-primary font-sans antialiased transition-colors duration-200">
    <Sidebar v-model:collapsed="sidebarCollapsed" />
    <div class="flex-1 transition-all duration-300" :class="sidebarCollapsed ? 'ml-20' : 'ml-72'">
      <TopNav />
      <main class="p-0">
        <router-view />
      </main>
    </div>
  </div>
  <router-view v-else />
</template>

<script setup lang="ts">
import { onMounted, computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useThemeStore } from './stores/themeStore';
import Sidebar from './components/Sidebar.vue';
import TopNav from './components/TopNav.vue';

const route = useRoute();
const themeStore = useThemeStore();
const sidebarCollapsed = ref(false);

onMounted(() => {
  themeStore.initTheme();
});

const isDashboardRoute = computed(() => {
  // Authenticated routes show the dashboard shell (sidebar + top nav).
  // Onboarding routes render their own full-page layout so users see
  // "You are setting up CAPFLUX", not "You are operating the school."
  return !!route.meta?.requiresAuth && !route.meta?.onboarding;
});
</script>