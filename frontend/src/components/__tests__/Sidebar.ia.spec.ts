import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';

Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1440,
});

const { mockRoute, mockRouterPush } = vi.hoisted(() => ({
  mockRoute: { name: 'Home', path: '/dashboard' },
  mockRouterPush: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ push: mockRouterPush }),
}));

import Sidebar from '../Sidebar.vue';

const childButton = (wrapper: ReturnType<typeof mount>, testid: string) =>
  wrapper.find(`[data-testid="nav-${testid}"]`);

const mountAt = (path: string, name: string) => {
  mockRoute.path = path;
  mockRoute.name = name;
  mockRouterPush.mockClear();
  return mount(Sidebar, {
    props: { collapsed: false, mobileOpen: false },
  });
};

describe('Sidebar information architecture', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('organizes Daily Collections and Outstanding Fees under Reports', () => {
    const wrapper = mountAt('/reports', 'Reports');
    const group = wrapper.find('[aria-label="Reports submenu"]');
    expect(group.exists()).toBe(true);
    expect(group.text()).toContain('Reports Overview');
    expect(group.text()).toContain('Daily Collections');
    expect(group.text()).toContain('Outstanding Fees');
    wrapper.unmount();
  });

  it('organizes Academic Structure under Settings', () => {
    const wrapper = mountAt('/settings', 'Settings');
    const group = wrapper.find('[aria-label="Settings submenu"]');
    expect(group.exists()).toBe(true);
    expect(group.text()).toContain('General');
    expect(group.text()).toContain('Academic Structure');
    wrapper.unmount();
  });

  it('navigates to DailyCollections from the Reports submenu', async () => {
    const wrapper = mountAt('/reports', 'Reports');
    await childButton(wrapper, 'DailyCollections').trigger('click');
    expect(mockRouterPush).toHaveBeenCalledWith({ name: 'DailyCollections' });
    wrapper.unmount();
  });

  it('navigates to OutstandingFees from the Reports submenu', async () => {
    const wrapper = mountAt('/reports', 'Reports');
    await childButton(wrapper, 'OutstandingFees').trigger('click');
    expect(mockRouterPush).toHaveBeenCalledWith({ name: 'OutstandingFees' });
    wrapper.unmount();
  });

  it('navigates to AcademicStructure from the Settings submenu', async () => {
    const wrapper = mountAt('/settings', 'Settings');
    await childButton(wrapper, 'AcademicStructure').trigger('click');
    expect(mockRouterPush).toHaveBeenCalledWith({ name: 'AcademicStructure' });
    wrapper.unmount();
  });

  it('keeps Reports highlighted on Daily Collections and Outstanding Fees routes', () => {
    for (const [path, name] of [
      ['/reports/daily-collections', 'DailyCollections'],
      ['/reports/outstanding-fees', 'OutstandingFees'],
    ] as const) {
      const wrapper = mountAt(path, name);
      const reports = wrapper
        .findAll('nav button')
        .find((b) => b.attributes('aria-label') === 'Reports');
      expect(reports?.attributes('aria-current')).toBe('page');
      expect(childButton(wrapper, name).attributes('aria-current')).toBe('page');
      wrapper.unmount();
    }
  });

  it('keeps Settings highlighted on the Academic Structure route', () => {
    const wrapper = mountAt('/settings/academic-structure', 'AcademicStructure');
    const settings = wrapper
      .findAll('nav button')
      .find((b) => b.attributes('aria-label') === 'Settings');
    expect(settings?.attributes('aria-current')).toBe('page');
    expect(childButton(wrapper, 'AcademicStructure').attributes('aria-current')).toBe('page');
    wrapper.unmount();
  });

  it('does not render Academic Structure as a Students item', () => {
    const wrapper = mountAt('/students', 'Students');
    const students = wrapper
      .findAll('nav button')
      .find((b) => b.attributes('aria-label') === 'Students');
    expect(students?.text()).not.toContain('Academic Structure');
    wrapper.unmount();
  });
});
