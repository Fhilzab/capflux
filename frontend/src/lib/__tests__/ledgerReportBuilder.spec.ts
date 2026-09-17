import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildLedgerSchoolReport, buildDailyCollections } from '../ledgerReportBuilder';
import type { LedgerRowLike } from '../ledgerSemantics';

const mocks = vi.hoisted(() => ({
  getEntriesBySchool: vi.fn(),
  getStudentsBySchool: vi.fn(),
  loadDivisions: vi.fn(),
}));

vi.mock('../../shared/repositories/LedgerRepository', () => ({
  LedgerRepository: { getEntriesBySchool: mocks.getEntriesBySchool },
}));
vi.mock('../../shared/repositories/StudentRepository', () => ({
  StudentRepository: { getStudentsBySchool: mocks.getStudentsBySchool },
}));
vi.mock('../../shared/divisions/DivisionService', () => ({
  DivisionService: class {
    loadDivisions = mocks.loadDivisions;
  },
}));

beforeEach(() => {
  mocks.getEntriesBySchool.mockReset();
  mocks.getStudentsBySchool.mockReset();
  mocks.loadDivisions.mockReset();
});

const entry = (over: Partial<LedgerRowLike>): LedgerRowLike => ({
  id: 'e1',
  student_id: 'stu-1',
  entry_type: 'CHARGE',
  entry_direction: 'DEBIT',
  amount_minor: 200_000,
  ...over,
});

const seed = async () => {
  mocks.getStudentsBySchool.mockResolvedValue([
    { id: 'stu-1', first_name: 'Ada', last_name: 'Obi', division_id: 'div-1', admission_number: 'CAP/2026/0001' },
    { id: 'stu-2', first_name: 'Bala', last_name: 'Moh', division_id: 'div-2', admission_number: 'CAP/2026/0002' },
  ]);
  mocks.loadDivisions.mockResolvedValue({
    data: [
      { id: 'div-1', name: 'JSS 1', code: 'JSS1', status: 'ACTIVE' },
      { id: 'div-2', name: 'SS 2', code: 'SS2', status: 'ACTIVE' },
    ],
    error: null as string | null,
  });
  mocks.getEntriesBySchool.mockResolvedValue([
    entry({ id: 'e1', student_id: 'stu-1' }),
    entry({ id: 'e2', student_id: 'stu-1', entry_type: 'PAYMENT', entry_direction: 'CREDIT', amount_minor: 120_000, occurred_at: '2026-09-12T08:00:00Z' }),
    entry({ id: 'e3', student_id: 'stu-2', entry_type: 'PAYMENT', entry_direction: 'CREDIT', amount_minor: 90_000, occurred_at: '2026-09-12T10:00:00Z' }),
    entry({ id: 'e4', student_id: 'stu-2', entry_type: 'REVERSAL', entry_direction: 'DEBIT', amount_minor: 10_000, occurred_at: '2026-09-13T10:00:00Z' }),
  ]);
};

describe('ledgerReportBuilder', () => {
  describe('buildLedgerSchoolReport', () => {
    it('aggregates per-student balances with real names and class names', async () => {
      await seed();
      const report = await buildLedgerSchoolReport('demo-school');

      expect(report.assessedMinor).toBe(200_000);
      expect(report.collectedMinor).toBe(200_000); // 120,000 (payments) - 10,000 (reversal) - 90,000 (payment has no charge) => 200_000
      expect(report.outstandingMinor).toBe(0);

      const stu1 = report.outstandingByStudent.find((r) => r.student_id === 'stu-1');
      expect(stu1?.student_name).toBe('Ada Obi');
      expect(stu1?.class_name).toBe('JSS 1');
      expect(stu1?.admission_number).toBe('CAP/2026/0001');
      expect(stu1?.assessedMinor).toBe(200_000);
      expect(stu1?.collectedMinor).toBe(120_000);
      expect(stu1?.outstandingMinor).toBe(80_000);

      const stu2 = report.outstandingByStudent.find((r) => r.student_id === 'stu-2');
      expect(stu2?.class_name).toBe('SS 2');
      expect(stu2?.outstandingMinor).toBe(-80_000); // 0 charged - (90,000 - 10,000) collected

      expect(report.paymentCount).toBe(2);
      expect(report.recentPayments[0]?.student_name).toBe('Bala Moh'); // newest first
      expect(report.recentPayments[0]?.amount_minor).toBe(90_000);
    });

    it('returns empty collections for a fresh ledger', async () => {
      mocks.getStudentsBySchool.mockResolvedValue([]);
      mocks.loadDivisions.mockResolvedValue({ data: [], error: null as string | null });
      mocks.getEntriesBySchool.mockResolvedValue([]);

      const report = await buildLedgerSchoolReport('demo-school');
      expect(report.assessedMinor).toBe(0);
      expect(report.outstandingByStudent).toEqual([]);
      expect(report.recentPayments).toEqual([]);
    });

    it('labels students without a matching row as unknown and resolves a division name from code', async () => {
      mocks.getStudentsBySchool.mockResolvedValue([{ id: 'stu-9', first_name: 'Zara', last_name: 'K', division_id: 'div-9' }]);
      mocks.loadDivisions.mockResolvedValue({ data: [{ id: 'div-9', name: '', code: 'JSS9', status: 'ACTIVE' }], error: null as string | null });
      mocks.getEntriesBySchool.mockResolvedValue([
        entry({ id: 'e9', student_id: 'orphan', amount_minor: 500_000 }),
        entry({ id: 'e10', student_id: 'stu-9', amount_minor: 100_000 }),
      ]);

      const report = await buildLedgerSchoolReport('demo-school');
      const orphan = report.outstandingByStudent.find((r) => r.student_id === 'orphan');
      expect(orphan?.student_name).toBe('Unknown student');
      const stu9 = report.outstandingByStudent.find((r) => r.student_id === 'stu-9');
      expect(stu9?.class_name).toBe('JSS9');
    });
  });

  describe('buildDailyCollections', () => {
    it('groups payment credits by day in kobo, newest first', async () => {
      await seed();
      const rows = await buildDailyCollections('demo-school');

      expect(rows).toHaveLength(1);
      expect(rows[0]?.date).toBe('2026-09-12');
      expect(rows[0]?.collectedMinor).toBe(210_000); // 120,000 + 90,000
      expect(rows[0]?.count).toBe(2);
    });

    it('ignores charges and reversals when collecting daily totals', async () => {
      mocks.getEntriesBySchool.mockResolvedValue([
        entry({ id: 'e1', student_id: 'stu-1' }),
        entry({ id: 'e2', student_id: 'stu-1', entry_type: 'PAYMENT', entry_direction: 'CREDIT', amount_minor: 5_000, occurred_at: '2026-09-10T10:00:00Z' }),
        entry({ id: 'e3', student_id: 'stu-1', entry_type: 'REVERSAL', entry_direction: 'DEBIT', amount_minor: 1_000, occurred_at: '2026-09-11T10:00:00Z' }),
      ]);
      const rows = await buildDailyCollections('demo-school');
      expect(rows).toHaveLength(1);
      expect(rows[0]?.collectedMinor).toBe(5_000);
    });
  });
});