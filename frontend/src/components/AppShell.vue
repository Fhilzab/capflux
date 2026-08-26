<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import AppHeader from './AppHeader.vue';
import Sidebar from './Sidebar.vue';
import { useThemeStore } from '../stores/themeStore';
import { runtimeEnvironment } from '../shared/environment/runtimeEnvironment';
import SandboxBanner from '../sandbox/ui/SandboxBanner.vue';

const route = useRoute();
const themeStore = useThemeStore();

const sidebarCollapsed = ref(true);
const mobileOpen = ref(false);

// Close mobile drawer on route change
watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false;
  },
);

const toggleMobile = () => {
  mobileOpen.value = !mobileOpen.value;
};

const closeMobile = () => {
  mobileOpen.value = false;
};

const mainMarginClass = computed(() => {
  return sidebarCollapsed.value ? 'lg:ml-20' : 'lg:ml-[188px]';
});
</script>

<template>
  <div class="flex min-h-screen bg-background font-sans text-text-primary">
    <!-- Application Header -->
    <AppHeader @toggle-mobile="toggleMobile" />

    <!-- Sidebar / Mobile Drawer -->
    <Sidebar
      v-model:collapsed="sidebarCollapsed"
      :mobile-open="mobileOpen"
      @close-mobile="closeMobile"
    />

    <!-- Main Content -->
    <div
      class="flex flex-col flex-1 pt-[50px] transition-all duration-300"
      :class="mainMarginClass"
    >
      <SandboxBanner v-if="runtimeEnvironment.isSandbox" />
      <main class="flex-1 overflow-y-auto">
        <slot />
      </main>
    </div>
  </div>
</template>
