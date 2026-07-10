import { NotificationRepository } from '../repositories/NotificationRepository';

export const NotificationService = {
  async sendNotification(notification: Record<string, any>) {
    const saved = await NotificationRepository.saveNotification({
      ...notification,
      delivery_status: notification.delivery_status ?? 'PENDING',
      created_at: notification.created_at ?? new Date().toISOString(),
    });

    return saved;
  },

  async getNotificationsForStudent(student_id: string) {
    return NotificationRepository.getNotificationsByStudent(student_id);
  },
};
