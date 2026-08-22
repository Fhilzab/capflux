<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { User, Settings, School, Sun, Moon, Monitor, CircleHelp, LogOut, Check, ChevronRight } from '@lucide/vue';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';

const props = withDefaults(defineProps<{
  showLabel?: boolean;
}>(), {
  showLabel: true,
});

const router = useRouter();
const authStore = useAuthStore();
const themeStore = useThemeStore();

const isOpen = ref(false);
const isThemeSubmenuOpen = ref(false);
const popoverRef = ref<HTMLElement | null>(null);

// ── Identity data (from existing stores) ──────────────────
const firstName = computed(() => authStore.profile?.first_name as string | undefined);
const lastName = computed(() => authStore.profile?.last_name as string | undefined);

const displayName = computed(() => {
  const first = firstName.value;
  const last = lastName.value;
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (last) return last;
  const fullName = authStore.profile?.full_name as string | undefined;
  if (fullName) return fullName;
  const email = authStore.user?.email || '';
  if (!email) return 'Admin';
  return email.split('@')[0] || 'Admin';
});

const schoolName = computed(() => {
  return authStore.organization?.name || '';
});

const userEmail = computed(() => authStore.user?.email || '');

const roleLabel = computed(() => {
  const role = authStore.currentRole;
  if (role === 'OWNER') return 'Owner';
  if (role === 'ADMIN') return 'Admin';
  return '';
});

const avatarAriaLabel = computed(() => {
  const role = roleLabel.value || 'View profile';
  return `${displayName.value}, ${role}`;
});

const profileImageUrl = computed(() => {
  return authStore.profile?.avatar_url as string | undefined;
});

// ── Theme ──────────────────────────────────────────────────
const currentTheme = computed<'light' | 'dark' | 'system'>(() => {
  const saved = localStorage.getItem('theme');
  if (saved === 'light') return 'light';
  if (saved === 'dark') return 'dark';
  return 'system';
});

const selectTheme = (theme: 'light' | 'dark' | 'system') => {
  if (theme === 'system') {
    localStorage.removeItem('theme');
    themeStore.initTheme();
  } else {
    themeStore.setTheme(theme);
  }
  isThemeSubmenuOpen.value = false;
};

const toggleThemeSubmenu = () => {
  isThemeSubmenuOpen.value = !isThemeSubmenuOpen.value;
};

// ── Interaction ───────────────────────────────────────────
const toggle = () => {
  isOpen.value = !isOpen.value;
};

const close = () => {
  isOpen.value = false;
  isThemeSubmenuOpen.value = false;
};

const navigate = (name: string) => {
  router.push({ name });
  close();
};

const signOut = async () => {
  await authStore.signOut();
  close();
  router.push({ name: 'Auth' });
};

// Click outside
const handleOutsideClick = (event: MouseEvent) => {
  if (popoverRef.value && !popoverRef.value.contains(event.target as Node)) {
    close();
  }
};

// Keyboard escape — close theme submenu first, then dropdown
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    if (isThemeSubmenuOpen.value) {
      isThemeSubmenuOpen.value = false;
    } else {
      close();
    }
  }
};

// document-level listeners are added when popover is open
watch(isOpen, (newVal) => {
  if (newVal) {
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleKeydown);
  } else {
    document.removeEventListener('click', handleOutsideClick);
    document.removeEventListener('keydown', handleKeydown);
  }
});
</script>

<template>
  <div ref="popoverRef" class="relative inline-block">
    <!-- Icon-only trigger (header) -->
    <button
      v-if="!showLabel"
      data-testid="profile-avatar"
      @click="toggle"
      @keydown.escape="close"
      :aria-haspopup="true"
      :aria-expanded="isOpen"
      :aria-label="avatarAriaLabel"
      class="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-text-primary border border-background text-background hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand/50 transition-opacity"
    >
      <span
        v-if="profileImageUrl"
        class="h-full w-full overflow-hidden rounded-full"
      >
        <img :src="profileImageUrl" :alt="displayName" class="h-full w-full object-cover" />
      </span>
      <span
        v-else
        class="flex h-full w-full items-center justify-center"
      >
        <User class="h-8 w-8 text-background" stroke-width="2" />
      </span>
    </button>

    <!-- Labelled trigger (sidebar footer etc.) -->
    <button
      v-else
      data-testid="profile-avatar"
      @click="toggle"
      @keydown.escape="close"
      :aria-haspopup="true"
      :aria-expanded="isOpen"
      :aria-label="avatarAriaLabel"
      class="flex items-center gap-2.5 rounded-button bg-surface/50 border border-divider px-2.5 py-1.5 text-sm font-medium text-text-primary hover:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/50 transition-colors"
    >
      <span
        v-if="profileImageUrl"
        class="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-text-primary border border-background"
      >
        <img :src="profileImageUrl" :alt="displayName" class="h-full w-full object-cover" />
      </span>
      <span
        v-else
        class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-text-primary border border-background"
      >
        <User class="h-5 w-5 text-background" stroke-width="2" />
      </span>

      <span v-if="showLabel" class="hidden sm:block">
        {{ displayName }}
      </span>

      <span
        v-if="showLabel && roleLabel"
        class="hidden sm:block text-xs text-text-muted"
      >
        {{ roleLabel }}
      </span>

      <svg
        v-if="showLabel"
        class="hidden sm:block h-4 w-4 text-text-muted transition-transform"
        :class="{ 'rotate-180': isOpen }"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      </svg>
    </button>

    <transition
      enter-active-class="transition ease-out duration-150"
      enter-from-class="opacity-0 scale-95 -translate-y-2"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition ease-in duration-100"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 -translate-y-2"
    >
      <div
        v-if="isOpen"
        role="menu"
        class="absolute right-0 top-full z-popover mt-2 w-56 max-w-[90vw] rounded-button border border-divider bg-card shadow-elevated"
      >
        <!-- Identity header — compact, no avatar/initials -->
        <div class="border-b border-divider">
          <div class="px-4 py-3">
            <p class="text-sm font-semibold text-text-primary truncate">{{ displayName }}</p>
            <p class="text-sm text-text-secondary truncate">{{ schoolName }}</p>
            <p class="text-xs text-text-muted truncate">{{ userEmail }}</p>
          </div>
        </div>

        <!-- Primary menu items -->
        <div class="py-1 text-sm">
          <button
            @click="navigate('Settings')"
            role="menuitem"
            class="flex w-full items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:bg-surface hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/50 transition-colors"
          >
            <Settings class="h-5 w-5 flex-shrink-0" stroke-width="2" />
            Account Settings
          </button>

          <button
            @click="navigate('SchoolSettings')"
            role="menuitem"
            class="flex w-full items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:bg-surface hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/50 transition-colors"
          >
            <School class="h-5 w-5 flex-shrink-0" stroke-width="2" />
            School Settings
          </button>

          <!-- Theme with nested submenu -->
          <div class="relative">
            <button
              @click="toggleThemeSubmenu"
              :aria-haspopup="true"
              :aria-expanded="isThemeSubmenuOpen"
              role="menuitem"
              class="flex w-full items-center justify-between gap-3 px-4 py-2 text-sm text-text-secondary hover:bg-surface hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/50 transition-colors"
            >
              <span class="flex items-center gap-3">
                <Sun class="h-5 w-5 flex-shrink-0" stroke-width="2" />
                Theme
              </span>
              <ChevronRight
                class="h-4 w-4 flex-shrink-0 text-text-muted transition-transform duration-200"
                :class="{ 'rotate-90': isThemeSubmenuOpen }"
                stroke-width="2"
              />
            </button>

            <transition
              enter-active-class="transition ease-out duration-150"
              enter-from-class="opacity-0 -translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition ease-in duration-100"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 -translate-y-1"
            >
              <div v-if="isThemeSubmenuOpen" class="ml-6 mt-1 space-y-0.5">
                <button
                  @click="selectTheme('light')"
                  role="menuitem"
                  class="flex w-full items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:bg-surface hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/50 transition-colors"
                >
                  <Sun class="h-5 w-5 flex-shrink-0" stroke-width="2" />
                  Light
                  <Check v-if="currentTheme === 'light'" class="ml-auto h-4 w-4 text-brand" stroke-width="2" />
                </button>
                <button
                  @click="selectTheme('dark')"
                  role="menuitem"
                  class="flex w-full items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:bg-surface hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/50 transition-colors"
                >
                  <Moon class="h-5 w-5 flex-shrink-0" stroke-width="2" />
                  Dark
                  <Check v-if="currentTheme === 'dark'" class="ml-auto h-4 w-4 text-brand" stroke-width="2" />
                </button>
                <button
                  @click="selectTheme('system')"
                  role="menuitem"
                  class="flex w-full items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:bg-surface hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/50 transition-colors"
                >
                  <Monitor class="h-5 w-5 flex-shrink-0" stroke-width="2" />
                  System
                  <Check v-if="currentTheme === 'system'" class="ml-auto h-4 w-4 text-brand" stroke-width="2" />
                </button>
              </div>
            </transition>
          </div>

          <button
            @click="navigate('Support')"
            role="menuitem"
            class="flex w-full items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:bg-surface hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/50 transition-colors"
          >
            <CircleHelp class="h-5 w-5 flex-shrink-0" stroke-width="2" />
            Help & Support
          </button>
        </div>

        <!-- Divider -->
        <div class="border-t border-divider my-1"></div>

        <!-- Log out -->
        <div class="py-1 text-sm">
          <button
            @click="signOut"
            role="menuitem"
            class="flex w-full items-center gap-3 px-4 py-2 text-sm text-danger hover:bg-danger/10 focus:outline-none focus:ring-2 focus:ring-danger/50 transition-colors"
          >
            <LogOut class="h-5 w-5 flex-shrink-0" stroke-width="2" />
            Log out
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>
