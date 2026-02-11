import { createContext } from 'react';

export type NotificationType = 'info' | 'success' | 'error';

export interface NotificationLink {
  label: string;
  to: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  description?: string;
  type: NotificationType;
  createdAt: string;
  read: boolean;
  link?: NotificationLink;
}

export interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

export const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);


