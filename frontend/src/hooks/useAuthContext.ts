import { useContext } from 'react';
import { AuthContext } from '../context/auth-context';

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext yalnız AuthProvider daxilində istifadə oluna bilər');
  }
  return context;
};

export default useAuthContext;

