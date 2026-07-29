import { defineStore } from 'pinia';
import { notificationService } from '../shared/notifications/NotificationService';
import type { Notification } from '../shared/notifications/types';

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  initialized: boolean;
  error: string | null;
}

export const useNotificationStore = defineStore('notification', {
  state: (): NotificationState => ({
    notifications: [],
    unreadCount: 0,
    loading: false,
    initialized: false,
    error: null,
  }),

  getters: {
    unreadNotifications: (state): Notification[] =>
      state.notifications.filter(n => !n.metadata?.read),
    notificationsByStudent: (state): Record<string, Notification[]> => {
      const map: Record<string, Notification[]> = {};
      for (const notification of state.notifications) {
        if (!map[notification.studentId]) map[notification.studentId] = [];
        map[notification.studentId].push(notification);
      }
      return map;
    },
    failedNotifications: (state): Notification[] =>
      state.notifications.filter(n => n.status === 'FAILED'),
    deliveredNotifications: (state): Notification[] =>
      state.notifications.filter(n => n.status === 'DELIVERED'),
    recentNotifications: (state): Notification[] =>
      [...state.notifications].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
  },

  actions: {
    async initialize() {
      this.loading = true;
      this.error = null;
      this.notifications = [];
      this.unreadCount = 0;
      this.loading = false;
      this.initialized = true;
    },

    async loadNotifications(studentId: string) {
      this.loading = true;
      this.error = null;

      try {
        const result = await notificationService.getNotificationsByStudent(studentId);

        if (result.error) {
          this.error = result.error.message;
          return;
        }

        if (result.data) {
          this.notifications = result.data;
          this.unreadCount = result.data.filter(n => !n.metadata?.read).length;
        }
      } catch (e: any) {
        this.error = e?.message || 'Failed to load notifications';
      } finally {
        this.loading = false;
        this.initialized = true;
      }
    },

    async loadSchoolNotifications(schoolId: string) {
      this.loading = true;
      this.error = null;

      try {
        const result = await notificationService.getNotificationsBySchool(schoolId);

        if (result.error) {
          this.error = result.error.message;
          return;
        }

        if (result.data) {
          this.notifications = result.data;
          this.unreadCount = result.data.filter(n => !n.metadata?.read).length;
        }
      } catch (e: any) {
        this.error = e?.message || 'Failed to load school notifications';
      } finally {
        this.loading = false;
        this.initialized = true;
      }
    },

    async markAsRead(notificationId: string) {
      try {
        const result = await notificationService.markAsRead(notificationId);
        if (result.error) {
          this.error = result.error.message;
          return;
        }

        const index = this.notifications.findIndex(n => n.id === notificationId);
        if (index >= 0) {
          this.notifications[index] = result.data!;
        }
        this.unreadCount = this.notifications.filter(n => !n.metadata?.read).length;
      } catch (e: any) {
        this.error = e?.message || 'Failed to mark notification as read';
      }
    },

    async markAllAsRead() {
      try {
        for (const notification of this.notifications) {
          if (!notification.metadata?.read) {
            await notificationService.markAsRead(notification.id);
            notification.metadata = { ...notification.metadata, read: true };
          }
        }
        this.unreadCount = 0;
      } catch (e: any) {
        this.error = e?.message || 'Failed to mark all notifications as read';
      }
    },

    async retryFailed(notificationId: string) {
      try {
        const result = await notificationService.retryFailed(notificationId);
        if (result.error) {
          this.error = result.error.message;
          return false;
        }

        const index = this.notifications.findIndex(n => n.id === notificationId);
        if (index >= 0) {
          this.notifications[index] = result.data!;
        }
        return true;
      } catch (e: any) {
        this.error = e?.message || 'Failed to retry notification';
        return false;
      }
    },

    async countUnread(studentId: string) {
      try {
        const result = await notificationService.countUnread(studentId);
        if (result.error) {
          this.error = result.error.message;
          return 0;
        }
        this.unreadCount = result.data ?? 0;
        return this.unreadCount;
      } catch (e: any) {
        this.error = e?.message || 'Failed to count unread notifications';
        return 0;
      }
    },

    clear() {
      this.notifications = [];
      this.unreadCount = 0;
      this.loading = false;
      this.initialized = false;
      this.error = null;
    },
  },
});
