<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useThemeStore } from '../../stores/themeStore';
import CmButton from '../../components/ui/CmButton.vue';

const router = useRouter();
const themeStore = useThemeStore();

const isScrolled = ref(false);
const isMobileMenuOpen = ref(false);

const handleScroll = () => {
  isScrolled.value = window.scrollY > 20;
};

const navigateTo = (section: string) => {
  const element = document.getElementById(section);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
  isMobileMenuOpen.value = false;
};

const navigateToAuth = (mode: 'login' | 'signup') => {
  router.push({ name: 'Auth', query: { mode } });
  isMobileMenuOpen.value = false;
};

const toggleTheme = () => {
  themeStore.toggleTheme();
};

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
});
</script>

<template>
  <header
    class="fixed inset-x-0 top-0 z-50 transition-all duration-300"
    :class="isScrolled ? 'bg-background/80 backdrop-blur-md border-b border-divider shadow-topnav' : 'bg-transparent'"
  >
    <nav class="mx-auto max-w-7xl px-6 lg:px-8">
      <div class="flex h-16 items-center justify-between">
        <!-- Logo -->
        <div class="flex items-center">
          <a href="/" class="flex items-center space-x-2">
            <div class="flex h-8 w-8 items-center justify-center rounded-button bg-brand shadow-card">
              <svg class="h-5 w-5 text-background" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2 1.343-2zm0 0v.5" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 12v3.5" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 16v3" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 8a7 7 0 0114 0c0 2.21-.9 4.2-2.25 5.64A6.97 6.97 0 0112 15a6.97 6.97 0 01-4.75-1.36C5.9 12.2 5 10.21 5 8z" />
              </svg>
            </div>
            <span class="text-lg font-semibold text-text-primary">Capstone</span>
          </a>
        </div>

        <!-- Desktop Navigation -->
        <div class="hidden md:flex items-center space-x-8">
          <CmButton
            v-for="item in ['product', 'pricing', 'resources', 'security']"
            :key="item"
            @click="navigateTo(item)"
            variant="link"
          >
            {{ item.charAt(0).toUpperCase() + item.slice(1) }}
          </CmButton>
        </div>

        <!-- Actions -->
        <div class="flex items-center space-x-4">
          <!-- Theme Toggle -->
          <button
            @click="toggleTheme"
            class="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-text-secondary hover:text-text-primary transition-colors focus-ring"
            :aria-label="themeStore.mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
          >
            <svg v-if="themeStore.mode === 'dark'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m8.66-9.66l-.71.71M4.05 4.05l.71.71M21 12h-1M4 12H3m15.364 6.364l-.71-.71M6.34 17.66l.71.71M16.95 7.05a5.95 5.95 0 11-8.49 0 5.95 5.95 0 118.49 0z" />
            </svg>
            <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>

          <!-- Log In Button -->
          <CmButton
            @click="navigateToAuth('login')"
            variant="black"
            class="hidden md:inline-flex"
          >
            Log In
          </CmButton>

          <!-- Create Free Account Button -->
          <CmButton
            @click="navigateToAuth('signup')"
            variant="primary"
            class="hidden md:inline-flex"
          >
            Create Free Account
          </CmButton>

          <!-- Mobile Menu Button -->
          <button
            @click="isMobileMenuOpen = !isMobileMenuOpen"
            class="md:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-text-secondary hover:text-text-primary transition-colors focus-ring"
            :aria-label="isMobileMenuOpen ? 'Close menu' : 'Open menu'"
            :aria-expanded="isMobileMenuOpen"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path v-if="!isMobileMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Mobile Menu -->
      <transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <div
          v-show="isMobileMenuOpen"
          class="md:hidden py-4 space-y-2 border-t border-divider"
        >
          <CmButton
            v-for="item in ['product', 'pricing', 'resources', 'security']"
            :key="item"
            @click="navigateTo(item)"
            variant="link"
            class="w-full block text-left"
          >
            {{ item.charAt(0).toUpperCase() + item.slice(1) }}
          </CmButton>
          <CmButton
            @click="navigateToAuth('login')"
            variant="black"
            class="w-full mt-2 inline-flex"
          >
            Log In
          </CmButton>
          <CmButton
            @click="navigateToAuth('signup')"
            variant="primary"
            class="w-full mt-2 inline-flex"
          >
            Create Free Account
          </CmButton>
        </div>
      </transition>
    </nav>
  </header>
</template>