import { LedgerRepository } from '../repositories/LedgerRepository';
import { StudentRepository } from '../repositories/StudentRepository';

export const BillingService = {
  async getBillingSummary(school_id: string) {
    const students = await StudentRepository.getStudentsBySchool(school_id);
    const items = [];
    let balance = 0;

    for (const student of students) {
      const studentEntries = await LedgerRepository.getEntriesByStudent(student.id);
      const studentBalance = studentEntries.reduce((total, entry) => {
        const amount = Number(entry.amount || 0);
        return total + (entry.entry_type === 'DEBIT' ? amount : -amount);
      }, 0);

      items.push(...studentEntries.map((entry) => ({
        id: entry.id,
        student_name: `${student.first_name} ${student.last_name}`,
        amount: entry.amount,
        entry_type: entry.entry_type,
      })));

      balance += studentBalance;
    }

    return { items, balance };
  },
};
