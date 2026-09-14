<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useThemeStore } from '../../stores/themeStore';
import { runtimeEnvironment } from '../../shared/environment/runtimeEnvironment';
import CmButton from '../../components/ui/CmButton.vue';
import CmBadge from '../../components/ui/CmBadge.vue';
import CapfluxMark from '../branding/CapfluxMark.vue';
import { Sun, Moon, Menu, X } from '@lucide/vue';

const router = useRouter();
const themeStore = useThemeStore();

const isScrolled = ref(false);
const isMobileMenuOpen = ref(false);

// In sandbox, logo links to production homepage; in production, links to local landing page
const homeUrl = computed(() => (runtimeEnvironment.isSandbox ? 'https://capflux.vercel.app' : '/'));

const navItems = [
  { id: 'features', label: 'Features' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'offline-first', label: 'Offline Engine' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
];

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
      <div class="flex h-14 items-center justify-between">
        <!-- Logo -->
        <div class="flex items-center">
          <a :href="homeUrl" class="flex items-center space-x-2">
            <CapfluxMark :size="36" aria-label="CAPFLUX Home" />
            <span class="text-xl font-bold tracking-tight text-text-primary">CAPFLUX</span>
            <CmBadge
              variant="brand"
              label="Financial OS"
              size="sm"
              pill
              class="hidden lg:inline-flex"
            />
          </a>
        </div>

        <!-- Desktop Navigation -->
        <div class="hidden md:flex items-center space-x-8">
          <CmButton
            v-for="item in navItems"
            :key="item.id"
            @click="navigateTo(item.id)"
            variant="link"
            class="nav-link"
          >
            {{ item.label }}
          </CmButton>
        </div>

        <!-- Actions -->
        <div class="flex items-center space-x-4">
          <!-- Theme Toggle -->
          <button
            @click="toggleTheme"
            class="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-text-secondary hover:text-text-primary transition-colors focus-ring"
            :aria-label="themeStore.mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
          >
            <Sun v-if="themeStore.mode === 'dark'" class="h-5 w-5" :stroke-width="2" />
            <Moon v-else class="h-5 w-5" :stroke-width="2" />
          </button>

          <!-- Log In Button -->
          <CmButton
            @click="navigateToAuth('login')"
            variant="black"
            class="hidden md:inline-flex"
          >
            Log In
          </CmButton>

          <!-- Get Started Free Button -->
          <CmButton
            @click="navigateToAuth('signup')"
            variant="primary"
            class="hidden md:inline-flex nav-cta"
          >
            Get Started Free
          </CmButton>

          <!-- Mobile Menu Button -->
          <button
            @click="isMobileMenuOpen = !isMobileMenuOpen"
            class="md:hidden flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-text-secondary hover:text-text-primary transition-colors focus-ring"
            :aria-label="isMobileMenuOpen ? 'Close menu' : 'Open menu'"
            :aria-expanded="isMobileMenuOpen"
          >
            <Menu v-if="!isMobileMenuOpen" class="h-5 w-5" :stroke-width="2" />
            <X v-else class="h-5 w-5" :stroke-width="2" />
          </button>
        </div>
      </div>

      <!-- Mobile Menu (sheet overlay) -->
      <transition name="mobile-menu">
        <div
          v-if="isMobileMenuOpen"
          class="md:hidden fixed inset-0 z-[var(--z-overlay)] flex"
        >
          <div
            class="absolute inset-0 bg-background/60 backdrop-blur-sm"
            @click="isMobileMenuOpen = false"
          />
          <div
            class="relative ml-auto h-full w-full max-w-xs bg-card border-l border-divider shadow-xl overflow-y-auto flex flex-col animate-slide-in-right"
          >
            <div class="flex h-14 items-center justify-between px-6 border-b border-divider flex-shrink-0">
              <a :href="homeUrl" class="flex items-center space-x-2">
                <CapfluxMark :size="28" aria-label="CAPFLUX Home" />
                <span class="text-xl font-bold tracking-tight text-text-primary">CAPFLUX</span>
                <CmBadge variant="brand" label="Financial OS" size="sm" pill />
              </a>
              <button
                type="button"
                @click="isMobileMenuOpen = false"
                class="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary hover:text-text-primary transition-colors focus-ring"
                aria-label="Close menu"
              >
                <X class="h-5 w-5" :stroke-width="2" />
              </button>
            </div>
            <nav class="flex-1 overflow-y-auto py-3">
              <CmButton
                v-for="item in navItems"
                :key="item.id"
                @click="navigateTo(item.id)"
                variant="link"
                class="nav-link w-full block py-4 text-left"
              >
                {{ item.label }}
              </CmButton>
            </nav>
            <div class="p-6 border-t border-divider space-y-3 flex-shrink-0">
              <CmButton
                @click="navigateToAuth('login')"
                variant="black"
                class="w-full"
              >
                Log In
              </CmButton>
              <CmButton
                @click="navigateToAuth('signup')"
                variant="primary"
                class="w-full nav-cta"
              >
                Get Started Free
              </CmButton>
            </div>
          </div>
        </div>
      </transition>
    </nav>
  </header>
</template>

<style scoped>
.nav-link {
  color: var(--color-brand-hover) !important;
}

.nav-cta {
  background-color: var(--color-brand-hover) !important;
}
.nav-cta:hover {
  background-color: var(--color-brand) !important;
}

@media (prefers-reduced-motion: reduce) {
  .animate-slide-in-right {
    animation: none;
  }
  .mobile-menu-enter-active,
  .mobile-menu-leave-active {
    transition: none;
  }
  .transition-colors {
    transition: none;
  }
}
</style>