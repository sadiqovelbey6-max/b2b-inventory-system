export interface ToastLink {
  label: string;
  to: string;
}

export type ToastEvent = {
  title: string;
  description?: string;
  type?: 'info' | 'success' | 'error';
  duration?: number;
  persist?: boolean;
  timestamp?: string;
  id?: string;
  link?: ToastLink;
};

type Listener = (event: ToastEvent) => void;

const listeners = new Set<Listener>();

export const toastBus = {
  emit(event: ToastEvent) {
    listeners.forEach((listener) => listener(event));
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export default toastBus;

