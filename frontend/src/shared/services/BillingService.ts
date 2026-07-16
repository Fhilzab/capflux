import { LedgerRepository } from '../repositories/LedgerRepository';
import { StudentRepository } from '../repositories/StudentRepository';
import { FeeRuleRepository } from '../repositories/FeeRuleRepository';
import type { Student, LedgerEntry, LedgerEntryCategory } from '../types/billing';

export const BillingService = {
  async getBillingSummary(school_id: string, studentIds: string[] = []) {
    const students = studentIds.length
      ? await StudentRepository.getStudentsByIds(studentIds)
      : await StudentRepository.getStudentsBySchool(school_id);
    const items: Array<{
      id: string;
      student_id: string;
      student_name: string;
      amount: number;
      entry_type: string;
      entry_category: string;
      entry_description: string | undefined;
    }> = [];
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
        entry_category: entry.entry_category,
      })));

      balance += studentBalance;
    }

    return { items, balance };
  },

  async getStudentLedgerEntries(student_id: string): Promise<LedgerEntry[]> {
    return LedgerRepository.getEntriesByStudent(student_id);
  },

  async createCharge(payload: {
    school_id: string;
    student_id: string;
    amount: number;
    entry_type: 'DEBIT' | 'CREDIT';
    entry_category: LedgerEntryCategory;
    entry_description?: string;
    metadata?: Record<string, unknown>;
  }) {
    return LedgerRepository.createLedgerEntry(payload);
  },

  /**
   * Get billing summary for all students of a guardian
   * Used for family-wide billing views in the future Flutter app
   */
  async getFamilyBillingSummary(guardian_id: string, school_id: string) {
    // Import db locally to avoid circular dependency
    const { default: db } = await import('../../offline/localDb');
    
    const students = await db.students
      .where('guardian_id')
      .equals(guardian_id)
      .and((s) => s.school_id === school_id)
      .toArray();
    
    const items: Array<{
      id: string;
      student_id: string;
      student_name: string;
      amount: number;
      entry_type: string;
      entry_category: string;
      entry_description: string | undefined;
    }> = [];
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
      students: students.map((s) => ({
        id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        class: s.class_name,
        category: s.category,
      })),
    };
  },

  /**
   * Calculate student balance (computed from ledger entries)
   * No mutable balance stored - computed on demand
   */
  async calculateStudentBalance(student_id: string): Promise<number> {
    const entries = await LedgerRepository.getEntriesByStudent(student_id);
    return entries.reduce((total, entry) => {
      const amount = Number(entry.amount || 0);
      return total + (entry.entry_type === 'DEBIT' ? amount : -amount);
    }, 0);
  },

  /**
   * Calculate platform fee for a payment amount
   */
  async calculatePlatformFee(amount: number, school_id: string) {
    return FeeRuleRepository.calculatePlatformFee(amount, school_id);
  },
};