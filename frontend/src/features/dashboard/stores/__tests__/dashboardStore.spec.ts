import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useDashboardStore } from '../dashboardStore';

// Mock repositories
vi.mock('../../../../shared/repositories/StudentRepository', () => ({
  StudentRepository: {
    getStudentsBySchool: vi.fn(),
  },
}));
vi.mock('../../../../shared/repositories/GuardianRepository', () => ({
  GuardianRepository: { getBySchool: vi.fn() },
}));
vi.mock('../../../../shared/repositories/LedgerRepository', () => ({
  LedgerRepository: { getEntriesBySchool: vi.fn() },
}));
vi.mock('../../../../shared/repositories/PaymentAccountRepository', () => ({
  PaymentAccountRepository: { getBySchool: vi.fn() },
}));
vi.mock('../../../../shared/repositories/NotificationRepository', () => ({
  NotificationRepository: { getBySchool: vi.fn() },
}));
vi.mock('../../../../stores/syncStore', () => ({
  useSyncStore: () => ({
    pendingCount: 0,
    lastSyncedAt: null,
    refreshStatus: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { StudentRepository } from '../../../../shared/repositories/StudentRepository';
import { GuardianRepository } from '../../../../shared/repositories/GuardianRepository';
import { LedgerRepository } from '../../../../shared/repositories/LedgerRepository';
import { PaymentAccountRepository } from '../../../../shared/repositories/PaymentAccountRepository';
import { NotificationRepository } from '../../../../shared/repositories/NotificationRepository';

function ledgerCharge(studentId: string, minor: number, opts: Partial<Record<string, unknown>> = {}) {
  return {
    id: `led-${studentId}-${minor}`,
    student_id: studentId,
    entry_type: 'CHARGE',
    entry_direction: 'DEBIT',
    amount_minor: minor,
    amount: minor / 100,
    created_at: new Date().toISOString(),
    occurred_at: new Date().toISOString(),
    metadata: {},
    ...opts,
  };
}
function ledgerPayment(studentId: string, minor: number, opts: Partial<Record<string, unknown>> = {}) {
  return {
    id: `led-pay-${studentId}-${minor}-${Math.random()}`,
    student_id: studentId,
    entry_type: 'PAYMENT',
    entry_direction: 'CREDIT',
    amount_minor: minor,
    amount: minor / 100,
    created_at: new Date().toISOString(),
    occurred_at: new Date().toISOString(),
    metadata: { verified: true },
    ...opts,
  };
}
function ledgerReversal(studentId: string, minor: number) {
  return {
    id: `led-rev-${studentId}-${minor}`,
    student_id: studentId,
    entry_type: 'REVERSAL',
    entry_direction: 'DEBIT',
    amount_minor: minor,
    amount: minor / 100,
    created_at: new Date().toISOString(),
    occurred_at: new Date().toISOString(),
    metadata: {},
  };
}

describe('dashboardStore — ledger semantics (V4 regression)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    (PaymentAccountRepository.getBySchool as any).mockResolvedValue([]);
    (NotificationRepository.getBySchool as any).mockResolvedValue([]);
    (GuardianRepository.getBySchool as any).mockResolvedValue([]);
  });

  it('CHARGE debit is assessed, not collected', async () => {
    const store = useDashboardStore();
    const students: any[] = [{ id: 's1', first_name: 'A', last_name: 'B', class_name: 'Primary 1', guardian: {} }];
    (StudentRepository.getStudentsBySchool as any).mockResolvedValue(students);
    (GuardianRepository.getBySchool as any).mockResolvedValue([{ id: 'g1' }]);
    (LedgerRepository.getEntriesBySchool as any).mockResolvedValue([ledgerCharge('s1', 100000)]); // ₦1000

    await store.fetchDashboardData();
    expect(store.totalCharges).toBe(1000);
    expect(store.totalPayments).toBe(0);
    expect(store.netBalance).toBe(1000);
  });

  it('PAYMENT credit is collected', async () => {
    const store = useDashboardStore();
    const students: any[] = [{ id: 's1', first_name: 'A', last_name: 'B', class_name: 'Primary 1', guardian: {} }];
    (StudentRepository.getStudentsBySchool as any).mockResolvedValue(students);
    (LedgerRepository.getEntriesBySchool as any).mockResolvedValue([
      ledgerCharge('s1', 100000),
      ledgerPayment('s1', 60000),
    ]);

    await store.fetchDashboardData();
    expect(store.totalCharges).toBe(1000);
    expect(store.totalPayments).toBe(600);
    expect(store.netBalance).toBe(400);
    expect(store.collectionRate).toBeCloseTo(60);
  });

  it('REVERSAL debit reduces collected amount', async () => {
    const store = useDashboardStore();
    const students: any[] = [{ id: 's1', first_name: 'A', last_name: 'B', class_name: 'Primary 1', guardian: {} }];
    (StudentRepository.getStudentsBySchool as any).mockResolvedValue(students);
    (LedgerRepository.getEntriesBySchool as any).mockResolvedValue([
      ledgerCharge('s1', 100000),
      ledgerPayment('s1', 100000),
      ledgerReversal('s1', 40000),
    ]);
    await store.fetchDashboardData();
    expect(store.totalPayments).toBe(600); // 1000 - 400
    expect(store.netBalance).toBe(400);
  });

  it('assessed = collected + outstanding', async () => {
    const store = useDashboardStore();
    const students: any[] = [
      { id: 's1', first_name: 'A', last_name: 'B', class_name: 'Primary 1', guardian: {} },
      { id: 's2', first_name: 'C', last_name: 'D', class_name: 'Primary 1', guardian: {} },
    ];
    (StudentRepository.getStudentsBySchool as any).mockResolvedValue(students);
    (LedgerRepository.getEntriesBySchool as any).mockResolvedValue([
      ledgerCharge('s1', 100000),
      ledgerPayment('s1', 60000),
      ledgerCharge('s2', 200000),
      ledgerPayment('s2', 200000),
    ]);
    await store.fetchDashboardData();
    expect(store.totalCharges).toBe(store.totalPayments + store.netBalance);
  });

  it('collection rate is correct and 0 when assessed is 0', async () => {
    const store = useDashboardStore();
    (StudentRepository.getStudentsBySchool as any).mockResolvedValue([]);
    (LedgerRepository.getEntriesBySchool as any).mockResolvedValue([]);
    await store.fetchDashboardData();
    expect(store.collectionRate).toBe(0);
    // with data
    (StudentRepository.getStudentsBySchool as any).mockResolvedValue([{ id: 's1', first_name: 'A', last_name: 'B', class_name: 'P1', guardian: {} }]);
    (LedgerRepository.getEntriesBySchool as any).mockResolvedValue([
      ledgerCharge('s1', 200000),
      ledgerPayment('s1', 50000),
    ]);
    await store.fetchDashboardData();
    expect(store.collectionRate).toBeCloseTo(25);
  });

  it('outstanding balances are non-negative and filtered correctly', async () => {
    const store = useDashboardStore();
    const students: any[] = [
      { id: 's1', first_name: 'A', last_name: 'B', class_name: 'Primary 1', guardian: {} },
      { id: 's2', first_name: 'C', last_name: 'D', class_name: 'Primary 1', guardian: {} },
    ];
    (StudentRepository.getStudentsBySchool as any).mockResolvedValue(students);
    (LedgerRepository.getEntriesBySchool as any).mockResolvedValue([
      ledgerCharge('s1', 100000),
      ledgerPayment('s1', 100000), // fully paid -> not in outstanding
      ledgerCharge('s2', 100000),
      ledgerPayment('s2', 30000),
    ]);
    await store.fetchDashboardData();
    expect(store.outstandingByStudent.length).toBe(1);
    expect(store.outstandingByStudent[0].student_id).toBe('s2');
    expect(store.outstandingByStudent[0].outstanding).toBe(700);
    expect(store.outstandingStudentCount).toBe(1);
    for (const s of store.outstandingByStudent) expect(s.outstanding).toBeGreaterThan(0);
  });

  it('recent payments are not empty when PAYMENT credits exist and use correct semantics', async () => {
    const store = useDashboardStore();
    (StudentRepository.getStudentsBySchool as any).mockResolvedValue([{ id: 's1', first_name: 'A', last_name: 'B', class_name: 'P1', guardian: { full_name: 'G1' } }]);
    (LedgerRepository.getEntriesBySchool as any).mockResolvedValue([
      ledgerCharge('s1', 50000),
      ledgerPayment('s1', 50000),
      ledgerCharge('s1', 50000), // should not appear in recent payments
    ]);
    await store.fetchDashboardData();
    expect(store.recentPayments.length).toBe(1);
    expect((store.recentPayments[0] as any).entry_type).toBe('PAYMENT');
  });

  it('trend data excludes CHARGE entries', async () => {
    const store = useDashboardStore();
    (StudentRepository.getStudentsBySchool as any).mockResolvedValue([{ id: 's1', first_name: 'A', last_name: 'B', class_name: 'P1', guardian: {} }]);
    // Only charges — trend should be empty zeros
    (LedgerRepository.getEntriesBySchool as any).mockResolvedValue([
      ledgerCharge('s1', 100000),
      ledgerCharge('s1', 200000),
    ]);
    await store.fetchDashboardData();
    const totals = store.trendData.byRange['7D'].reduce((sum, d) => sum + d.total, 0);
    expect(totals).toBe(0);
    // With payments
    (LedgerRepository.getEntriesBySchool as any).mockResolvedValue([
      ledgerCharge('s1', 100000),
      ledgerPayment('s1', 60000),
    ]);
    await store.fetchDashboardData();
    const totals2 = store.trendData.byRange['7D'].reduce((sum, d) => sum + d.total, 0);
    expect(totals2).toBeGreaterThan(0);
  });

  it('collection breakdown does not show false empty state when charges exist', async () => {
    const store = useDashboardStore();
    (StudentRepository.getStudentsBySchool as any).mockResolvedValue([{ id: 's1', first_name: 'A', last_name: 'B', class_name: 'P1', guardian: {} }]);
    (LedgerRepository.getEntriesBySchool as any).mockResolvedValue([
      ledgerCharge('s1', 100000),
      ledgerPayment('s1', 70000),
    ]);
    await store.fetchDashboardData();
    expect(store.totalCharges).toBeGreaterThan(0);
    expect(store.collectedPercent).toBeCloseTo(70);
    expect(store.outstandingPercent).toBeCloseTo(30);
  });

  it('uses amount_minor as canonical, fallback to amount', async () => {
    const store = useDashboardStore();
    (StudentRepository.getStudentsBySchool as any).mockResolvedValue([{ id: 's1', first_name: 'A', last_name: 'B', class_name: 'P1', guardian: {} }]);
    // entry with only amount (legacy) — should be interpreted as naira*100
    (LedgerRepository.getEntriesBySchool as any).mockResolvedValue([
      { id: 'x', student_id: 's1', entry_type: 'CHARGE', entry_direction: 'DEBIT', amount: 500, created_at: new Date().toISOString() } as any,
      { id: 'y', student_id: 's1', entry_type: 'PAYMENT', entry_direction: 'CREDIT', amount: 200, created_at: new Date().toISOString() } as any,
    ]);
    await store.fetchDashboardData();
    expect(store.totalCharges).toBe(500);
    expect(store.totalPayments).toBe(200);
  });

  it('monthly collections net reversals', async () => {
    const store = useDashboardStore();
    // monthly logic tested via helper
    const now = new Date().toISOString();
    const entries: any[] = [
      { id: '1', student_id: 's1', entry_type: 'PAYMENT', entry_direction: 'CREDIT', amount_minor: 100000, amount: 1000, created_at: now, occurred_at: now },
      { id: '2', student_id: 's1', entry_type: 'REVERSAL', entry_direction: 'DEBIT', amount_minor: 40000, amount: 400, created_at: now, occurred_at: now },
    ];
    const total = store.calculateMonthlyCollections(entries as any, 0);
    expect(total).toBe(600); // 1000 - 400
  });
});
