/**
 * Audit Trail Types
 * Immutable operational audit records.
 *
 * Audit records operational events (who did what, when, where).
 * Financial events belong in the Ledger.
 *
 * Audit is append-only:
 *   NEVER update
 *   NEVER delete
 *   NEVER overwrite
 */

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'SESSION_REVOKED'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'VIEW'
  | 'EXPORT'
  | 'APPROVE'
  | 'REVERSE'
  | 'PAYMENT_RECEIVED'
  | 'BILLING_CREATED'
  | 'ROLE_CHANGED';

export type AuditEntity =
  | 'USER'
  | 'SESSION'
  | 'STUDENT'
  | 'GUARDIAN'
  | 'FEE'
  | 'BILLING'
  | 'PAYMENT'
  | 'JOURNAL'
  | 'LEDGER'
  | 'REPORT'
  | 'ROLE'
  | 'SYSTEM';

export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type AuditResultStatus = 'SUCCESS' | 'FAILED';

export type SourceModule =
  | 'AUTH'
  | 'BILLING'
  | 'PAYMENTS'
  | 'ACCOUNTING'
  | 'LEDGER'
  | 'REPORTING'
  | 'SYSTEM';

export interface AuditEntry {
  id: string;
  auditNumber: string;
  organizationId: string;
  schoolId?: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  sourceModule: SourceModule;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  description: string;
  severity: AuditSeverity;
  result: AuditResultStatus;
  failureReason?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  metadata?: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}

export interface AuditResult<T> {
  data: T | null;
  error: AuditError | null;
}

export type AuditErrorCode =
  | 'AUDIT_ENTRY_NOT_FOUND'
  | 'AUDIT_ENTRY_CREATE_FAILED'
  | 'INVALID_AUDIT_ENTRY'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'UNKNOWN';

export interface AuditError {
  code: AuditErrorCode;
  message: string;
  raw?: unknown;
}