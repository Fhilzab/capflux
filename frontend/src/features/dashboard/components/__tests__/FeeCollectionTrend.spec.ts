import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import FeeCollectionTrend from '../FeeCollectionTrend.vue';
import { useDashboardStore } from '../../stores/dashboardStore';

vi.mock('../../../../stores/syncStore', () => ({
  useSyncStore: () => ({ pendingCount: 0, lastSyncedAt: null, refreshStatus: vi.fn().mockResolvedValue(undefined) }),
}));

describe('FeeCollectionTrend — chart toggle', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const store = useDashboardStore();
    // set canonical V4 values
    store.totalCharges = 67121000;
    store.totalPayments = 49177940;
    store.netBalance = 17943060;
    store.collectionRate = 73.3;
  });

  const sampleData = [
    { date: 'Jan 1', total: 10000, count: 5 },
    { date: 'Jan 2', total: 20000, count: 3 },
    { date: 'Jan 3', total: 15000, count: 4 },
  ];

  it('defaults to linear', () => {
    const wrapper = mount(FeeCollectionTrend, { props: { data: sampleData } });
    expect(wrapper.find('[data-testid="chart-mode-linear"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.find('[data-testid="chart-linear"]').exists()).toBe(true);
  });

  it('switches linear → bar → flow → linear with same financial data', async () => {
    const wrapper = mount(FeeCollectionTrend, { props: { data: sampleData } });
    // linear -> bar
    await wrapper.find('[data-testid="chart-mode-bar"]').trigger('click');
    expect(wrapper.find('[data-testid="chart-mode-bar"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.find('[data-testid="chart-bar"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="chart-linear"]').exists()).toBe(false);

    // bar -> flow
    await wrapper.find('[data-testid="chart-mode-flow"]').trigger('click');
    expect(wrapper.find('[data-testid="chart-mode-flow"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.find('[data-testid="chart-flow"]').exists()).toBe(true);
    // flow shows canonical values
    expect(wrapper.find('[data-testid="flow-assessed"]').text()).toContain('67,121,000');
    expect(wrapper.find('[data-testid="flow-collected"]').text()).toContain('49,177,940');
    expect(wrapper.find('[data-testid="flow-outstanding"]').text()).toContain('17,943,060');
    expect(wrapper.find('[data-testid="flow-rate"]').text()).toContain('73.3');

    // flow -> linear
    await wrapper.find('[data-testid="chart-mode-linear"]').trigger('click');
    expect(wrapper.find('[data-testid="chart-linear"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="chart-bar"]').exists()).toBe(false);
  });

  it('uses same financial data across modes (no mutation)', async () => {
    const wrapper = mount(FeeCollectionTrend, { props: { data: sampleData } });
    const store = useDashboardStore();
    const before = { charges: store.totalCharges, collected: store.totalPayments, outstanding: store.netBalance };
    await wrapper.find('[data-testid="chart-mode-bar"]').trigger('click');
    await wrapper.find('[data-testid="chart-mode-flow"]').trigger('click');
    await wrapper.find('[data-testid="chart-mode-linear"]').trigger('click');
    expect(store.totalCharges).toBe(before.charges);
    expect(store.totalPayments).toBe(before.collected);
    expect(store.netBalance).toBe(before.outstanding);
    expect(store.totalCharges).toBe(store.totalPayments + store.netBalance);
  });

  it('renders Lucide icons for toggle and is accessible', () => {
    const wrapper = mount(FeeCollectionTrend, { props: { data: sampleData } });
    const toggle = wrapper.find('[data-testid="chart-mode-toggle"]');
    expect(toggle.exists()).toBe(true);
    expect(toggle.attributes('aria-label')).toBeTruthy();
    for (const mode of ['linear', 'bar', 'flow']) {
      const btn = wrapper.find(`[data-testid="chart-mode-${mode}"]`);
      expect(btn.exists()).toBe(true);
      expect(btn.attributes('aria-label')).toBeTruthy();
    }
  });
});
