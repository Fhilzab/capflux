/**
 * StudentToolbar.spec.ts — responsive filter/search/action toolbar flows.
 * Verifies the compact filter row, More Filters drawer, and bulk actions.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import StudentToolbar from '../StudentToolbar.vue';
import type { FilterState } from '../../types';

const baseFilters: FilterState = {
  class: '',
  gender: '',
  status: 'ALL',
  academicSession: '',
  relationship: '',
};

const commonProps = {
  searchQuery: '',
  filters: { ...baseFilters },
  sortField: 'name',
  sortOrder: 'asc' as const,
  classOptions: [
    { value: 'level-1', label: 'Primary 1' },
    { value: 'level-2', label: 'Primary 2' },
  ],
  genderOptions: [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
  ],
  statusOptions: [
    { value: 'ALL', label: 'All statuses' },
    { value: 'ACTIVE', label: 'Active' },
  ],
  sessionOptions: [{ value: '2025/2026', label: '2025/2026' }],
  relationshipOptions: [
    { value: 'MOTHER', label: 'Mother' },
    { value: 'FATHER', label: 'Father' },
  ],
  sortFieldOptions: [
    { value: 'name', label: 'Name' },
    { value: 'class', label: 'Class' },
  ],
  selectedCount: 0,
};

function mountToolbar(overrides: Record<string, unknown> = {}) {
  return mount(StudentToolbar, {
    props: { ...commonProps, ...overrides },
    attachTo: document.body,
  });
}

describe('StudentToolbar', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a single coherent search field', () => {
    const wrapper = mountToolbar();
    const search = wrapper.find('[data-testid="student-search-input"]');
    expect(search.exists()).toBe(true);
    expect(search.attributes('type')).toBe('search');
  });

  it('emits update:searchQuery when the user types', async () => {
    const wrapper = mountToolbar();
    await wrapper.find('[data-testid="student-search-input"]').setValue('Ada');
    expect(wrapper.emitted('update:searchQuery')).toBeTruthy();
    expect(wrapper.emitted('update:searchQuery')![0]).toEqual(['Ada']);
  });

  it('keeps the primary filters inline (Class / Gender / Status)', () => {
    const wrapper = mountToolbar();
    expect(wrapper.find('[data-testid="filter-class"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="filter-gender"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="filter-status"]').exists()).toBe(true);
  });

  it('emits filter-change when a primary filter changes', async () => {
    const wrapper = mountToolbar();
    await wrapper.find('[data-testid="filter-class"] select').setValue('level-1');
    expect(wrapper.emitted('filter-change')).toBeTruthy();
    expect(wrapper.emitted('filter-change')![0]).toEqual([{ class: 'level-1' }]);
  });

  it('opens the More Filters drawer and exposes secondary filters', async () => {
    const wrapper = mountToolbar();
    expect(document.body.querySelector('[data-testid="filter-session"]')).toBeNull();

    await wrapper.find('[data-testid="more-filters-toggle"]').trigger('click');
    await new Promise((r) => setTimeout(r, 0));
    expect(document.body.querySelector('[data-testid="filter-session"]')).not.toBeNull();
    expect(document.body.querySelector('[data-testid="filter-relationship"]')).not.toBeNull();
  });

  it('emits filter-change for a secondary filter from the drawer', async () => {
    const wrapper = mountToolbar();
    await wrapper.find('[data-testid="more-filters-toggle"]').trigger('click');

    // CmDrawer teleports to document.body — query the real DOM target.
    const select = document.body.querySelector<HTMLSelectElement>(
      '[data-testid="filter-session"] select',
    );
    expect(select).not.toBeNull();
    select!.value = '2025/2026';
    select!.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));

    expect(wrapper.emitted('filter-change')?.[0]).toEqual([{ academicSession: '2025/2026' }]);
  });

  it('shows a badge with the count of active secondary filters', async () => {
    const wrapper = mountToolbar({
      filters: { ...baseFilters, academicSession: '2025/2026', relationship: 'MOTHER' },
    });
    const badge = wrapper.find('[data-testid="more-filters-count"]');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toBe('2');
  });

  it('emits clear-filters when Clear is clicked', async () => {
    const wrapper = mountToolbar({
      filters: { ...baseFilters, class: 'level-1' },
    });
    await wrapper.find('[data-testid="clear-filters"]').trigger('click');
    expect(wrapper.emitted('clear-filters')).toBeTruthy();
  });

  it('exposes bulk actions when students are selected', async () => {
    const wrapper = mountToolbar({ selectedCount: 2 });
    expect(wrapper.find('[data-testid="move-selected"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="export-selected"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="archive-selected"]').exists()).toBe(true);

    await wrapper.find('[data-testid="move-selected"]').trigger('click');
    await wrapper.find('[data-testid="archive-selected"]').trigger('click');
    expect(wrapper.emitted('move-selected')).toBeTruthy();
    expect(wrapper.emitted('archive-selected')).toBeTruthy();
  });

  it('emits export and import when nothing is selected', async () => {
    const wrapper = mountToolbar();
    await wrapper.find('[data-testid="export-students"]').trigger('click');
    await wrapper.find('[data-testid="import-students"]').trigger('click');
    expect(wrapper.emitted('export')).toBeTruthy();
    expect(wrapper.emitted('import')).toBeTruthy();
  });

  it('emits sort-change when the sort control is used', async () => {
    const wrapper = mountToolbar();
    await wrapper.find('[data-testid="student-sort-field"] select').setValue('class');
    expect(wrapper.emitted('sort-change')![0]).toEqual(['class', 'asc']);

    // The toggle echoes the prop-driven sort field (parent state), not the
    // free-typing selection of the local copy.
    await wrapper.find('[data-testid="student-sort-order"]').trigger('click');
    expect(wrapper.emitted('sort-change')![1]).toEqual(['name', 'desc']);
  });
});