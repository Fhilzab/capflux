import { defineStore } from 'pinia';
import { auditService } from '../shared/audit/AuditService';
import type { AuditEntry } from '../shared/audit/types';
import type { AuditFilter, AuditFilterResult } from '../shared/audit/AuditFilter';

export interface AuditState {
  entries: AuditEntry[];
  total: number;
  loading: boolean;
  initialized: boolean;
  error: string | null;
}

export const useAuditStore = defineStore('audit', {
  state: (): AuditState => ({
    entries: [],
    total: 0,
    loading: false,
    initialized: false,
    error: null,
  }),

  getters: {
    entriesByEntity: (state): Record<string, AuditEntry[]> => {
      const map: Record<string, AuditEntry[]> = {};
      for (const entry of state.entries) {
        if (!map[entry.entity]) map[entry.entity] = [];
        map[entry.entity].push(entry);
      }
      return map;
    },
    entriesByAction: (state): Record<string, AuditEntry[]> => {
      const map: Record<string, AuditEntry[]> = {};
      for (const entry of state.entries) {
        if (!map[entry.action]) map[entry.action] = [];
        map[entry.action].push(entry);
      }
      return map;
    },
    entriesByModule: (state): Record<string, AuditEntry[]> => {
      const map: Record<string, AuditEntry[]> = {};
      for (const entry of state.entries) {
        if (!map[entry.sourceModule]) map[entry.sourceModule] = [];
        map[entry.sourceModule].push(entry);
      }
      return map;
    },
    failedEntries: (state): AuditEntry[] =>
      state.entries.filter(e => e.result === 'FAILED'),
    criticalEntries: (state): AuditEntry[] =>
      state.entries.filter(e => e.severity === 'CRITICAL'),
    recentEntries: (state): AuditEntry[] =>
      [...state.entries].sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      ),
  },

  actions: {
    async initialize() {
      this.loading = true;
      this.error = null;
      this.entries = [];
      this.total = 0;
      this.loading = false;
      this.initialized = true;
    },

    async listEntries(filter: AuditFilter) {
      this.loading = true;
      this.error = null;

      try {
        const result = await auditService.listEntries(filter);

        if (result.error) {
          this.error = result.error.message;
          return;
        }

        if (result.data) {
          this.entries = result.data.entries;
          this.total = result.data.total;
        }
      } catch (e: any) {
        this.error = e?.message || 'Failed to load audit entries';
      } finally {
        this.loading = false;
        this.initialized = true;
      }
    },

    async getEntry(id: string): Promise<AuditEntry | null> {
      this.loading = true;
      this.error = null;

      try {
        const result = await auditService.getEntry(id);

        if (result.error) {
          this.error = result.error.message;
          return null;
        }

        return result.data;
      } catch (e: any) {
        this.error = e?.message || 'Failed to load audit entry';
        return null;
      } finally {
        this.loading = false;
      }
    },

    async countEntries(filter: Omit<AuditFilter, 'page' | 'pageSize'>) {
      this.loading = true;
      this.error = null;

      try {
        const result = await auditService.countEntries(filter);

        if (result.error) {
          this.error = result.error.message;
          return 0;
        }

        return result.data ?? 0;
      } catch (e: any) {
        this.error = e?.message || 'Failed to count audit entries';
        return 0;
      } finally {
        this.loading = false;
      }
    },

    clear() {
      this.entries = [];
      this.total = 0;
      this.loading = false;
      this.initialized = false;
      this.error = null;
    },
  },
});
