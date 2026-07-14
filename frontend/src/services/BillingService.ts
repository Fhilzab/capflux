import { LedgerRepository } from '../repositories/LedgerRepository';
import { StudentRepository } from '../repositories/StudentRepository';
import { GuardianRepository } from '../repositories/GuardianRepository';
import db from '../offline/localDb';

export const BillingService = {
  async getBillingSummary(school_id: string, studentIds: string[] = []) {
    const students = studentIds.length
      ? await StudentRepository.getStudentsByIds(studentIds)
      : await StudentRepository.getStudentsBySchool(school_id);
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
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`,
        amount: entry.amount,
        entry_type: entry.entry_type,
        entry_description: entry.entry_description,
      })));

      balance += studentBalance;
    }

    return { items, balance };
  },

  async getStudentLedgerEntries(student_id: string) {
    return LedgerRepository.getEntriesByStudent(student_id);
  },

  async createCharge(payload: Record<string, any>) {
    return LedgerRepository.createLedgerEntry(payload);
  },

  /**
   * Get billing summary for all students of a guardian
   * Used for family-wide billing views in the future Flutter app
   */
  async getFamilyBillingSummary(guardian_id: string) {
    const students = await db.students
      .where('guardian_id')
      .equals(guardian_id)
      .toArray();
    
    const items = [];
    let totalBalance = 0;

    for (const student of students) {
      const studentEntries = await LedgerRepository.getEntriesByStudent(student.id);
      const studentBalance = studentEntries.reduce((total, entry) => {
        const amount = Number(entry.amount || 0);
        return total + (entry.entry_type === 'DEBIT' ? amount : -amount);
      }, 0);

      items.push(...studentEntries.map((entry) => ({
        id: entry.id,
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`,
        amount: entry.amount,
        entry_type: entry.entry_type,
        entry_category: entry.entry_category,
        entry_description: entry.entry_description,
      })));

      totalBalance += studentBalance;
    }

    return {
      items,
      balance: totalBalance,
      studentCount: students.length,
      students: students.map(s => ({
        id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        class: s.class_name,
      })),
    };
  },
};