import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import useNotifications from '../../hooks/useNotifications';

const NotificationBell = () => {
  const { notifications, unreadCount, markAllAsRead, removeNotification, clearNotifications } =
    useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      markAllAsRead();
    }
  }, [isOpen, unreadCount, markAllAsRead]);

  const latestNotifications = useMemo(
    () =>
      [...notifications].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [notifications],
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type='button'
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-800"
        aria-label="Bildirişlər"
      >
        🔔
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-danger-500 px-1 text-[11px] font-semibold text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-[2000] mt-3 w-80 max-w-sm rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Bildirişlər</h2>
            {notifications.length > 0 ? (
              <button
                type='button'
                onClick={() => clearNotifications()}
                className="text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                Hamısını sil
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {latestNotifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                Yeni bildiriş yoxdur.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {latestNotifications.map((notification) => (
                  <li key={notification.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 inline-flex h-2 w-2 flex-shrink-0 rounded-full ${
                          notification.type === 'success'
                            ? 'bg-success-500'
                            : notification.type === 'error'
                              ? 'bg-danger-500'
                              : 'bg-primary-500'
                        }`}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">
                          {notification.title}
                        </p>
                        {notification.description ? (
                          <p className="mt-1 text-xs text-slate-500">
                            {notification.description}
                          </p>
                        ) : null}
                        <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
                          <time dateTime={notification.createdAt}>
                            {new Date(notification.createdAt).toLocaleString('az-AZ')}
                          </time>
                          <button
                            type='button'
                            onClick={() => removeNotification(notification.id)}
                            className="text-[11px] font-medium text-slate-400 hover:text-slate-600"
                          >
                            Sil
                          </button>
                        </div>
                        {notification.link ? (
                          <Link
                            to={notification.link.to}
                            className="mt-2 inline-flex text-xs font-medium text-primary-600 hover:text-primary-700"
                            onClick={() => setIsOpen(false)}
                          >
                            {notification.link.label}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default NotificationBell;


