import { defineStore } from 'pinia';
import { ledgerService } from '../shared/ledger/LedgerService';
import type { LedgerEntry } from '../shared/ledger/types';

export const useLedgerStore = defineStore('ledger', {
  state: () => ({
    ledgerEntries: [] as LedgerEntry[],
    loading: false as boolean,
    initialized: false as boolean,
    error: null as string | null,
  }),
  getters: {
    entriesByStudent: (state): Record<string, LedgerEntry[]> => {
      const map: Record<string, LedgerEntry[]> = {};
      for (const entry of state.ledgerEntries) {
        if (!map[entry.studentId]) map[entry.studentId] = [];
        map[entry.studentId].push(entry);
      }
      return map;
    },
    entriesBySession: (state): Record<string, LedgerEntry[]> => {
      const map: Record<string, LedgerEntry[]> = {};
      for (const entry of state.ledgerEntries) {
        if (!map[entry.academicSessionId]) map[entry.academicSessionId] = [];
        map[entry.academicSessionId].push(entry);
      }
      return map;
    },
    entriesByTerm: (state): Record<string, LedgerEntry[]> => {
      const map: Record<string, LedgerEntry[]> = {};
      for (const entry of state.ledgerEntries) {
        if (!map[entry.academicTermId]) map[entry.academicTermId] = [];
        map[entry.academicTermId].push(entry);
      }
      return map;
    },
    currentBalance: (state): ((studentId: string) => number) => {
      return (studentId: string): number => {
        const entries = state.ledgerEntries
          .filter(e => e.studentId === studentId)
          .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
        if (entries.length === 0) return 0;
        return entries[entries.length - 1].balanceAfterMinor;
      };
    },
    totalDebits: (state): number =>
      state.ledgerEntries.reduce((sum, e) => e.entryDirection === 'DEBIT' ? sum + e.amountMinor : sum, 0),
    totalCredits: (state): number =>
      state.ledgerEntries.reduce((sum, e) => e.entryDirection === 'CREDIT' ? sum + e.amountMinor : sum, 0),
    statement: (state): ((studentId: string) => LedgerEntry[]) => {
      return (studentId: string): LedgerEntry[] =>
        state.ledgerEntries
          .filter(e => e.studentId === studentId)
          .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    },
  },
  actions: {
    async initialize() {
      this.loading = true;
      this.error = null;
      this.ledgerEntries = [];
      this.loading = false;
      this.initialized = true;
    },

    async loadStudentLedger(studentId: string) {
      this.loading = true;
      this.error = null;

      try {
        // In production, this would call ledger provider via LedgerService
        this.ledgerEntries = [];
      } catch (e: any) {
        this.error = e?.message || 'Failed to load student ledger';
      } finally {
        this.loading = false;
      }
    },

    async loadSchoolLedger(schoolId: string) {
      this.loading = true;
      this.error = null;

      try {
        this.ledgerEntries = [];
      } catch (e: any) {
        this.error = e?.message || 'Failed to load school ledger';
      } finally {
        this.loading = false;
      }
    },

    async loadSessionLedger(schoolId: string, sessionId: string) {
      this.loading = true;
      this.error = null;

      try {
        this.ledgerEntries = [];
      } catch (e: any) {
        this.error = e?.message || 'Failed to load session ledger';
      } finally {
        this.loading = false;
      }
    },

    async loadTermLedger(schoolId: string, termId: string) {
      this.loading = true;
      this.error = null;

      try {
        this.ledgerEntries = [];
      } catch (e: any) {
        this.error = e?.message || 'Failed to load term ledger';
      } finally {
        this.loading = false;
      }
    },

    addEntry(entry: LedgerEntry) {
      this.ledgerEntries.push(entry);
      this.ledgerEntries.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    },

    clear() {
      this.ledgerEntries = [];
      this.loading = false;
      this.initialized = false;
      this.error = null;
    },
  },
});