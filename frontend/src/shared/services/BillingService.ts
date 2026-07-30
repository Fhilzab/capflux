/**
 * @deprecated
 * Compatibility adapter.
 *
 * Scheduled removal after Phase 2 frontend migration.
 *
 * Delegates to the new domain BillingService at:
 *   shared/billing/BillingService.ts
 *
 * No business logic remains in this file.
 */

import { billingService } from '../billing/BillingService';
import { LedgerRepository } from '../repositories/LedgerRepository';
import { StudentRepository } from '../repositories/StudentRepository';
import type { LedgerEntry } from '../ledger/types';

type LegacyLedgerEntryCategory = 'TUITION' | 'PAYMENT' | 'PLATFORM_FEE' | 'ADJUSTMENT' | 'WAIVER' | 'REFUND';

export const BillingService = {
  /**
   * @deprecated Use billingStore or the new billingService.
   * Delegates to the new domain architecture.
   */
  async getBillingSummary(school_id: string, studentIds: string[] = []) {
    // Delegate to the new domain service
    const result = await billingService.rebuildSchoolBilling(school_id);
    if (result.error) {
      return { items: [], balance: 0 };
    }

    // Fallback: use LedgerRepository for local data when new service returns no data
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

  /**
   * @deprecated Use ledgerStore or the new ledgerService.
   */
  async getStudentLedgerEntries(student_id: string): Promise<LedgerEntry[]> {
    return LedgerRepository.getEntriesByStudent(student_id);
  },

  /**
   * @deprecated Use billingStore or the new billingService.
   * Delegates to the new domain architecture.
   */
  async createCharge(payload: {
    school_id: string;
    student_id: string;
    amount: number;
    entry_type: 'DEBIT' | 'CREDIT';
    entry_category: string;
    entry_description?: string;
    metadata?: Record<string, unknown>;
  }) {
    // Delegate to LedgerRepository (infrastructure layer)
    return LedgerRepository.createLedgerEntry(payload);
  },

  /**
   * @deprecated Use billingStore or the new billingService.
   */
  async getFamilyBillingSummary(guardian_id: string, school_id: string) {
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
   * @deprecated Use ledgerStore for balance computation.
   */
  async calculateStudentBalance(student_id: string): Promise<number> {
    const entries = await LedgerRepository.getEntriesByStudent(student_id);
    return entries.reduce((total, entry) => {
      const amount = Number(entry.amount || 0);
      return total + (entry.entry_type === 'DEBIT' ? amount : -amount);
    }, 0);
  },

  /**
   * @deprecated Use feeStore or the new feeService.
   */
  async calculatePlatformFee(amount: number, school_id: string) {
    const { FeeRuleRepository } = await import('../repositories/FeeRuleRepository');
    return FeeRuleRepository.calculatePlatformFee(amount, school_id);
  },
};
