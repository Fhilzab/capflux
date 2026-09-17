import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import Sidebar from '../Sidebar.vue';

Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
});

const { mockRoute, mockRouterPush } = vi.hoisted(() => ({
  mockRoute: { name: 'Home', path: '/dashboard' },
  mockRouterPush: vi.fn(),
}));

vi.mock('vue-router', () => ({ useRoute: () => mockRoute, useRouter: () => ({ push: mockRouterPush }) }));

const itemButton = (wrapper: ReturnType<typeof mount>, label: string) =>
  wrapper.findAll('nav button').find((button) => button.attributes('aria-label') === label);

const mountAt = (path: string, name: string) => {
  mockRoute.path = path;
  mockRoute.name = name;
  const wrapper = mount(Sidebar, {
    props: { collapsed: false, mobileOpen: false },
  });
  return wrapper;
};

describe('Sidebar.vue active state for nested detail routes', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps Students highlighted on a nested student detail route', () => {
    const wrapper = mountAt('/students/stu-0001', 'StudentDetail');
    const students = itemButton(wrapper, 'Students');
    expect(students?.attributes('aria-current')).toBe('page');
    expect(itemButton(wrapper, 'Guardians')?.attributes('aria-current')).not.toBe('page');
    wrapper.unmount();
  });

  it('keeps Guardians highlighted on a nested guardian detail route', () => {
    const wrapper = mountAt('/guardians/grd-0001', 'GuardianDetail');
    const guardians = itemButton(wrapper, 'Guardians');
    expect(guardians?.attributes('aria-current')).toBe('page');
    wrapper.unmount();
  });

  it('does not highlight Students for unrelated routes', () => {
    const wrapper = mountAt('/settlements', 'Settlements');
    expect(itemButton(wrapper, 'Students')?.attributes('aria-current')).not.toBe('page');
    wrapper.unmount();
  });

  it('highlights the exact route name as before (Students on Students)', () => {
    const wrapper = mountAt('/students', 'Students');
    expect(itemButton(wrapper, 'Students')?.attributes('aria-current')).toBe('page');
    wrapper.unmount();
  });

  it('tolerates a route record without a path (legacy mocks)', () => {
    const wrapper = mountAt(undefined as unknown as string, 'Students');
    expect(itemButton(wrapper, 'Students')?.attributes('aria-current')).toBe('page');
    wrapper.unmount();
  });
});