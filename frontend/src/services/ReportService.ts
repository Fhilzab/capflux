import { LedgerRepository } from '../repositories/LedgerRepository';
import { StudentRepository } from '../repositories/StudentRepository';

export const ReportService = {
  async getFeeDashboard(school_id: string) {
    const students = await StudentRepository.getStudentsBySchool(school_id);
    const entries = await LedgerRepository.getEntriesBySchool(school_id);

    const report = {
      totalCharges: 0,
      totalPayments: 0,
      netBalance: 0,
      outstandingByStudent: [] as Array<Record<string, any>>,
      recentPayments: [] as Array<Record<string, any>>,
    };

    for (const entry of entries) {
      const amount = Number(entry.amount || 0);
      if (entry.entry_type === 'DEBIT') {
        report.totalCharges += amount;
      } else {
        report.totalPayments += amount;
      }
    }

    report.netBalance = report.totalCharges - report.totalPayments;

    report.outstandingByStudent = students.map((student) => {
      const studentEntries = entries.filter((entry) => entry.student_id === student.id);
      const totalCharges = studentEntries
        .filter((entry) => entry.entry_type === 'DEBIT')
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
      const totalPayments = studentEntries
        .filter((entry) => entry.entry_type === 'CREDIT')
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

      return {
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`,
        class_name: student.class_name,
        totalCharges,
        totalPayments,
        outstanding: totalCharges - totalPayments,
      };
    });

    report.recentPayments = entries
      .filter((entry) => entry.entry_type === 'CREDIT')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map((entry) => {
        const student = students.find((student) => student.id === entry.student_id);
        return {
          ...entry,
          student_name: student ? `${student.first_name} ${student.last_name}` : 'Unknown',
        };
      });

    return report;
  },

  async getDailyCollections(school_id: string, startDate: string | null, endDate: string | null) {
    const entries = await LedgerRepository.getEntriesBySchool(school_id);
    const payments = entries.filter((entry) => entry.entry_type === 'CREDIT');

    // Group by date
    const grouped: Record<string, { count: number; total: number }> = {};

    for (const payment of payments) {
      const date = payment.created_at
        ? new Date(payment.created_at).toISOString().split('T')[0]
        : 'unknown';

      // Apply date filter
      if (startDate && date < startDate) continue;
      if (endDate && date > endDate) continue;

      if (!grouped[date]) {
        grouped[date] = { count: 0, total: 0 };
      }
      grouped[date].count += 1;
      grouped[date].total += Number(payment.amount || 0);
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
