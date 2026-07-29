/**
 * AuditFilter
 * Reusable filters for querying audit entries.
 */

import type { AuditAction, AuditEntity } from './types';

export interface AuditFilter {
  organizationId: string;
  schoolId?: string;
  userId?: string;
  entity?: AuditEntity;
  action?: AuditAction;
  entityId?: string;
  startDate: string;
  endDate: string;
  page?: number;
  pageSize?: number;
}

export interface AuditFilterResult {
  entries: any[];
  total: number;
  page: number;
  pageSize: number;
}