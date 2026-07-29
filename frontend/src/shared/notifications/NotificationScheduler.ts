/**
 * NotificationScheduler
 *
 * Future reminder support.
 * Creates scheduled notifications only.
 * No cron implementation.
 *
 * Uses only Billing Profiles and Due Dates.
 * Never modifies Ledger.
 */

import type { Notification, NotificationResult, NotificationTemplateId, NotificationPriority, NotificationChannel } from './types';
import { InAppProvider } from './InAppProvider';
import { mapNotificationError } from './NotificationError';
import { generateUuidV7 } from '../core/IdGenerator';

export interface ScheduledNotificationInput {
  organizationId: string;
  schoolId: string;
  studentId: string;
  templateId: NotificationTemplateId;
  variables: Record<string, string>;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  scheduledFor: string; // ISO timestamp when the notification should be sent
  recipientPhone?: string;
  recipientEmail?: string;
  metadata?: Record<string, unknown>;
}

export class NotificationScheduler {
  private provider: InAppProvider;

  constructor(provider?: InAppProvider) {
    this.provider = provider ?? new InAppProvider();
  }

  /**
   * Schedule a notification for future delivery.
   * Creates a PENDING notification with a scheduled send time.
   */
  async scheduleReminder(input: ScheduledNotificationInput): Promise<NotificationResult<Notification>> {
    try {
      const dedupeKey = this.generateDedupeKey(
        input.organizationId,
        input.studentId,
        input.templateId,
        input.scheduledFor,
      );

      // Check for duplicate
      const existing = await this.provider.findByDedupeKey(dedupeKey);
      if (existing.data) {
        return {
          data: null,
          error: {
            code: 'DUPLICATE_NOTIFICATION',
            message: 'A scheduled notification with the same dedupe key already exists',
          },
        };
      }

      const notification: Notification = {
        id: generateUuidV7(),
        organizationId: input.organizationId,
        schoolId: input.schoolId,
        studentId: input.studentId,
        channels: input.channels,
        templateId: input.templateId,
        priority: input.priority,
        status: 'PENDING',
        title: '',
        body: '',
        variables: input.variables,
        metadata: {
          ...input.metadata,
          scheduledFor: input.scheduledFor,
        },
        correlationId: input.metadata?.correlationId as string | undefined,
        dedupeKey,
        recipientPhone: input.recipientPhone,
        recipientEmail: input.recipientEmail,
        attempts: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return await this.provider.save(notification);
    } catch (e) {
      return { data: null, error: mapNotificationError(e, 'NOTIFICATION_CREATE_FAILED') };
    }
  }

  /**
   * Get all scheduled notifications that are ready to be sent.
   */
  async getDueReminders(): Promise<NotificationResult<Notification[]>> {
    try {
      const now = Date.now();
      const db = (this.provider as any);
      if (db.db && db.db.notifications) {
        const notifications = await db.db.notifications
          .where('status')
          .equals('PENDING')
          .and((n: Notification) => {
            const scheduledFor = n.metadata?.scheduledFor as string | undefined;
            if (!scheduledFor) return false;
            return new Date(scheduledFor).getTime() <= now;
          })
          .sortBy('createdAt');
        return { data: notifications, error: null };
      }
      return { data: [], error: null };
    } catch (e) {
      return { data: null, error: mapNotificationError(e, 'UNKNOWN') };
    }
  }

  /**
   * Generate a dedupe key for scheduled notifications.
   */
  private generateDedupeKey(
    organizationId: string,
    studentId: string,
    templateId: string,
    scheduledFor: string,
  ): string {
    return `${organizationId}:${studentId}:${templateId}:${scheduledFor}`;
  }
}
