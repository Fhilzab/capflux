import { ReportingService } from '../reporting/ReportingService';
import { SupabaseReportingProvider } from '../reporting/SupabaseReportingProvider';

/**
 * @deprecated
 * Compatibility adapter.
 *
 * Scheduled removal after Phase 2 frontend migration.
 *
 * Delegates to the new domain ReportingService at:
 *   shared/reporting/ReportingService.ts
 *
 * No business logic remains in this file.
 */

const provider = new SupabaseReportingProvider();

export const ReportService = {
  /**
   * @deprecated Use reportingStore or the new ReportingService.
   */
  async getFeeDashboard(school_id: string) {
    const result = await ReportingService.generateStudentStatement({
      provider,
      reportType: 'STUDENT_STATEMENT',
      filter: {
        organizationId: school_id,
        schoolId: school_id,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
      } as any,
    });

    if (result.error || !result.data) {
      return {
        totalCharges: 0,
        totalPayments: 0,
        netBalance: 0,
        outstandingByStudent: [],
        recentPayments: [],
      };
    }

    const statement = result.data;
    const outstandingByStudent = (statement.lines || []).map((line: any) => ({
      student_id: line.studentId || '',
      student_name: line.studentName || 'Unknown',
      class_name: '',
      totalCharges: line.totalCharges,
      totalPayments: line.totalPayments,
      outstanding: line.balance,
    }));

    return {
      totalCharges: ((statement.metadata as any)?.totalCharges || 0),
      totalPayments: ((statement.metadata as any)?.totalPayments || 0),
      netBalance: ((statement.metadata as any)?.totalCharges || 0) - ((statement.metadata as any)?.totalPayments || 0),
      outstandingByStudent,
      recentPayments: [],
    };
  },

  /**
   * @deprecated Use reportingStore or the new ReportingService.
   */
  async getDailyCollections(school_id: string, startDate: string | null, endDate: string | null) {
    const result = await ReportingService.generateCashBook({
      provider,
      reportType: 'CASH_BOOK',
      filter: {
        organizationId: school_id,
        schoolId: school_id,
        startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: endDate || new Date().toISOString().split('T')[0],
      } as any,
    });

    if (result.error || !result.data) {
      return [];
    }

    const grouped: Record<string, { count: number; total: number }> = {};

    for (const entry of result.data.entries) {
      const date = (entry as any).postingDate || (entry as any).occurredAt;
      if (!date) continue;

      const dateStr = new Date(date).toISOString().split('T')[0];

      if (startDate && dateStr < startDate) continue;
      if (endDate && dateStr > endDate) continue;

      if (!grouped[dateStr]) {
        grouped[dateStr] = { count: 0, total: 0 };
      }
      grouped[dateStr].count += 1;
      grouped[dateStr].total += ((entry as any).amountMinor || 0) / 100;
    }

    return Object.entries(grouped)
      .map(([date, data]) => ({
        date,
        count: data.count,
        total: data.total,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  },
};