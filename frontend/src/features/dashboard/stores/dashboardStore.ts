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

/** Ledger entry as persisted in Dexie/sandboxDb. Canonical fields are
 *  entry_type / entry_direction / amount_minor (kobo). Legacy readers also
 *  populate amount (naira) and entry_category for backwards compat. */
export interface LedgerEntry {
  id: string;
  student_id: string;
  // Canonical money in kobo
  amount_minor?: number;
  // Legacy/derived naira field (e.g. seed writes amount = minor/100)
  amount?: number;
  // Canonical entry semantics
  entry_type?: string; // 'CHARGE' | 'PAYMENT' | 'REVERSAL' | ...
  entry_direction?: string; // 'DEBIT' | 'CREDIT'
  entry_category?: string;
  // Timestamps — seed writes both; treat either as event time
  created_at?: string;
  occurred_at?: string;
  posting_date?: string;
  metadata?: {
    verified?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
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

  // ------------------------------------------------------------------
  // Ledger semantics helpers — canonical domain definition aligned with
  // sandbox seed (entry_type CHARGE/PAYMENT/REVERSAL + entry_direction).
  // Uses amount_minor (kobo) where present; falls back to amount (naira*100).
  // ------------------------------------------------------------------

  actions: {
    /** Derive kobo integer from either amount_minor or legacy amount. */
    _getAmountMinor(entry: LedgerEntry): number {
      const raw = (entry as Record<string, unknown>).amount_minor ??
                  (entry as Record<string, unknown>).amountMinor;
      if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
      if (typeof raw === 'string' && raw !== '') {
        const n = Number(raw);
        if (Number.isFinite(n)) return Math.trunc(n);
      }
      const amt = Number(entry.amount ?? 0);
      if (!Number.isFinite(amt)) return 0;
      return Math.round(amt * 100);
    },

    /** Event date — seed writes occurred_at & created_at identically. */
    _getEntryDate(entry: LedgerEntry): string | undefined {
      const e = entry as Record<string, unknown>;
      return (e.occurred_at as string) ?? (e.posting_date as string) ?? entry.created_at;
    },

    _isCharge(entry: LedgerEntry): boolean {
      const t = String(entry.entry_type ?? '').toUpperCase();
      const d = String((entry.entry_direction ?? '')).toUpperCase();
      // Canonical: CHARGE + DEBIT. Legacy fallback: entry_type==='DEBIT' or amount sign.
      if (t === 'CHARGE') return d === 'DEBIT' || d === '';
      if (!t && d === 'DEBIT' && entry.entry_category) return false; // ambiguous legacy
      return false;
    },

    _isPaymentCredit(entry: LedgerEntry): boolean {
      const t = String(entry.entry_type ?? '').toUpperCase();
      const d = String((entry.entry_direction ?? '')).toUpperCase();
      if (t === 'PAYMENT' && d === 'CREDIT') return true;
      // Legacy fallback: some callers still write CREDIT as type-less credit
      if (t === 'CREDIT' && (d === 'CREDIT' || d === '')) return true;
      return false;
    },

    _isReversalDebit(entry: LedgerEntry): boolean {
      const t = String(entry.entry_type ?? '').toUpperCase();
      const d = String((entry.entry_direction ?? '')).toUpperCase();
      return t === 'REVERSAL' && d === 'DEBIT';
    },

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

        // Canonical financial aggregation — integer kobo arithmetic.
        // Assessed = CHARGE DEBITs
        // Collected = PAYMENT CREDITs net of REVERSAL DEBITs
        // Outstanding = Assessed - Collected
        let assessedMinor = 0;
        let paymentCreditsMinor = 0;
        let reversalDebitsMinor = 0;

        for (const e of entries as LedgerEntry[]) {
          if (this._isCharge(e)) assessedMinor += this._getAmountMinor(e);
          else if (this._isPaymentCredit(e)) paymentCreditsMinor += this._getAmountMinor(e);
          else if (this._isReversalDebit(e)) reversalDebitsMinor += this._getAmountMinor(e);
        }

        const collectedMinor = paymentCreditsMinor - reversalDebitsMinor;
        const outstandingMinor = assessedMinor - collectedMinor;

        this.totalCharges = Math.round(assessedMinor / 100);
        this.totalPayments = Math.round(collectedMinor / 100);
        // Guard: outstanding must never go negative for V4 data, but preserve credit-balance domain.
        this.netBalance = Math.round(outstandingMinor / 100);
        this.collectionRate = assessedMinor > 0
          ? (collectedMinor / assessedMinor) * 100
          : 0;

        // Today's collections — PAYMENT CREDITs only, date via _getEntryDate
        const todaysEntries = (entries as LedgerEntry[]).filter((e) =>
          this._isPaymentCredit(e) && dayjs(this._getEntryDate(e)).isSame(dayjs(), 'day')
        );
        this.todaysCollections = todaysEntries.reduce((sum, e) => sum + this._getAmountMinor(e) / 100, 0);
        // Exclude reversals from today's count; they are not payments received that day.
        this.todaysPaymentsCount = todaysEntries.length;

        // This month's and last month's collections (net of reversals handled via helper)
        this.thisMonthsCollections = this.calculateMonthlyCollections(entries as LedgerEntry[], 0);
        this.lastMonthCollections = this.calculateMonthlyCollections(entries as LedgerEntry[], 1);

        // Outstanding by student — per-student CHARGE vs PAYMENT net REVERSAL
        this.outstandingByStudent = students.map((student) => {
          const studentEntries = (entries as LedgerEntry[]).filter((e) => e.student_id === student.id);
          let chargesMinor = 0;
          let paymentsMinor = 0;
          let reversalsMinor = 0;
          for (const e of studentEntries) {
            if (this._isCharge(e)) chargesMinor += this._getAmountMinor(e);
            else if (this._isPaymentCredit(e)) paymentsMinor += this._getAmountMinor(e);
            else if (this._isReversalDebit(e)) reversalsMinor += this._getAmountMinor(e);
          }
          const collectedMinor = paymentsMinor - reversalsMinor;
          const outstandingMinor = chargesMinor - collectedMinor;
          return {
            student_id: student.id,
            student_name: `${student.first_name} ${student.last_name}`,
            class_name: student.class_name,
            phone: student.guardian?.primary_phone || '',
            outstanding: Math.round(outstandingMinor / 100),
            percentage_paid: chargesMinor > 0 ? (collectedMinor / chargesMinor) * 100 : 0,
          };
        }).filter((s) => s.outstanding > 0);

        this.outstandingStudentCount = this.outstandingByStudent.length;

        // Recent payments — PAYMENT CREDITs only, newest first by occurred_at/created_at
        this.recentPayments = (entries as LedgerEntry[])
          .filter((e) => this._isPaymentCredit(e))
          .sort((a, b) => new Date(this._getEntryDate(b) ?? '').getTime() - new Date(this._getEntryDate(a) ?? '').getTime())
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

        // Pending verification — PAYMENT credits without verified flag
        this.pendingVerification = (entries as LedgerEntry[]).filter((e) =>
          this._isPaymentCredit(e) && !(e.metadata as Record<string, unknown> | undefined)?.verified
        ).length;

        // Trend data — net PAYMENT credits per day (reversals subtract)
        // Build a signed byDay map where REVERSAL debits are negative.
        const trendByDay = new Map<string, { totalMinor: number; count: number }>();
        for (const e of entries as LedgerEntry[]) {
          const d = this._getEntryDate(e);
          if (!d) continue;
          const key = dayjs(d).format('YYYY-MM-DD');
          if (this._isPaymentCredit(e)) {
            const minor = this._getAmountMinor(e);
            const bucket = trendByDay.get(key);
            if (bucket) { bucket.totalMinor += minor; bucket.count += 1; }
            else trendByDay.set(key, { totalMinor: minor, count: 1 });
          } else if (this._isReversalDebit(e)) {
            const minor = this._getAmountMinor(e);
            const bucket = trendByDay.get(key);
            if (bucket) { bucket.totalMinor -= minor; bucket.count += 0; }
            else trendByDay.set(key, { totalMinor: -minor, count: 0 });
          }
        }
        // Convert kobo map to NGN TrendData[] for existing range calculators
        // by materialising pseudo-creditEntries carrying net daily totals
        const netCreditEntries: LedgerEntry[] = [];
        for (const [dayKey, v] of trendByDay) {
          netCreditEntries.push({
            id: `trend-${dayKey}`,
            student_id: '',
            amount_minor: v.totalMinor,
            amount: v.totalMinor / 100,
            entry_type: 'PAYMENT',
            entry_direction: 'CREDIT',
            created_at: dayjs(dayKey).toISOString(),
            occurred_at: dayjs(dayKey).toISOString(),
            _count: v.count,
          } as unknown as LedgerEntry);
        }
        // For counts we need a separate path — calculateTrendData will bucket by day totals
        // but we also preserve real payment counts via trendByDay counts.
        // We delegate to calculateTrendData with net entries (NGN totals) and
        // then patch counts from trendByDay where relevant is handled inside.
        this.trendData = {
          payments: this.calculateTrendData(netCreditEntries, '7D'),
          byRange: {
            '7D': this.calculateTrendData(netCreditEntries, '7D'),
            '30D': this.calculateTrendData(netCreditEntries, '30D'),
            '3M': this.calculateTrendData(netCreditEntries, '3M'),
            '6M': this.calculateTrendData(netCreditEntries, '6M'),
            '1Y': this.calculateTrendData(netCreditEntries, '1Y'),
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
     * offset 0 = current month, 1 = last month, etc. Net of reversals.
     */
    calculateMonthlyCollections(entries: LedgerEntry[], offset: number): number {
      const targetMonth = dayjs().subtract(offset, 'month');
      let collectedMinor = 0;
      let reversalMinor = 0;
      for (const e of entries) {
        const d = this._getEntryDate(e);
        if (!d) continue;
        const m = dayjs(d);
        if (m.year() !== targetMonth.year() || m.month() !== targetMonth.month()) continue;
        if (this._isPaymentCredit(e)) collectedMinor += this._getAmountMinor(e);
        else if (this._isReversalDebit(e)) reversalMinor += this._getAmountMinor(e);
      }
      return (collectedMinor - reversalMinor) / 100;
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
      // Supports net entries carrying amount_minor/_count (for reversal-adjusted trends).
      const byDay = new Map<string, { total: number; count: number }>();
      for (const e of creditEntries) {
        const raw = e as Record<string, unknown>;
        const d = (raw.occurred_at as string) ?? e.created_at ?? '';
        const key = d ? dayjs(d).format('YYYY-MM-DD') : '';
        if (!key || key === 'Invalid Date') continue;
        // Prefer kobo-derived NGN for totals; fallback to amount.
        const amtMinor = raw.amount_minor ?? raw.amountMinor;
        const totalNgn = typeof amtMinor === 'number' ? (amtMinor as number) / 100 : Number(e.amount || 0);
        const cnt = typeof raw._count === 'number' ? (raw._count as number) : 1;
        const bucket = byDay.get(key);
        if (bucket) {
          bucket.total += totalNgn;
          bucket.count += cnt;
        } else {
          byDay.set(key, { total: totalNgn, count: cnt });
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
