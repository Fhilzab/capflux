/**
 * StudentStats.spec.ts — compact stat strip.
 * Verifies every metric renders its real label/value/description without
 * the MetricCard chrome, and that an empty stat list renders no cards.
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import StudentStats from '../StudentStats.vue';

const stats = [
  { key: 'total', label: 'Total Students', value: 480, description: 'All registered students', icon: 'M0' },
  { key: 'active', label: 'Active Students', value: 474, description: 'Currently enrolled', icon: 'M1' },
  { key: 'archived', label: 'Archived Students', value: 6, description: 'Inactive / left', icon: 'M2' },
  { key: 'levels', label: 'Academic Levels', value: 15, description: 'Levels in use', icon: 'M3' },
  { key: 'guardians', label: 'Guardians', value: 270, description: 'Linked guardians', icon: 'M4' },
];

describe('StudentStats', () => {
  it('renders every metric with its real value and description', () => {
    const wrapper = mount(StudentStats, { props: { stats } });
    const text = wrapper.text();
    for (const stat of stats) {
      expect(text).toContain(stat.label);
      expect(text).toContain(String(stat.value));
      expect(text).toContain(stat.description);
    }
    expect(wrapper.find('[data-testid="student-stats"]').exists()).toBe(true);
  });

  it('renders one card per metric in a responsive grid', () => {
    const wrapper = mount(StudentStats, { props: { stats } });
    const grid = wrapper.find('[data-testid="student-stats"]');
    expect(grid.classes()).toEqual(
      expect.arrayContaining(['grid', 'grid-cols-2', 'sm:grid-cols-3', 'lg:grid-cols-5']),
    );
    expect(grid.findAll(':scope > div')).toHaveLength(5);
  });

  it('renders no cards when stats are empty', () => {
    const wrapper = mount(StudentStats, { props: { stats: [] } });
    expect(wrapper.find('[data-testid="student-stats"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="student-stats"]').findAll(':scope > div')).toHaveLength(0);
  });
});
