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
  const canPermissionMock = vi.fn(async (_permission: string) => true);
  const schoolMock = {
    currentSchoolId: 'live-school-9' as string | null,
    error: null as string | null,
    initialized: true,
  };
  const lockMock = {
    showLock: false,
    lockReason: null as string | null,
    canAccessFinancials: true,
  };
  return {
    buildLedgerSchoolReportMock,
    buildDailyCollectionsMock,
    canPermissionMock,
    schoolMock,
    lockMock,
  };
});

const { buildLedgerSchoolReportMock, buildDailyCollectionsMock, canPermissionMock, schoolMock, lockMock } = hoisted;

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

vi.mock('../../shared/rbac/usePermission', () => ({
  usePermission: () => ({
    can: hoisted.canPermissionMock,
    canRole: vi.fn(async () => false),
    canAny: vi.fn(async () => false),
    canAll: vi.fn(async () => false),
    scope: null,
  }),
}));

vi.mock('../../composables/useModuleLock', async () => {
  // Real refs so the gate behaves like the production composable: script
  // `.value` reads work and watchers fire when tests mutate lock state.
  const { ref } = await import('vue');
  const showLock = ref(false);
  const lockReason = ref<string | null>(null);
  const canAccessFinancials = ref(true);
  const gate = { showLock, lockReason, canAccessFinancials };
  Object.assign(hoisted.lockMock, gate);
  return { useModuleLock: () => hoisted.lockMock };
});

import ReportsView from '../ReportsView.vue';
import OutstandingFeesView from '../OutstandingFeesView.vue';
import DailyCollectionsView from '../DailyCollectionsView.vue';

/** Mutate the reactive gate refs (populated by the async mock above). */
function setGate(state: { showLock: boolean; lockReason: string | null; canAccessFinancials: boolean }) {
  (lockMock.showLock as unknown as { value: boolean }).value = state.showLock;
  (lockMock.lockReason as unknown as { value: string | null }).value = state.lockReason;
  (lockMock.canAccessFinancials as unknown as { value: boolean }).value = state.canAccessFinancials;
}

describe('report views tenant school context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    schoolMock.currentSchoolId = 'live-school-9';
    schoolMock.error = null;
    canPermissionMock.mockResolvedValue(true);
    setGate({ showLock: false, lockReason: null, canAccessFinancials: true });
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

describe('ReportsView financial gate', () => {
  const overlayTitles: Record<string, string> = {
    setup: 'Setup Required',
    kyc: 'KYC Verification Required',
    settlement: 'Settlement Verification Required',
    payment: 'Payments Locked',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    schoolMock.currentSchoolId = 'live-school-9';
    schoolMock.error = null;
    canPermissionMock.mockResolvedValue(true);
    setGate({ showLock: false, lockReason: null, canAccessFinancials: true });
  });

  it.each(Object.entries(overlayTitles))(
    'shows the %s lock overlay without loading financial data',
    async (reason, title) => {
      setGate({ showLock: true, lockReason: reason, canAccessFinancials: false });
      const wrapper = mount(ReportsView);
      await flushPromises();
      expect(wrapper.text()).toContain(title);
      expect(wrapper.text()).not.toContain('Total charges');
      expect(wrapper.text()).not.toContain('Outstanding by student');
      expect(wrapper.text()).not.toContain('Recent payments');
      expect(wrapper.text()).not.toContain('Export outstanding');
      expect(buildLedgerSchoolReportMock).not.toHaveBeenCalled();
      wrapper.unmount();
    },
  );

  it('loads the report when access is granted after resolving', async () => {
    setGate({ showLock: false, lockReason: null, canAccessFinancials: false });
    const wrapper = mount(ReportsView);
    await flushPromises();
    expect(buildLedgerSchoolReportMock).not.toHaveBeenCalled();
    expect(wrapper.text()).not.toContain('Total charges');

    setGate({ showLock: false, lockReason: null, canAccessFinancials: true });
    await vi.waitFor(async () => {
      await flushPromises();
      expect(buildLedgerSchoolReportMock).toHaveBeenCalledWith('live-school-9');
    });
    expect(wrapper.text()).toContain('Total charges');
    expect(wrapper.text()).toContain('Export outstanding');
    expect(wrapper.text()).toContain('Export payments');
    expect(wrapper.text()).toContain('Export summary');
    expect(wrapper.find('[aria-label="Reports sections"]').exists()).toBe(true);
    wrapper.unmount();
  });
});

describe('report export authorization (reports.export)', () => {
  const createObjectURLMock = vi.fn(() => 'blob:mock-url');
  const revokeObjectURLMock = vi.fn();
  const anchorClickMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    schoolMock.currentSchoolId = 'live-school-9';
    schoolMock.error = null;
    canPermissionMock.mockResolvedValue(true);
    setGate({ showLock: false, lockReason: null, canAccessFinancials: true });
    URL.createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURLMock;
    HTMLAnchorElement.prototype.click = anchorClickMock as unknown as () => void;
  });

  const clickButton = async (wrapper: ReturnType<typeof mount>, text: string) => {
    const btn = wrapper.findAll('button').find((b) => b.text().includes(text));
    expect(btn?.exists()).toBe(true);
    await btn!.trigger('click');
    await flushPromises();
  };

  it('authorized export proceeds for every ReportsView export action', async () => {
    const wrapper = mount(ReportsView);
    await vi.waitFor(async () => {
      await flushPromises();
      expect(buildLedgerSchoolReportMock).toHaveBeenCalled();
    });
    for (const label of ['Export outstanding', 'Export payments', 'Export summary']) {
      await clickButton(wrapper, label);
      expect(canPermissionMock).toHaveBeenCalledWith('reports.export');
    }
    expect(createObjectURLMock).toHaveBeenCalledTimes(3);
    wrapper.unmount();
  });

  it('blocks ReportsView exports without reports.export at the action boundary', async () => {
    canPermissionMock.mockResolvedValue(false);
    const wrapper = mount(ReportsView);
    await vi.waitFor(async () => {
      await flushPromises();
      expect(buildLedgerSchoolReportMock).toHaveBeenCalled();
    });
    // Buttons render disabled, and triggering the action still cannot export.
    for (const label of ['Export outstanding', 'Export payments', 'Export summary']) {
      const btn = wrapper.findAll('button').find((b) => b.text().includes(label));
      expect(btn?.attributes('disabled')).toBeDefined();
      await btn!.trigger('click');
      await flushPromises();
    }
    expect(createObjectURLMock).not.toHaveBeenCalled();
    // Viewing itself is unaffected: report content still renders.
    expect(wrapper.text()).toContain('Total charges');
    wrapper.unmount();
  });

  it('authorized Daily Collections export proceeds', async () => {
    buildDailyCollectionsMock.mockResolvedValueOnce([
      { date: '2026-09-01', collectedMinor: 500000, count: 2 },
    ]);
    const wrapper = mount(DailyCollectionsView);
    await vi.waitFor(async () => {
      await flushPromises();
      expect(buildDailyCollectionsMock).toHaveBeenCalled();
    });
    await clickButton(wrapper, 'Export CSV');
    expect(canPermissionMock).toHaveBeenCalledWith('reports.export');
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('blocks Daily Collections export without reports.export', async () => {
    canPermissionMock.mockResolvedValue(false);
    const wrapper = mount(DailyCollectionsView);
    await vi.waitFor(async () => {
      await flushPromises();
      expect(buildDailyCollectionsMock).toHaveBeenCalled();
    });
    const btn = wrapper.findAll('button').find((b) => b.text().includes('Export CSV'));
    expect(btn?.attributes('disabled')).toBeDefined();
    await btn!.trigger('click');
    await flushPromises();
    expect(createObjectURLMock).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('authorized Outstanding Fees export proceeds', async () => {
    buildLedgerSchoolReportMock.mockResolvedValueOnce({
      outstandingByStudent: [
        {
          student_id: 's1',
          student_name: 'Ada Obi',
          class_name: 'JSS1',
          admission_number: 'A1',
          assessedMinor: 500000,
          collectedMinor: 200000,
          outstandingMinor: 300000,
        },
      ],
      recentPayments: [],
      assessedMinor: 500000,
      collectedMinor: 200000,
      outstandingMinor: 300000,
      studentCount: 1,
      outstandingCount: 1,
      paymentCount: 0,
    });
    const wrapper = mount(OutstandingFeesView);
    await vi.waitFor(async () => {
      await flushPromises();
      expect(buildLedgerSchoolReportMock).toHaveBeenCalled();
    });
    await clickButton(wrapper, 'Export CSV');
    expect(canPermissionMock).toHaveBeenCalledWith('reports.export');
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('blocks Outstanding Fees export without reports.export', async () => {
    canPermissionMock.mockResolvedValue(false);
    const wrapper = mount(OutstandingFeesView);
    await vi.waitFor(async () => {
      await flushPromises();
      expect(buildLedgerSchoolReportMock).toHaveBeenCalled();
    });
    const btn = wrapper.findAll('button').find((b) => b.text().includes('Export CSV'));
    expect(btn?.attributes('disabled')).toBeDefined();
    await btn!.trigger('click');
    await flushPromises();
    expect(createObjectURLMock).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('locked Daily Collections and Outstanding Fees offer no export path', async () => {
    // Sibling views keep their pre-existing P1-A behavior (overlay covers all
    // actions); the export action boundary is additionally permission-guarded.
    setGate({ showLock: true, lockReason: 'setup', canAccessFinancials: false });
    for (const component of [DailyCollectionsView, OutstandingFeesView]) {
      const wrapper = mount(component as unknown as object);
      await flushPromises();
      expect(wrapper.text()).toContain('Setup Required');
      expect(wrapper.text()).not.toContain('Export CSV');
      wrapper.unmount();
    }
    expect(createObjectURLMock).not.toHaveBeenCalled();
  });
});
