/**
 * InAppProvider
 *
 * Stores notifications locally using Dexie (IndexedDB).
 * In-app notifications are always "delivered" immediately since they're local.
 *
 * This provider uses its own Dexie database to avoid conflicts with the
 * existing localDb.ts notification table (which uses a legacy type).
 */

import Dexie, { Table } from 'dexie';
import { NotificationProvider } from './NotificationProvider';
import type { Notification, NotificationResult, NotificationChannel, DeliveryAttempt } from './types';
import { createNotificationError, mapNotificationError } from './NotificationError';
import { generateUuidV7 } from '../core/IdGenerator';
import { runtimeEnvironment } from '../../shared/environment/runtimeEnvironment';

/**
 * Dexie database for the notification module.
 * Separate from localDb.ts to avoid type conflicts.
 * Sandbox mode uses its own database name for full isolation.
 */
class NotificationDB extends Dexie {
  notifications!: Table<Notification, string>;

  constructor() {
    super(runtimeEnvironment.isSandbox ? 'capflux_sandbox_notifications_db' : 'capflux_notifications_db');
    this.version(1).stores({
      notifications: 'id, organizationId, schoolId, studentId, guardianId, dedupeKey, status, createdAt',
    });
  }
}

const db = new NotificationDB();

export class InAppProvider extends NotificationProvider {
  /**
   * Store a notification locally and mark it as delivered (in-app is always deliverable).
   */
  async send(
    notification: Notification,
    channel: NotificationChannel,
  ): Promise<NotificationResult<Notification>> {
    try {
      const attempt: DeliveryAttempt = {
        id: generateUuidV7(),
        notificationId: notification.id,
        channel,
        provider: 'IN_APP',
        attemptNumber: notification.attempts.length + 1,
        status: 'DELIVERED',
        attemptedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      const updatedNotification: Notification = {
        ...notification,
        attempts: [...notification.attempts, attempt],
        status: 'DELIVERED',
        sentAt: notification.sentAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.notifications.put(updatedNotification);

      return { data: updatedNotification, error: null };
    } catch (e) {
      return { data: null, error: mapNotificationError(e, 'NOTIFICATION_SEND_FAILED') };
    }
  }

  /**
   * Get a notification by ID from local storage.
   */
  async getStatus(notificationId: string): Promise<NotificationResult<Notification | null>> {
    try {
      const notification = await db.notifications.get(notificationId);
      return { data: notification || null, error: null };
    } catch (e) {
      return { data: null, error: mapNotificationError(e, 'NOTIFICATION_NOT_FOUND') };
    }
  }

  /**
   * Cancel a notification by marking it as CANCELLED.
   */
  async cancel(notificationId: string): Promise<NotificationResult<Notification>> {
    try {
      const notification = await db.notifications.get(notificationId);
      if (!notification) {
        return {
          data: null,
          error: createNotificationError('NOTIFICATION_NOT_FOUND', 'Notification not found'),
        };
      }

      const updatedNotification: Notification = {
        ...notification,
        status: 'CANCELLED',
        updatedAt: new Date().toISOString(),
      };

      await db.notifications.put(updatedNotification);

      return { data: updatedNotification, error: null };
    } catch (e) {
      return { data: null, error: mapNotificationError(e, 'NOTIFICATION_CANCEL_FAILED') };
    }
  }

  /**
   * Get all notifications for a student.
   */
  async getNotificationsByStudent(studentId: string): Promise<NotificationResult<Notification[]>> {
    try {
      const notifications = await db.notifications
        .where('studentId')
        .equals(studentId)
        .sortBy('createdAt');
      return { data: notifications, error: null };
    } catch (e) {
      return { data: null, error: mapNotificationError(e, 'UNKNOWN') };
    }
  }

  /**
   * Get all notifications for a school.
   */
  async getNotificationsBySchool(schoolId: string): Promise<NotificationResult<Notification[]>> {
    try {
      const notifications = await db.notifications
        .where('schoolId')
        .equals(schoolId)
        .sortBy('createdAt');
      return { data: notifications, error: null };
    } catch (e) {
      return { data: null, error: mapNotificationError(e, 'UNKNOWN') };
    }
  }

  /**
   * Count unread notifications for a student.
   */
  async countUnread(studentId: string): Promise<NotificationResult<number>> {
    try {
      const count = await db.notifications
        .where('studentId')
        .equals(studentId)
        .and(n => n.status === 'DELIVERED' && !n.metadata?.read)
        .count();
      return { data: count, error: null };
    } catch (e) {
      return { data: 0, error: mapNotificationError(e, 'UNKNOWN') };
    }
  }

  /**
   * Mark a notification as read.
   */
  async markAsRead(notificationId: string): Promise<NotificationResult<Notification>> {
    try {
      const notification = await db.notifications.get(notificationId);
      if (!notification) {
        return {
          data: null,
          error: createNotificationError('NOTIFICATION_NOT_FOUND', 'Notification not found'),
        };
      }

      const updatedNotification: Notification = {
        ...notification,
        metadata: { ...notification.metadata, read: true },
        updatedAt: new Date().toISOString(),
      };

      await db.notifications.put(updatedNotification);

      return { data: updatedNotification, error: null };
    } catch (e) {
      return { data: null, error: mapNotificationError(e, 'UNKNOWN') };
    }
  }

  /**
   * Check if a notification with the given dedupeKey already exists.
   */
  async findByDedupeKey(dedupeKey: string): Promise<NotificationResult<Notification | null>> {
    try {
      const notification = await db.notifications
        .where('dedupeKey')
        .equals(dedupeKey)
        .first();
      return { data: notification || null, error: null };
    } catch (e) {
      return { data: null, error: mapNotificationError(e, 'UNKNOWN') };
    }
  }

  /**
   * Save a notification to the queue (status PENDING/QUEUED).
   */
  async save(notification: Notification): Promise<NotificationResult<Notification>> {
    try {
      await db.notifications.put(notification);
      return { data: notification, error: null };
    } catch (e) {
      return { data: null, error: mapNotificationError(e, 'NOTIFICATION_CREATE_FAILED') };
    }
  }

  /**
   * Update a notification's status.
   */
  async updateStatus(
    notificationId: string,
    status: Notification['status'],
    additionalUpdates?: Partial<Notification>,
  ): Promise<NotificationResult<Notification>> {
    try {
      const notification = await db.notifications.get(notificationId);
      if (!notification) {
        return {
          data: null,
          error: createNotificationError('NOTIFICATION_NOT_FOUND', 'Notification not found'),
        };
      }

      const updatedNotification: Notification = {
        ...notification,
        status,
        updatedAt: new Date().toISOString(),
        ...additionalUpdates,
      };

      await db.notifications.put(updatedNotification);

      return { data: updatedNotification, error: null };
    } catch (e) {
      return { data: null, error: mapNotificationError(e, 'UNKNOWN') };
    }
  }
}
