import { useContext } from 'react';
import { ToastContext } from '../components/toast/toast-context';

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast yalnız ToastProvider daxilində istifadə oluna bilər');
  }
  return context;
};

export default useToast;

