import { LocalRepository } from '../offline/localDb';

export const NotificationRepository = {
  async saveNotification(notification: Record<string, any>) {
    const saved = await LocalRepository.saveNotification(notification);

    await LocalRepository.enqueueSyncItem({
      id: `notification-sync-${saved.id}`,
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
};
