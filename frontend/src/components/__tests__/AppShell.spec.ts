import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';
import AppShell from '../AppShell.vue';

// ── Reactive mock route for useRoute ─────────────────────
const mockRoute = reactive({ fullPath: '/', name: 'Home' });

// ── Module-level mocks ───────────────────────────────────
vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
}));

vi.mock('../../stores/themeStore', () => ({
  useThemeStore: () => ({ initTheme: vi.fn(), mode: 'dark' }),
}));

vi.mock('../AppHeader.vue', () => ({
  default: {
    name: 'AppHeader',
    emits: ['toggle-mobile'],
    template: '<header data-testid="app-header"></header>',
  },
}));

vi.mock('../Sidebar.vue', () => ({
  default: {
    name: 'Sidebar',
    props: ['collapsed', 'mobileOpen'],
    emits: ['update:collapsed', 'close-mobile'],
    template:
      '<aside data-testid="sidebar" @click="$emit(\'update:collapsed\', !collapsed)"></aside>',
  },
}));

describe('AppShell.vue', () => {
  let wrapper: ReturnType<typeof mount>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRoute.fullPath = '/';
    mockRoute.name = 'Home';
    localStorage.clear();

    wrapper = mount(AppShell, {
      slots: { default: '<div data-testid="main-content">Page content</div>' },
    });
  });

  afterEach(() => {
    if (wrapper?.element) {
      wrapper.unmount();
    }
    localStorage.clear();
  });

  it('renders the AppHeader, Sidebar, and main content slot', () => {
    expect(wrapper.find('[data-testid="app-header"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="sidebar"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="main-content"]').exists()).toBe(true);
  });

  it('starts with collapsed sidebar (lg:ml-20) by default on desktop', () => {
    const mainDiv = wrapper.find('div.flex.flex-col.flex-1');
    expect(mainDiv.classes()).toContain('lg:ml-20');
  });

  it('applies pt-[50px] padding to offset below the 50px header', () => {
    const mainDiv = wrapper.find('div.flex.flex-col.flex-1');
    expect(mainDiv.classes()).toContain('pt-[50px]');
  });

  it('switches to lg:ml-[188px] margin when sidebar is expanded', async () => {
    const sidebar = wrapper.findComponent({ name: 'Sidebar' });
    await sidebar.vm.$emit('update:collapsed', false);
    await nextTick();

    const mainDiv = wrapper.find('div.flex.flex-col.flex-1');
    expect(mainDiv.classes()).toContain('lg:ml-[188px]');
  });

  it('switches to lg:ml-20 margin when sidebar is collapsed', async () => {
    const sidebar = wrapper.findComponent({ name: 'Sidebar' });
    await sidebar.vm.$emit('update:collapsed', true);
    await nextTick();

    const mainDiv = wrapper.find('div.flex.flex-col.flex-1');
    expect(mainDiv.classes()).toContain('lg:ml-20');
  });

  it('does not persist collapsed state to localStorage', async () => {
    const sidebar = wrapper.findComponent({ name: 'Sidebar' });
    await sidebar.vm.$emit('update:collapsed', true);
    await nextTick();

    expect(localStorage.getItem('capflux:sidebarCollapsed')).toBeNull();
  });

  it('closes mobile menu on route change', async () => {
    // Simulate hamburger click → AppShell toggles mobileOpen to true
    const header = wrapper.findComponent({ name: 'AppHeader' });
    await header.vm.$emit('toggle-mobile');
    await nextTick();

    const sidebar = wrapper.findComponent({ name: 'Sidebar' });
    expect(sidebar.props('mobileOpen')).toBe(true);

    // Simulate route navigation
    mockRoute.fullPath = '/students';
    await nextTick();

    expect(sidebar.props('mobileOpen')).toBe(false);
  });
});
