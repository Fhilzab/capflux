/**
 * NotificationService
 *
 * Main application entry point.
 * Business modules call ONLY this service.
 *
 * Features:
 * - Fire-and-forget: notification failures never propagate to callers
 * - Auto correlationId reuse: reuses the same correlationId from Audit
 * - Idempotency: dedupeKey prevents duplicate notifications
 * - Delegates rendering to NotificationEngine
 * - Delegates channel selection to NotificationPreferenceProvider
 * - Delegates persistence to NotificationQueue
 * - Never communicates directly with providers
 */

import { NotificationEngine } from './NotificationEngine';
import { NotificationValidator } from './NotificationValidator';
import { NotificationQueue } from './NotificationQueue';
import { NotificationDispatcher } from './NotificationDispatcher';
import { NotificationPreferenceProvider } from './NotificationPreferenceProvider';
import { InAppProvider } from './InAppProvider';
import type {
  Notification,
  NotificationResult,
  NotificationChannel,
  NotificationPriority,
  NotificationTemplateId,
  SendPaymentReceivedInput,
  SendBillingCreatedInput,
  SendRefundProcessedInput,
  SendWaiverApprovedInput,
  SendAdjustmentMadeInput,
} from './types';
import { mapNotificationError } from './NotificationError';
import { generateUuidV7 } from '../core/IdGenerator';

export class NotificationService {
  private queue: NotificationQueue;
  private dispatcher: NotificationDispatcher;
  private preferenceProvider: NotificationPreferenceProvider;
  private inAppProvider: InAppProvider;

  constructor() {
    this.inAppProvider = new InAppProvider();
    this.queue = new NotificationQueue(this.inAppProvider);
    this.dispatcher = new NotificationDispatcher();
    this.preferenceProvider = new NotificationPreferenceProvider();
  }

  /**
   * Swap per-channel delivery providers at runtime (sandbox execution mode
   * uses this to deliver into the demo inbox). No-op in production usage.
   */
  setDispatcherOverrides(overrides: Parameters<NotificationDispatcher['constructor']>[0]): void {
    this.dispatcher = new NotificationDispatcher(overrides);
  }

  /**
   * Generate a dedupe key.
   * dedupeKey = organizationId + recipientId + templateId + correlationId
   */
  private generateDedupeKey(
    organizationId: string,
    recipientId: string,
    templateId: string,
    correlationId: string,
  ): string {
    return `${organizationId}:${recipientId}:${templateId}:${correlationId}`;
  }

  /**
   * Internal method to create, validate, and enqueue a notification.
   * Fire-and-forget: errors are logged but never propagated.
   */
  private async createAndSend(input: {
    organizationId: string;
    schoolId: string;
    studentId: string;
    templateId: NotificationTemplateId;
    priority: NotificationPriority;
    correlationId: string;
    variables: Record<string, string>;
    channels: NotificationChannel[];
    recipientPhone?: string;
    recipientEmail?: string;
    metadata?: Record<string, unknown>;
  }): Promise<NotificationResult<Notification>> {
    try {
      // Render the template
      const renderResult = NotificationEngine.render(input.templateId, input.variables);
      if (renderResult.error || !renderResult.data) {
        console.error('[NotificationService] Template render failed:', renderResult.error?.message);
        return { data: null, error: renderResult.error || { code: 'UNKNOWN', message: 'Template render failed' } };
      }

      // Generate dedupe key
      const dedupeKey = this.generateDedupeKey(
        input.organizationId,
        input.studentId,
        input.templateId,
        input.correlationId,
      );

      // Check for duplicate (idempotency)
      const existing = await this.inAppProvider.findByDedupeKey(dedupeKey);
      if (existing.data) {
        // Notification already exists — skip duplicate
        return { data: existing.data, error: null };
      }

      // Filter channels by preferences
      const enabledChannels = this.preferenceProvider.filterEnabledChannels(
        input.channels,
        input.studentId,
      );

      if (enabledChannels.length === 0) {
        return {
          data: null,
          error: {
            code: 'INVALID_CHANNEL',
            message: 'No enabled channels for recipient',
          },
        };
      }

      // Build the notification
      const notification: Notification = {
        id: generateUuidV7(),
        organizationId: input.organizationId,
        schoolId: input.schoolId,
        studentId: input.studentId,
        channels: enabledChannels,
        templateId: input.templateId,
        priority: input.priority,
        status: 'QUEUED',
        title: renderResult.data.title,
        body: renderResult.data.body,
        variables: input.variables,
        metadata: input.metadata,
        correlationId: input.correlationId,
        dedupeKey,
        recipientPhone: input.recipientPhone,
        recipientEmail: input.recipientEmail,
        attempts: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Validate
      const validation = NotificationValidator.validateNotification({
        organizationId: notification.organizationId,
        schoolId: notification.schoolId,
        studentId: notification.studentId,
        channels: notification.channels,
        templateId: notification.templateId,
        priority: notification.priority,
        variables: notification.variables,
        dedupeKey: notification.dedupeKey,
        recipientPhone: notification.recipientPhone,
        recipientEmail: notification.recipientEmail,
        metadata: notification.metadata,
      });

      if (!validation.valid) {
        console.error('[NotificationService] Validation failed:', validation.errors);
        return {
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Notification validation failed: ${Object.values(validation.errors).join(', ')}`,
          },
        };
      }

      // Enqueue for delivery
      const enqueueResult = await this.queue.enqueue(notification);
      if (enqueueResult.error || !enqueueResult.data) {
        console.error('[NotificationService] Enqueue failed:', enqueueResult.error?.message);
        return { data: null, error: enqueueResult.error || { code: 'UNKNOWN', message: 'Enqueue failed' } };
      }

      // Dispatch immediately (fire-and-forget)
      void this.dispatcher.dispatch(enqueueResult.data);

      return { data: enqueueResult.data, error: null };
    } catch (e) {
      console.error('[NotificationService] Failed to create notification:', e instanceof Error ? e.message : String(e));
      return { data: null, error: mapNotificationError(e, 'NOTIFICATION_CREATE_FAILED') };
    }
  }

  /**
   * Send a payment received notification.
   * Called by PaymentEngine after successful payment.
   * Fire-and-forget.
   */
  async sendPaymentReceived(input: SendPaymentReceivedInput): Promise<NotificationResult<Notification>> {
    return this.createAndSend({
      organizationId: input.organizationId,
      schoolId: input.schoolId,
      studentId: input.studentId,
      templateId: 'PAYMENT_RECEIVED',
      priority: 'HIGH',
      correlationId: input.correlationId || generateUuidV7(),
      variables: input.variables,
      channels: input.channels,
      recipientPhone: input.recipientPhone,
      recipientEmail: input.recipientEmail,
      metadata: input.metadata,
    });
  }

  /**
   * Send a billing created notification.
   * Called by BillingEngine after successful billing generation.
   * Fire-and-forget.
   */
  async sendBillingCreated(input: SendBillingCreatedInput): Promise<NotificationResult<Notification>> {
    return this.createAndSend({
      organizationId: input.organizationId,
      schoolId: input.schoolId,
      studentId: input.studentId,
      templateId: 'BILLING_CREATED',
      priority: 'NORMAL',
      correlationId: input.correlationId || generateUuidV7(),
      variables: input.variables,
      channels: input.channels,
      recipientPhone: input.recipientPhone,
      recipientEmail: input.recipientEmail,
      metadata: input.metadata,
    });
  }

  /**
   * Send a refund processed notification.
   * Called by JournalPoster after successful refund.
   * Fire-and-forget.
   */
  async sendRefundProcessed(input: SendRefundProcessedInput): Promise<NotificationResult<Notification>> {
    return this.createAndSend({
      organizationId: input.organizationId,
      schoolId: input.schoolId,
      studentId: input.studentId,
      templateId: 'REFUND_PROCESSED',
      priority: 'HIGH',
      correlationId: input.correlationId || generateUuidV7(),
      variables: input.variables,
      channels: input.channels,
      recipientPhone: input.recipientPhone,
      recipientEmail: input.recipientEmail,
      metadata: input.metadata,
    });
  }

  /**
   * Send a waiver approved notification.
   * Fire-and-forget.
   */
  async sendWaiverApproved(input: SendWaiverApprovedInput): Promise<NotificationResult<Notification>> {
    return this.createAndSend({
      organizationId: input.organizationId,
      schoolId: input.schoolId,
      studentId: input.studentId,
      templateId: 'WAIVER_APPROVED',
      priority: 'NORMAL',
      correlationId: input.correlationId || generateUuidV7(),
      variables: input.variables,
      channels: input.channels,
      recipientPhone: input.recipientPhone,
      recipientEmail: input.recipientEmail,
      metadata: input.metadata,
    });
  }

  /**
   * Send an adjustment made notification.
   * Fire-and-forget.
   */
  async sendAdjustmentMade(input: SendAdjustmentMadeInput): Promise<NotificationResult<Notification>> {
    return this.createAndSend({
      organizationId: input.organizationId,
      schoolId: input.schoolId,
      studentId: input.studentId,
      templateId: 'ADJUSTMENT_MADE',
      priority: 'NORMAL',
      correlationId: input.correlationId || generateUuidV7(),
      variables: input.variables,
      channels: input.channels,
      recipientPhone: input.recipientPhone,
      recipientEmail: input.recipientEmail,
      metadata: input.metadata,
    });
  }

  /**
   * Get all notifications for a student.
   */
  async getNotificationsByStudent(studentId: string): Promise<NotificationResult<Notification[]>> {
    return this.inAppProvider.getNotificationsByStudent(studentId);
  }

  /**
   * Get all notifications for a school.
   */
  async getNotificationsBySchool(schoolId: string): Promise<NotificationResult<Notification[]>> {
    return this.inAppProvider.getNotificationsBySchool(schoolId);
  }

  /**
   * Count unread notifications for a student.
   */
  async countUnread(studentId: string): Promise<NotificationResult<number>> {
    return this.inAppProvider.countUnread(studentId);
  }

  /**
   * Mark a notification as read.
   */
  async markAsRead(notificationId: string): Promise<NotificationResult<Notification>> {
    return this.inAppProvider.markAsRead(notificationId);
  }

  /**
   * Retry a failed notification.
   */
  async retryFailed(notificationId: string): Promise<NotificationResult<Notification>> {
    return this.queue.retry(notificationId);
  }

  /**
   * Cancel a notification.
   */
  async cancel(notificationId: string): Promise<NotificationResult<Notification>> {
    return this.inAppProvider.cancel(notificationId);
  }
}

/**
 * Singleton notification service instance.
 * Business modules import and use this directly.
 */
export const notificationService = new NotificationService();
