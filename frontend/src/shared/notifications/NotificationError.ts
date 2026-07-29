/**
 * NotificationError
 *
 * Friendly error mapping for notification failures.
 */

import type { NotificationError } from './types';

export function createNotificationError(
  code: string,
  message: string,
  raw?: unknown,
): NotificationError {
  return { code: code as any, message, raw };
}

export function mapNotificationError(error: unknown, fallbackCode: string): NotificationError {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const maybeError = error as { code?: unknown; message?: unknown };
    if (typeof maybeError.code === 'string') {
      return {
        code: maybeError.code as any,
        message: typeof maybeError.message === 'string' ? maybeError.message : 'Unknown notification error',
        raw: error,
      };
    }
  }
  if (error instanceof Error) {
    return { code: fallbackCode as any, message: error.message, raw: error };
  }
  return { code: fallbackCode as any, message: 'Unknown notification error', raw: error };
}

export function getNotificationErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    NOTIFICATION_NOT_FOUND: 'Notification not found.',
    NOTIFICATION_CREATE_FAILED: 'Failed to create notification.',
    NOTIFICATION_SEND_FAILED: 'Failed to send notification.',
    NOTIFICATION_CANCEL_FAILED: 'Failed to cancel notification.',
    INVALID_CHANNEL: 'Invalid notification channel.',
    INVALID_RECIPIENT: 'Invalid notification recipient.',
    INVALID_TEMPLATE: 'Invalid notification template.',
    DUPLICATE_NOTIFICATION: 'A notification with the same dedupe key already exists.',
    QUEUE_FULL: 'Notification queue is full.',
    VALIDATION_ERROR: 'Notification validation failed.',
    NETWORK_ERROR: 'Network error occurred while sending notification.',
    UNAUTHORIZED: 'Unauthorized to send notification.',
    UNKNOWN: 'An unknown error occurred.',
  };
  return messages[code] || messages.UNKNOWN;
}
