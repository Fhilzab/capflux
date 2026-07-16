<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { useDashboardStore } from '../features/dashboard/stores/dashboardStore';
import { useThemeStore } from '../stores/themeStore';

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

// Combined system status
const systemStatus = computed(() => {
  if (!online.value) return { label: 'Offline', status: 'error' as const };
  if (syncStore.pendingCount > 0) return { label: `${syncStore.pendingCount} pending`, status: 'pending' as const };
  return { label: 'Synced', status: 'success' as const };
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

// Appearance toggle (moved from UI)
const toggleAppearance = () => {
  const isDark = themeStore.mode === 'dark';
  themeStore.setTheme(isDark ? 'light' : 'dark');
  closeDropdown();
};

// Logout
const logout = async () => {
  await authStore.signOut();
  closeDropdown();
};
</script>

<template>
  <header class="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl px-6">
    <!-- Left: Greeting -->
    <div class="flex items-center gap-3">
      <span class="text-sm text-white/60">
        {{ greeting }},
      </span>
      <span class="text-sm font-medium text-white">
        {{ displayName }}
      </span>
      <span class="text-lg">👋</span>
    </div>

    <!-- Center: Global Search -->
    <div class="flex-1 max-w-md mx-8">
      <div class="relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search students, invoices, payments..."
          class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/50 border border-slate-800/50 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
        />
      </div>
    </div>

    <!-- Right: Status indicators and profile -->
    <div class="flex items-center gap-3">
      <!-- System Status (merged) -->
      <div class="flex items-center gap-2 rounded-xl bg-slate-900/80 dark:bg-slate-900/80 px-3 py-2">
        <span class="h-2 w-2 rounded-full" :class="{
          'bg-emerald-400': systemStatus.status === 'success',
          'bg-amber-400 animate-pulse': systemStatus.status === 'pending',
          'bg-rose-400': systemStatus.status === 'error'
        }"></span>
        <span class="text-xs text-slate-400 hidden sm:inline">{{ systemStatus.label }}</span>
      </div>

      <!-- Notification Bell -->
      <button class="relative flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/80 dark:bg-slate-900/80 text-slate-400 hover:bg-slate-800/80 transition-colors">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a7 7 0 00-5.714 0A2.25 2.25 0 013 15.75V9.125a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 9.125v6.625c0 .441-.204.857-.543 1.143l-2.24.962" />
        </svg>
        <span v-if="dashboardStore.pendingNotifications > 0" class="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-xs font-medium text-white">
          {{ dashboardStore.pendingNotifications > 99 ? '99+' : dashboardStore.pendingNotifications }}
        </span>
      </button>

      <!-- Profile Dropdown -->
      <div class="relative" @click-outside="closeDropdown">
        <button 
          @click="toggleDropdown"
          class="flex items-center gap-2 rounded-xl bg-slate-900/80 dark:bg-slate-900/80 pl-3 pr-2 py-2 hover:bg-slate-800/80 transition-colors"
        >
          <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-xs font-medium text-cyan-400">
            {{ displayName.charAt(0).toUpperCase() }}
          </span>
          <span class="hidden sm:block text-sm font-medium text-white dark:text-white truncate max-w-32">{{ displayName }}</span>
          <svg class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        <!-- Dropdown Menu -->
        <transition name="fade">
          <div v-if="showDropdown" class="absolute right-0 top-full mt-2 w-56 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl py-2 z-50">
            <div class="px-3 py-2 border-b border-slate-200 dark:border-slate-700">
              <p class="text-xs text-slate-500">Signed in as</p>
              <p class="text-sm font-medium text-slate-900 dark:text-white truncate">{{ userEmail }}</p>
            </div>
            <div class="py-1">
              <button @click="navigate('SchoolProfile')" class="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                School Profile
              </button>
              <button @click="navigate('Settings')" class="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                Settings
              </button>
              <button @click="toggleAppearance" class="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                Appearance
              </button>
              <div class="border-t border-slate-200 dark:border-slate-700 my-1"></div>
              <button @click="navigate('Support')" class="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                Help
              </button>
              <button @click="navigate('Support')" class="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                Documentation
              </button>
              <button @click="navigate('Settings')" class="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                Roles & Permissions
              </button>
              <div class="border-t border-slate-200 dark:border-slate-700 my-1"></div>
              <button @click="logout" class="w-full px-4 py-2 text-left text-sm text-rose-500 hover:bg-rose-500/10 transition-colors">
                Logout
              </button>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </header>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>