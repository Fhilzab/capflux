import { LocalRepository } from '../offline/localDb';

export const NotificationRepository = {
  async saveNotification(notification: Record<string, any>) {
    return LocalRepository.saveNotification(notification);
  },
};
