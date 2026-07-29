/**
 * Notification Domain Types
 *
 * Operational notification system — communicates business events to stakeholders.
 *
 * Notifications are infrastructure. They are fire-and-forget.
 * They NEVER modify Ledger, Journals, Billing, Payments, Reports, or Audit.
 * They NEVER rollback financial transactions.
 */

export type NotificationChannel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH' | 'IN_APP';

export type NotificationStatus = 'PENDING' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'CANCELLED';

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export type NotificationTemplateId =
  | 'PAYMENT_RECEIVED'
  | 'BILLING_CREATED'
  | 'PAYMENT_REMINDER'
  | 'REFUND_PROCESSED'
  | 'WAIVER_APPROVED'
  | 'ADJUSTMENT_MADE';

/**
 * Immutable notification template definition.
 * Templates are defined once and never modified at runtime.
 * The renderer substitutes variables into the body.
 */
export interface NotificationTemplate {
  id: NotificationTemplateId;
  title: string;
  body: string;
  variables: string[];
}

/**
 * A single delivery attempt for a notification on a specific channel.
 * Every attempt is preserved — nothing is overwritten.
 */
export interface DeliveryAttempt {
  id: string;
  notificationId: string;
  channel: NotificationChannel;
  provider: string;
  attemptNumber: number;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
  providerMessageId?: string;
  errorMessage?: string;
  attemptedAt: string;
  completedAt?: string;
}

/**
 * Notification preference for a student or guardian.
 * Determines which channels are enabled for delivery.
 */
export interface NotificationPreference {
  id: string;
  studentId?: string;
  guardianId?: string;
  channel: NotificationChannel;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * A notification record.
 * May target multiple channels — each channel gets its own DeliveryAttempt.
 */
export interface Notification {
  id: string;
  organizationId: string;
  schoolId: string;
  studentId: string;
  guardianId?: string;
  channels: NotificationChannel[];
  templateId: NotificationTemplateId;
  priority: NotificationPriority;
  status: NotificationStatus;
  title: string;
  body: string;
  variables: Record<string, string>;
  metadata?: Record<string, unknown>;
  correlationId?: string;
  dedupeKey: string;
  recipientPhone?: string;
  recipientEmail?: string;
  attempts: DeliveryAttempt[];
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationResult<T> {
  data: T | null;
  error: NotificationError | null;
}

export type NotificationErrorCode =
  | 'NOTIFICATION_NOT_FOUND'
  | 'NOTIFICATION_CREATE_FAILED'
  | 'NOTIFICATION_SEND_FAILED'
  | 'NOTIFICATION_CANCEL_FAILED'
  | 'INVALID_CHANNEL'
  | 'INVALID_RECIPIENT'
  | 'INVALID_TEMPLATE'
  | 'DUPLICATE_NOTIFICATION'
  | 'QUEUE_FULL'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'UNKNOWN';

export interface NotificationError {
  code: NotificationErrorCode;
  message: string;
  raw?: unknown;
}

/**
 * Input for sending a payment received notification.
 */
export interface SendPaymentReceivedInput {
  organizationId: string;
  schoolId: string;
  studentId: string;
  paymentId: string;
  correlationId?: string;
  variables: { studentName: string; amount: string; receiptNumber: string };
  channels: NotificationChannel[];
  recipientPhone?: string;
  recipientEmail?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Input for sending a billing created notification.
 */
export interface SendBillingCreatedInput {
  organizationId: string;
  schoolId: string;
  studentId: string;
  billingProfileId: string;
  correlationId?: string;
  variables: { studentName: string; amount: string; term: string };
  channels: NotificationChannel[];
  recipientPhone?: string;
  recipientEmail?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Input for sending a refund processed notification.
 */
export interface SendRefundProcessedInput {
  organizationId: string;
  schoolId: string;
  studentId: string;
  refundId: string;
  correlationId?: string;
  variables: { studentName: string; amount: string };
  channels: NotificationChannel[];
  recipientPhone?: string;
  recipientEmail?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Input for sending a waiver approved notification.
 */
export interface SendWaiverApprovedInput {
  organizationId: string;
  schoolId: string;
  studentId: string;
  waiverId: string;
  correlationId?: string;
  variables: { studentName: string; amount: string };
  channels: NotificationChannel[];
  recipientPhone?: string;
  recipientEmail?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Input for sending an adjustment made notification.
 */
export interface SendAdjustmentMadeInput {
  organizationId: string;
  schoolId: string;
  studentId: string;
  adjustmentId: string;
  correlationId?: string;
  variables: { studentName: string; amount: string };
  channels: NotificationChannel[];
  recipientPhone?: string;
  recipientEmail?: string;
  metadata?: Record<string, unknown>;
}
