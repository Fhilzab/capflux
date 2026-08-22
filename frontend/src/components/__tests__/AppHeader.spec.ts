import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import AppHeader from '../AppHeader.vue';

// ── Hoisted mocks ────────────────────────────────────────
const { mockAuthStore, mockSchoolStore, mockSyncStore, mockDashboardStore, mockThemeStore, mockRouterPush } = vi.hoisted(() => ({
  mockRouterPush: vi.fn(),
  mockAuthStore: {
    user: { id: 'u1', email: 'admin@capflux.local' },
    profile: { full_name: 'Admin User', avatar_url: '' },
    organization: { name: 'CAPFLUX' },
    signOut: vi.fn().mockResolvedValue(undefined),
    currentRole: 'OWNER',
    isAuthenticated: true,
  },
  mockSchoolStore: {
    school: {
      id: 'school-1',
      name: 'Bright Future Academy',
      status: 'ACTIVE',
      paymentStatus: 'READY',
    },
  },
  mockSyncStore: {
    pendingCount: 0,
    failedCount: 0,
  },
  mockDashboardStore: {
    pendingNotifications: 3,
  },
  mockThemeStore: {
    mode: 'light' as const,
    toggleTheme: vi.fn(),
    setTheme: vi.fn(),
    initTheme: vi.fn(),
    systemPrefersDark: false,
  },
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => mockAuthStore,
}));

vi.mock('../../stores/schoolStore', () => ({
  useSchoolStore: () => mockSchoolStore,
}));

vi.mock('../../stores/syncStore', () => ({
  useSyncStore: () => mockSyncStore,
}));

vi.mock('../../features/dashboard/stores/dashboardStore', () => ({
  useDashboardStore: () => mockDashboardStore,
}));

vi.mock('../../stores/themeStore', () => ({
  useThemeStore: () => mockThemeStore,
}));

describe('AppHeader.vue', () => {
  let wrapper: ReturnType<typeof mount>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRouterPush.mockReset();
    setActivePinia(createPinia());

    wrapper = mount(AppHeader, {
      attachTo: document.body,
    });
  });

  afterEach(() => {
    if (wrapper?.element) {
      wrapper.unmount();
    }
  });

  // ── Header height ──────────────────────────────────────
  it('renders with h-[50px] height class (50px)', () => {
    const header = wrapper.find('[data-testid="app-header"]');
    expect(header.exists()).toBe(true);
    expect(header.classes()).toContain('h-[50px]');
  });

  // ── Left side: logo + separator + school name ──────────
  it('renders the CAPFLUX logo circle as perfectly circular', () => {
    const logoCircle = wrapper.find('[data-testid="capflux-logo"] div');
    expect(logoCircle.classes()).toContain('rounded-full');
    expect(logoCircle.classes()).not.toContain('rounded-button');
  });

  it('renders the CAPFLUX logo at the far left', () => {
    const logo = wrapper.find('[data-testid="capflux-logo"]');
    expect(logo.exists()).toBe(true);
    expect(logo.text()).toContain('CAPFLUX');
  });

  it('renders a subtle vertical separator after the logo', () => {
    const separator = wrapper.find('[data-testid="workspace-separator"]');
    expect(separator.exists()).toBe(true);
    expect(separator.classes()).toContain('bg-divider');
    expect(separator.classes()).toContain('w-px');
  });

  it('renders the real school name after the separator', () => {
    const schoolName = wrapper.find('[data-testid="workspace-name"]');
    expect(schoolName.exists()).toBe(true);
    expect(schoolName.text()).toBe('Bright Future Academy');
    expect(schoolName.classes()).toContain('text-text-secondary');
    expect(schoolName.classes()).toContain('truncate');
  });

  it('renders a status dot when school is active', () => {
    const dot = wrapper.find('[data-testid="school-status-dot"]');
    expect(dot.exists()).toBe(true);
    expect(dot.classes()).toContain('bg-success');
  });

  it('renders the mobile menu button', () => {
    const button = wrapper.find('[data-testid="mobile-menu-button"]');
    expect(button.exists()).toBe(true);
    expect(button.attributes('aria-label')).toBe('Toggle navigation');
  });

  // ── Right side: search + utilities + profile ───────────
  it('renders the search input', () => {
    const search = wrapper.find('[data-testid="search-input"]');
    expect(search.exists()).toBe(true);
    expect(search.attributes('placeholder')).toBe('Search...');
    expect(search.attributes('aria-label')).toBe('Search');
  });

  it('renders the search container with ~195px width', () => {
    const container = wrapper.find('[data-testid="search-container"]');
    expect(container.exists()).toBe(true);
    expect(container.classes()).toContain('w-[195px]');
  });

  it('retains the keyboard shortcut hint (⌘K)', () => {
    const kbd = wrapper.find('[data-testid="search-container"] kbd');
    expect(kbd.exists()).toBe(true);
    expect(kbd.text()).toContain('K');
  });

  it('positions search before notifications in the DOM', () => {
    const html = wrapper.html();
    const searchPos = html.indexOf('data-testid="search-container"');
    const notifyPos = html.indexOf('data-testid="notification-button"');
    const aiPos = html.indexOf('data-testid="ai-assistant-button"');
    expect(searchPos).toBeGreaterThan(-1);
    expect(notifyPos).toBeGreaterThan(searchPos);
    expect(aiPos).toBeGreaterThan(notifyPos);
  });

  // ── Notification button ─────────────────────────────────
  it('renders the notification button as a circular icon button', () => {
    const button = wrapper.find('[data-testid="notification-button"]');
    expect(button.exists()).toBe(true);
    expect(button.classes()).toContain('rounded-full');
    expect(button.classes()).toContain('h-[34px]');
    expect(button.classes()).toContain('w-[34px]');
    expect(button.attributes('aria-label')).toBe('Notifications');
  });

  it('renders the notification badge with pending count', () => {
    const badge = wrapper.find('[data-testid="notification-button"] .rounded-full.bg-danger');
    // The badge should exist and show "3"
    expect(wrapper.find('[data-testid="notification-button"]').text()).toContain('3');
  });

  it('notification button is clickable with accessible label', async () => {
    const button = wrapper.find('[data-testid="notification-button"]');
    expect(button.exists()).toBe(true);
    expect(button.attributes('aria-label')).toBe('Notifications');
    expect(button.classes()).toContain('rounded-full');
    // Click should not throw
    await button.trigger('click');
    expect(button.exists()).toBe(true);
  });

  // ── AI Assistant button ─────────────────────────────────
  it('renders the AI Assistant button as a circular icon button', () => {
    const button = wrapper.find('[data-testid="ai-assistant-button"]');
    expect(button.exists()).toBe(true);
    expect(button.classes()).toContain('rounded-full');
    expect(button.classes()).toContain('h-[34px]');
    expect(button.classes()).toContain('w-[34px]');
    expect(button.attributes('aria-label')).toBe('AI Assistant');
  });

  // ── Profile Avatar ──────────────────────────────────────
  it('renders the profile avatar as the final control with black/white circle', () => {
    const avatar = wrapper.find('[data-testid="profile-avatar"]');
    expect(avatar.exists()).toBe(true);
    expect(avatar.classes()).toContain('h-[34px]');
    expect(avatar.classes()).toContain('w-[34px]');
    expect(avatar.classes()).toContain('rounded-full');
    // Black/white circle via semantic tokens (not hardcoded colors)
    expect(avatar.classes()).toContain('bg-text-primary');
    expect(avatar.classes()).toContain('border-background');
  });

  it('renders a person icon inside the avatar when no profile image', () => {
    const avatar = wrapper.find('[data-testid="profile-avatar"]');
    const personIcon = avatar.find('svg');
    expect(personIcon.exists()).toBe(true);
    // Person icon should use text-background (semantic, not hardcoded)
    expect(personIcon.classes()).toContain('text-background');
  });

  it('opens the profile popover when avatar is clicked', async () => {
    const avatar = wrapper.find('[data-testid="profile-avatar"]');
    await avatar.trigger('click');
    expect(avatar.attributes('aria-expanded')).toBe('true');
    expect(wrapper.find('.z-popover').exists()).toBe(true);
  });

  // ── Desktop layout ──────────────────────────────────────
  it('hides the desktop utility group on mobile (lg:flex)', () => {
    const group = wrapper.find('[data-testid="search-container"]').element?.parentElement;
    // The parent should have hidden lg:flex classes
    const groupClasses = group?.className || '';
    expect(groupClasses).toContain('hidden');
    expect(groupClasses).toContain('lg:flex');
  });

  it('navigates to Home when CAPFLUX logo is clicked', async () => {
    const logo = wrapper.find('[data-testid="capflux-logo"]');
    await logo.trigger('click');
    expect(mockRouterPush).toHaveBeenCalledWith({ name: 'Home' });
  });

  // ── Utility icon rule ───────────────────────────────────
  it('has rounded-rectangular search and circular utility buttons', () => {
    const searchInput = wrapper.find('[data-testid="search-input"]');
    expect(searchInput.classes()).toContain('rounded-search');

    const notificationButton = wrapper.find('[data-testid="notification-button"]');
    expect(notificationButton.classes()).toContain('rounded-full');

    const aiButton = wrapper.find('[data-testid="ai-assistant-button"]');
    expect(aiButton.classes()).toContain('rounded-full');
  });
});
