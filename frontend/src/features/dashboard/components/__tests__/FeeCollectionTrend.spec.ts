import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import FeeCollectionTrend from '../FeeCollectionTrend.vue';
import { useDashboardStore } from '../../stores/dashboardStore';
import type { CompoundPoint } from '../../stores/dashboardStore';

vi.mock('../../../../stores/syncStore', () => ({
  useSyncStore: () => ({ pendingCount: 0, lastSyncedAt: null, refreshStatus: vi.fn().mockResolvedValue(undefined) }),
}));

describe('FeeCollectionTrend — compound financial chart', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const store = useDashboardStore();
    // set canonical V4 values
    store.totalCharges = 67121000;
    store.totalPayments = 49177940;
    store.netBalance = 17943060;
    store.collectionRate = 73.3;
  });

  const sampleData: CompoundPoint[] = [
    { date: 'Day 1', expected: 67121000, collected: 30000000, outstanding: 37121000, reconciliationRate: 44.7 },
    { date: 'Day 2', expected: 67121000, collected: 49177940, outstanding: 17943060, reconciliationRate: 73.3 },
    { date: 'Day 3', expected: 67121000, collected: 49177940, outstanding: 17943060, reconciliationRate: 73.3 },
  ];

  it('renders the compound chart with grouped bars for all three series + reconciliation line', () => {
    const wrapper = mount(FeeCollectionTrend, { props: { data: sampleData } });
    const chart = wrapper.find('[data-testid="compound-chart"]');
    expect(chart.exists()).toBe(true);
    expect(wrapper.findAll('[data-testid^="compound-bar-expected-"]').length).toBe(3);
    expect(wrapper.findAll('[data-testid^="compound-bar-collected-"]').length).toBe(3);
    expect(wrapper.findAll('[data-testid^="compound-bar-outstanding-"]').length).toBe(3);
    expect(wrapper.find('[data-testid="compound-line"]').exists()).toBe(true);
    for (const testid of [
      'compound-legend-expected',
      'compound-legend-collected',
      'compound-legend-outstanding',
      'compound-legend-reconciliation',
    ]) {
      expect(wrapper.find(`[data-testid="${testid}"]`).exists()).toBe(true);
    }
  });

  it('renders the range selector and emits update:selectedRange on click', async () => {
    const wrapper = mount(FeeCollectionTrend, {
      props: { data: sampleData, selectedRange: '7D' },
    });
    for (const range of ['7D', '30D', '3M', '6M', '1Y']) {
      expect(wrapper.find(`[data-testid="trend-range-${range}"]`).exists()).toBe(true);
    }
    await wrapper.find('[data-testid="trend-range-30D"]').trigger('click');
    expect(wrapper.emitted('update:selectedRange')?.[0]).toEqual(['30D']);
  });

  it('shows the consolidated tooltip on hover with exact values', async () => {
    const wrapper = mount(FeeCollectionTrend, { props: { data: sampleData } });
    expect(wrapper.find('[data-testid="compound-tooltip"]').exists()).toBe(false);
    await wrapper.findAll('[data-testid^="compound-cluster-hit-"]')[1].trigger('mouseenter');
    const tooltip = wrapper.find('[data-testid="compound-tooltip"]');
    expect(tooltip.exists()).toBe(true);
    expect(tooltip.text()).toContain('Day 2');
    expect(tooltip.text()).toContain('Expected');
    expect(tooltip.text()).toContain('₦67,121,000');
    expect(tooltip.text()).toContain('Collect');
    expect(tooltip.text()).toContain('₦49,177,940');
    expect(tooltip.text()).toContain('Outstanding');
    expect(tooltip.text()).toContain('₦17,943,060');
    expect(tooltip.text()).toContain('73.3%');
  });

  it('supports keyboard navigation between period clusters', async () => {
    const wrapper = mount(FeeCollectionTrend, { props: { data: sampleData } });
    const hits = wrapper.findAll('[data-testid^="compound-cluster-hit-"]');
    await hits[0].trigger('focus');
    expect(wrapper.find('[data-testid="compound-tooltip"]').text()).toContain('Day 1');
    await hits[0].trigger('keydown', { key: 'ArrowRight' });
    expect(hits[1].element.getAttribute('tabindex')).toBe('0');
    expect(wrapper.find('[data-testid="compound-tooltip"]').text()).toContain('Day 2');
    await hits[1].trigger('keydown', { key: 'ArrowLeft' });
    expect(wrapper.find('[data-testid="compound-tooltip"]').text()).toContain('Day 1');
  });

  it('shows a loading skeleton while loading', () => {
    const wrapper = mount(FeeCollectionTrend, { props: { data: [], loading: true } });
    expect(wrapper.find('.skeleton').exists()).toBe(true);
    expect(wrapper.find('[data-testid="compound-chart"]').exists()).toBe(false);
  });

  it('shows the shared empty state when there is no activity', () => {
    const wrapper = mount(FeeCollectionTrend, { props: { data: [] } });
    expect(wrapper.text()).toContain('No fee activity yet');
  });

  it('renders only the expected bar (no zero-height collected bar) when nothing is collected yet', () => {
    const store = useDashboardStore();
    store.totalPayments = 0;
    store.netBalance = store.totalCharges;
    store.collectionRate = 0;
    const partial: CompoundPoint[] = [
      { date: 'Day 1', expected: 67121000, collected: 0, outstanding: 67121000, reconciliationRate: 0 },
    ];
    const wrapper = mount(FeeCollectionTrend, { props: { data: partial } });
    expect(wrapper.findAll('[data-testid^="compound-bar-expected-"]').length).toBe(1);
    expect(wrapper.findAll('[data-testid^="compound-bar-collected-"]').length).toBe(0);
    expect(wrapper.findAll('[data-testid^="compound-bar-outstanding-"]').length).toBe(1);
  });

  it('uses canonical store totals in the summary and does not mutate them', async () => {
    const wrapper = mount(FeeCollectionTrend, { props: { data: sampleData } });
    const store = useDashboardStore();
    expect(wrapper.find('[data-testid="compound-summary-expected"]').text()).toContain('67,121,000');
    expect(wrapper.find('[data-testid="compound-summary-collected"]').text()).toContain('49,177,940');
    expect(wrapper.find('[data-testid="compound-summary-outstanding"]').text()).toContain('17,943,060');
    expect(wrapper.find('[data-testid="compound-summary-reconciliation"]').text()).toContain('73.3');

    const before = { charges: store.totalCharges, collected: store.totalPayments, outstanding: store.netBalance };
    await wrapper.findAll('[data-testid^="compound-cluster-hit-"]')[2].trigger('mouseenter');
    await wrapper.findAll('[data-testid^="compound-cluster-hit-"]')[0].trigger('keydown', { key: 'ArrowLeft' });
    expect(store.totalCharges).toBe(before.charges);
    expect(store.totalPayments).toBe(before.collected);
    expect(store.netBalance).toBe(before.outstanding);
    expect(store.totalCharges).toBe(store.totalPayments + store.netBalance);
  });
});