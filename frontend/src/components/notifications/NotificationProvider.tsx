import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { toastBus } from '../../lib/toastBus';
import {
  NotificationContext,
  type NotificationContextValue,
  type NotificationItem,
  type NotificationType,
} from './notification-context';

const MAX_NOTIFICATIONS = 30;

const normalizeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((item) => (item.read ? item : { ...item, read: true })),
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    const unsubscribe = toastBus.subscribe((event) => {
      if (!event.persist) {
        return;
      }

      const id = event.id ?? normalizeId();
      const timestamp = event.timestamp ?? new Date().toISOString();
      const type: NotificationType = event.type ?? 'info';
      setNotifications((prev) => {
        const next: NotificationItem[] = [
          {
            id,
            title: event.title,
            description: event.description,
            type,
            createdAt: timestamp,
            read: false,
            link: event.link,
          },
          ...prev,
        ];
        return next.slice(0, MAX_NOTIFICATIONS);
      });
    });
    return unsubscribe;
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  );

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      markAllAsRead,
      removeNotification,
      clearNotifications,
    }),
    [notifications, unreadCount, markAllAsRead, removeNotification, clearNotifications],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export default NotificationProvider;


