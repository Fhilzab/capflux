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
};
