/**
 * StudentPageHeader.spec.ts — header title, student count and action wiring.
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import StudentPageHeader from '../StudentPageHeader.vue';

describe('StudentPageHeader', () => {
  it('renders the heading and description', () => {
    const wrapper = mount(StudentPageHeader, {
      props: { studentCount: 3 },
    });
    expect(wrapper.find('h1').text()).toBe('Students');
    expect(wrapper.text()).toContain('Student register');
  });

  it('shows the real student count from the provided data source', () => {
    const wrapper = mount(StudentPageHeader, {
      props: { studentCount: 42 },
    });
    expect(wrapper.find('[data-testid="students-count"]').text()).toBe('42');
  });

  it('hides the count badge when no count is provided', () => {
    const wrapper = mount(StudentPageHeader);
    expect(wrapper.find('[data-testid="students-count"]').exists()).toBe(false);
  });

  it('emits import and add from the header actions', async () => {
    const wrapper = mount(StudentPageHeader, {
      props: { studentCount: 3 },
    });
    await wrapper.find('[data-testid="header-import-students"]').trigger('click');
    await wrapper.find('[data-testid="header-add-student"]').trigger('click');
    expect(wrapper.emitted('import')).toBeTruthy();
    expect(wrapper.emitted('add')).toBeTruthy();
  });

  it('hides action buttons when hideActions is true (empty state owns CTAs)', () => {
    const wrapper = mount(StudentPageHeader, {
      props: { studentCount: 0, hideActions: true },
    });
    expect(wrapper.find('[data-testid="header-add-student"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="header-import-students"]').exists()).toBe(false);
  });
});