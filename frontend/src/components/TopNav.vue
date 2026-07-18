<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { useDashboardStore } from '../features/dashboard/stores/dashboardStore';
import { useThemeStore } from '../stores/themeStore';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const syncStore = useSyncStore();
const dashboardStore = useDashboardStore();
const themeStore = useThemeStore();

const online = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);

const userEmail = computed(() => authStore.user?.email || 'admin@capstone.local');
const displayName = computed(() => {
  const email = userEmail.value;
  return email.split('@')[0] || 'Admin';
});

// Greeting for time of day
const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
});

// Contextual message based on system state
const contextMessage = computed(() => {
  if (!online.value) return 'Offline Mode';
  if (syncStore.pendingCount > 0) return `${syncStore.pendingCount} pending sync`;
  return 'System Healthy';
});

// System status indicator
const systemStatus = computed(() => {
  if (!online.value) return { status: 'offline' as const };
  if (syncStore.pendingCount > 0) return { status: 'syncing' as const };
  return { status: 'online' as const };
});

// Dropdown state
const showDropdown = ref(false);
const toggleDropdown = () => { showDropdown.value = !showDropdown.value; };
const closeDropdown = () => { showDropdown.value = false; };

// Navigation functions
const navigate = (name: string) => {
  router.push({ name });
  closeDropdown();
};

// Appearance toggle
const toggleAppearance = () => {
  const isDark = themeStore.mode === 'dark';
  themeStore.setTheme(isDark ? 'light' : 'dark');
  closeDropdown();
};

// Logout
const logout = async () => {
  await authStore.signOut();
  closeDropdown();
  router.push({ name: 'Auth' });
};

// Search placeholder based on current route
const searchPlaceholder = computed(() => {
  const name = route.name as string;
  if (name === 'Students') return 'Search Students...';
  if (name === 'Guardians') return 'Search Guardians...';
  if (name === 'Payments' || name === 'Home') return 'Search Payments...';
  if (name === 'VirtualAccounts') return 'Search DVAs...';
  return 'Search...';
});
</script>

<template>
  <header class="sticky top-4 z-30 mx-4 mt-2 flex h-14 items-center justify-between rounded-xl bg-card/90 backdrop-blur-xl px-4 transition-all duration-200 shadow-card border border-border">
    <!-- Left: Greeting with Contextual Status -->
    <div class="flex items-center gap-3 transition-colors duration-200">
      <span class="text-sm font-medium text-text-primary">
        {{ greeting }},
      </span>
      <span class="text-sm font-medium text-text-primary">
        {{ displayName }}
      </span>
      
      <!-- System Status Indicator -->
      <div class="flex items-center gap-2 pl-3 border-l border-divider">
        <span class="h-2 w-2 rounded-full" :class="{
          'bg-success': systemStatus.status === 'online',
          'bg-warning animate-pulse': systemStatus.status === 'syncing',
          'bg-danger': systemStatus.status === 'offline'
        }"></span>
        <span class="text-xs hidden sm:inline" :class="systemStatus.status === 'online' ? 'text-success' : 'text-text-muted'">{{ contextMessage }}</span>
      </div>
    </div>

    <!-- Center: Global Search -->
    <div class="flex-1 max-w-md mx-8">
      <div class="relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          :placeholder="searchPlaceholder"
          class="w-full pl-10 pr-4 py-2.5 rounded-search bg-surface border border-border text-text-primary placeholder:text-text-muted/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand shadow-float transition-all duration-200 premium-search"
        />
      </div>
    </div>

    <!-- Right: Notification and Profile -->
    <div class="flex items-center gap-3">
      <!-- Notification Bell -->
      <button class="relative flex h-10 w-10 items-center justify-center rounded-xl bg-surface border border-divider text-text-secondary hover:bg-surface hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-brand/50">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a7 7 0 00-5.714 0A2.25 2.25 0 013 15.75V9.125a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 9.125v6.625c0 .441-.204.857-.543 1.143l-2.24.962" />
        </svg>
        <span v-if="dashboardStore.pendingNotifications > 0" class="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-danger px-1 text-xs font-medium text-background">
          {{ dashboardStore.pendingNotifications > 99 ? '99+' : dashboardStore.pendingNotifications }}
        </span>
      </button>

      <!-- Profile Dropdown -->
      <div class="relative">
        <button 
          @click="toggleDropdown"
          class="flex items-center gap-2 rounded-xl bg-surface border border-divider pl-3 pr-2 py-2 hover:bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-brand/50"
        >
          <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/20 text-xs font-medium text-brand">
            {{ displayName.charAt(0).toUpperCase() }}
          </span>
          <span class="hidden sm:block text-sm font-medium text-text-primary truncate max-w-32">{{ displayName }}</span>
          <svg class="h-4 w-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        <!-- Dropdown Menu -->
        <transition name="fade">
          <div v-if="showDropdown" class="absolute right-0 top-full mt-2 w-56 rounded-xl bg-card border border-divider shadow-elevated py-2 z-50">
            <div class="px-3 py-2 border-b border-divider">
              <p class="text-xs text-text-muted">Signed in as</p>
              <p class="text-sm font-medium text-text-primary truncate">{{ userEmail }}</p>
            </div>
            <div class="py-1">
              <button @click="navigate('SchoolProfile')" class="w-full px-4 py-2 text-left text-sm text-text-secondary hover:bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-brand/50">
                School Profile
              </button>
              <button @click="navigate('Settings')" class="w-full px-4 py-2 text-left text-sm text-text-secondary hover:bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-brand/50">
                Account
              </button>
              <button @click="toggleAppearance" class="w-full px-4 py-2 text-left text-sm text-text-secondary hover:bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-brand/50">
                Appearance
              </button>
              <div class="border-t border-divider my-1"></div>
              <button @click="navigate('Support')" class="w-full px-4 py-2 text-left text-sm text-text-secondary hover:bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-brand/50">
                Documentation
              </button>
              <button @click="navigate('Support')" class="w-full px-4 py-2 text-left text-sm text-text-secondary hover:bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-brand/50">
                Support
              </button>
              <div class="border-t border-divider my-1"></div>
              <button @click="logout" class="w-full px-4 py-2 text-left text-sm text-danger hover:bg-danger/10 transition-colors focus:outline-none focus:ring-2 focus:ring-danger/50">
                Logout
              </button>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </header>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>