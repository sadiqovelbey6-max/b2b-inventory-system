import { createContext } from 'react';

export type ToastStatus = 'info' | 'success' | 'error';

export interface ToastLink {
  label: string;
  to: string;
}

export interface ToastOptions {
  id?: string;
  title: string;
  description?: string;
  type?: ToastStatus;
  duration?: number;
  link?: ToastLink;
}

export interface ToastContextValue {
  addToast: (toast: ToastOptions) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);

