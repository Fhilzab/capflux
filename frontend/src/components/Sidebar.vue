<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  LayoutDashboard,
  UsersRound,
  UserRoundCheck,
  Receipt,
  CreditCard,
  Landmark,
  ArrowLeftRight,
  BadgeAlert,
  CalendarCheck,
  ChartNoAxesCombined,
  Settings,
} from '@lucide/vue';

const props = withDefaults(
  defineProps<{
    collapsed?: boolean;
    mobileOpen?: boolean;
  }>(),
  {
    collapsed: true,
    mobileOpen: false,
  },
);
const emit = defineEmits<{
  'update:collapsed': [value: boolean];
  'close-mobile': [];
}>();

const route = useRoute();
const router = useRouter();

const sidebarRef = ref<HTMLElement | null>(null);

// Computed for two-way v-model collapsed
const collapsed = computed({
  get: () => props.collapsed,
  set: (value: boolean) => emit('update:collapsed', value),
});

const isActive = (name: string) => route.name === name;

// Mobile detection — hover logic only applies on desktop
const isMobile = ref(false);
const checkMobile = () => {
  isMobile.value = typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
};

// Desktop interaction: hovering the sidebar expands it
const handleMouseEnter = () => {
  if (!isMobile.value) {
    emit('update:collapsed', false);
  }
};

// Desktop interaction: leaving the sidebar collapses it
const handleMouseLeave = () => {
  if (!isMobile.value) {
    emit('update:collapsed', true);
  }
};

// Click-outside-to-collapse on desktop
const handleOutsideClick = (event: MouseEvent) => {
  if (isMobile.value || collapsed.value) return;
  if (sidebarRef.value && !sidebarRef.value.contains(event.target as Node)) {
    emit('update:collapsed', true);
  }
};

onMounted(() => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
  document.addEventListener('click', handleOutsideClick, true);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
  document.removeEventListener('click', handleOutsideClick, true);
});

const navigate = (name: string) => {
  router.push({ name });
  if (props.mobileOpen) {
    emit('close-mobile');
  }
};

// Lucide icon component mapping
const iconComponents: Record<string, any> = {
  dashboard: LayoutDashboard,
  users: UsersRound,
  'user-group': UserRoundCheck,
  receipt: Receipt,
  'credit-card': CreditCard,
  banknotes: Landmark,
  transactions: ArrowLeftRight,
  'clipboard-document-list': BadgeAlert,
  calendar: CalendarCheck,
  'chart-pie': ChartNoAxesCombined,
  cog: Settings,
};

// Flat navigation structure — no section heading labels, just dividers
const navItems = [
  { name: 'Home', label: 'Overview', icon: 'dashboard' },
  { name: 'Students', label: 'Students', icon: 'users' },
  { name: 'Guardians', label: 'Guardians', icon: 'user-group' },
  { divider: true },
  { name: 'Billing', label: 'Billing', icon: 'receipt' },
  { name: 'Payments', label: 'Payments', icon: 'credit-card' },
  { name: 'VirtualAccounts', label: 'Virtual Accounts', icon: 'banknotes' },
  { name: 'Settlements', label: 'Transactions', icon: 'transactions' },
  { name: 'OutstandingFees', label: 'Outstanding Fees', icon: 'clipboard-document-list' },
  { name: 'DailyCollections', label: 'Daily Collections', icon: 'calendar' },
  { name: 'Reports', label: 'Reports', icon: 'chart-pie' },
  { divider: true },
  { name: 'Settings', label: 'Settings', icon: 'cog' },
];
</script>

<template>
  <!-- Mobile overlay / backdrop -->
  <Teleport to="body">
    <transition name="slide" appear>
      <div
        v-if="mobileOpen"
        class="fixed inset-0 z-overlay bg-black/50 lg:hidden"
        @click="emit('close-mobile')"
      />
    </transition>
  </Teleport>

  <!-- Sidebar -->
  <aside
    ref="sidebarRef"
    class="fixed inset-y-0 left-0 z-sticky flex flex-col bg-sidebar border-r border-divider transition-all duration-300"
    :class="[
      mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      collapsed ? 'lg:w-20 w-72' : 'w-[188px]',
      'lg:top-[50px]',
    ]"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- Navigation (flat structure with subtle dividers — no section heading labels) -->
    <nav class="flex-1 overflow-y-auto py-4">
      <div class="px-3 space-y-1">
        <template
          v-for="(item, index) in navItems"
          :key="item.divider ? `divider-${index}` : item.name"
        >
          <!-- Subtle divider between logical groups -->
          <div
            v-if="item.divider"
            v-show="!collapsed"
            class="border-t border-divider my-2"
          />

          <!-- Unified nav item: icon always at fixed position (px-4), label fades in/out -->
          <button
            v-else
            @click="navigate(item.name)"
            :aria-label="item.label"
            :aria-current="isActive(item.name) ? 'page' : null"
            class="relative flex w-full items-center gap-3 rounded-button px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:ring-offset-2 focus:ring-offset-background"
            :class="
              isActive(item.name)
                ? 'text-brand bg-surface font-semibold'
                : 'text-text-secondary hover:bg-surface hover:text-text-primary'
            "
          >
            <!-- Icon (fixed position via px-4 — same column in both collapsed and expanded) -->
            <component
              :is="iconComponents[item.icon]"
              class="h-8 w-8 flex-shrink-0"
              :class="isActive(item.name) ? 'text-brand' : 'text-text-muted'"
              stroke-width="2"
            />

            <!-- Label (fades in/out beside the fixed icon column) -->
            <span
              class="truncate transition-opacity duration-200"
              :class="{ 'opacity-0': collapsed, 'opacity-100': !collapsed }"
            >
              {{ item.label }}
            </span>
          </button>
        </template>
      </div>
    </nav>
  </aside>
</template>
