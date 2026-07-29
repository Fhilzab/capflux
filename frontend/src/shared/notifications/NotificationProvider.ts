/**
 * NotificationProvider
 *
 * Abstract interface for notification delivery providers.
 * Each concrete provider (InApp, Email, SMS, WhatsApp, Push) implements this.
 */

import type { Notification, NotificationResult, NotificationChannel } from './types';

export abstract class NotificationProvider {
  /**
   * Send a notification on a specific channel.
   * Returns the notification with updated attempts.
   */
  abstract send(
    notification: Notification,
    channel: NotificationChannel,
  ): Promise<NotificationResult<Notification>>;

  /**
   * Get the delivery status of a notification.
   */
  abstract getStatus(notificationId: string): Promise<NotificationResult<Notification | null>>;

  /**
   * Cancel a notification (prevents further delivery attempts).
   */
  abstract cancel(notificationId: string): Promise<NotificationResult<Notification>>;
}
