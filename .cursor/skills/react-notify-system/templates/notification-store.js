import { create } from "zustand";

export const useNotificationStore = create((set) => ({
  items: [],
  setNotifications: (items) => set({ items }),
  addNotification: (notification) =>
    set((s) => ({ items: [notification, ...s.items] })),
  markAsRead: (id) =>
    set((s) => ({
      items: s.items.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      ),
    })),
  markAllAsRead: () =>
    set((s) => ({
      items: s.items.map((n) => ({ ...n, isRead: true })),
    })),
  removeNotification: (id) =>
    set((s) => ({
      items: s.items.filter((n) => n.id !== id),
    })),
}));

export const selectNotifications = (s) => s.items;
export const selectUnreadCount = (s) =>
  s.items.filter((notification) => !notification.isRead).length;
