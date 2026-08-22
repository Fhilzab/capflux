import { defineStore } from 'pinia';
import { StudentRepository } from '../../../shared/repositories/StudentRepository';
import { GuardianRepository } from '../../../shared/repositories/GuardianRepository';
import { LedgerRepository } from '../../../shared/repositories/LedgerRepository';
import { PaymentAccountRepository } from '../../../shared/repositories/PaymentAccountRepository';
import { NotificationRepository } from '../../../shared/repositories/NotificationRepository';
import { ReportService } from '../../../shared/services/ReportService';
import { useSyncStore } from '../../../stores/syncStore';
import dayjs from 'dayjs';

const DEFAULT_SCHOOL_ID = 'demo-school';

export type TrendRange = '7D' | '30D' | '3M' | '6M' | '1Y';

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  class_name: string;
  status: string;
  guardian?: {
    primary_phone?: string;
    full_name?: string;
  };
}

export interface LedgerEntry {
  id: string;
  student_id: string;
  amount: number;
  entry_type: 'DEBIT' | 'CREDIT';
  created_at: string;
  metadata?: {
    verified?: boolean;
  };
}

export interface OutstandingStudent {
  student_id: string;
  student_name: string;
  class_name: string;
  phone: string;
  outstanding: number;
  percentage_paid: number;
}

export interface TrendData {
  date: string;
  total: number;
  count: number;
}

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    loading: false as boolean,
    error: null as string | null,

    // Core metrics
    totalStudents: 0 as number,
    totalGuardians: 0 as number,
    totalCharges: 0 as number,
    totalPayments: 0 as number,
    netBalance: 0 as number,
    collectionRate: 0 as number,

    // Period metrics
    todaysCollections: 0 as number,
    todaysPaymentsCount: 0 as number,
    thisMonthsCollections: 0 as number,
    lastMonthCollections: 0 as number,

    // Operational status
    pendingVerification: 0 as number,
    pendingNotifications: 0 as number,
    offlineQueue: 0 as number,

    // Outstanding
    outstandingByStudent: [] as OutstandingStudent[],
    outstandingStudentCount: 0 as number,

    // Recent payments
    recentPayments: [] as (LedgerEntry & { student_name?: string; guardian_name?: string })[],

    // Payment accounts
    totalDVAs: 0 as number,
    pendingDVAs: 0 as number,
    failedDVAs: 0 as number,

    // Sync & system
    lastSync: null as string | null,

    // Trend
    selectedTrendRange: '7D' as TrendRange,
    trendData: {
      payments: [] as TrendData[],
      byRange: {} as Record<TrendRange, TrendData[]>,
    },
  }),

  getters: {
    formattedTodaysCollections: (state): string => `₦${state.todaysCollections.toLocaleString()}`,
    formattedTotalCharges: (state): string => `₦${state.totalCharges.toLocaleString()}`,
    formattedTotalPayments: (state): string => `₦${state.totalPayments.toLocaleString()}`,
    formattedNetBalance: (state): string => `₦${state.netBalance.toLocaleString()}`,
    formattedThisMonthsCollections: (state): string => `₦${state.thisMonthsCollections.toLocaleString()}`,
    collectionRatePercent: (state): string => `${state.collectionRate.toFixed(1)}%`,

    // Collection breakdown percentages (derived from existing totals)
    collectedPercent: (state): number =>
      state.totalCharges > 0 ? (state.totalPayments / state.totalCharges) * 100 : 0,
    outstandingPercent: (state): number =>
      state.totalCharges > 0 ? (state.netBalance / state.totalCharges) * 100 : 0,

    // Trend data for the currently selected range
    trendDataByRange: (state): TrendData[] =>
      state.trendData.byRange[state.selectedTrendRange] || [],

    // Month-over-month trend for "This Month" metric
    monthlyTrend: (state): { trend: 'up' | 'down' | 'flat'; value: string } | null => {
      if (state.lastMonthCollections > 0 && state.thisMonthsCollections > 0) {
        const change = ((state.thisMonthsCollections - state.lastMonthCollections) / state.lastMonthCollections) * 100;
        if (Math.abs(change) < 1) return { trend: 'flat', value: `${Math.abs(change).toFixed(1)}%` };
        return {
          trend: change > 0 ? 'up' : 'down',
          value: `${Math.abs(change).toFixed(0)}%`,
        };
      }
      return null;
    },
  },

  actions: {
    async fetchDashboardData() {
      this.loading = true;
      this.error = null;

      try {
        const [students, guardians, entries, paymentAccounts, notifications] = await Promise.all([
          StudentRepository.getStudentsBySchool(DEFAULT_SCHOOL_ID),
          GuardianRepository.getBySchool(DEFAULT_SCHOOL_ID),
          LedgerRepository.getEntriesBySchool(DEFAULT_SCHOOL_ID),
          PaymentAccountRepository.getBySchool(DEFAULT_SCHOOL_ID),
          NotificationRepository.getBySchool(DEFAULT_SCHOOL_ID),
        ]);

        // Basic counts
        this.totalStudents = students.length;
        this.totalGuardians = guardians.length;

        // Calculate charges and payments
        let totalCharges = 0;
        let totalPayments = 0;
        const todaysEntries = entries.filter((e) =>
          dayjs(e.created_at).isSame(dayjs(), 'day')
        ) as LedgerEntry[];

        entries.forEach((entry) => {
          const amount = Number(entry.amount || 0);
          if (entry.entry_type === 'DEBIT') {
            totalCharges += amount;
          } else {
            totalPayments += amount;
          }
        });

        this.totalCharges = totalCharges;
        this.totalPayments = totalPayments;
        this.netBalance = totalCharges - totalPayments;
        this.collectionRate = totalCharges > 0
          ? (totalPayments / totalCharges) * 100
          : 0;

        // Today's collections
        this.todaysCollections = todaysEntries
          .filter((e) => e.entry_type === 'CREDIT')
          .reduce((sum, e) => sum + Number(e.amount || 0), 0);
        this.todaysPaymentsCount = todaysEntries.filter((e) => e.entry_type === 'CREDIT').length;

        // This month's and last month's collections
        this.thisMonthsCollections = this.calculateMonthlyCollections(entries, 0);
        this.lastMonthCollections = this.calculateMonthlyCollections(entries, 1);

        // Outstanding by student
        this.outstandingByStudent = students.map((student) => {
          const studentEntries = entries.filter((e: LedgerEntry) => e.student_id === student.id);
          const charges = studentEntries
            .filter((e) => e.entry_type === 'DEBIT')
            .reduce((sum, e) => sum + Number(e.amount || 0), 0);
          const payments = studentEntries
            .filter((e) => e.entry_type === 'CREDIT')
            .reduce((sum, e) => sum + Number(e.amount || 0), 0);

          return {
            student_id: student.id,
            student_name: `${student.first_name} ${student.last_name}`,
            class_name: student.class_name,
            phone: student.guardian?.primary_phone || '',
            outstanding: charges - payments,
            percentage_paid: charges > 0 ? (payments / charges) * 100 : 0,
          };
        }).filter((s) => s.outstanding > 0);

        this.outstandingStudentCount = this.outstandingByStudent.length;

        // Recent payments (actual ledger entries, not fabricated)
        this.recentPayments = entries
          .filter((e) => e.entry_type === 'CREDIT')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 10)
          .map((entry) => {
            const student = students.find((s) => s.id === entry.student_id);
            return {
              ...entry,
              student_name: student ? `${student.first_name} ${student.last_name}` : 'Unknown',
              guardian_name: student?.guardian?.full_name || 'Unknown',
            } as LedgerEntry & { student_name: string; guardian_name: string };
          });

        // Payment accounts
        this.totalDVAs = paymentAccounts.filter((a) => a.account_status === 'ACTIVE').length;
        this.pendingDVAs = paymentAccounts.filter((a) => a.account_status === 'INACTIVE').length;
        this.failedDVAs = paymentAccounts.filter((a) => a.account_status === 'SUSPENDED').length;

        // Notifications
        this.pendingNotifications = notifications.filter((n) => n.delivery_status === 'PENDING').length;

        // Sync store data
        const syncStore = useSyncStore();
        await syncStore.refreshStatus();
        this.offlineQueue = syncStore.pendingCount;
        this.lastSync = syncStore.lastSyncedAt;

        // Pending verification (payments without sync)
        this.pendingVerification = entries.filter((e) =>
          e.entry_type === 'CREDIT' && !e.metadata?.verified
        ).length;

        // Trend data for chart — computed for all supported ranges from real entries.
        // Bucket every credit entry once by day, then aggregate days into
        // weeks/months per range instead of re-filtering entries per bucket.
        const creditEntries = entries.filter((e) => e.entry_type === 'CREDIT') as LedgerEntry[];
        this.trendData = {
          payments: this.calculateTrendData(creditEntries, '7D'),
          byRange: {
            '7D': this.calculateTrendData(creditEntries, '7D'),
            '30D': this.calculateTrendData(creditEntries, '30D'),
            '3M': this.calculateTrendData(creditEntries, '3M'),
            '6M': this.calculateTrendData(creditEntries, '6M'),
            '1Y': this.calculateTrendData(creditEntries, '1Y'),
          },
        };

      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err);
      } finally {
        this.loading = false;
      }
    },

    setTrendRange(range: TrendRange) {
      this.selectedTrendRange = range;
    },

    /**
     * Compute monthly collections for a given month offset.
     * offset 0 = current month, 1 = last month, etc.
     */
    calculateMonthlyCollections(entries: LedgerEntry[], offset: number): number {
      const targetMonth = dayjs().subtract(offset, 'month');
      return entries
        .filter(
          (e) =>
            e.entry_type === 'CREDIT' &&
            dayjs(e.created_at).year() === targetMonth.year() &&
            dayjs(e.created_at).month() === targetMonth.month()
        )
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    },

    /**
     * Compute trend data for a given range. Groups credit entries by:
     * - 7D, 30D: daily buckets
     * - 3M, 6M: weekly buckets
     * - 1Y: monthly buckets
     *
     * Entries are bucketed once per unique day (O(n) dayjs parses), then each
     * bucket aggregates days/weeks/months — instead of re-filtering and
     * re-parsing every entry for every bucket.
     */
    calculateTrendData(creditEntries: LedgerEntry[], range: TrendRange): TrendData[] {
      const today = dayjs();

      // Single pass: bucket entry totals/counts by YYYY-MM-DD
      const byDay = new Map<string, { total: number; count: number }>();
      for (const e of creditEntries) {
        const key = dayjs(e.created_at).format('YYYY-MM-DD');
        const bucket = byDay.get(key);
        if (bucket) {
          bucket.total += Number(e.amount || 0);
          bucket.count += 1;
        } else {
          byDay.set(key, { total: Number(e.amount || 0), count: 1 });
        }
      }

      if (range === '7D' || range === '30D') {
        const days = range === '7D' ? 7 : 30;
        const result: TrendData[] = [];
        for (let i = days - 1; i >= 0; i--) {
          const date = today.subtract(i, 'day');
          const day = byDay.get(date.format('YYYY-MM-DD'));
          result.push({
            date: date.format('MMM D'),
            total: day?.total ?? 0,
            count: day?.count ?? 0,
          });
        }
        return result;
      }

      if (range === '3M' || range === '6M') {
        const weeks = range === '3M' ? 13 : 26;
        const result: TrendData[] = [];
        // Precompute each week's start/end once; each day bucket is checked
        // against every week window without re-parsing entry timestamps.
        const windows = [] as { date: string; start: dayjs.Dayjs; end: dayjs.Dayjs; total: number; count: number }[];
        for (let i = weeks - 1; i >= 0; i--) {
          const weekEnd = today.subtract(i * 7, 'day');
          const weekStart = weekEnd.subtract(6, 'day');
          windows.push({ date: weekStart.format('MMM D'), start: weekStart, end: weekEnd, total: 0, count: 0 });
        }
        for (const [key, day] of byDay) {
          const d = dayjs(key);
          for (const w of windows) {
            if ((d.isAfter(w.start) || d.isSame(w.start)) && (d.isBefore(w.end) || d.isSame(w.end))) {
              w.total += day.total;
              w.count += day.count;
            }
          }
        }
        return windows.map(({ date, total, count }) => ({ date, total, count }));
      }

      if (range === '1Y') {
        const result = new Map<string, TrendData>();
        for (let i = 11; i >= 0; i--) {
          const month = today.subtract(i, 'month');
          result.set(month.format('YYYY-MM'), { date: month.format('MMM'), total: 0, count: 0 });
        }
        for (const [key, day] of byDay) {
          const monthKey = key.slice(0, 7);
          const bucket = result.get(monthKey);
          if (bucket) {
            bucket.total += day.total;
            bucket.count += day.count;
          }
        }
        return Array.from(result.values());
      }

      return [];
    },
  },
});
