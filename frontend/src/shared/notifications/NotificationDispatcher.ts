/**
 * NotificationDispatcher
 *
 * Routes notifications to the correct providers based on channels[].
 * For each channel in notification.channels, calls the appropriate provider's send().
 * Records a DeliveryAttempt for each channel.
 *
 * No business logic — only routing.
 */

import type { Notification, NotificationResult, NotificationChannel, DeliveryAttempt } from './types';
import { NotificationProvider } from './NotificationProvider';
import { InAppProvider } from './InAppProvider';
import { EmailProvider } from './EmailProvider';
import { SMSProvider } from './SMSProvider';
import { WhatsAppProvider } from './WhatsAppProvider';
import { PushProvider } from './PushProvider';
import { mapNotificationError } from './NotificationError';
import { generateUuidV7 } from '../core/IdGenerator';

export class NotificationDispatcher {
  private inAppProvider: InAppProvider;
  private emailProvider: EmailProvider;
  private smsProvider: SMSProvider;
  private whatsappProvider: WhatsAppProvider;
  private pushProvider: PushProvider;

  constructor() {
    this.inAppProvider = new InAppProvider();
    this.emailProvider = new EmailProvider();
    this.smsProvider = new SMSProvider();
    this.whatsappProvider = new WhatsAppProvider();
    this.pushProvider = new PushProvider();
  }

  /**
   * Dispatch a notification to all requested channels.
   * Returns the notification with all delivery attempts recorded.
   */
  async dispatch(notification: Notification): Promise<NotificationResult<Notification>> {
    try {
      let updatedNotification = { ...notification };

      for (const channel of notification.channels) {
        const provider = this.getProvider(channel);
        if (!provider) {
          // Record a failed attempt for unknown channels
          const attempt: DeliveryAttempt = {
            id: generateUuidV7(),
            notificationId: notification.id,
            channel,
            provider: 'UNKNOWN',
            attemptNumber: notification.attempts.length + 1,
            status: 'FAILED',
            errorMessage: `No provider available for channel: ${channel}`,
            attemptedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          };
          updatedNotification = {
            ...updatedNotification,
            attempts: [...updatedNotification.attempts, attempt],
          };
          continue;
        }

        const result = await provider.send(updatedNotification, channel);

        if (result.error) {
          // Record a failed attempt
          const attempt: DeliveryAttempt = {
            id: generateUuidV7(),
            notificationId: notification.id,
            channel,
            provider: channel,
            attemptNumber: notification.attempts.length + 1,
            status: 'FAILED',
            errorMessage: result.error.message,
            attemptedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          };
          updatedNotification = {
            ...updatedNotification,
            attempts: [...updatedNotification.attempts, attempt],
          };
        } else if (result.data) {
          // Provider returned updated notification with attempts
          updatedNotification = result.data;
        }
      }

      // Update overall status based on attempts
      const allDelivered = updatedNotification.attempts.every(a => a.status === 'DELIVERED');
      const anyDelivered = updatedNotification.attempts.some(a => a.status === 'DELIVERED');
      const allFailed = updatedNotification.attempts.every(a => a.status === 'FAILED');

      if (allDelivered) {
        updatedNotification.status = 'DELIVERED';
      } else if (anyDelivered) {
        updatedNotification.status = 'DELIVERED';
      } else if (allFailed) {
        updatedNotification.status = 'FAILED';
      } else {
        updatedNotification.status = 'SENT';
      }

      updatedNotification.sentAt = updatedNotification.sentAt || new Date().toISOString();
      updatedNotification.updatedAt = new Date().toISOString();

      // Persist the updated notification
      await this.inAppProvider.save(updatedNotification);

      return { data: updatedNotification, error: null };
    } catch (e) {
      return { data: null, error: mapNotificationError(e, 'NOTIFICATION_SEND_FAILED') };
    }
  }

  /**
   * Get the provider for a specific channel.
   */
  private getProvider(channel: NotificationChannel): NotificationProvider | null {
    switch (channel) {
      case 'IN_APP':
        return this.inAppProvider;
      case 'EMAIL':
        return this.emailProvider;
      case 'SMS':
        return this.smsProvider;
      case 'WHATSAPP':
        return this.whatsappProvider;
      case 'PUSH':
        return this.pushProvider;
      default:
        return null;
    }
  }

  /**
   * Process the queue — dispatch all ready notifications.
   */
  async processQueue(): Promise<NotificationResult<Notification[]>> {
    try {
      const ready = await this.inAppProvider.getNotificationsByStudent('');
      // In production, this would query the queue for ready notifications
      // For now, return empty
      return { data: [], error: null };
    } catch (e) {
      return { data: null, error: mapNotificationError(e, 'UNKNOWN') };
    }
  }
}
