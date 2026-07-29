/**
 * Audit Module — Barrel Export
 *
 * Immutable operational audit records.
 * Audit records operational events (who did what, when, where).
 * Financial events belong in the Ledger.
 *
 * Audit is append-only:
 *   NEVER update
 *   NEVER delete
 *   NEVER overwrite
 */

// Types
export type {
  AuditAction,
  AuditEntity,
  AuditSeverity,
  AuditResultStatus,
  SourceModule,
  AuditEntry,
  AuditResult,
  AuditErrorCode,
  AuditError,
} from './types';

// Context
export type { AuditContext } from './AuditContext';
export { createAuditContext } from './AuditContext';

// Filter
export type { AuditFilter, AuditFilterResult } from './AuditFilter';

// Provider (abstract)
export { AuditProvider } from './AuditProvider';

// Provider (concrete)
export { SupabaseAuditProvider } from './SupabaseAuditProvider';

// Engine
export { AuditEngine } from './AuditEngine';

// Validator
export { AuditValidator } from './AuditValidator';
export type { AuditMetadataValue, AuditMetadata, AuditValidationResult } from './AuditValidator';

// Error helpers
export { createAuditError, mapAuditError } from './AuditError';

// Service
export { AuditService, auditService } from './AuditService';
export type {
  RecordBillingInput,
  RecordPaymentInput,
  RecordApprovalInput,
  RecordReversalInput,
  RecordRefundInput,
  RecordAdjustmentInput,
  RecordExportInput,
} from './AuditService';
