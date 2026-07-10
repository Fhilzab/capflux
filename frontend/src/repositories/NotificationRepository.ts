import { LocalRepository } from '../offline/localDb';

export const NotificationRepository = {
  async saveNotification(notification: Record<string, any>) {
    return LocalRepository.saveNotification(notification);
  },

  async getNotificationsByStudent(student_id: string) {
    return LocalRepository.getNotificationsByStudent(student_id);
  },
};
