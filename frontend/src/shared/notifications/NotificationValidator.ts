/**
 * NotificationValidator
 *
 * Validates notification data before it is enqueued.
 * Ensures data integrity and structural correctness.
 */

import type {
  NotificationChannel,
  NotificationTemplateId,
  NotificationPriority,
} from './types';

export interface NotificationValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const VALID_CHANNELS: NotificationChannel[] = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP'];
const VALID_TEMPLATE_IDS: NotificationTemplateId[] = [
  'PAYMENT_RECEIVED',
  'BILLING_CREATED',
  'PAYMENT_REMINDER',
  'REFUND_PROCESSED',
  'WAIVER_APPROVED',
  'ADJUSTMENT_MADE',
];
const VALID_PRIORITIES: NotificationPriority[] = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];

export class NotificationValidator {
  static validateNotification(input: {
    organizationId: string;
    schoolId: string;
    studentId: string;
    channels: NotificationChannel[];
    templateId: NotificationTemplateId;
    priority: NotificationPriority;
    variables: Record<string, string>;
    dedupeKey: string;
    recipientPhone?: string;
    recipientEmail?: string;
    metadata?: unknown;
  }): NotificationValidationResult {
    const errors: Record<string, string> = {};

    // Validate organizationId
    if (!input.organizationId || typeof input.organizationId !== 'string' || input.organizationId.trim() === '') {
      errors.organizationId = 'organizationId is required and must be a non-empty string';
    }

    // Validate schoolId
    if (!input.schoolId || typeof input.schoolId !== 'string' || input.schoolId.trim() === '') {
      errors.schoolId = 'schoolId is required and must be a non-empty string';
    }

    // Validate studentId
    if (!input.studentId || typeof input.studentId !== 'string' || input.studentId.trim() === '') {
      errors.studentId = 'studentId is required and must be a non-empty string';
    }

    // Validate channels
    if (!input.channels || !Array.isArray(input.channels) || input.channels.length === 0) {
      errors.channels = 'At least one channel is required';
    } else {
      for (const channel of input.channels) {
        if (!VALID_CHANNELS.includes(channel)) {
          errors.channels = `Invalid channel: ${channel}. Valid channels: ${VALID_CHANNELS.join(', ')}`;
          break;
        }
      }
    }

    // Validate templateId
    if (!input.templateId || !VALID_TEMPLATE_IDS.includes(input.templateId)) {
      errors.templateId = `Invalid templateId. Valid templates: ${VALID_TEMPLATE_IDS.join(', ')}`;
    }

    // Validate priority
    if (!input.priority || !VALID_PRIORITIES.includes(input.priority)) {
      errors.priority = `Invalid priority. Valid priorities: ${VALID_PRIORITIES.join(', ')}`;
    }

    // Validate dedupeKey
    if (!input.dedupeKey || typeof input.dedupeKey !== 'string' || input.dedupeKey.trim() === '') {
      errors.dedupeKey = 'dedupeKey is required and must be a non-empty string';
    }

    // Validate variables
    if (!input.variables || typeof input.variables !== 'object') {
      errors.variables = 'variables must be an object';
    } else {
      for (const [key, value] of Object.entries(input.variables)) {
        if (typeof value !== 'string') {
          errors.variables = `Variable '${key}' must be a string, got ${typeof value}`;
          break;
        }
      }
    }

    // Validate recipient — at least one of phone or email must be provided for external channels
    const hasExternalChannel = input.channels.some(c => c === 'EMAIL' || c === 'SMS' || c === 'WHATSAPP');
    if (hasExternalChannel) {
      if (!input.recipientPhone && !input.recipientEmail) {
        errors.recipient = 'At least one recipient (phone or email) is required for external channels';
      }
    }

    // Validate metadata size (max 10KB serialized)
    if (input.metadata !== undefined) {
      try {
        const serialized = JSON.stringify(input.metadata);
        if (serialized.length > 10240) {
          errors.metadata = 'metadata exceeds maximum size of 10KB';
        }
      } catch {
        errors.metadata = 'metadata is not serializable';
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }
}
