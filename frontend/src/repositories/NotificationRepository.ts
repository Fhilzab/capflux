import { LocalRepository } from '../offline/localDb';
import db from '../offline/localDb';

export const NotificationRepository = {
  async saveNotification(notification: Record<string, any>) {
    const saved = await LocalRepository.saveNotification(notification);

    await LocalRepository.enqueueSyncItem({
      id: `notification-sync-${saved.id}-${Date.now()}`,
      school_id: saved.school_id,
      entity_type: 'notifications',
      entity_id: saved.id,
      operation: 'UPSERT',
      payload: saved,
    });

    return saved;
  },

  async getNotificationsByStudent(student_id: string) {
    return LocalRepository.getNotificationsByStudent(student_id);
  },

  async getNotificationsByGuardian(guardian_id: string) {
    return LocalRepository.getNotificationsByGuardian(guardian_id);
  },

  async getNotificationById(notification_id: string) {
    return db.notifications.get(notification_id);
  },

  async updateDeliveryStatus(notification_id: string, status: string, provider_msg_id?: string) {
    const updates: Record<string, any> = {
      delivery_status: status,
    };
    if (provider_msg_id) {
      updates.provider_msg_id = provider_msg_id;
    }
    return db.notifications.update(notification_id, updates);
  },
};