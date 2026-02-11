import { useContext } from 'react';
import { NotificationContext } from '../components/notifications/notification-context';

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications yalnız NotificationProvider daxilində istifadə oluna bilər');
  }
  return context;
};

export default useNotifications;


