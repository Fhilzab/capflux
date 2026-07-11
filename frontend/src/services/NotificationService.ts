import { NotificationRepository } from '../repositories/NotificationRepository';
import { supabase, hasSupabaseConfig } from './api/supabase';

const DEFAULT_SCHOOL_ID = 'demo-school';

export const NotificationService = {
  async sendNotification(notification: Record<string, any>) {
    const saved = await NotificationRepository.saveNotification({
      ...notification,
      delivery_status: notification.delivery_status ?? 'PENDING',
      delivery_method: notification.delivery_method ?? 'SMS',
      created_at: notification.created_at ?? new Date().toISOString(),
    });

    // Attempt to send via Edge Function if Supabase is configured
    if (hasSupabaseConfig) {
      try {
        const { data, error } = await supabase.functions.invoke('send-notification', {
          body: {
            id: saved.id,
            school_id: saved.school_id,
            student_id: saved.student_id,
            recipient_phone: saved.recipient_phone,
            message_body: saved.message_body,
            delivery_method: saved.delivery_method || 'SMS',
          },
        });

        if (error) {
          console.warn('Failed to send notification via Edge Function:', error.message);
        } else if (data?.success && data?.provider_msg_id) {
          // Mark as sent with provider message ID
          await NotificationRepository.updateDeliveryStatus(saved.id, 'SENT', data.provider_msg_id);
          return { ...saved, delivery_status: 'SENT', provider_msg_id: data.provider_msg_id };
        }
      } catch (err) {
        console.warn('Notification Edge Function call failed:', err);
      }
    }

    return saved;
  },

  async getNotificationsForStudent(student_id: string) {
    return NotificationRepository.getNotificationsByStudent(student_id);
  },

  async retryFailedNotification(notification_id: string) {
    const notification = await NotificationRepository.getNotificationById(notification_id);
    if (!notification) throw new Error('Notification not found');
    if (notification.delivery_status !== 'FAILED') throw new Error('Notification is not in failed state');

    await NotificationRepository.updateDeliveryStatus(notification_id, 'PENDING');
    return this.sendNotification(notification);
  },

  /**
   * Generate notification templates for common scenarios.
   */
  generateTemplates(student_name: string, class_name: string) {
    return {
      fee_reminder: `Dear Parent/Guardian, this is a reminder that fees for ${student_name} (${class_name}) are due. Please make payment at the school bursary. Thank you. - Capstone`,
      receipt_notice: `Dear Parent/Guardian, your payment for ${student_name} (${class_name}) has been received. Thank you. - Capstone`,
      outstanding_balance: `Dear Parent/Guardian, ${student_name} (${class_name}) has an outstanding balance. Please settle at the bursary office. - Capstone`,
      general_update: `Dear Parent/Guardian, this is an update regarding ${student_name} (${class_name}). Please contact the school for more information. - Capstone`,
    };
  },
};