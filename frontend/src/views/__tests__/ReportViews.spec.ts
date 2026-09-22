/**
 * Report-view tenant school-context regressions (Reports, Outstanding
 * Fees, Daily Collections).
 *
 * The builders were invoked with a hardcoded 'demo-school' id, producing
 * empty reports on Live. Views must pass the authenticated school id and
 * surface a retryable error when context is missing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const hoisted = vi.hoisted(() => {
  const buildLedgerSchoolReportMock = vi.fn(async () => ({
    outstandingByStudent: [],
    recentPayments: [],
    assessedMinor: 0,
    collectedMinor: 0,
    studentCount: 0,
    outstandingCount: 0,
    paymentCount: 0,
  }));
  const buildDailyCollectionsMock = vi.fn(async () => []);
  const schoolMock = {
    currentSchoolId: 'live-school-9' as string | null,
    error: null as string | null,
    initialized: true,
  };
  return {
    buildLedgerSchoolReportMock,
    buildDailyCollectionsMock,
    schoolMock,
  };
});

const { buildLedgerSchoolReportMock, buildDailyCollectionsMock, schoolMock } = hoisted;

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {}, path: '/reports' }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/stores/schoolStore', () => ({
  useSchoolStore: () => hoisted.schoolMock,
}));

vi.mock('../../lib/ledgerReportBuilder', () => ({
  buildLedgerSchoolReport: hoisted.buildLedgerSchoolReportMock,
  buildDailyCollections: hoisted.buildDailyCollectionsMock,
}));

vi.mock('../../composables/useModuleLock', () => ({
  useModuleLock: () => ({ showLock: false, lockReason: null, canAccessFinancials: true }),
}));

import ReportsView from '../ReportsView.vue';
import OutstandingFeesView from '../OutstandingFeesView.vue';
import DailyCollectionsView from '../DailyCollectionsView.vue';

describe('report views tenant school context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    schoolMock.currentSchoolId = 'live-school-9';
    schoolMock.error = null;
  });

  it('ReportsView builds the fee report for the authenticated school', async () => {
    mount(ReportsView);
    await vi.waitFor(async () => {
      await flushPromises();
      expect(buildLedgerSchoolReportMock).toHaveBeenCalled();
    });
    expect(buildLedgerSchoolReportMock).toHaveBeenCalledWith('live-school-9');
    expect(buildLedgerSchoolReportMock.mock.calls.flat()).not.toContain('demo-school');
  });

  it('OutstandingFeesView queries the authenticated school', async () => {
    mount(OutstandingFeesView);
    await vi.waitFor(async () => {
      await flushPromises();
      expect(buildLedgerSchoolReportMock).toHaveBeenCalled();
    });
    expect(buildLedgerSchoolReportMock).toHaveBeenCalledWith('live-school-9');
  });

  it('DailyCollectionsView queries the authenticated school', async () => {
    mount(DailyCollectionsView);
    await vi.waitFor(async () => {
      await flushPromises();
      expect(buildDailyCollectionsMock).toHaveBeenCalled();
    });
    expect(buildDailyCollectionsMock).toHaveBeenCalledWith('live-school-9');
  });

  it('shows a retryable error and skips the builder when context is missing', async () => {
    schoolMock.currentSchoolId = null;
    const wrapper = mount(ReportsView);
    await flushPromises();
    expect(buildLedgerSchoolReportMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toMatch(/School context is unavailable/);
  });

  it('passes the sandbox demo id through unchanged', async () => {
    schoolMock.currentSchoolId = 'demo-school';
    mount(DailyCollectionsView);
    await vi.waitFor(async () => {
      await flushPromises();
      expect(buildDailyCollectionsMock).toHaveBeenCalled();
    });
    expect(buildDailyCollectionsMock).toHaveBeenCalledWith('demo-school');
  });
});
