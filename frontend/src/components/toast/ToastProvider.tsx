import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { toastBus, type ToastEvent } from '../../lib/toastBus';
import { ToastContext, type ToastContextValue, type ToastOptions } from './toast-context';

interface Toast extends Required<Omit<ToastOptions, 'id' | 'duration'>> {
  id: string;
  duration: number;
  persist: boolean;
  timestamp: string;
}

const DEFAULT_DURATION = 4000;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: ToastOptions) => {
      const generatedId =
        toast.id ??
        (typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2));
      const normalized: Toast = {
        id: generatedId,
        title: toast.title,
        description: toast.description ?? '',
        type: toast.type ?? 'info',
        duration: toast.duration ?? DEFAULT_DURATION,
        link: toast.link ?? { label: '', to: '/' },
        persist: Boolean('duration' in toast ? toast.duration === 0 : false),
        timestamp: new Date().toISOString(),
      };

      setToasts((prev) => [...prev, normalized]);

      if (normalized.duration > 0) {
        window.setTimeout(() => removeToast(generatedId), normalized.duration);
      }
    },
    [removeToast],
  );

  useEffect(() => {
    const unsubscribe = toastBus.subscribe((event: ToastEvent) => {
      if (!event.title) return;
      addToast({
        title: event.title,
        description: event.description,
        type: event.type,
        duration: event.duration,
        link: event.link,
      });
    });
    return unsubscribe;
  }, [addToast]);

  const value = useMemo<ToastContextValue>(
    () => ({
      addToast,
      removeToast,
    }),
    [addToast, removeToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-full max-w-xs flex-col gap-3 sm:max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-lg border bg-white shadow-lg transition duration-200 ease-out ${
              toast.type === 'error'
                ? 'border-danger/50'
                : toast.type === 'success'
                  ? 'border-success/50'
                  : 'border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
                {toast.description ? <p className="mt-1 text-xs text-slate-500">{toast.description}</p> : null}
                {toast.link ? (
                  <Link
                    to={toast.link.to}
                    className="mt-2 inline-flex text-xs font-medium text-primary-600 hover:text-primary-700"
                    onClick={() => removeToast(toast.id)}
                  >
                    {toast.link.label}
                  </Link>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 transition hover:text-slate-600"
              >
                <span className="sr-only">Bağla</span>
                ×
              </button>
            </div>
            <div
              className={`h-1 w-full rounded-b-lg ${
                toast.type === 'error'
                  ? 'bg-danger/80'
                  : toast.type === 'success'
                    ? 'bg-success/80'
                    : 'bg-primary-400'
              }`}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;

