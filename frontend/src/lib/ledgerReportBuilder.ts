/** Real school-wide ledger reporting from the local ledger.
 *
 * These builders are READ-ONLY: they aggregate canonical integer-kobo ledger
 * entries into the tables the Reports / Outstanding fees / Daily collections
 * sidebar pages show. Student and class context is resolved from the local
 * students table and academic divisions, so no fabricated values are used.
 */
import { LedgerRepository } from '../shared/repositories/LedgerRepository';
import { StudentRepository } from '../shared/repositories/StudentRepository';
import { DivisionService } from '../shared/divisions/DivisionService';
import {
  getEntryAmountMinor,
  getEntryDate,
  isChargeEntry,
  isPaymentCreditEntry,
  isReversalDebitEntry,
  summarizeLedger,
  type LedgerRowLike,
} from './ledgerSemantics';

const divisionService = new DivisionService();

export interface StudentRowLike {
  id: string;
  first_name?: string;
  last_name?: string;
  division_id?: string;
  admission_number?: string;
  guardian_id?: string;
}

export interface OutstandingStudentRow {
  student_id: string;
  student_name: string;
  class_name: string;
  admission_number: string;
  assessedMinor: number;
  collectedMinor: number;
  outstandingMinor: number;
}

export interface RecentPaymentRow {
  id: string;
  student_id: string;
  student_name: string;
  amount_minor: number;
  entry_description?: string;
  occurred_at?: string;
}

export interface LedgerSchoolReport {
  assessedMinor: number;
  collectedMinor: number;
  outstandingMinor: number;
  paymentCount: number;
  studentCount: number;
  outstandingByStudent: OutstandingStudentRow[];
  outstandingCount: number;
  recentPayments: RecentPaymentRow[];
}

export async function buildLedgerSchoolReport(schoolId: string): Promise<LedgerSchoolReport> {
  const [entries, studentRows, divisions] = await Promise.all([
    LedgerRepository.getEntriesBySchool(schoolId) as Promise<LedgerRowLike[]>,
    StudentRepository.getStudentsBySchool(schoolId),
    divisionService.loadDivisions(schoolId),
  ]);

  const divisionName = (divisionId?: string): string => {
    if (!divisionId) return '';
    const division = (divisions.data ?? []).find((d) => d.id === divisionId);
    return division?.name || division?.code || '';
  };

  const students = (studentRows as unknown as StudentRowLike[]) ?? [];
  const studentById = new Map<string, StudentRowLike>();
  for (const student of students) studentById.set(student.id, student);

  const byStudent = new Map<string, OutstandingStudentRow>();
  for (const entry of entries) {
    const student = studentById.get(entry.student_id);
    let row = byStudent.get(entry.student_id);
    if (!row) {
      row = {
        student_id: entry.student_id,
        student_name: student
          ? `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() || 'Unknown student'
          : 'Unknown student',
        class_name: divisionName(student?.division_id),
        admission_number: student?.admission_number ?? '',
        assessedMinor: 0,
        collectedMinor: 0,
        outstandingMinor: 0,
      };
      byStudent.set(entry.student_id, row);
    }
    const minor = getEntryAmountMinor(entry);
    if (isChargeEntry(entry)) row.assessedMinor += minor;
    if (isPaymentCreditEntry(entry)) row.collectedMinor += minor;
    if (isReversalDebitEntry(entry)) row.collectedMinor -= minor;
    row.outstandingMinor = row.assessedMinor - row.collectedMinor;
  }

  const outstandingByStudent = [...byStudent.values()].sort((a, b) => b.outstandingMinor - a.outstandingMinor);

  const overall = summarizeLedger(entries);
  const recentPayments = entries
    .filter((entry) => isPaymentCreditEntry(entry))
    .map((entry) => ({
      id: entry.id,
      student_id: entry.student_id,
      student_name: studentById.get(entry.student_id)
        ? `${studentById.get(entry.student_id)?.first_name ?? ''} ${studentById.get(entry.student_id)?.last_name ?? ''}`.trim() || 'Unknown student'
        : 'Unknown student',
      amount_minor: getEntryAmountMinor(entry),
      entry_description: entry.entry_description,
      occurred_at: getEntryDate(entry) ?? '',
    }))
    .sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)));

  return {
    assessedMinor: overall.assessedMinor,
    collectedMinor: overall.collectedMinor,
    outstandingMinor: overall.outstandingMinor,
    paymentCount: recentPayments.length,
    studentCount: byStudent.size,
    outstandingByStudent,
    outstandingCount: outstandingByStudent.filter((row) => row.outstandingMinor > 0).length,
    recentPayments,
  };
}

export interface DailyCollectionRow {
  date: string;
  collectedMinor: number;
  count: number;
}

export async function buildDailyCollections(schoolId: string): Promise<DailyCollectionRow[]> {
  const entries = (await LedgerRepository.getEntriesBySchool(schoolId)) as LedgerRowLike[];
  const byDay = new Map<string, DailyCollectionRow>();
  for (const entry of entries) {
    if (!isPaymentCreditEntry(entry)) continue;
    const date = (getEntryDate(entry) ?? '').slice(0, 10);
    if (!date) continue;
    const row = byDay.get(date) ?? { date, collectedMinor: 0, count: 0 };
    row.collectedMinor += getEntryAmountMinor(entry);
    row.count += 1;
    byDay.set(date, row);
  }
  return [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date));
}