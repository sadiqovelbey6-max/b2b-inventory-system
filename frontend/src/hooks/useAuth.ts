import { useAuthContext } from './useAuthContext';

export const useAuth = () => {
  const ctx = useAuthContext();
  return ctx;
};

export default useAuth;

