<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';

const props = defineProps<{ collapsed?: boolean }>();
const emit = defineEmits<{ 'update:collapsed': [value: boolean] }>();

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const collapsed = computed({
  get: () => props.collapsed ?? false,
  set: (value) => emit('update:collapsed', value)
});

const isActive = (name: string) => route.name === name;

const toggleSidebar = () => {
  collapsed.value = !collapsed.value;
};

// Navigation groups as per CEMDS specification
const navGroups = [
  {
    label: 'Financial',
    items: [
      { name: 'Home', label: 'Dashboard', icon: 'dashboard' },
      { name: 'Students', label: 'Students', icon: 'users' },
      { name: 'Guardians', label: 'Guardians', icon: 'user-group' },
      { name: 'Payments', label: 'Payments', icon: 'credit-card' },
      { name: 'VirtualAccounts', label: 'Virtual Accounts', icon: 'banknotes' },
    ]
  },
  {
    label: 'Management',
    items: [
      { name: 'Reports', label: 'Reports', icon: 'chart-bar' },
      { name: 'Notifications', label: 'Notifications', icon: 'bell' },
    ]
  },
  {
    label: 'Administration',
    items: [
      { name: 'SchoolProfile', label: 'Settings', icon: 'cog' },
      { name: 'Support', label: 'Help', icon: 'lifebuoy' },
    ]
  },
];

const navigate = (name: string) => {
  router.push({ name });
};

const logout = async () => {
  await authStore.signOut();
  router.push({ name: 'Login' });
};
</script>

<template>
  <aside
    class="fixed left-0 top-0 bottom-0 z-40 flex flex-col bg-sidebar border-r border-divider transition-all duration-300"
    :class="collapsed ? 'w-20' : 'w-72'"
  >
    <!-- Logo / Collapse Control -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-divider">
      <div class="flex items-center gap-3" :class="{ 'justify-center w-full': collapsed }">
        <!-- Logo or Hamburger - NOT both -->
        <div v-if="!collapsed" class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-hover text-background font-bold text-lg shadow-lg shadow-glow">
          C
        </div>
        <div v-else class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-hover text-background font-bold text-lg shadow-lg shadow-glow">
          C
        </div>
        
        <div v-if="!collapsed" class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-text-primary truncate">Capstone</p>
          <p class="text-xs text-text-muted">Fee-First ERP</p>
        </div>
      </div>

      <button
        v-if="!collapsed"
        @click="toggleSidebar"
        class="p-2 rounded-lg hover:bg-surface transition-colors focus-ring"
        :class="collapsed ? 'mx-auto' : ''"
      >
        <svg class="h-5 w-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </div>

    <!-- Collapsed: Show only menu button -->
    <div v-if="collapsed" class="p-4 border-b border-divider">
      <button
        @click="toggleSidebar"
        class="w-full p-2 rounded-lg hover:bg-surface transition-colors focus-ring"
        title="Expand sidebar"
      >
        <svg class="h-5 w-5 text-text-muted mx-auto" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </div>

    <!-- Navigation Groups -->
    <nav class="flex-1 overflow-y-auto py-4">
      <div v-for="(group, groupIndex) in navGroups" :key="group.label" class="mb-6 last:mb-0">
        <p v-if="!collapsed" class="px-6 text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
          {{ group.label }}
        </p>
        <div class="px-3 space-y-1">
          <button
            v-for="item in group.items"
            :key="item.name"
            @click="navigate(item.name)"
            class="relative flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 focus-ring"
            :class="[
              collapsed ? 'justify-center px-3' : 'px-4',
              isActive(item.name)
                ? 'text-text-primary bg-surface font-semibold'
                : 'text-text-secondary hover:bg-surface hover:text-text-primary'
            ]"
          >
            <!-- Active accent bar - Emerald -->
            <span
              v-if="isActive(item.name) && !collapsed"
              class="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-primary"
            />

            <!-- Icons using semantic colors -->
            <svg v-if="item.icon === 'dashboard'" class="h-5 w-5 flex-shrink-0" :class="isActive(item.name) ? 'text-primary' : 'text-text-muted'" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25C3.504 21 3 20.496 3 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25c-.621 0-1.125-.504-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25c-.621 0-1.125-.504-1.125-1.125v-15.75z" />
            </svg>

            <svg v-else-if="item.icon === 'users'" class="h-5 w-5 flex-shrink-0" :class="isActive(item.name) ? 'text-primary' : 'text-text-muted'" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.628 9.628 0 00-3.778-.88c-1.18 0-2.37.2-3.44.55a5.99 5.99 0 00-2.84-.97c-1.31 0-2.55.36-3.66.97a9.03 9.03 0 00-3.778.88c0 .34.03.68.08 1.01h15.84c.05-.33.08-.67.08-1z" />
            </svg>

            <svg v-else-if="item.icon === 'user-group'" class="h-5 w-5 flex-shrink-0" :class="isActive(item.name) ? 'text-primary' : 'text-text-muted'" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.03 9.03 0 00-3.77-.88c-1.18 0-2.37.2-3.44.55a5.99 5.99 0 00-2.84-.97c-1.31 0-2.55.36-3.66.97a9.03 9.03 0 00-3.77.88c0 .34.03.68.08 1.01h15.84c.05-.33.08-.67.08-1z" />
            </svg>

            <svg v-else-if="item.icon === 'credit-card'" class="h-5 w-5 flex-shrink-0" :class="isActive(item.name) ? 'text-primary' : 'text-text-muted'" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5v13.5H3.75V6.75zM3.75 9.75V6.75A2.25 2.25 0 016 4.5h12A2.25 2.25 0 0120.25 6.75v3M3.75 9.75V17.25A2.25 2.25 0 006 19.5h12a2.25 2.25 0 002.25-2.25V9.75" />
            </svg>

            <svg v-else-if="item.icon === 'banknotes'" class="h-5 w-5 flex-shrink-0" :class="isActive(item.name) ? 'text-primary' : 'text-text-muted'" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.278 12c0 5.314 4.286 9.75 9.5 10.125V12H2.278zM12 2.278C6.686 2.652 2.4 7.088 2.4 12.5c0-5.314 4.286-9.625 9.5-9.75V12H2.278v.25z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 12c0-5.314-4.286-9.75-9.5-10.125V12h9.5z" />
            </svg>

            <svg v-else-if="item.icon === 'chart-bar'" class="h-5 w-5 flex-shrink-0" :class="isActive(item.name) ? 'text-primary' : 'text-text-muted'" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.5v6A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 19.5v-6M3 8.75v6A2.25 2.25 0 005.25 15h13.5A2.25 2.25 0 0021 12.75v-4.5A2.25 2.25 0 0018.75 4.5H5.25A2.25 2.25 0 003 6.75v2z" />
            </svg>

            <svg v-else-if="item.icon === 'bell'" class="h-5 w-5 flex-shrink-0" :class="isActive(item.name) ? 'text-primary' : 'text-text-muted'" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a7 7 0 00-5.714 0A2.25 2.25 0 013 15.75V9.125a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 9.125v6.625c0 .441-.204.857-.543 1.143l-2.24.962" />
            </svg>

            <svg v-else-if="item.icon === 'cog'" class="h-5 w-5 flex-shrink-0" :class="isActive(item.name) ? 'text-primary' : 'text-text-muted'" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94a5.971 5.971 0 012.812 0l.5.75a2.25 2.25 0 002.578 2.578l.75-.5a2.25 2.25 0 002.963 0l.5.75a2.25 2.25 0 012.578-2.578l-.75.5a2.25 2.25 0 01-2.963 0l-.5-.75a2.25 2.25 0 00-2.963 0l-.5-.75A2.25 2.25 0 009.594 3.94z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 15a3 3 0 100-6 3 3 0 10-6 0" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 21c-4.97 0-9-4.03-9-9s4.03-9 9-9 9 4.03 9 9-4.03 9-9 9z" />
            </svg>

            <svg v-else-if="item.icon === 'lifebuoy'" class="h-5 w-5 flex-shrink-0" :class="isActive(item.name) ? 'text-primary' : 'text-text-muted'" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6a7.75 7.75 0 106 0 7.75 7.75 0 00-6 0zM12 17.25V12M8.25 12l3.75 5.25 3.75-5.25M3.75 12a8.25 8.25 0 0112.75-6.75M19.5 12a8.25 8.25 0 01-12.75 6.75" />
            </svg>

            <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
          </button>
        </div>
      </div>
    </nav>

    <!-- Logout -->
    <div class="border-t border-divider px-3 py-3">
      <button
        @click="logout"
        class="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-danger hover:bg-danger/10 transition-colors focus-ring"
        :class="{ 'justify-center px-3': collapsed }"
      >
        <svg class="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 15l3-3m0 0l-3-3m3 3H9" />
        </svg>
        <span v-if="!collapsed">Logout</span>
      </button>
    </div>
  </aside>
</template>

<style>
.focus-ring:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
}
</style>