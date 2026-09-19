<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
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
  GraduationCap,
  ChevronDown,
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

// When mobile drawer is open, always show labels (override collapsed state)
const effectiveCollapsed = computed(() => props.mobileOpen ? false : collapsed.value);

// Active state: top-level route names light up their item; nested detail
// routes (e.g. /students/:id, /guardians/:id) keep their parent item
// highlighted. Report children (/reports/*) highlight the Reports group and
// the matching child; /settings/* highlights the Settings group.
const REPORT_CHILD_NAMES = ['Reports', 'DailyCollections', 'OutstandingFees', 'RevenueDashboard'];
const SETTINGS_CHILD_NAMES = ['Settings', 'AcademicStructure'];

const isActive = (name: string): boolean => {
  if (route.name === name) return true;
  const path = route.path ?? '';
  if (name === 'Students') return path.startsWith('/students');
  if (name === 'Guardians') return path.startsWith('/guardians');
  if (name === 'Reports') {
    if ((REPORT_CHILD_NAMES as string[]).includes(route.name as string)) return true;
    return path.startsWith('/reports');
  }
  if (name === 'Settings') {
    if ((SETTINGS_CHILD_NAMES as string[]).includes(route.name as string)) return true;
    return path.startsWith('/settings');
  }
  return false;
};

const isChildActive = (name: string): boolean => route.name === name;

// Expandable groups — auto-open when a child route is active.
const reportsOpen = ref(false);
const settingsOpen = ref(false);

function syncGroupExpansion() {
  const path = route.path ?? '';
  const name = route.name as string | undefined;
  if ((name && REPORT_CHILD_NAMES.includes(name)) || path.startsWith('/reports')) {
    reportsOpen.value = true;
  }
  if ((name && SETTINGS_CHILD_NAMES.includes(name) && name !== 'Settings') || path.startsWith('/settings/')) {
    settingsOpen.value = true;
  }
}

watch(
  () => [route.path, route.name],
  () => syncGroupExpansion(),
);

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
  syncGroupExpansion();
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

function toggleReports() {
  reportsOpen.value = !reportsOpen.value;
}

function toggleSettings() {
  settingsOpen.value = !settingsOpen.value;
}

function navigateChild(name: string) {
  navigate(name);
}

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
  graduation: GraduationCap,
  chevron: ChevronDown,
};

// Flat navigation structure — no section heading labels, just dividers.
// Information architecture: Daily Collections + Outstanding Fees live under
// the Reports group; Academic Structure lives under the Settings group.
// Route names/paths are unchanged so deep links keep working.
import { runtimeEnvironment } from '../shared/environment/runtimeEnvironment';

interface NavChild {
  name: string;
  label: string;
  icon: string;
}

interface NavEntry {
  kind: 'item' | 'group';
  name: string;
  label: string;
  icon: string;
  children?: NavChild[];
}

const navItems: NavEntry[] = [
  ...(runtimeEnvironment.isSandbox
    ? [{ kind: 'item' as const, name: 'SandboxControl', label: 'Sandbox Controls', icon: 'settings' }]
    : []),
  { kind: 'item', name: 'Home', label: 'Overview', icon: 'dashboard' },
  { kind: 'item', name: 'Students', label: 'Students', icon: 'users' },
  { kind: 'item', name: 'Guardians', label: 'Guardians', icon: 'user-group' },
  { kind: 'item', name: 'Billing', label: 'Billing', icon: 'receipt' },
  { kind: 'item', name: 'Payments', label: 'Payments', icon: 'credit-card' },
  { kind: 'item', name: 'VirtualAccounts', label: 'Virtual Accounts', icon: 'banknotes' },
  { kind: 'item', name: 'Settlements', label: 'Transactions', icon: 'transactions' },
  {
    kind: 'group',
    name: 'Reports',
    label: 'Reports',
    icon: 'chart-pie',
    children: [
      { name: 'Reports', label: 'Reports Overview', icon: 'chart-pie' },
      { name: 'DailyCollections', label: 'Daily Collections', icon: 'calendar' },
      { name: 'OutstandingFees', label: 'Outstanding Fees', icon: 'clipboard-document-list' },
    ],
  },
  {
    kind: 'group',
    name: 'Settings',
    label: 'Settings',
    icon: 'cog',
    children: [
      { name: 'Settings', label: 'General', icon: 'cog' },
      { name: 'AcademicStructure', label: 'Academic Structure', icon: 'graduation' },
    ],
  },
];

function groupOpen(name: string): boolean {
  if (name === 'Reports') return reportsOpen.value;
  if (name === 'Settings') return settingsOpen.value;
  return false;
}
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
      mobileOpen ? 'w-[188px]' : (collapsed ? 'lg:w-20 w-72' : 'w-[188px]'),
      'lg:top-[50px]',
    ]"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- Navigation (flat structure with subtle dividers — no section heading labels) -->
    <nav class="flex-1 overflow-y-auto py-4" aria-label="Primary">
      <div class="px-3 space-y-1">
        <template
          v-for="(item, index) in navItems"
          :key="item.name + '-' + index"
        >
          <!-- Single nav item -->
          <button
            v-if="item.kind === 'item'"
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
              :class="{ 'opacity-0': effectiveCollapsed, 'opacity-100': !effectiveCollapsed }"
            >
              {{ item.label }}
            </span>
          </button>

          <!-- Group: header + nested children (Reports, Settings) -->
          <div v-else>
            <button
              @click="item.name === 'Reports' ? (navigate('Reports'), toggleReports()) : (navigate('Settings'), toggleSettings())"
              :aria-label="item.label"
              :aria-expanded="groupOpen(item.name)"
              :aria-current="isActive(item.name) && !isChildActive(item.name) ? 'page' : null"
              class="relative flex w-full items-center gap-3 rounded-button px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:ring-offset-2 focus:ring-offset-background"
              :class="
                isActive(item.name)
                  ? 'text-brand bg-surface font-semibold'
                  : 'text-text-secondary hover:bg-surface hover:text-text-primary'
              "
            >
              <component
                :is="iconComponents[item.icon]"
                class="h-8 w-8 flex-shrink-0"
                :class="isActive(item.name) ? 'text-brand' : 'text-text-muted'"
                stroke-width="2"
              />
              <span
                class="truncate transition-opacity duration-200"
                :class="{ 'opacity-0': effectiveCollapsed, 'opacity-100': !effectiveCollapsed }"
              >
                {{ item.label }}
              </span>
              <component
                :is="iconComponents['chevron']"
                class="ml-auto h-4 w-4 flex-shrink-0 transition-transform duration-200"
                :class="{ 'rotate-180': groupOpen(item.name), 'opacity-0': effectiveCollapsed, 'opacity-100': !effectiveCollapsed }"
                stroke-width="2"
              />
            </button>
            <!-- Children stay mounted (v-show) so keyboard/screen-reader order is stable -->
            <div
              v-show="!effectiveCollapsed && groupOpen(item.name)"
              class="mt-1 space-y-1 border-l border-divider ml-7 pl-2"
              role="group"
              :aria-label="item.label + ' submenu'"
            >
              <button
                v-for="child in item.children"
                :key="child.name + '-' + child.label"
                @click="navigateChild(child.name)"
                :aria-label="child.label"
                :aria-current="isChildActive(child.name) ? 'page' : null"
                :data-testid="'nav-' + child.name"
                class="relative flex w-full items-center gap-2 rounded-button px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:ring-offset-2 focus:ring-offset-background"
                :class="
                  isChildActive(child.name)
                    ? 'text-brand bg-surface font-semibold'
                    : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                "
              >
                <component
                  :is="iconComponents[child.icon]"
                  class="h-5 w-5 flex-shrink-0"
                  :class="isChildActive(child.name) ? 'text-brand' : 'text-text-muted'"
                  stroke-width="2"
                />
                <span class="truncate transition-opacity duration-200"
                  :class="{ 'opacity-0': effectiveCollapsed, 'opacity-100': !effectiveCollapsed }">
                  {{ child.label }}
                </span>
              </button>
            </div>
          </div>
        </template>
      </div>
    </nav>
  </aside>
</template>
