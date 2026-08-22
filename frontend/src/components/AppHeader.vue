<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  Search,
  Menu,
  Bell,
  Sparkles,
  Moon,
  Sun,
} from '@lucide/vue';
import { useAuthStore } from '../stores/authStore';
import { useSchoolStore } from '../stores/schoolStore';
import { useSyncStore } from '../stores/syncStore';
import { useDashboardStore } from '../features/dashboard/stores/dashboardStore';
import { useThemeStore } from '../stores/themeStore';
import ProfileMenu from './ProfileMenu.vue';

const router = useRouter();
const authStore = useAuthStore();
const schoolStore = useSchoolStore();
const syncStore = useSyncStore();
const dashboardStore = useDashboardStore();
const themeStore = useThemeStore();

const online = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);

const emit = defineEmits<{
  (e: 'toggle-mobile'): void;
  (e: 'open-notifications'): void;
}>();

// Workspace / school context
const workspaceName = computed(() => {
  return schoolStore.school?.name || authStore.organization?.name || '';
});

const workspaceStatus = computed(() => {
  if (!schoolStore.school) return 'no-school';
  if (schoolStore.school.status === 'ACTIVE') {
    return schoolStore.school.paymentStatus === 'READY' ? 'active' : 'pending-payments';
  }
  if (schoolStore.school.status === 'PENDING_SETUP') return 'setup';
  if (schoolStore.school.status === 'SUSPENDED') return 'suspended';
  return 'inactive';
});

const syncStatus = computed(() => {
  if (!online.value) return { label: 'Offline', color: 'bg-danger', dot: true };
  if (syncStore.pendingCount > 0) return { label: `${syncStore.pendingCount} pending`, color: 'bg-warning animate-pulse', dot: true };
  if (syncStore.failedCount > 0) return { label: `${syncStore.failedCount} failed`, color: 'bg-danger', dot: true };
  return { label: 'Online', color: 'bg-success', dot: true };
});

const openNotifications = () => emit('open-notifications');
</script>

<template>
  <header
     class="fixed inset-x-0 top-0 z-fixed flex h-[50px] items-center justify-between border-b border-divider bg-background/90 text-text-primary backdrop-blur-sm"
    data-testid="app-header"
  >
    <!-- Left: Logo + Workspace context -->
    <div class="flex items-center gap-3 pl-3">
      <!-- Mobile menu button -->
      <button
        @click="$emit('toggle-mobile')"
        data-testid="mobile-menu-button"
        class="lg:hidden flex h-[34px] w-[34px] items-center justify-center rounded-full bg-surface/50 border border-divider text-text-muted hover:text-text-primary hover:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/50 transition-colors"
        aria-label="Toggle navigation"
      >
        <Menu class="h-8 w-8" stroke-width="2" />
      </button>

      <!-- CAPFLUX Logo -->
      <button
        @click="router.push({ name: 'Home' })"
        data-testid="capflux-logo"
        class="flex items-center gap-2 rounded-button px-1.5 py-1 text-text-primary hover:bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-brand/50"
        aria-label="CAPFLUX Home"
      >
        <div
          class="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-background font-bold text-sm shadow-card"
        >
          C
        </div>
        <span class="font-semibold text-sm text-text-primary hidden sm:block">CAPFLUX</span>
      </button>

      <!-- Workspace / School context (desktop only) -->
      <div
        v-if="workspaceName"
        data-testid="workspace-context"
        class="hidden items-center gap-2 text-sm lg:flex"
      >
        <span data-testid="workspace-separator" class="h-5 w-px bg-divider"></span>
        <span
          data-testid="workspace-name"
          class="font-medium text-text-secondary truncate max-w-[180px]"
          :title="workspaceName"
        >
          {{ workspaceName }}
        </span>
        <span
          v-if="workspaceStatus === 'active'"
          data-testid="school-status-dot"
          class="inline-flex h-1.5 w-1.5 rounded-full bg-success"
          aria-label="School active"
          title="School active"
        />
        <span
          v-else-if="workspaceStatus === 'pending-payments'"
          class="inline-flex h-1.5 w-1.5 rounded-full bg-warning"
          aria-label="Payments pending activation"
          title="Payments pending activation"
        />
        <span
          v-else-if="workspaceStatus === 'setup'"
          class="inline-flex h-1.5 w-1.5 rounded-full bg-warning"
          aria-label="Setup in progress"
          title="Setup in progress"
        />
      </div>
    </div>

    <!-- Right: Search + Sync + Utilities + Profile -->
    <div class="flex items-center gap-2 pr-3">
      <!-- Desktop group: search + utilities -->
      <div class="hidden items-center gap-2 lg:flex">
        <!-- Search box -->
        <div data-testid="search-container" class="relative w-[195px]">
          <Search
            class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted"
            stroke-width="2"
          />
          <input
            data-testid="search-input"
            type="text"
            placeholder="Search..."
            aria-label="Search"
            class="w-full pl-10 pr-10 py-1.5 rounded-search bg-surface border border-border text-sm text-text-primary placeholder:text-text-muted/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/50 transition-colors"
          />
          <kbd
            class="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 rounded border border-divider px-1 py-0.5 text-xs text-text-muted"
            aria-hidden="true"
          >
            <span class="text-xs">⌘</span>K
          </kbd>
        </div>

        <!-- Sync indicator -->
        <span
          v-if="syncStatus.dot"
          :class="syncStatus.color"
          class="h-2 w-2 rounded-full"
          :title="syncStatus.label"
          :aria-label="`Sync status: ${syncStatus.label}`"
        />

        <!-- Notifications -->
        <button
          data-testid="notification-button"
          @click="openNotifications"
          class="relative flex h-[34px] w-[34px] items-center justify-center rounded-full bg-surface/50 border border-divider text-text-muted hover:text-text-primary hover:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/50 transition-colors"
          aria-label="Notifications"
        >
          <Bell class="h-8 w-8" stroke-width="2" />
          <span
            v-if="dashboardStore.pendingNotifications > 0"
            class="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-danger px-0.75 text-xs font-medium text-background"
          >
            {{ dashboardStore.pendingNotifications > 99 ? '99+' : dashboardStore.pendingNotifications }}
          </span>
        </button>

        <!-- AI Assistant (future feature placeholder) -->
        <button
          data-testid="ai-assistant-button"
          class="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-surface/50 border border-divider text-text-muted hover:text-text-primary hover:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/50 transition-colors"
          aria-label="AI Assistant"
        >
          <Sparkles class="h-8 w-8" stroke-width="2" />
        </button>

        <!-- Theme toggle -->
        <button
          data-testid="theme-toggle"
          @click="themeStore.toggleTheme()"
          class="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-surface/50 border border-divider text-text-muted hover:text-text-primary hover:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/50 transition-colors"
          :aria-label="themeStore.mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
        >
          <Moon v-if="themeStore.mode === 'dark'" class="h-8 w-8" stroke-width="2" />
          <Sun v-else class="h-8 w-8" stroke-width="2" />
        </button>
      </div>

      <!-- Profile (always visible, locked) -->
      <ProfileMenu :show-label="false" />
    </div>
  </header>
</template>
