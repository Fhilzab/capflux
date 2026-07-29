/**
 * Notification Module — Barrel Export
 *
 * Operational notification system — communicates business events to stakeholders.
 *
 * Notifications are infrastructure. They are fire-and-forget.
 * They NEVER modify Ledger, Journals, Billing, Payments, Reports, or Audit.
 */

// Types
export type {
  NotificationChannel,
  NotificationStatus,
  NotificationPriority,
  NotificationTemplateId,
  NotificationTemplate,
  Notification,
  DeliveryAttempt,
  NotificationPreference,
  NotificationResult,
  NotificationErrorCode,
  NotificationError,
  SendPaymentReceivedInput,
  SendBillingCreatedInput,
  SendRefundProcessedInput,
  SendWaiverApprovedInput,
  SendAdjustmentMadeInput,
} from './types';

// Error helpers
export { createNotificationError, mapNotificationError, getNotificationErrorMessage } from './NotificationError';

// Validator
export { NotificationValidator } from './NotificationValidator';
export type { NotificationValidationResult } from './NotificationValidator';

// Abstract provider
export { NotificationProvider } from './NotificationProvider';

// Concrete providers
export { InAppProvider } from './InAppProvider';
export { EmailProvider } from './EmailProvider';
export { SMSProvider } from './SMSProvider';
export { WhatsAppProvider } from './WhatsAppProvider';
export { PushProvider } from './PushProvider';

// Engine (template rendering)
export { NotificationEngine } from './NotificationEngine';

// Preference provider
export { NotificationPreferenceProvider } from './NotificationPreferenceProvider';

// Queue (persistence + backoff)
export { NotificationQueue } from './NotificationQueue';

// Dispatcher (routes to providers)
export { NotificationDispatcher } from './NotificationDispatcher';

// Scheduler (future reminders)
export { NotificationScheduler } from './NotificationScheduler';
export type { ScheduledNotificationInput } from './NotificationScheduler';

// Service (main entry point)
export { NotificationService, notificationService } from './NotificationService';
