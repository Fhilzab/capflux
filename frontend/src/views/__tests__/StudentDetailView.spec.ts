/**
 * StudentDetailView.spec.ts — unified student workspace (no redundant tabs).
 *
 * Stores + localDb are mocked at the module boundary; the canonical
 * ledger-semantics lib is real so Expected/Paid/Outstanding math is tested.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const pushMock = vi.fn();

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'stu-1' }, query: {}, path: '/students/stu-1' }),
  useRouter: () => ({ push: pushMock }),
}));

const state = vi.hoisted(() => {
  const CHARGE = {
    id: 'e-charge-1',
    student_id: 'stu-1',
    entry_type: 'CHARGE',
    entry_direction: 'DEBIT',
    entry_category: 'TUITION',
    entry_description: 'Term fees',
    amount_minor: 25000000,
    occurred_at: '2026-09-01T00:00:00.000Z',
  };
  const PAY_1 = {
    id: 'e-pay-1',
    student_id: 'stu-1',
    entry_type: 'PAYMENT',
    entry_direction: 'CREDIT',
    entry_category: 'PAYMENT',
    entry_description: 'Bank transfer',
    amount_minor: 15500000,
    occurred_at: '2026-09-12T00:00:00.000Z',
  };
  const PAY_2 = {
    id: 'e-pay-2',
    student_id: 'stu-1',
    entry_type: 'PAYMENT',
    entry_direction: 'CREDIT',
    entry_category: 'PAYMENT',
    entry_description: 'Cash',
    amount_minor: 5000000,
    occurred_at: '2026-09-18T00:00:00.000Z',
  };
  return {
    CHARGE,
    PAY_1,
    PAY_2,
    ledger: [CHARGE, PAY_1, PAY_2] as any[],
    ledgerError: null as string | null,
    dvaAccounts: [] as any[],
    studentFields: {} as Record<string, any>,
  };
});

const { CHARGE, PAY_1, PAY_2 } = state;

vi.mock('@/offline/localDb', () => ({
  db: {
    students: {
      get: async (id: string) =>
        id === 'stu-1'
          ? {
              id: 'stu-1',
              school_id: 'school-1',
              first_name: 'John',
              last_name: 'Doe',
              admission_number: 'STU-00124',
              status: 'ACTIVE',
              gender: 'Male',
              admission_date: '2026-09-01T00:00:00.000Z',
              guardian_id: null,
              ...state.studentFields,
            }
          : undefined,
    },
    guardians: { get: async () => null },
  },
}));

vi.mock('@/stores/studentStore', () => ({
  useStudentStore: () => ({
    updateStudent: vi.fn(async () => true),
    deactivateStudent: vi.fn(async () => true),
    activateStudent: vi.fn(async () => true),
    error: null,
  }),
}));

vi.mock('@/stores/billingStore', () => ({
  useBillingStore: () => ({
    loadStudentLedger: vi.fn(async () => [...state.ledger]),
    createCharge: vi.fn(async () => undefined),
    get error() {
      return state.ledgerError;
    },
  }),
}));

vi.mock('@/stores/enrollmentStore', () => ({
  useEnrollmentStore: () => ({
    current: {
      'stu-1': {
        enrollment: { id: 'enr-1', status: 'ACTIVE' },
        session: { name: '2026/27' },
        section: { name: 'Secondary' },
        level: { name: 'JSS 2' },
      },
    },
    history: { 'stu-1': [] },
    loadHistory: vi.fn(async () => undefined),
    error: null,
  }),
}));

vi.mock('@/stores/academicStore', () => ({
  useAcademicStore: () => ({ initialize: vi.fn(async () => undefined) }),
}));

vi.mock('@/stores/divisionStore', () => ({
  useDivisionStore: () => ({ divisions: [], initialize: vi.fn(async () => undefined) }),
}));

vi.mock('@/stores/guardianStore', () => ({
  useGuardianStore: () => ({
    initialize: vi.fn(async () => undefined),
    loadLinksForStudent: vi.fn(async () => undefined),
  }),
}));

vi.mock('@/stores/paymentsStore', () => ({
  usePaymentsStore: () => ({
    dvAccounts: state.dvaAccounts,
    loadDVAccounts: vi.fn(async () => undefined),
    provisionDVA: vi.fn(async () => undefined),
    error: null,
  }),
}));

import StudentDetailView from '@/views/StudentDetailView.vue';

async function mountDetail() {
  const wrapper = mount(StudentDetailView, {
    global: {
      plugins: [createPinia()],
      stubs: {
        StudentGuardiansCard: {
          template: '<div data-testid="guardians-stub">guardians</div>',
        },
        AcademicHistoryList: {
          template: '<div data-testid="history-stub">history</div>',
        },
        StudentMovementModal: {
          template: '<div />',
        },
      },
    },
  });
  await flushPromises();
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  setActivePinia(createPinia());
  pushMock.mockClear();
  state.ledger = [CHARGE, PAY_1, PAY_2];
  state.ledgerError = null;
  state.dvaAccounts = [];
  state.studentFields = {};
});

describe('StudentDetailView unified workspace', () => {
  it('renders identity, financial position and contextual sections without tab navigation', async () => {
    const wrapper = await mountDetail();
    const text = wrapper.text();
    expect(text).toContain('John Doe');
    expect(text).toContain('STU-00124');
    expect(text).toContain('Financial position');
    expect(text).toContain('Student information');
    expect(text).toContain('Virtual account');
    expect(text).toContain('Recent payments');
    expect(text).toContain('Academic history');
    // No redundant primary tabs.
    expect(wrapper.find('nav').exists()).toBe(false);
    wrapper.unmount();
  });

  it('derives Expected / Paid / Outstanding from the ledger in kobo', async () => {
    const wrapper = await mountDetail();
    const text = wrapper.text();
    expect(text).toContain('₦250,000');
    expect(text).toContain('₦205,000');
    expect(text).toContain('₦45,000');
    expect(text).toContain('Partially paid');
    expect(text).toContain('82% collected');
    wrapper.unmount();
  });

  it('labels a fully-paid student Paid and distinguishes no-payment states', async () => {
    state.ledger = [CHARGE, { ...PAY_1, amount_minor: 25000000 }];
    const paid = await mountDetail();
    expect(paid.text()).toContain('Paid');
    paid.unmount();

    state.ledger = [CHARGE];
    const unpaid = await mountDetail();
    expect(unpaid.text()).toContain('No payments recorded yet');
    unpaid.unmount();

    state.ledger = [];
    const empty = await mountDetail();
    expect(empty.text()).toContain('No billing records');
    empty.unmount();
  });

  it('routes View billing with preserved student context', async () => {
    const wrapper = await mountDetail();
    const buttons = wrapper.findAll('button');
    await buttons.find((b) => b.text() === 'View billing')!.trigger('click');
    expect(pushMock).toHaveBeenCalledWith({ name: 'Billing', query: { student: 'stu-1' } });
    wrapper.unmount();
  });

  it('routes View all payments with preserved student context', async () => {
    const wrapper = await mountDetail();
    const buttons = wrapper.findAll('button');
    await buttons.find((b) => b.text() === 'View all payments')!.trigger('click');
    expect(pushMock).toHaveBeenCalledWith({ name: 'Payments', query: { student: 'stu-1' } });
    wrapper.unmount();
  });

  it('routes View account with preserved student context and masks the number', async () => {
    state.studentFields = {
      dva_account_number: '1234567890',
      dva_bank_name: 'Test Bank',
    };
    const wrapper = await mountDetail();
    expect(wrapper.text()).toContain('•••• •••• 7890');
    expect(wrapper.text()).not.toContain('1234567890');
    const buttons = wrapper.findAll('button');
    await buttons.find((b) => b.text() === 'View account')!.trigger('click');
    expect(pushMock).toHaveBeenCalledWith({
      name: 'VirtualAccounts',
      query: { student: 'stu-1' },
    });
    wrapper.unmount();
  });

  it('shows not-provisioned state with a provision action when no account exists', async () => {
    const wrapper = await mountDetail();
    expect(wrapper.text()).toContain('Not provisioned yet');
    expect(wrapper.text()).toContain('Provision account');
    wrapper.unmount();
  });
});
