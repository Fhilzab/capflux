import { defineStore } from 'pinia';
import { billingService } from '../shared/billing/BillingService';
import { LedgerRepository } from '../shared/repositories/LedgerRepository';
import { StudentRepository } from '../shared/repositories/StudentRepository';
import type { BillingProfile, StudentCharge } from '../shared/billing/types';
import type { LedgerEntry } from '../shared/ledger/types';
import { getEntryAmountMinor, getEntryDate, isChargeEntry, isPaymentCreditEntry, summarizeLedger, type LedgerRowLike, type LedgerSummaryMinor } from '../lib/ledgerSemantics';
import { useSchoolStore } from './schoolStore';

export interface BillingSummaryItem {
  id: string;
  student_id: string;
  student_name: string;
  amount_minor: number;
  entry_type: string;
  entry_direction?: string;
  entry_category: string;
  entry_description?: string;
  occurred_at?: string;
}

export const useBillingStore = defineStore('billing', {
  state: () => ({
    billingProfiles: [] as BillingProfile[],
    studentCharges: [] as StudentCharge[],
    loading: false as boolean,
    initialized: false as boolean,
    error: null as string | null,
  }),
  getters: {
    chargesByStudent: (state): Record<string, StudentCharge[]> => {
      const map: Record<string, StudentCharge[]> = {};
      for (const charge of state.studentCharges) {
        if (!map[charge.studentId]) map[charge.studentId] = [];
        map[charge.studentId].push(charge);
      }
      return map;
    },
    mandatoryCharges: (state): StudentCharge[] => state.studentCharges.filter(c => c.chargeSource === 'MANDATORY' || c.chargeSource === 'PLATFORM'),
    optionalCharges: (state): StudentCharge[] => state.studentCharges.filter(c => c.chargeSource === 'OPTIONAL'),
    mandatoryTotal: (state): number => 0,
    optionalTotal: (state): number => 0,
    grandTotal: (state): number => 0,
    studentChargeCount: (state): number => state.studentCharges.length,
  },
  actions: {
    async initialize() {
      this.loading = true;
      this.error = null;

      try {
        const schoolStore = useSchoolStore();
        const schoolId = schoolStore.currentSchoolId;

        if (schoolId) {
          const profileResult = await billingService.rebuildSchoolBilling(schoolId);
          if (profileResult.error) {
            this.error = profileResult.error.message;
          }
        }

        this.billingProfiles = [];
        this.studentCharges = [];
      } catch (e: any) {
        this.error = e?.message || 'Failed to load billing data';
        this.billingProfiles = [];
        this.studentCharges = [];
      } finally {
        this.loading = false;
        this.initialized = true;
      }
    },

    async initializeStudentBilling(studentId: string, profile: BillingProfile) {
      this.loading = true;
      this.error = null;

      try {
        const result = await billingService.initializeStudentBilling(studentId, profile);
        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        if (result.data?.charges) {
          this.studentCharges.push(...result.data.charges);
        }
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to initialize student billing';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async loadStudentCharges(studentId: string) {
      this.loading = true;
      this.error = null;

      try {
        const result = await billingService.rebuildStudentBilling(studentId);
        if (result.error) {
          this.error = result.error.message;
          return;
        }

        this.studentCharges = [];
      } catch (e: any) {
        this.error = e?.message || 'Failed to load student charges';
      } finally {
        this.loading = false;
      }
    },

    /**
     * Get billing summary for a school (optionally filtered by student IDs).
     * Delegates to LedgerRepository for local data. Amounts follow the
     * canonical integer-kobo ledger semantics (CHARGE debits vs PAYMENT
     * credits net of reversal debits), matching the dashboard compound chart.
     */
    async getBillingSummary(schoolId: string, studentIds: string[] = []): Promise<{
      items: BillingSummaryItem[];
      summary: LedgerSummaryMinor;
    }> {
      this.loading = true;
      this.error = null;

      try {
        const students = studentIds.length
          ? await StudentRepository.getStudentsByIds(studentIds)
          : await StudentRepository.getStudentsBySchool(schoolId);

        const items: BillingSummaryItem[] = [];
        let assessedMinor = 0;
        let collectedMinor = 0;
        let outstandingMinor = 0;

        for (const student of students) {
          const rows = (await LedgerRepository.getEntriesByStudent(student.id)) as LedgerRowLike[];
          const { assessedMinor: a, collectedMinor: c, outstandingMinor: o } = summarizeLedger(rows);
          assessedMinor += a;
          collectedMinor += c;
          outstandingMinor += o;

          items.push(
            ...rows.map((entry) => ({
              id: entry.id,
              student_id: student.id,
              student_name: `${student.first_name} ${student.last_name}`,
              amount_minor: getEntryAmountMinor(entry),
              entry_type: entry.entry_type ?? (isPaymentCreditEntry(entry) ? 'PAYMENT' : isChargeEntry(entry) ? 'CHARGE' : 'UNKNOWN'),
              entry_direction: entry.entry_direction ?? (isChargeEntry(entry) ? 'DEBIT' : isPaymentCreditEntry(entry) ? 'CREDIT' : ''),
              entry_category: entry.entry_category ?? '',
              entry_description: entry.entry_description,
              occurred_at: getEntryDate(entry),
            })),
          );
        }

        return { items, summary: { assessedMinor, collectedMinor, outstandingMinor } };
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load billing summary';
        return { items: [], summary: { assessedMinor: 0, collectedMinor: 0, outstandingMinor: 0 } };
      } finally {
        this.loading = false;
      }
    },

    /**
     * Create a charge (ledger entry) for a student.
     * Delegates to LedgerRepository.
     */
    async createCharge(payload: {
      school_id: string;
      student_id: string;
      amount: number;
      entry_type: 'DEBIT' | 'CREDIT';
      entry_category?: string;
      entry_description?: string;
      metadata?: Record<string, unknown>;
    }): Promise<void> {
      this.loading = true;
      this.error = null;

      try {
        await LedgerRepository.createLedgerEntry({
          ...payload,
          entry_category: payload.entry_category || (payload.entry_type === 'DEBIT' ? 'TUITION' : 'PAYMENT'),
        });
      } catch (e: any) {
        this.error = e?.message || 'Failed to create charge';
      } finally {
        this.loading = false;
      }
    },

    /**
     * Load ledger entries for a student.
     * Delegates to LedgerRepository.
     */
    async loadStudentLedger(studentId: string): Promise<LedgerEntry[]> {
      this.loading = true;
      this.error = null;

      try {
        return await LedgerRepository.getEntriesByStudent(studentId);
      } catch (e: any) {
        this.error = e?.message || 'Failed to load student ledger';
        return [];
      } finally {
        this.loading = false;
      }
    },

    clear() {
      this.billingProfiles = [];
      this.studentCharges = [];
      this.loading = false;
      this.initialized = false;
      this.error = null;
    },
  },
});
