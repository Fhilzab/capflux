/**
 * AuditService
 *
 * The single business-logic layer between business modules and the AuditProvider.
 *
 * Architectural Rules:
 *   - Business modules only call AuditService (never AuditProvider directly)
 *   - Only AuditService talks to AuditProvider
 *   - Audit is append-only: NEVER update, NEVER delete, NEVER overwrite
 *   - Audit never modifies Ledger
 *   - Audit never depends on Reporting
 *   - Audit writes are fire-and-forget: a failed audit write never blocks
 *     a successful financial transaction
 *   - Never store passwords, tokens, OTPs, API keys, secrets, or private keys
 *   - Correlation IDs are propagated from the workflow boundary; if none is
 *     provided, one is generated automatically
 */

import { AuditEngine } from './AuditEngine';
import { AuditValidator } from './AuditValidator';
import { SupabaseAuditProvider } from './SupabaseAuditProvider';
import type { AuditProvider } from './AuditProvider';
import type {
  AuditEntry,
  AuditAction,
  AuditEntity,
  AuditSeverity,
  AuditResultStatus,
  AuditResult,
  SourceModule,
  AuditError,
} from './types';
import type { AuditContext } from './AuditContext';
import type { AuditMetadata } from './AuditValidator';
import { generateUuidV7 } from '../core/IdGenerator';

/**
 * Fields that must never appear in audit metadata.
 * These are matched case-insensitively against metadata keys.
 */
const SENSITIVE_METADATA_KEYS = new Set([
  'password',
  'passwd',
  'pwd',
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'otp',
  'api_key',
  'apikey',
  'secret',
  'private_key',
  'privatekey',
  'client_secret',
  'session_token',
  'auth_token',
  'authorization',
  'credential',
  'credentials',
]);

/**
 * Recursively sanitize metadata by removing sensitive keys.
 * Returns a new object — never mutates the input.
 */
function sanitizeAuditMetadata(metadata: unknown): AuditMetadata | undefined {
  if (metadata === undefined || metadata === null) {
    return undefined;
  }

  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();

    // Skip sensitive keys entirely
    if (SENSITIVE_METADATA_KEYS.has(lowerKey)) {
      continue;
    }

    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => {
        if (item === null || typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
          return item;
        }
        if (typeof item === 'object' && item !== null && !(item instanceof Date) && !(item instanceof Map) && !(item instanceof Set)) {
          return sanitizeAuditMetadata(item);
        }
        return null;
      });
    } else if (typeof value === 'object' && value !== null && !(value instanceof Date) && !(value instanceof Map) && !(value instanceof Set)) {
      if (value.constructor === Object || value.constructor === undefined) {
        sanitized[key] = sanitizeAuditMetadata(value);
      } else {
        // Class instance — replace with null
        sanitized[key] = null;
      }
    } else {
      // Functions, Dates, Maps, Sets — replace with null
      sanitized[key] = null;
    }
  }

  return sanitized as AuditMetadata;
}

/**
 * Input for recording a billing event.
 */
export interface RecordBillingInput {
  organizationId: string;
  schoolId?: string;
  entityId?: string;
  description: string;
  context: AuditContext;
  metadata?: unknown;
}

/**
 * Input for recording a payment event.
 */
export interface RecordPaymentInput {
  organizationId: string;
  schoolId?: string;
  entityId?: string;
  description: string;
  context: AuditContext;
  metadata?: unknown;
}

/**
 * Input for recording an approval (journal posting) event.
 */
export interface RecordApprovalInput {
  organizationId: string;
  schoolId?: string;
  entityId?: string;
  description: string;
  context: AuditContext;
  metadata?: unknown;
}

/**
 * Input for recording a reversal event.
 */
export interface RecordReversalInput {
  organizationId: string;
  schoolId?: string;
  entityId?: string;
  description: string;
  context: AuditContext;
  metadata?: unknown;
}

/**
 * Input for recording a refund event.
 */
export interface RecordRefundInput {
  organizationId: string;
  schoolId?: string;
  entityId?: string;
  description: string;
  context: AuditContext;
  metadata?: unknown;
}

/**
 * Input for recording an adjustment event.
 */
export interface RecordAdjustmentInput {
  organizationId: string;
  schoolId?: string;
  entityId?: string;
  description: string;
  context: AuditContext;
  metadata?: unknown;
}

/**
 * Input for recording an export event.
 */
export interface RecordExportInput {
  organizationId: string;
  schoolId?: string;
  entityId?: string;
  description: string;
  context: AuditContext;
  metadata?: unknown;
}

/**
 * Internal input for the generic record method.
 */
interface InternalRecordInput {
  organizationId: string;
  schoolId?: string;
  entityId?: string;
  description: string;
  action: AuditAction;
  entity: AuditEntity;
  severity: AuditSeverity;
  result: AuditResultStatus;
  failureReason?: string;
  context: AuditContext;
  metadata?: unknown;
}

export class AuditService {
  private provider: AuditProvider;

  constructor(provider?: AuditProvider) {
    this.provider = provider ?? new SupabaseAuditProvider();
  }

  /**
   * Set or replace the audit provider at runtime.
   */
  setProvider(provider: AuditProvider): void {
    this.provider = provider;
  }

  /**
   * Internal method to build, validate, and persist an audit entry.
   *
   * This is fire-and-forget: if the write fails, the error is logged but
   * never propagated to the caller. The financial transaction is always
   * considered complete regardless of audit outcome.
   */
  private async record(input: InternalRecordInput): Promise<AuditResult<AuditEntry>> {
    try {
      // Sanitize metadata to remove any sensitive fields
      const sanitizedMetadata = sanitizeAuditMetadata(input.metadata);

      // Auto-propagate correlation ID if not provided
      const context: AuditContext = {
        ...input.context,
        correlationId: input.context.correlationId ?? generateUuidV7(),
      };

      // Build the entry using AuditEngine
      const entryInput = AuditEngine.buildEntry({
        organizationId: input.organizationId,
        schoolId: input.schoolId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        description: input.description,
        severity: input.severity,
        result: input.result,
        failureReason: input.failureReason,
        context,
        metadata: sanitizedMetadata,
      });

      // Validate before persisting
      const validation = AuditValidator.validateEntry({
        organizationId: input.organizationId,
        action: input.action,
        entity: input.entity,
        description: input.description,
        severity: input.severity,
        result: input.result,
        sourceModule: context.sourceModule,
        metadata: sanitizedMetadata,
        occurredAt: entryInput.occurredAt,
      });

      if (!validation.valid) {
        const error: AuditError = {
          code: 'VALIDATION_ERROR',
          message: `Audit entry validation failed: ${Object.values(validation.errors).join(', ')}`,
          raw: validation.errors,
        };
        console.error('[AuditService] Validation failed:', validation.errors);
        return { data: null, error };
      }

      // Persist via the provider
      return await this.provider.createEntry(entryInput);
    } catch (e) {
      const error = {
        code: 'UNKNOWN' as const,
        message: e instanceof Error ? e.message : 'Unknown audit error',
        raw: e,
      };
      console.error('[AuditService] Failed to record audit entry:', error.message);
      return { data: null, error };
    }
  }

  /**
   * Record a billing creation event.
   * Called by BillingEngine after successful billing generation.
   *
   * Fire-and-forget: errors are logged but never propagated.
   */
  async recordBilling(input: RecordBillingInput): Promise<AuditResult<AuditEntry>> {
    return this.record({
      ...input,
      action: 'BILLING_CREATED',
      entity: 'BILLING',
      severity: 'INFO',
      result: 'SUCCESS',
    });
  }

  /**
   * Record a payment received event.
   * Called by PaymentEngine after successful payment confirmation.
   *
   * Fire-and-forget: errors are logged but never propagated.
   */
  async recordPayment(input: RecordPaymentInput): Promise<AuditResult<AuditEntry>> {
    return this.record({
      ...input,
      action: 'PAYMENT_RECEIVED',
      entity: 'PAYMENT',
      severity: 'INFO',
      result: 'SUCCESS',
    });
  }

  /**
   * Record a journal approval (posting) event.
   * Called by JournalPoster after successful journal posting.
   *
   * Fire-and-forget: errors are logged but never propagated.
   */
  async recordApproval(input: RecordApprovalInput): Promise<AuditResult<AuditEntry>> {
    return this.record({
      ...input,
      action: 'APPROVE',
      entity: 'JOURNAL',
      severity: 'INFO',
      result: 'SUCCESS',
    });
  }

  /**
   * Record a ledger reversal event.
   * Called by the caller of LedgerEngine (e.g., JournalPoster) after a
   * successful REVERSAL entry is created.
   *
   * Fire-and-forget: errors are logged but never propagated.
   */
  async recordReversal(input: RecordReversalInput): Promise<AuditResult<AuditEntry>> {
    return this.record({
      ...input,
      action: 'REVERSE',
      entity: 'LEDGER',
      severity: 'WARNING',
      result: 'SUCCESS',
    });
  }

  /**
   * Record a ledger refund event.
   * Called by the caller of LedgerEngine (e.g., JournalPoster) after a
   * successful REFUND entry is created.
   *
   * Fire-and-forget: errors are logged but never propagated.
   */
  async recordRefund(input: RecordRefundInput): Promise<AuditResult<AuditEntry>> {
    return this.record({
      ...input,
      action: 'CREATE',
      entity: 'LEDGER',
      severity: 'INFO',
      result: 'SUCCESS',
    });
  }

  /**
   * Record a ledger adjustment event.
   * Called by the caller of LedgerEngine (e.g., JournalPoster) after a
   * successful ADJUSTMENT entry is created.
   *
   * Fire-and-forget: errors are logged but never propagated.
   */
  async recordAdjustment(input: RecordAdjustmentInput): Promise<AuditResult<AuditEntry>> {
    return this.record({
      ...input,
      action: 'CREATE',
      entity: 'LEDGER',
      severity: 'INFO',
      result: 'SUCCESS',
    });
  }

  /**
   * Record a report export event.
   * Called by the export layer after a report is exported.
   *
   * Fire-and-forget: errors are logged but never propagated.
   */
  async recordExport(input: RecordExportInput): Promise<AuditResult<AuditEntry>> {
    return this.record({
      ...input,
      action: 'EXPORT',
      entity: 'REPORT',
      severity: 'INFO',
      result: 'SUCCESS',
    });
  }

  /**
   * List audit entries with filtering.
   */
  async listEntries(filter: import('./AuditFilter').AuditFilter): Promise<AuditResult<import('./AuditFilter').AuditFilterResult>> {
    return this.provider.listEntries(filter);
  }

  /**
   * Get a single audit entry by ID.
   */
  async getEntry(id: string): Promise<AuditResult<AuditEntry | null>> {
    return this.provider.getEntry(id);
  }

  /**
   * Count audit entries matching a filter.
   */
  async countEntries(filter: Omit<import('./AuditFilter').AuditFilter, 'page' | 'pageSize'>): Promise<AuditResult<number>> {
    return this.provider.countEntries(filter);
  }
}

/**
 * Singleton audit service instance.
 * Business modules import and use this directly.
 */
export const auditService = new AuditService();
