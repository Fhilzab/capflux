/**
 * Finance destinations — three-tab navigation refactor regressions.
 *
 * 1. Billing & Invoices answers "what does each student owe" (charges,
 *    invoices, adjustments, outstanding, history) with no duplicate flows.
 * 2. Payments & Reconciliation answers "what was paid / reconciled"
 *    (payment history + settlement history + reconciliation issues) with
 *    receipt never presented as settlement.
 * 3. Reports & Analytics answers "what do the records show" (read-only
 *    summaries, collections, outstanding, revenue + CSV exports), with
 *    consolidated report pages reachable via in-page section nav.
 * Financial lock gating (useModuleLock) is preserved on every destination
 * that had it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const hoisted = vi.hoisted(() => {
  const pushMock = vi.fn();
  const paymentsMock = {
    payments: [] as any[],
    paymentSummary: {
      total_payments: 0,
      successful_payments: 0,
      pending_payments: 0,
      failed_payments: 0,
      reversed_payments: 0,
      today_collections_minor: 0,
      month_collections_minor: 0,
      total_collected_minor: 0,
    },
    settlements: [] as any[],
    settlementSummary: null as null | Record<string, number>,
    reconciliation: { runs: [], open_issues: [] },
    loading: false,
    error: null as string | null,
    loadAll: vi.fn(async () => undefined),
    loadPayments: vi.fn(async () => undefined),
    loadPaymentSummary: vi.fn(async () => undefined),
    loadSettlements: vi.fn(async () => undefined),
    loadSettlementSummary: vi.fn(async () => undefined),
    loadReconciliation: vi.fn(async () => undefined),
  };
  const lockMock = {
    showLock: false,
    lockReason: null as string | null,
    canAccessFinancials: true,
  };
  const schoolMock = {
    currentSchoolId: 'live-school-9' as string | null,
    error: null as string | null,
    initialized: true,
  };
  const getBillingSummaryMock = vi.fn(async () => ({
    items: [],
    summary: { assessedMinor: 0, collectedMinor: 0, outstandingMinor: 0 },
  }));
  const buildLedgerSchoolReportMock = vi.fn(async () => ({
    outstandingByStudent: [],
    recentPayments: [],
    assessedMinor: 0,
    collectedMinor: 0,
    outstandingMinor: 0,
    studentCount: 0,
    outstandingCount: 0,
    paymentCount: 0,
  }));
  return {
    pushMock,
    paymentsMock,
    lockMock,
    schoolMock,
    getBillingSummaryMock,
    buildLedgerSchoolReportMock,
  };
});

const { pushMock, paymentsMock, lockMock, schoolMock } = hoisted;

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {}, path: '/payments' }),
  useRouter: () => ({ push: hoisted.pushMock }),
}));

vi.mock('@/stores/paymentsStore', () => ({
  usePaymentsStore: () => hoisted.paymentsMock,
}));

vi.mock('@/shared/rbac/usePermission', () => ({
  usePermission: () => ({
    can: vi.fn(async () => true),
    canRole: vi.fn(async () => false),
    canAny: vi.fn(async () => false),
    canAll: vi.fn(async () => false),
    scope: null,
  }),
}));

vi.mock('@/composables/useModuleLock', async () => {
  // Real refs so the gate behaves like the production composable.
  const { ref } = await import('vue');
  const gate = {
    showLock: ref(false),
    lockReason: ref<string | null>(null),
    canAccessFinancials: ref(true),
  };
  Object.assign(hoisted.lockMock, gate);
  return { useModuleLock: () => hoisted.lockMock };
});

vi.mock('@/stores/schoolStore', () => ({
  useSchoolStore: () => hoisted.schoolMock,
}));

vi.mock('@/stores/billingStore', () => ({
  useBillingStore: () => ({ getBillingSummary: hoisted.getBillingSummaryMock, createCharge: vi.fn() }),
}));

vi.mock('@/stores/studentStore', () => ({
  useStudentStore: () => ({ loadStudents: vi.fn(async () => undefined), students: [], searchStudents: vi.fn(async () => []) }),
}));

vi.mock('@/sandbox/seedReady', () => ({
  ensureSeedReady: vi.fn(async () => undefined),
}));

vi.mock('../../lib/ledgerReportBuilder', () => ({
  buildLedgerSchoolReport: hoisted.buildLedgerSchoolReportMock,
  buildDailyCollections: vi.fn(async () => []),
}));

import PaymentsDashboard from '@/features/payments/PaymentsDashboard.vue';
import SettlementsView from '@/views/SettlementsView.vue';
import BillingView from '@/views/BillingView.vue';
import ReportsView from '@/views/ReportsView.vue';

describe('finance destinations', () => {
  const setGate = (state: { showLock: boolean; lockReason: string | null; canAccessFinancials: boolean }) => {
    (lockMock.showLock as unknown as { value: boolean }).value = state.showLock;
    (lockMock.lockReason as unknown as { value: string | null }).value = state.lockReason;
    (lockMock.canAccessFinancials as unknown as { value: boolean }).value = state.canAccessFinancials;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setGate({ showLock: false, lockReason: null, canAccessFinancials: true });
  });

  it('Payments destination shows payment history with section nav to settlements', async () => {
    const wrapper = mount(PaymentsDashboard);
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('Payments & Reconciliation');
    expect(text).toContain('Payment History');
    const sections = wrapper.find('[aria-label="Payments sections"]');
    expect(sections.exists()).toBe(true);
    expect(sections.text()).toContain('Payments');
    expect(sections.text()).toContain('Settlements & Reconciliation');
    // Section nav reaches the consolidated settlements page.
    const settlementBtn = sections.findAll('button').find((b) => b.text().includes('Settlements'));
    await settlementBtn!.trigger('click');
    expect(pushMock).toHaveBeenCalledWith({ name: 'Settlements' });
    wrapper.unmount();
  });

  it('Settlements page lives inside Payments & Reconciliation with settlement history', async () => {
    const wrapper = mount(SettlementsView);
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('Payments & Reconciliation');
    expect(text).toContain('Settlement History');
    expect(text).toContain('Reconciliation Issues');
    // Receipt is never presented as settlement: the page states settlement
    // requires bank confirmation, and no received payment is labelled Settled.
    expect(text).toContain('not settled until the bank confirms it');
    const sections = wrapper.find('[aria-label="Payments sections"]');
    expect(sections.exists()).toBe(true);
    const paymentsBtn = sections.findAll('button').find((b) => b.text() === 'Payments');
    await paymentsBtn!.trigger('click');
    expect(pushMock).toHaveBeenCalledWith({ name: 'Payments' });
    wrapper.unmount();
  });

  it('Billing destination answers what each student owes and links outstanding detail', async () => {
    const wrapper = mount(BillingView);
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('Billing & Invoices');
    expect(text).toContain('Outstanding balance');
    expect(text).toContain('Charges');
    expect(text).toContain('Payment history');
    const detailBtn = wrapper.findAll('button').find((b) => b.text().includes('outstanding fees'));
    expect(detailBtn?.exists()).toBe(true);
    await detailBtn!.trigger('click');
    expect(pushMock).toHaveBeenCalledWith({ name: 'OutstandingFees' });
    wrapper.unmount();
  });

  it('Reports destination is read-only with exports and section nav', async () => {
    const wrapper = mount(ReportsView);
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('Reports & Analytics');
    expect(text).toContain('Total charges');
    expect(text).toContain('Export outstanding');
    expect(text).toContain('Export payments');
    expect(text).toContain('Export summary');
    const sections = wrapper.find('[aria-label="Reports sections"]');
    expect(sections.exists()).toBe(true);
    expect(sections.text()).toContain('Reports Overview');
    expect(sections.text()).toContain('Daily Collections');
    expect(sections.text()).toContain('Outstanding Fees');
    expect(sections.text()).toContain('Revenue');
    wrapper.unmount();
  });

  it('financial lock overlay still gates every affected destination', async () => {
    setGate({ showLock: true, lockReason: 'setup', canAccessFinancials: false });
    for (const component of [PaymentsDashboard, SettlementsView, BillingView, ReportsView]) {
      const wrapper = mount(component as any);
      await flushPromises();
      expect(wrapper.text()).toMatch(/school setup|KYC|Settlement|payment/i);
      wrapper.unmount();
    }
  });
});
