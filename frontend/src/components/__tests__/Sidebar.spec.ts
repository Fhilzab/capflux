import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, defineComponent, reactive } from 'vue';
import Sidebar from '../Sidebar.vue';

// ── Mock window.innerWidth for jsdom (desktop default) ───
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
});

// ── Hoisted mocks ────────────────────────────────────────
const { mockRoute, mockRouterPush } = vi.hoisted(() => ({
  mockRoute: { name: 'Home' },
  mockRouterPush: vi.fn(),
}));

vi.mock('vue-router', () => ({ useRoute: () => mockRoute, useRouter: () => ({ push: mockRouterPush }) }));

describe('Sidebar.vue', () => {
  let wrapper: ReturnType<typeof mount>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRouterPush.mockReset();
    mockRoute.name = 'Home';
    (window as any).innerWidth = 1024;

    wrapper = mount(Sidebar, {
      props: {
        collapsed: true,
        mobileOpen: false,
      },
    });
  });

  afterEach(() => {
    if (wrapper?.element) {
      wrapper.unmount();
    }
    // Clean up any teleported content
    document.body.innerHTML = '';
  });

  // ── Default collapsed state ─────────────────────────────

  it('starts collapsed by default on desktop (icons only)', () => {
    const defaultWrapper = mount(Sidebar, {
      props: { mobileOpen: false },
    });
    expect(defaultWrapper.find('aside').classes()).toContain('lg:w-20');
    // Labels should be hidden (opacity-0) indicating collapsed
    const labels = defaultWrapper.findAll('nav span.truncate');
    expect(labels.length).toBeGreaterThan(0);
    labels.forEach((label) => {
      expect(label.classes()).toContain('opacity-0');
    });
    defaultWrapper.unmount();
  });

  it('does not render a bottom collapse toggle button', () => {
    expect(wrapper.find('[data-testid="sidebar-toggle"]').exists()).toBe(false);
  });

  it('does not render CmTooltip wrappers for nav items', () => {
    expect(wrapper.findAll('.cm-tooltip').length).toBe(0);
  });

  // ── Navigation ────────────────────────────────────────

  it('renders all navigation items', () => {
    const text = wrapper.text();
    expect(text).toContain('Overview');
    expect(text).toContain('Students');
    expect(text).toContain('Guardians');
    expect(text).toContain('Billing');
    expect(text).toContain('Payments');
    expect(text).toContain('Virtual Accounts');
    expect(text).toContain('Transactions');
    expect(text).toContain('Outstanding Fees');
    expect(text).toContain('Daily Collections');
    expect(text).toContain('Reports');
    expect(text).toContain('Settings');
  });

  it('does not render section heading labels', () => {
    const text = wrapper.text();
    expect(text).not.toContain('School');
    expect(text).not.toContain('Finance');
    expect(text).not.toContain('Administration');
  });

  it('navigates to the correct route when a nav item is clicked', async () => {
    await wrapper.setProps({ collapsed: false });
    const buttons = wrapper.findAll('nav button');
    await buttons[0].trigger('click');
    expect(mockRouterPush).toHaveBeenCalledWith({ name: 'Home' });
  });

  it('emits close-mobile when a nav item is clicked with mobileOpen', async () => {
    const closeMobileHandler = vi.fn();
    const Parent = defineComponent({
      components: { Sidebar },
      data() {
        return { collapsed: true, mobileOpen: true };
      },
      methods: {
        handleCloseMobile() {
          closeMobileHandler();
        },
      },
      template: `<Sidebar :collapsed="collapsed" :mobile-open="mobileOpen" @close-mobile="handleCloseMobile" />`,
    });
    const parentWrapper = mount(Parent);
    const buttons = parentWrapper.findAll('nav button');
    await buttons[0].trigger('click');
    expect(closeMobileHandler).toHaveBeenCalled();
    parentWrapper.unmount();
  });

  it('does not render a logout button in the sidebar', () => {
    const text = wrapper.text();
    expect(text.toLowerCase()).not.toContain('logout');
    expect(text.toLowerCase()).not.toContain('sign out');
    expect(wrapper.findAll('[data-testid="sidebar-toggle"]').length).toBe(0);
  });

  // ── Width classes ──────────────────────────────────────

  it('applies collapsed width class (lg:w-20) when collapsed', () => {
    const aside = wrapper.find('aside');
    expect(aside.classes()).toContain('lg:w-20');
  });

  it('applies expanded width class (w-[188px]) when expanded', async () => {
    await wrapper.setProps({ collapsed: false });
    const aside = wrapper.find('aside');
    expect(aside.classes()).toContain('w-[188px]');
  });

  // ── Hover behavior (desktop) ──────────────────────────

  it('expands when hovering the sidebar (mouseenter on desktop)', async () => {
    const Parent = defineComponent({
      components: { Sidebar },
      data() {
        return { collapsed: true, mobileOpen: false };
      },
      template: `<Sidebar v-model:collapsed="collapsed" :mobile-open="mobileOpen" />`,
    });
    const parentWrapper = mount(Parent, { attachTo: document.body });

    const asideEl = parentWrapper.find('aside').element;
    asideEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await nextTick();

    expect((parentWrapper.vm as any).collapsed).toBe(false);
    parentWrapper.unmount();
  });

  it('collapses when leaving the sidebar (mouseleave on desktop)', async () => {
    const Parent = defineComponent({
      components: { Sidebar },
      data() {
        return { collapsed: false, mobileOpen: false };
      },
      template: `<Sidebar v-model:collapsed="collapsed" :mobile-open="mobileOpen" />`,
    });
    const parentWrapper = mount(Parent, { attachTo: document.body });

    const asideEl = parentWrapper.find('aside').element;
    asideEl.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    await nextTick();

    expect((parentWrapper.vm as any).collapsed).toBe(true);
    parentWrapper.unmount();
  });

  it('collapses when clicking outside the sidebar on desktop', async () => {
    const Parent = defineComponent({
      components: { Sidebar },
      data() {
        return { collapsed: false, mobileOpen: false };
      },
      template: `<Sidebar v-model:collapsed="collapsed" :mobile-open="mobileOpen" />`,
    });
    const parentWrapper = mount(Parent, { attachTo: document.body });

    // Click on an element outside the sidebar
    const outsideEl = document.createElement('div');
    document.body.appendChild(outsideEl);
    outsideEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect((parentWrapper.vm as any).collapsed).toBe(true);

    document.body.removeChild(outsideEl);
    parentWrapper.unmount();
  });

  it('does not collapse when clicking inside the sidebar', async () => {
    const Parent = defineComponent({
      components: { Sidebar },
      data() {
        return { collapsed: false, mobileOpen: false };
      },
      template: `<Sidebar v-model:collapsed="collapsed" :mobile-open="mobileOpen" />`,
    });
    const parentWrapper = mount(Parent, { attachTo: document.body });

    const buttons = parentWrapper.findAll('nav button');
    await buttons[0].trigger('click');
    await nextTick();

    expect((parentWrapper.vm as any).collapsed).toBe(false);
    parentWrapper.unmount();
  });

  it('does not apply hover expansion logic on mobile screens', async () => {
    (window as any).innerWidth = 768;
    const Parent = defineComponent({
      components: { Sidebar },
      data() {
        return { collapsed: true, mobileOpen: false };
      },
      template: `<Sidebar v-model:collapsed="collapsed" :mobile-open="mobileOpen" />`,
    });
    const parentWrapper = mount(Parent, { attachTo: document.body });

    const asideEl = parentWrapper.find('aside').element;
    asideEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await nextTick();

    expect((parentWrapper.vm as any).collapsed).toBe(true);

    (window as any).innerWidth = 1024;
    parentWrapper.unmount();
  });

  // ── Icon position stability ───────────────────────────

  it('uses px-4 (fixed icon column) for nav buttons in collapsed state', () => {
    const buttons = wrapper.findAll('nav button');
    buttons.forEach((button) => {
      expect(button.classes()).toContain('px-4');
      expect(button.classes()).not.toContain('justify-center');
    });
  });

  it('uses px-4 (fixed icon column) for nav buttons in expanded state', async () => {
    await wrapper.setProps({ collapsed: false });
    const buttons = wrapper.findAll('nav button');
    buttons.forEach((button) => {
      expect(button.classes()).toContain('px-4');
      expect(button.classes()).not.toContain('justify-center');
    });
  });

  it('renders the same number of nav buttons in collapsed and expanded states', async () => {
    const collapsedCount = wrapper.findAll('nav button').length;
    await wrapper.setProps({ collapsed: false });
    const expandedCount = wrapper.findAll('nav button').length;
    expect(collapsedCount).toBe(expandedCount);
  });

  it('renders nav icons at header-matching size (h-8 w-8 stroke-width-2) in both states', async () => {
    // Collapsed
    let icons = wrapper.findAll('nav svg.h-8.w-8');
    expect(icons.length).toBeGreaterThan(0);

    // Expanded
    await wrapper.setProps({ collapsed: false });
    icons = wrapper.findAll('nav svg.h-8.w-8');
    expect(icons.length).toBeGreaterThan(0);
  });

  it('does not use mx-auto or justify-center that would shift icon positions', () => {
    const buttons = wrapper.findAll('nav button');
    buttons.forEach((button) => {
      expect(button.classes()).not.toContain('mx-auto');
      expect(button.classes()).not.toContain('justify-center');
    });
  });

  it('uses flex-shrink-0 on icons to prevent resizing', () => {
    const icons = wrapper.findAll('nav svg.h-8.w-8');
    icons.forEach((icon) => {
      expect(icon.classes()).toContain('flex-shrink-0');
    });
  });

  it('renders icons at a fixed left position (px-4) in both collapsed and expanded', async () => {
    // Collapsed — icon should start at px-4
    const collapsedButton = wrapper.find('nav button');
    expect(collapsedButton.classes()).toContain('px-4');

    await wrapper.setProps({ collapsed: false });
    // Expanded — icon should still start at px-4
    const expandedButton = wrapper.find('nav button');
    expect(expandedButton.classes()).toContain('px-4');
  });

  // ── Label visibility ──────────────────────────────────

  it('hides labels (opacity-0) when collapsed', () => {
    const labels = wrapper.findAll('nav span.truncate');
    expect(labels.length).toBeGreaterThan(0);
    labels.forEach((label) => {
      expect(label.classes()).toContain('opacity-0');
    });
  });

  it('shows labels (opacity-100) when expanded', async () => {
    await wrapper.setProps({ collapsed: false });
    const labels = wrapper.findAll('nav span.truncate');
    expect(labels.length).toBeGreaterThan(0);
    labels.forEach((label) => {
      expect(label.classes()).toContain('opacity-100');
    });
  });

  it('renders a transition-opacity class on labels for smooth fade', () => {
    const labels = wrapper.findAll('nav span.truncate');
    labels.forEach((label) => {
      expect(label.classes()).toContain('transition-opacity');
    });
  });

  // ── Active route styling ──────────────────────────────

  it('applies distinct active highlight (no accent bar/border) for the active route', async () => {
    await wrapper.setProps({ collapsed: false });
    const activeButton = wrapper.find('nav button[aria-current="page"]');
    expect(activeButton.exists()).toBe(true);
    // Active button should use bg-surface background (not bg-background)
    expect(activeButton.classes()).toContain('bg-surface');
    expect(activeButton.classes()).toContain('text-brand');
    // No accent bar span should exist
    expect(activeButton.find('span.absolute.left-0').exists()).toBe(false);
  });

  it('renders aria-label on all nav buttons', () => {
    const buttons = wrapper.findAll('nav button');
    buttons.forEach((button) => {
      expect(button.attributes('aria-label')).toBeTruthy();
    });
  });

  // ── Mobile drawer behavior ────────────────────────────

  it('preserves mobile drawer behavior (translate-x-full by default)', () => {
    const aside = wrapper.find('aside');
    expect(aside.classes()).toContain('-translate-x-full');
    expect(aside.classes()).toContain('lg:translate-x-0');
  });

  it('shows mobile drawer when mobileOpen is true', async () => {
    await wrapper.setProps({ mobileOpen: true });
    const aside = wrapper.find('aside');
    expect(aside.classes()).toContain('translate-x-0');
  });

  it('renders mobile overlay backdrop when mobileOpen', () => {
    const Parent = defineComponent({
      components: { Sidebar },
      data() {
        return { collapsed: true, mobileOpen: true };
      },
      template: `<Sidebar :collapsed="collapsed" :mobile-open="mobileOpen" />`,
    });
    const parentWrapper = mount(Parent, { attachTo: document.body });

    // Teleport renders to document.body, so search the whole body
    const overlay = document.body.querySelector('.z-overlay');
    expect(overlay).not.toBeNull();

    parentWrapper.unmount();
  });

  it('tapping outside the mobile drawer closes it', async () => {
    const closeMobileHandler = vi.fn();
    const Parent = defineComponent({
      components: { Sidebar },
      data() {
        return { collapsed: true, mobileOpen: true };
      },
      methods: {
        handleCloseMobile() {
          closeMobileHandler();
        },
      },
      template: `<Sidebar :collapsed="collapsed" :mobile-open="mobileOpen" @close-mobile="handleCloseMobile" />`,
    });
    const parentWrapper = mount(Parent, { attachTo: document.body });

    // The backdrop element is teleported to body — find it and click
    const backdrop = document.body.querySelector('.z-overlay');
    expect(backdrop).not.toBeNull();
    backdrop!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(closeMobileHandler).toHaveBeenCalled();
    parentWrapper.unmount();
  });

  // ── Header alignment ───────────────────────────────────

  it('aligns sidebar below the 50px header with lg:top-[50px]', () => {
    const aside = wrapper.find('aside');
    expect(aside.classes()).toContain('lg:top-[50px]');
  });
});
