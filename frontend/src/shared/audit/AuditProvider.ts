/**
 * AuditProvider
 * Abstract persistence layer for audit entries.
 *
 * Performs ONLY persistence. No business logic.
 */

import type { AuditEntry, AuditResult } from './types';
import type { AuditFilter, AuditFilterResult } from './AuditFilter';

export abstract class AuditProvider {
  abstract createEntry(entry: Omit<AuditEntry, 'id' | 'auditNumber' | 'createdAt'>): Promise<AuditResult<AuditEntry>>;
  abstract listEntries(filter: AuditFilter): Promise<AuditResult<AuditFilterResult>>;
  abstract getEntry(id: string): Promise<AuditResult<AuditEntry | null>>;
  abstract countEntries(filter: Omit<AuditFilter, 'page' | 'pageSize'>): Promise<AuditResult<number>>;
}