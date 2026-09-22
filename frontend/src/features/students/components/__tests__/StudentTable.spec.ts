/**
 * StudentTable.spec.ts — responsive table/card record list flows.
 * Verifies row actions, sort, selection, pagination and the mobile card
 * markers (data-job-label) that back the CSS-driven card layout.
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import StudentTable from '../StudentTable.vue';
import type { NormalizedStudent } from '../../types';

const students: NormalizedStudent[] = [
  {
    id: 'stu-1',
    schoolId: 'school-1',
    firstName: 'Ada',
    lastName: 'Obi',
    admissionNumber: 'ADM-001',
    class: 'Primary 1',
    divisionId: 'level-1',
    guardian: {
      id: 'g-1',
      schoolId: 'school-1',
      fullName: 'Mrs. Obi',
      phone: '08011111111',
      relationship: 'MOTHER',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    status: 'ACTIVE',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'stu-2',
    schoolId: 'school-1',
    firstName: 'Emeka',
    lastName: 'Okafor',
    admissionNumber: 'ADM-002',
    class: 'Primary 2',
    divisionId: 'level-2',
    guardian: null,
    status: 'ACTIVE',
    createdAt: '2026-01-05',
    updatedAt: '2026-01-05',
  },
];

function mountTable(overrides: Record<string, unknown> = {}) {
  return mount(StudentTable, {
    props: {
      students,
      sortField: 'name',
      sortOrder: 'asc',
      selectedIds: new Set<string>(),
      loading: false,
      currentPage: 1,
      totalPages: 2,
      totalItems: 24,
      ...overrides,
    },
  });
}

describe('StudentTable', () => {
  it('renders each student with name and admission id', () => {
    const wrapper = mountTable();
    const names = wrapper.findAll('[data-testid="student-name"]');
    expect(names).toHaveLength(2);
    expect(wrapper.text()).toContain('ADM-001');
    expect(wrapper.text()).toContain('Ada Obi');
  });

  it('renders mobile card markers (data-job-label) on all detail cells', () => {
    const wrapper = mountTable();
    const labels = wrapper.findAll('[data-job-label]');
    expect(labels.length).toBeGreaterThanOrEqual(4);
    const texts = labels.map((n) => n.attributes('data-job-label'));
    expect(texts).toEqual(expect.arrayContaining(['Class', 'Guardian', 'Phone', 'Registered']));
  });

  it('keeps the select-all and per-row checkboxes wired', async () => {
    const wrapper = mountTable();
    await wrapper.find('[data-testid="select-all-students"]').setValue(true);
    expect(wrapper.emitted('toggle-select-all')![0]).toEqual([true]);

    await wrapper.find('[data-testid="select-student"]').setValue(true);
    expect(wrapper.emitted('toggle-select')![0]).toEqual(['stu-1', expect.anything()]);
  });

  it('emits view and edit when row actions are clicked', async () => {
    const wrapper = mountTable();
    await wrapper.find('[data-testid="view-student"]').trigger('click');
    expect(wrapper.emitted('view')![0]).toEqual([students[0]]);

    await wrapper.find('[data-testid="edit-student"]').trigger('click');
    expect(wrapper.emitted('edit')![0]).toEqual([students[0]]);
  });

  it('emits financial-record and archive from the More actions menu', async () => {
    const wrapper = mountTable();
    await wrapper.find('[data-testid="student-more-actions"]').trigger('click');
    const menu = wrapper.find('[data-action-menu]');
    expect(menu.exists()).toBe(true);

    const menuButtons = menu.findAll('button');
    await menuButtons[0].trigger('click');
    expect(wrapper.emitted('financial-record')![0]).toEqual([students[0]]);

    await wrapper.find('[data-testid="student-more-actions"]').trigger('click');
    await menuButtons[1].trigger('click');
    expect(wrapper.emitted('archive')![0]).toEqual([students[0]]);
  });

  it('emits sort when a sortable header is clicked', async () => {
    const wrapper = mountTable();
    const classHeader = wrapper.findAll('th').find((th) => th.text().includes('Class'))!;
    await classHeader.trigger('click');
    expect(wrapper.emitted('sort')![0]).toEqual(['class', 'asc']);

    // Parent-controlled toggle: reflect the prop back, then re-click to flip.
    await wrapper.setProps({ sortField: 'class', sortOrder: 'asc' });
    await classHeader.trigger('click');
    expect(wrapper.emitted('sort')![1]).toEqual(['class', 'desc']);
  });

  it('emits page-change from the pagination controls', async () => {
    const wrapper = mountTable({ currentPage: 1 });
    await wrapper.find('[aria-label="Next page"]').trigger('click');
    expect(wrapper.emitted('page-change')![0]).toEqual([2]);

    await wrapper.find('[aria-label="Last page"]').trigger('click');
    expect(wrapper.emitted('page-change')![1]).toEqual([2]);

    const midWrapper = mountTable({ currentPage: 2 });
    await midWrapper.find('[aria-label="First page"]').trigger('click');
    await midWrapper.find('[aria-label="Previous page"]').trigger('click');
    expect(midWrapper.emitted('page-change')).toBeTruthy();
  });

  it('shows a loading state when loading is true', () => {
    const wrapper = mountTable({ loading: true, students: [] });
    expect(wrapper.text()).toContain('Loading students...');
  });

  it('renders the empty slot when there are no records', () => {
    const wrapper = mount(StudentTable, {
      props: {
        students: [],
        sortField: 'name',
        sortOrder: 'asc',
        selectedIds: new Set<string>(),
      },
      slots: {
        empty: '<div data-testid="table-empty">No students found</div>',
      },
    });
    expect(wrapper.find('[data-testid="table-empty"]').exists()).toBe(true);
  });
});