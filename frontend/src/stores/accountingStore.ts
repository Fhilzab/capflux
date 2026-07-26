import { defineStore } from 'pinia';
import type { JournalEntry, PostingBatch } from '../shared/accounting/types';

export const useAccountingStore = defineStore('accounting', {
  state: () => ({
    journals: [] as JournalEntry[],
    postingBatches: [] as PostingBatch[],
    loading: false as boolean,
    initialized: false as boolean,
    error: null as string | null,
  }),
  getters: {
    journalsBySchool: (state): Record<string, JournalEntry[]> => {
      const map: Record<string, JournalEntry[]> = {};
      for (const journal of state.journals) {
        if (!map[journal.schoolId]) map[journal.schoolId] = [];
        map[journal.schoolId].push(journal);
      }
      return map;
    },
    postedJournals: (state): JournalEntry[] =>
      state.journals.filter(j => j.postingStatus === 'POSTED'),
    draftJournals: (state): JournalEntry[] =>
      state.journals.filter(j => j.postingStatus === 'NOT_POSTED'),
  },
  actions: {
    async initialize() {
      this.loading = true;
      this.error = null;
      this.journals = [];
      this.postingBatches = [];
      this.loading = false;
      this.initialized = true;
    },

    async postJournal(journal: JournalEntry, batch: PostingBatch | null) {
      this.loading = true;
      this.error = null;

      try {
        const { JournalPoster } = await import('../shared/accounting/JournalPoster');
        const result = await JournalPoster.postJournal(journal, batch);

        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        if (result.data) {
          const existingIndex = this.journals.findIndex(j => j.id === result.data!.journal.id);
          if (existingIndex >= 0) {
            this.journals[existingIndex] = result.data.journal;
          } else {
            this.journals.push(result.data.journal);
          }
        }

        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to post journal';
        return false;
      } finally {
        this.loading = false;
      }
    },

    clear() {
      this.journals = [];
      this.postingBatches = [];
      this.loading = false;
      this.initialized = false;
      this.error = null;
    },
  },
});