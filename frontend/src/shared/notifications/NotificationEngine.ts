2222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222/**
 * NotificationEngine
 *
 * Responsible only for template rendering.
 * Templates are immutable — defined once, never modified at runtime.
 * The renderer substitutes variables into the body.
 */

import type { NotificationTemplate, NotificationTemplateId, NotificationResult, NotificationError } from './types';
import { createNotificationError } from './NotificationError';

/**
 * Immutable template definitions.
 * These are never modified at runtime.
 */
const TEMPLATES: Record<NotificationTemplateId, NotificationTemplate> = {
  PAYMENT_RECEIVED: {
    id: 'PAYMENT_RECEIVED',
    title: 'Payment Received',
    body: 'Payment of {amount} received for {studentName}.\nReceipt: {receiptNumber}',
    variables: ['studentName', 'amount', 'receiptNumber'],
  },
  BILLING_CREATED: {
    id: 'BILLING_CREATED',
    title: 'Fees Generated',
    body: 'School fees of {amount} have been generated for {studentName} for {term}.',
    variables: ['studentName', 'amount', 'term'],
  },
  PAYMENT_REMINDER: {
    id: 'PAYMENT_REMINDER',
    title: 'Fee Reminder',
    body: 'This is a reminder that {amount} in school fees is due for {studentName} by {dueDate}.',
    variables: ['studentName', 'amount', 'dueDate'],
  },
  REFUND_PROCESSED: {
    id: 'REFUND_PROCESSED',
    title: 'Refund Processed',
    body: 'A refund of {amount} has been processed for {studentName}.',
    variables: ['studentName', 'amount'],
  },
  WAIVER_APPROVED: {
    id: 'WAIVER_APPROVED',
    title: 'Waiver Approved',
    body: 'A fee waiver of {amount} has been approved for {studentName}.',
    variables: ['studentName', 'amount'],
  },
  ADJUSTMENT_MADE: {
    id: 'ADJUSTMENT_MADE',
    title: 'Fee Adjustment',
    body: 'An adjustment of {amount} has been applied to {studentName}\'s account.',
    variables: ['studentName', 'amount'],
  },
};

export class NotificationEngine {
  /**
   * Get a template by ID.
   */
  static getTemplate(templateId: NotificationTemplateId): NotificationTemplate | null {
    return TEMPLATES[templateId] || null;
  }

  /**
   * Get all available templates.
   */
  static getAllTemplates(): NotificationTemplate[] {
    return Object.values(TEMPLATES);
  }

  /**
   * Render a template by substituting variables.
   * Returns { title, body } with variables substituted.
   */
  static render(
    templateId: NotificationTemplateId,
    variables: Record<string, string>,
  ): NotificationResult<{ title: string; body: string }> {
    const template = TEMPLATES[templateId];
    if (!template) {
      const error: NotificationError = createNotificationError(
        'INVALID_TEMPLATE',
        `Unknown template: ${templateId}`,
      );
      return { data: null, error };
    }

    // Validate all required variables are present
    for (const requiredVar of template.variables) {
      if (!(requiredVar in variables) || !variables[requiredVar]) {
        const error: NotificationError = createNotificationError(
          'VALIDATION_ERROR',
          `Missing required variable: ${requiredVar}`,
        );
        return { data: null, error };
      }
    }

    // Substitute variables in title and body
    let title = template.title;
    let body = template.body;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      title = title.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
      body = body.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    }

    return { data: { title, body }, error: null };
  }
}
