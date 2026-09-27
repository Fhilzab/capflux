/**
 * seedReadiness.spec.ts — sandbox seed-readiness gates across domain stores.
 *
 * Cold boot clears local tables before rewriting them, so any read issued
 * before seed completion observes an empty snapshot. Every store below
 * awaits `ensureSeedReady()` (sandbox-gated no-op elsewhere) before its
 * first local read or mutation. These tests prove the gate runs first and
 * the authenticated school id propagates — with mocked persistence so no
 * IndexedDB or network is involved.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const hoisted = vi.hoisted(() => {
  const ensureSeedReadyMock = vi.fn(async () => undefined);
  const divisionListMock = vi.fn(async () => ({ data: [], error: null }));
  const sessionsMock = vi.fn(async () => []);
  const levelsMock = vi.fn(async () => []);
  const notifListMock = vi.fn(async () => ({ data: [], error: null }));
  const studentsBySchoolMock = vi.fn(async () => []);
  const entriesBySchoolMock = vi.fn(async () => []);
  const createEntryMock = vi.fn(async () => ({ id: 'led-1' }));
  const studentSearchMock = vi.fn(async () => ({ data: [], error: null }));
  const statementMock = vi.fn(async () => ({ data: { lines: [], metadata: {} }, error: null }));
  return {
    ensureSeedReadyMock,
    divisionListMock,
    sessionsMock,
    levelsMock,
    notifListMock,
    studentsBySchoolMock,
    entriesBySchoolMock,
    createEntryMock,
    studentSearchMock,
    statementMock,
  };
});

const {
  ensureSeedReadyMock,
  divisionListMock,
  sessionsMock,
  levelsMock,
  notifListMock,
  studentsBySchoolMock,
  entriesBySchoolMock,
  createEntryMock,
  studentSearchMock,
  statementMock,
} = hoisted;

vi.mock('@/sandbox/seedReady', () => ({
  ensureSeedReady: hoisted.ensureSeedReadyMock,
}));

vi.mock('@/shared/divisions/DivisionService', () => ({
  divisionService: { loadDivisions: hoisted.divisionListMock },
}));

vi.mock('@/offline/localDb', () => ({
  db: {},
  LocalRepository: {
    getAcademicSessionsBySchool: hoisted.sessionsMock,
    getAcademicLevelsBySchool: hoisted.levelsMock,
  },
}));

vi.mock('@/shared/notifications/NotificationService', () => ({
  notificationService: { getNotificationsByStudent: hoisted.notifListMock },
}));

vi.mock('@/shared/repositories/StudentRepository', () => ({
  StudentRepository: {
    getStudentsBySchool: hoisted.studentsBySchoolMock,
    getStudentsByIds: vi.fn(async () => []),
  },
}));

vi.mock('@/shared/repositories/LedgerRepository', () => ({
  LedgerRepository: {
    getEntriesBySchool: hoisted.entriesBySchoolMock,
    createLedgerEntry: hoisted.createEntryMock,
  },
}));

vi.mock('@/shared/students/StudentService', () => ({
  studentService: { searchStudents: hoisted.studentSearchMock },
}));

vi.mock('@/shared/reporting/ReportingService', () => ({
  ReportingService: { generateStudentStatement: hoisted.statementMock },
}));

import { useSchoolStore } from '@/stores/schoolStore';
import { useDivisionStore } from '@/stores/divisionStore';
import { useAcademicStore } from '@/stores/academicStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useBillingStore } from '@/stores/billingStore';
import { useStudentStore } from '@/stores/studentStore';
import { useReportingStore } from '@/stores/reportingStore';

function orderedBefore(first: ReturnType<typeof vi.fn>, second: ReturnType<typeof vi.fn>): void {
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(1);
  expect(first.mock.invocationCallOrder[0]).toBeLessThan(second.mock.invocationCallOrder[0]);
}

describe('seed readiness gates', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    (useSchoolStore() as any).school = { id: 'live-school-9' };
    (useSchoolStore() as any).error = null;
  });

  it('divisionStore waits for seed, then loads divisions for the live school', async () => {
    divisionListMock.mockResolvedValue({ data: [{ id: 'd1' }], error: null });
    const store = useDivisionStore();
    await store.loadDivisions();
    orderedBefore(ensureSeedReadyMock, divisionListMock);
    expect(divisionListMock).toHaveBeenCalledWith('live-school-9');
    expect(store.divisions).toHaveLength(1);
  });

  it('academicStore waits for seed before reading sessions and levels', async () => {
    const store = useAcademicStore();
    await store.initialize();
    orderedBefore(ensureSeedReadyMock, sessionsMock);
    expect(sessionsMock).toHaveBeenCalledWith('live-school-9');
    expect(levelsMock).toHaveBeenCalledWith('live-school-9');
  });

  it('notificationStore waits for seed before loading notifications', async () => {
    const store = useNotificationStore();
    await store.loadNotifications('stu-1');
    orderedBefore(ensureSeedReadyMock, notifListMock);
    expect(notifListMock).toHaveBeenCalledWith('stu-1');
  });

  it('billingStore waits for seed before summary reads and charge writes', async () => {
    const store = useBillingStore();
    await store.getBillingSummary('live-school-9', []);
    orderedBefore(ensureSeedReadyMock, studentsBySchoolMock);
    expect(studentsBySchoolMock).toHaveBeenCalledWith('live-school-9');

    vi.clearAllMocks();
    await store.createCharge({ school_id: 'live-school-9', student_id: 's1', amount: 5000, entry_type: 'DEBIT' });
    orderedBefore(ensureSeedReadyMock, createEntryMock);
    expect(createEntryMock).toHaveBeenCalledWith(expect.objectContaining({ school_id: 'live-school-9' }));
  });

  it('studentStore waits for seed before searching', async () => {
    const store = useStudentStore();
    await store.searchStudents('live-school-9', 'Ada');
    orderedBefore(ensureSeedReadyMock, studentSearchMock);
    expect(studentSearchMock).toHaveBeenCalledWith('live-school-9', 'Ada');
  });

  it('reportingStore waits for seed before generating statements', async () => {
    const store = useReportingStore();
    await store.loadStudentStatement('', { schoolId: 'live-school-9' });
    orderedBefore(ensureSeedReadyMock, statementMock);
    expect(store.error).toBeNull();
  });

  it('seed failures surface instead of producing false empty results', async () => {
    ensureSeedReadyMock.mockRejectedValueOnce(new Error('seed unavailable'));
    const store = useDivisionStore();
    await store.loadDivisions();
    expect(store.error).toBe('seed unavailable');
    expect(divisionListMock).not.toHaveBeenCalled();
  });
});
