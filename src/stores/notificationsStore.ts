import { create } from 'zustand';
import type { Notification } from '../types';

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  reset: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.is_read).length,
    }),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + (notification.is_read ? 0 : 1),
    })),

  markAsRead: (notificationId) =>
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === notificationId ? { ...n, is_read: true } : n
      );
      return {
        notifications,
        unreadCount: notifications.filter((n) => !n.is_read).length,
      };
    }),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    })),

  reset: () => set({ notifications: [], unreadCount: 0 }),
}));
