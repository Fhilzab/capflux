import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ProfileMenu from '../ProfileMenu.vue';

// ── Hoisted mocks ────────────────────────────────────────
const { mockAuthStore, mockThemeStore, mockRouterPush } = vi.hoisted(() => ({
  mockRouterPush: vi.fn(),
  mockAuthStore: {
    user: { id: 'u1', email: 'admin@capflux.local' },
    profile: {
      first_name: 'Jane',
      last_name: 'Doe',
      full_name: 'Jane Doe',
      avatar_url: undefined,
    },
    organization: { id: 'org1', name: 'Lincoln High School' },
    currentRole: 'OWNER',
    isAuthenticated: true,
    signOut: vi.fn().mockResolvedValue(undefined),
  },
  mockThemeStore: {
    mode: 'dark' as const,
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
    initTheme: vi.fn(),
  },
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => mockAuthStore,
}));

vi.mock('../../stores/themeStore', () => ({
  useThemeStore: () => mockThemeStore,
}));

describe('ProfileMenu.vue', () => {
  let wrapper: ReturnType<typeof mount>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRouterPush.mockReset();
    mockAuthStore.signOut.mockClear();
    mockAuthStore.signOut.mockResolvedValue(undefined);
    mockThemeStore.setTheme.mockClear();
    mockThemeStore.initTheme.mockClear();
    localStorage.clear();

    wrapper = mount(ProfileMenu, {
      props: { showLabel: true },
      attachTo: document.body,
    });
  });

  afterEach(() => {
    if (wrapper?.element) {
      wrapper.unmount();
    }
  });

  const openDropdown = async () => {
    const button = wrapper.find('button[aria-haspopup="true"][aria-label]');
    await button.trigger('click');
  };

  const findMenuItem = (label: string) => {
    return wrapper
      .findAll('[role="menuitem"]')
      .filter((b) => b.text().trim() === label)[0];
  };

  const findSubmenuButton = (label: string) => {
    return wrapper
      .findAll('button')
      .filter((b) => b.text().trim().startsWith(label))[0];
  };

  const toggleThemeSubmenu = async () => {
    const themeBtn = findMenuItem('Theme');
    await themeBtn.trigger('click');
    await wrapper.vm.$nextTick();
  };

  // ── Avatar trigger (unchanged) ──────────────────────────

  it('renders the avatar with a person icon when no profile image', () => {
    const avatarButton = wrapper.find('[data-testid="profile-avatar"]');
    const personIcon = avatarButton.find('svg.h-5.w-5.text-background');
    expect(personIcon.exists()).toBe(true);
  });

  it('uses semantic tokens for avatar', () => {
    const avatarButton = wrapper.find('[data-testid="profile-avatar"]');
    const icon = avatarButton.find('svg');
    expect(icon.classes()).toContain('text-background');
    const avatarSpan = avatarButton.find('span');
    expect(avatarSpan.classes()).toContain('bg-text-primary');
    expect(avatarSpan.classes()).toContain('border-background');
    expect(avatarButton.classes()).not.toContain('text-brand');
  });

  // ── Identity header ──────────────────────────────────────

  it('renders first name and last name in dropdown header (no avatar)', async () => {
    await openDropdown();
    expect(wrapper.text()).toContain('Jane Doe');
  });

  it('renders school name in dropdown header', async () => {
    await openDropdown();
    expect(wrapper.text()).toContain('Lincoln High School');
  });

  it('renders email address in dropdown header', async () => {
    await openDropdown();
    expect(wrapper.text()).toContain('admin@capflux.local');
  });

  it('does not render an avatar, initials circle, or profile image inside the dropdown', async () => {
    await openDropdown();
    const dropdown = wrapper.find('.z-popover');
    expect(dropdown.find('img').exists()).toBe(false);
    expect(dropdown.find('span.flex.h-\\[34px\\]').exists()).toBe(false);
  });

  it('uses proper text hierarchy (semibold name, secondary school, muted email)', async () => {
    await openDropdown();
    // Name — semibold primary
    const nameEl = wrapper.find('.text-text-primary.text-sm.font-semibold');
    expect(nameEl.exists()).toBe(true);
    expect(nameEl.text()).toBe('Jane Doe');
    // Email — smaller muted
    const emailEls = wrapper.findAll('.text-xs.text-text-muted');
    expect(emailEls.length).toBeGreaterThan(0);
    expect(emailEls.some((e) => e.text().includes('admin@capflux.local'))).toBe(true);
  });

  it('renders a subtle divider below the identity information', async () => {
    await openDropdown();
    const dropdown = wrapper.find('.z-popover');
    // The identity section has a border-b divider
    expect(dropdown.find('.border-b.border-divider').exists()).toBe(true);
  });

  // ── Menu items ───────────────────────────────────────────

  it('renders Account Settings, School Settings, Theme, Help & Support, and Log out', async () => {
    await openDropdown();
    const text = wrapper.text();
    expect(text).toContain('Account Settings');
    expect(text).toContain('School Settings');
    expect(text).toContain('Theme');
    expect(text).toContain('Help & Support');
    expect(text).toContain('Log out');
  });

  it('does not render old "Profile", "Appearance", or "Sign Out" menu items', async () => {
    await openDropdown();
    const buttonTexts = wrapper
      .findAll('[role="menuitem"]')
      .map((b) => b.text().trim());
    expect(buttonTexts).not.toContain('Profile');
    expect(buttonTexts).not.toContain('Appearance');
    expect(buttonTexts).not.toContain('Sign Out');
  });

  it('renders Settings icon for Account Settings', async () => {
    await openDropdown();
    const settingsBtn = findMenuItem('Account Settings');
    expect(settingsBtn.exists()).toBe(true);
    expect(settingsBtn.find('svg.h-5.w-5').exists()).toBe(true);
  });

  it('renders School icon for School Settings', async () => {
    await openDropdown();
    const schoolBtn = findMenuItem('School Settings');
    expect(schoolBtn.exists()).toBe(true);
    expect(schoolBtn.find('svg.h-5.w-5').exists()).toBe(true);
  });

  it('renders Sun icon for Theme', async () => {
    await openDropdown();
    const themeBtn = findMenuItem('Theme');
    expect(themeBtn.exists()).toBe(true);
    expect(themeBtn.find('svg.h-5.w-5').exists()).toBe(true);
  });

  it('renders CircleHelp icon for Help & Support', async () => {
    await openDropdown();
    const supportBtn = findMenuItem('Help & Support');
    expect(supportBtn.exists()).toBe(true);
    expect(supportBtn.find('svg.h-5.w-5').exists()).toBe(true);
  });

  it('renders LogOut icon for Log out', async () => {
    await openDropdown();
    const logoutBtn = findMenuItem('Log out');
    expect(logoutBtn.exists()).toBe(true);
    expect(logoutBtn.find('svg.h-5.w-5').exists()).toBe(true);
  });

  it('renders ChevronRight indicator on Theme button', async () => {
    await openDropdown();
    const themeBtn = findMenuItem('Theme');
    expect(themeBtn.find('svg.h-4.w-4.text-text-muted').exists()).toBe(true);
  });

  it('renders Check icon for active theme', async () => {
    localStorage.setItem('theme', 'dark');
    await openDropdown();
    await toggleThemeSubmenu();
    const checkIcon = wrapper.find('svg.h-4.w-4.text-brand');
    expect(checkIcon.exists()).toBe(true);
  });

  // ── Theme submenu ────────────────────────────────────────

  it('opens theme submenu when Theme is clicked', async () => {
    await openDropdown();
    await toggleThemeSubmenu();
    expect(wrapper.text()).toContain('Light');
    expect(wrapper.text()).toContain('Dark');
    expect(wrapper.text()).toContain('System');
  });

  it('closes theme submenu when Theme is clicked again', async () => {
    await openDropdown();
    await toggleThemeSubmenu();

    const themeBtn = findMenuItem('Theme');
    await themeBtn.trigger('click');
    await wrapper.vm.$nextTick();

    expect(themeBtn.attributes('aria-expanded')).toBe('false');
  });

  it('shows active checkmark for dark theme', async () => {
    localStorage.setItem('theme', 'dark');
    await openDropdown();
    await toggleThemeSubmenu();
    expect(wrapper.findAll('svg.h-4.w-4.text-brand').length).toBeGreaterThan(0);
  });

  it('shows active checkmark for light theme', async () => {
    localStorage.setItem('theme', 'light');
    await openDropdown();
    await toggleThemeSubmenu();
    expect(wrapper.findAll('svg.h-4.w-4.text-brand').length).toBeGreaterThan(0);
  });

  it('shows active checkmark for system theme (no localStorage entry)', async () => {
    await openDropdown();
    await toggleThemeSubmenu();
    expect(wrapper.findAll('svg.h-4.w-4.text-brand').length).toBeGreaterThan(0);
  });

  it('applies Light theme and closes submenu when Light is selected', async () => {
    localStorage.setItem('theme', 'dark');
    await openDropdown();
    await toggleThemeSubmenu();

    const lightBtn = findSubmenuButton('Light');
    await lightBtn.trigger('click');

    expect(mockThemeStore.setTheme).toHaveBeenCalledWith('light');
    await wrapper.vm.$nextTick();
    const themeBtn = findMenuItem('Theme');
    expect(themeBtn.attributes('aria-expanded')).toBe('false');
    expect(wrapper.find('.z-popover').exists()).toBe(true);
  });

  it('applies Dark theme and closes submenu when Dark is selected', async () => {
    localStorage.setItem('theme', 'light');
    await openDropdown();
    await toggleThemeSubmenu();

    const darkBtn = findSubmenuButton('Dark');
    await darkBtn.trigger('click');

    expect(mockThemeStore.setTheme).toHaveBeenCalledWith('dark');
  });

  it('applies System theme and calls initTheme when System is selected', async () => {
    localStorage.setItem('theme', 'dark');
    await openDropdown();
    await toggleThemeSubmenu();

    const systemBtn = findSubmenuButton('System');
    await systemBtn.trigger('click');

    expect(mockThemeStore.initTheme).toHaveBeenCalled();
  });

  it('rotates chevron when theme submenu opens', async () => {
    await openDropdown();
    const themeBtn = findMenuItem('Theme');
    await themeBtn.trigger('click');
    await wrapper.vm.$nextTick();
    const chevron = themeBtn.find('svg.h-4.w-4.text-text-muted');
    expect(chevron.classes()).toContain('rotate-90');
  });

  // ── Navigation ───────────────────────────────────────────

  it('navigates to Settings when Account Settings is clicked', async () => {
    await openDropdown();
    const settingsBtn = findMenuItem('Account Settings');
    await settingsBtn.trigger('click');
    expect(mockRouterPush).toHaveBeenCalledWith({ name: 'Settings' });
  });

  it('navigates to SchoolSettings when School Settings is clicked', async () => {
    await openDropdown();
    const schoolBtn = findMenuItem('School Settings');
    await schoolBtn.trigger('click');
    expect(mockRouterPush).toHaveBeenCalledWith({ name: 'SchoolSettings' });
  });

  it('navigates to Support when Help & Support is clicked', async () => {
    await openDropdown();
    const supportBtn = findMenuItem('Help & Support');
    await supportBtn.trigger('click');
    expect(mockRouterPush).toHaveBeenCalledWith({ name: 'Support' });
  });

  it('closes the dropdown after navigating', async () => {
    await openDropdown();
    const settingsBtn = findMenuItem('Account Settings');
    await settingsBtn.trigger('click');
    const avatarButton = wrapper.find('button[aria-haspopup="true"][aria-label]');
    expect(avatarButton.attributes('aria-expanded')).toBe('false');
  });

  // ── Sign out ─────────────────────────────────────────────

  it('calls signOut and navigates to Auth when Log out is clicked', async () => {
    await openDropdown();
    const logoutBtn = findMenuItem('Log out');
    await logoutBtn.trigger('click');
    expect(mockAuthStore.signOut).toHaveBeenCalled();
    expect(mockRouterPush).toHaveBeenCalledWith({ name: 'Auth' });
  });

  it('closes the dropdown after signing out', async () => {
    await openDropdown();
    const logoutBtn = findMenuItem('Log out');
    await logoutBtn.trigger('click');
    const avatarButton = wrapper.find('button[aria-haspopup="true"][aria-label]');
    expect(avatarButton.attributes('aria-expanded')).toBe('false');
  });

  it('Log out uses destructive color token (text-danger)', async () => {
    await openDropdown();
    const logoutBtn = findMenuItem('Log out');
    expect(logoutBtn.classes()).toContain('text-danger');
  });

  // ── Interaction ──────────────────────────────────────────

  it('opens the dropdown when avatar button is clicked', async () => {
    const button = wrapper.find('button[aria-haspopup="true"][aria-label]');
    await button.trigger('click');
    expect(button.attributes('aria-expanded')).toBe('true');
    expect(wrapper.find('.z-popover').exists()).toBe(true);
  });

  it('toggles the dropdown when avatar button is clicked twice', async () => {
    const button = wrapper.find('button[aria-haspopup="true"][aria-label]');
    await button.trigger('click');
    expect(button.attributes('aria-expanded')).toBe('true');
    await button.trigger('click');
    expect(button.attributes('aria-expanded')).toBe('false');
  });

  it('closes the dropdown on click outside', async () => {
    const button = wrapper.find('button[aria-haspopup="true"][aria-label]');
    await button.trigger('click');
    expect(button.attributes('aria-expanded')).toBe('true');

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(button.attributes('aria-expanded')).toBe('false');
  });

  it('closes the dropdown on Escape', async () => {
    const button = wrapper.find('button[aria-haspopup="true"][aria-label]');
    await button.trigger('click');
    expect(button.attributes('aria-expanded')).toBe('true');

    await button.trigger('keydown.escape');
    expect(button.attributes('aria-expanded')).toBe('false');
  });

  it('closes theme submenu on Escape but keeps dropdown open', async () => {
    await openDropdown();
    await toggleThemeSubmenu();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await wrapper.vm.$nextTick();

    const themeBtn = findMenuItem('Theme');
    expect(themeBtn.attributes('aria-expanded')).toBe('false');
    expect(wrapper.find('.z-popover').exists()).toBe(true);
  });

  // ── Accessibility ────────────────────────────────────────

  it('has aria-haspopup and aria-expanded on avatar button', () => {
    const button = wrapper.find('button[aria-haspopup="true"][aria-label]');
    expect(button.attributes('aria-haspopup')).toBe('true');
    expect(button.attributes('aria-expanded')).toBe('false');
  });

  it('has aria-haspopup and aria-expanded on Theme button', async () => {
    await openDropdown();
    const themeBtn = findMenuItem('Theme');
    expect(themeBtn.attributes('aria-haspopup')).toBe('true');
    expect(themeBtn.attributes('aria-expanded')).toBe('false');
  });

  it('updates aria-expanded on Theme button when submenu toggles', async () => {
    await openDropdown();
    const themeBtn = findMenuItem('Theme');
    await themeBtn.trigger('click');
    await wrapper.vm.$nextTick();
    expect(themeBtn.attributes('aria-expanded')).toBe('true');
    await themeBtn.trigger('click');
    await wrapper.vm.$nextTick();
    expect(themeBtn.attributes('aria-expanded')).toBe('false');
  });

  it('has role="menu" on dropdown and role="menuitem" on items', async () => {
    await openDropdown();
    const dropdown = wrapper.find('.z-popover');
    expect(dropdown.attributes('role')).toBe('menu');
    const items = wrapper.findAll('[role="menuitem"]');
    expect(items.length).toBeGreaterThan(0);
  });

  it('has visible focus states on menu items', async () => {
    await openDropdown();
    const items = wrapper.findAll('[role="menuitem"]');
    expect(items.length).toBeGreaterThan(0);
    items.forEach((item) => {
      expect(item.classes()).toContain('focus:outline-none');
      expect(item.classes()).toContain('focus:ring-2');
    });
  });

  // ── Icon-only mode ───────────────────────────────────────

  describe('icon-only mode (showLabel=false)', () => {
    let iconWrapper: ReturnType<typeof mount>;

    beforeEach(() => {
      iconWrapper = mount(ProfileMenu, {
        props: { showLabel: false },
        attachTo: document.body,
      });
    });

    afterEach(() => {
      iconWrapper.unmount();
    });

    it('renders a 34×34 circular avatar button', () => {
      const button = iconWrapper.find('[data-testid="profile-avatar"]');
      expect(button.exists()).toBe(true);
      expect(button.classes()).toContain('h-[34px]');
      expect(button.classes()).toContain('w-[34px]');
      expect(button.classes()).toContain('rounded-full');
    });

    it('renders a person icon inside the avatar', () => {
      const button = iconWrapper.find('[data-testid="profile-avatar"]');
      const icon = button.find('svg');
      expect(icon.exists()).toBe(true);
      expect(icon.findAll('path').length).toBeGreaterThan(0);
    });

    it('uses semantic tokens (bg-text-primary + border-background)', () => {
      const button = iconWrapper.find('[data-testid="profile-avatar"]');
      expect(button.classes()).toContain('bg-text-primary');
      expect(button.classes()).toContain('border-background');
    });

    it('uses text-background for the person icon', () => {
      const icon = iconWrapper.find('[data-testid="profile-avatar"] svg');
      expect(icon.classes()).toContain('text-background');
    });

    it('does not render the label in icon-only mode', () => {
      const button = iconWrapper.find('[data-testid="profile-avatar"]');
      expect(button.text()).not.toContain('Jane');
    });

    it('opens the popover when clicked', async () => {
      const button = iconWrapper.find('[data-testid="profile-avatar"]');
      await button.trigger('click');
      expect(button.attributes('aria-expanded')).toBe('true');
      expect(iconWrapper.find('.z-popover').exists()).toBe(true);
    });
  });

  // ── Visual requirements ──────────────────────────────────

  it('dropdown has subtle border, soft shadow, and rounded corners', async () => {
    await openDropdown();
    const dropdown = wrapper.find('.z-popover');
    expect(dropdown.classes()).toContain('border');
    expect(dropdown.classes()).toContain('border-divider');
    expect(dropdown.classes()).toContain('shadow-elevated');
    expect(dropdown.classes()).toContain('rounded-button');
  });

  it('dropdown uses existing CAPFLUX background color', async () => {
    await openDropdown();
    const dropdown = wrapper.find('.z-popover');
    expect(dropdown.classes()).toContain('bg-card');
  });

  it('dropdown has max width constraint for viewport safety', async () => {
    await openDropdown();
    const dropdown = wrapper.find('.z-popover');
    expect(dropdown.classes()).toContain('max-w-[90vw]');
  });

  it('renders menu items with gap-3 (icons + labels)', async () => {
    await openDropdown();
    const items = wrapper.findAll('[role="menuitem"]');
    expect(items.length).toBeGreaterThan(0);
    items.forEach((item) => {
      expect(item.classes()).toContain('items-center');
      expect(item.classes()).toContain('gap-3');
    });
  });

  it('keeps existing header avatar completely unchanged', () => {
    const avatarButton = wrapper.find('[data-testid="profile-avatar"]');
    expect(avatarButton.classes()).toContain('rounded-button');
    expect(avatarButton.classes()).toContain('bg-surface/50');
    expect(avatarButton.classes()).toContain('border-divider');
    expect(avatarButton.classes()).toContain('text-text-primary');
    expect(avatarButton.classes()).not.toContain('text-brand');
  });

  it('renders chevron-down on labelled avatar for showLabel mode', () => {
    const chevron = wrapper.find('svg.h-4.w-4.text-text-muted.transition-transform');
    expect(chevron.exists()).toBe(true);
  });
});
