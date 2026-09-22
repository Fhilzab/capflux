/**
 * BillingView tenant school-context regressions.
 *
 * The view previously queried and wrote billing data with a hardcoded
 * 'demo-school' id. It must resolve the authenticated school id from the
 * school store, block safely when context is missing, and never emit the
 * demo id on Live (the demo id still flows through unchanged in Sandbox,
 * where the school store itself resolves it).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const hoisted = vi.hoisted(() => {
  const getBillingSummaryMock = vi.fn(async () => ({
    items: [],
    summary: { assessedMinor: 0, collectedMinor: 0, outstandingMinor: 0 },
  }));
  const createChargeMock = vi.fn(async (_payload: Record<string, unknown>) => undefined);
  const loadStudentsMock = vi.fn(async () => undefined);
  const searchStudentsMock = vi.fn(async () => []);
  const schoolMock = {
    currentSchoolId: 'live-school-9' as string | null,
    error: null as string | null,
    initialized: true,
  };
  return {
    getBillingSummaryMock,
    createChargeMock,
    loadStudentsMock,
    searchStudentsMock,
    schoolMock,
    billingMock: { getBillingSummary: getBillingSummaryMock, createCharge: createChargeMock },
    studentMock: {
      loadStudents: loadStudentsMock,
      students: [] as Array<{ id: string; firstName: string; lastName: string }>,
      searchStudents: searchStudentsMock,
    },
  };
});

const { getBillingSummaryMock, createChargeMock, searchStudentsMock, schoolMock } = hoisted;

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/stores/billingStore', () => ({
  useBillingStore: () => hoisted.billingMock,
}));

vi.mock('@/stores/studentStore', () => ({
  useStudentStore: () => hoisted.studentMock,
}));

vi.mock('@/stores/schoolStore', () => ({
  useSchoolStore: () => hoisted.schoolMock,
}));

vi.mock('../../composables/useModuleLock', () => ({
  useModuleLock: () => ({ showLock: false, lockReason: null, canAccessFinancials: true }),
}));

import BillingView from '../BillingView.vue';

const clickButton = async (wrapper: ReturnType<typeof mount>, text: string) => {
  const btn = wrapper.findAll('button').find((b) => b.text().includes(text));
  expect(btn?.exists()).toBe(true);
  await btn!.trigger('click');
  await flushPromises();
};

describe('BillingView tenant school context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    schoolMock.currentSchoolId = 'live-school-9';
    schoolMock.error = null;
    schoolMock.initialized = true;
    hoisted.studentMock.students = [{ id: 's1', firstName: 'Ada', lastName: 'Obi' }];
    getBillingSummaryMock.mockResolvedValue({
      items: [],
      summary: { assessedMinor: 0, collectedMinor: 0, outstandingMinor: 0 },
    });
    searchStudentsMock.mockResolvedValue([]);
  });

  it('loads the billing summary with the authenticated school id', async () => {
    const wrapper = mount(BillingView);
    await vi.waitFor(async () => {
      await flushPromises();
      expect(getBillingSummaryMock).toHaveBeenCalled();
    });
    expect(getBillingSummaryMock).toHaveBeenCalledWith('live-school-9', []);
    expect(
      getBillingSummaryMock.mock.calls.flat(2),
    ).not.toContain('demo-school');
  });

  it('searches students within the authenticated school', async () => {
    const wrapper = mount(BillingView);
    await flushPromises();
    await wrapper.find('input[placeholder="Search students"]').setValue('Ada');
    await clickButton(wrapper, 'Filter');
    expect(searchStudentsMock).toHaveBeenCalledWith('live-school-9', 'Ada');
  });

  it('writes charges with the authenticated school id', async () => {
    const wrapper = mount(BillingView);
    await flushPromises();
    const studentSelect = wrapper.find('select');
    expect(studentSelect.exists()).toBe(true);
    await studentSelect.setValue('s1');
    await wrapper.find('input[type="number"]').setValue('5000');
    await clickButton(wrapper, 'Save charge');
    expect(createChargeMock).toHaveBeenCalledTimes(1);
    expect(createChargeMock.mock.calls[0]![0]).toMatchObject({
      school_id: 'live-school-9',
      student_id: 's1',
    });
  });

  it('blocks reads and writes when school context is missing', async () => {
    schoolMock.currentSchoolId = null;
    const wrapper = mount(BillingView);
    await flushPromises();
    expect(getBillingSummaryMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toMatch(/School context is unavailable/);
    const selects = wrapper.findAll('select');
    if (selects.length > 0) {
      const studentSelect = wrapper.find('select');
      await studentSelect.setValue('s1');
      await wrapper.find('input[type="number"]').setValue('5000');
      await clickButton(wrapper, 'Save charge');
    }
    expect(createChargeMock).not.toHaveBeenCalled();
  });

  it('passes the sandbox demo id through unchanged', async () => {
    schoolMock.currentSchoolId = 'demo-school';
    const wrapper = mount(BillingView);
    await vi.waitFor(async () => {
      await flushPromises();
      expect(getBillingSummaryMock).toHaveBeenCalled();
    });
    expect(getBillingSummaryMock).toHaveBeenCalledWith('demo-school', []);
  });
});
