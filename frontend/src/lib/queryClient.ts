import { QueryCache, QueryClient, MutationCache } from '@tanstack/react-query';
import { toastBus, type ToastEvent } from './toastBus';
import { getErrorMessage } from './requestError';

interface NotificationMeta {
  title?: string;
  description?: string;
  type?: 'info' | 'success' | 'error';
  persist?: boolean;
  link?: {
    label: string;
    to: string;
  };
  duration?: number;
}

interface MutationMeta {
  successMessage?: string;
  errorMessage?: string;
  notification?: NotificationMeta;
  errorNotification?: NotificationMeta;
}

const emitToast = (event: ToastEvent) => {
  toastBus.emit({
    timestamp: new Date().toISOString(),
    ...event,
  });
};

const mergeNotification = (
  base: ToastEvent,
  override?: NotificationMeta,
  fallbackDescription?: string,
) => {
  if (!override) {
    return base;
  }
  return {
    ...base,
    title: override.title ?? base.title,
    description: override.description ?? base.description ?? fallbackDescription,
    type: override.type ?? base.type,
    persist: override.persist ?? base.persist,
    duration: override.duration ?? base.duration,
    link: override.link ?? base.link,
  };
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Pəncərə fokuslandıqda yenidən fetch etmə (məlumatların sabit qalması üçün)
      staleTime: 1000 * 60 * 60 * 24, // 24 saat - cache-də uzun müddət saxla (məlumatların sabit qalması üçün)
      gcTime: 1000 * 60 * 60 * 24 * 7, // 7 gün - garbage collection zamanı (məlumatların sabit qalması üçün)
      refetchOnMount: false, // Mount olduqda yenidən fetch etmə (məlumatların sabit qalması üçün)
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      emitToast({
        type: 'error',
        title: 'Məlumat yüklənmədi',
        description: getErrorMessage(error),
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const meta = (mutation.meta ?? {}) as MutationMeta;
      const description = getErrorMessage(error);
      const base: ToastEvent = {
        type: 'error',
        title: meta.errorMessage ?? 'Əməliyyat uğursuz oldu',
        description,
      };
      const merged = mergeNotification(base, meta.errorNotification, description);
      emitToast(merged);
    },
    onSuccess: (_data, _variables, _context, mutation) => {
      const meta = (mutation.meta ?? {}) as MutationMeta;
      if (meta.successMessage) {
        const base: ToastEvent = {
          type: 'success',
          title: meta.successMessage,
        };
        const merged = mergeNotification(base, meta.notification);
        emitToast(merged);
      } else if (meta.notification) {
        const base: ToastEvent = {
          type: meta.notification.type ?? 'success',
          title: meta.notification.title ?? 'Əməliyyat tamamlandı',
          description: meta.notification.description,
        };
        const merged = mergeNotification(base, meta.notification);
        emitToast(merged);
      }
    },
  }),
});

export default queryClient;
