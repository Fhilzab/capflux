/**
 * AuditValidator
 *
 * Validates audit entries before they are persisted.
 * Ensures data integrity, metadata safety, and structural correctness.
 *
 * Audit is append-only:
 *   NEVER update
 *   NEVER delete
 *   NEVER overwrite
 */

import type { AuditAction, AuditEntity, AuditSeverity, AuditResultStatus, SourceModule } from './types';

/**
 * JSON-safe recursive metadata value type.
 * Prevents unsupported values like functions, Dates, Maps, or class instances.
 */
export type AuditMetadataValue =
  | string
  | number
  | boolean
  | null
  | AuditMetadataValue[]
  | { [key: string]: AuditMetadataValue };

export type AuditMetadata = Record<string, AuditMetadataValue>;

export interface AuditValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Validate that a value is JSON-safe (no functions, Dates, Maps, Sets, class instances).
 */
function isJsonSafe(value: unknown, depth = 0): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }
  if (depth > 10) {
    return false; // Prevent deeply nested structures
  }
  if (Array.isArray(value)) {
    return value.every(item => isJsonSafe(item, depth + 1));
  }
  if (typeof value === 'object') {
    // Reject Date, Map, Set, and class instances
    if (value instanceof Date || value instanceof Map || value instanceof Set) {
      return false;
    }
    if (value.constructor && value.constructor !== Object) {
      return false;
    }
    return Object.values(value).every(val => isJsonSafe(val, depth + 1));
  }
  return false;
}

/**
 * Validate metadata structure and size.
 */
export function validateMetadata(metadata: unknown): string[] {
  const errors: string[] = [];

  if (metadata === undefined || metadata === null) {
    return errors;
  }

  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    errors.push('metadata must be a plain object');
    return errors;
  }

  if (!isJsonSafe(metadata)) {
    errors.push('metadata contains unsupported types (functions, Dates, Maps, Sets, or class instances are not allowed)');
    return errors;
  }

  // Validate metadata size (max 10KB serialized)
  try {
    const serialized = JSON.stringify(metadata);
    if (serialized.length > 10240) {
      errors.push('metadata exceeds maximum size of 10KB');
    }
  } catch {
    errors.push('metadata is not serializable');
  }

  return errors;
}

/**
 * Validate an audit entry input before creation.
 */
export class AuditValidator {
  static validateEntry(input: {
    organizationId: string;
    action: AuditAction;
    entity: AuditEntity;
    description: string;
    severity: AuditSeverity;
    result: AuditResultStatus;
    sourceModule: SourceModule;
    metadata?: unknown;
    occurredAt?: string;
  }): AuditValidationResult {
    const errors: Record<string, string> = {};

    // Validate organizationId presence
    if (!input.organizationId || typeof input.organizationId !== 'string' || input.organizationId.trim() === '') {
      errors.organizationId = 'organizationId is required and must be a non-empty string';
    }

    // Validate description length
    if (!input.description || typeof input.description !== 'string') {
      errors.description = 'description is required and must be a string';
    } else {
      if (input.description.trim() === '') {
        errors.description = 'description must not be empty';
      }
      if (input.description.length > 500) {
        errors.description = 'description exceeds maximum length of 500 characters';
      }
    }

    // Validate severity/result combinations
    if (input.severity === 'CRITICAL' && input.result === 'SUCCESS') {
      errors.severity = 'CRITICAL severity should not be used with SUCCESS result';
    }

    // Validate timestamp sanity (occurredAt should not be in the far future)
    if (input.occurredAt) {
      const occurred = new Date(input.occurredAt);
      const now = new Date();
      const maxFuture = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes grace
      if (isNaN(occurred.getTime())) {
        errors.occurredAt = 'occurredAt is not a valid date';
      } else if (occurred.getTime() > maxFuture.getTime()) {
        errors.occurredAt = 'occurredAt is in the future';
      }
    }

    // Validate metadata
    if (input.metadata !== undefined) {
      const metadataErrors = validateMetadata(input.metadata);
      if (metadataErrors.length > 0) {
        errors.metadata = metadataErrors.join('; ');
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }
}
