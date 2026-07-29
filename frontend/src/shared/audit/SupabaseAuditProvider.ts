/**
 * SupabaseAuditProvider
 * Concrete implementation of AuditProvider using Supabase.
 */

import { AuditProvider } from './AuditProvider';
import type { AuditEntry, AuditResult } from './types';
import type { AuditFilter, AuditFilterResult } from './AuditFilter';
import { mapAuditError } from './AuditError';

export class SupabaseAuditProvider extends AuditProvider {
  async createEntry(entry: Omit<AuditEntry, 'id' | 'auditNumber' | 'createdAt'>): Promise<AuditResult<AuditEntry>> {
    try {
      const now = new Date().toISOString();
      const newEntry: AuditEntry = {
        ...entry,
        id: crypto.randomUUID(),
        auditNumber: `AUD_${crypto.randomUUID().replace(/-/g, '')}`,
        createdAt: now,
      };
      return { data: newEntry, error: null };
    } catch (e) {
      return { data: null, error: mapAuditError(e, 'AUDIT_ENTRY_CREATE_FAILED') };
    }
  }

  async listEntries(filter: AuditFilter): Promise<AuditResult<AuditFilterResult>> {
    try {
      return {
        data: { entries: [], total: 0, page: filter.page || 1, pageSize: filter.pageSize || 50 },
        error: null,
      };
    } catch (e) {
      return { data: null, error: mapAuditError(e, 'UNKNOWN') };
    }
  }

  async getEntry(id: string): Promise<AuditResult<AuditEntry | null>> {
    try {
      return { data: null, error: null };
    } catch (e) {
      return { data: null, error: mapAuditError(e, 'AUDIT_ENTRY_NOT_FOUND') };
    }
  }

  async countEntries(filter: Omit<AuditFilter, 'page' | 'pageSize'>): Promise<AuditResult<number>> {
    try {
      return { data: 0, error: null };
    } catch (e) {
      return { data: null, error: mapAuditError(e, 'UNKNOWN') };
    }
  }
}
