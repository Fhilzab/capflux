/**
 * PushProvider
 *
 * Stub implementation — no push notification service yet.
 * Future: Firebase Cloud Messaging integration.
 */

import { NotificationProvider } from './NotificationProvider';
import type { Notification, NotificationResult, NotificationChannel, DeliveryAttempt } from './types';
import { mapNotificationError } from './NotificationError';
import { generateUuidV7 } from '../core/IdGenerator';

export class PushProvider extends NotificationProvider {
  async send(
    notification: Notification,
    channel: NotificationChannel,
  ): Promise<NotificationResult<Notification>> {
    try {
      const attempt: DeliveryAttempt = {
        id: generateUuidV7(),
        notificationId: notification.id,
        channel,
        provider: 'PUSH',
        attemptNumber: notification.attempts.length + 1,
        status: 'FAILED',
        errorMessage: 'Push provider not yet configured. Push delivery is a stub.',
        attemptedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      const updatedNotification: Notification = {
        ...notification,
        attempts: [...notification.attempts, attempt],
        status: 'FAILED',
        updatedAt: new Date().toISOString(),
      };

      return { data: updatedNotification, error: null };
    } catch (e) {
      return { data: null, error: mapNotificationError(e, 'NOTIFICATION_SEND_FAILED') };
    }
  }

  async getStatus(notificationId: string): Promise<NotificationResult<Notification | null>> {
    return { data: null, error: null };
  }

  async cancel(notificationId: string): Promise<NotificationResult<Notification>> {
    return { data: null, error: mapNotificationError(new Error('Not implemented'), 'NOTIFICATION_CANCEL_FAILED') };
  }
}
