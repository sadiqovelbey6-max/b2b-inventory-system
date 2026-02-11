import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '../types';
import { AuthContext, type AuthContextValue, type AuthSessionData } from './auth-context';
import { queryKeys } from '../lib/queryKeys';

const STORAGE_KEY = 'b2b_auth_session';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AuthSessionData;
        setUser(parsed.user);
        setAccessToken(parsed.accessToken);
        setRefreshToken(parsed.refreshToken ?? null);
        localStorage.setItem('b2b_access_token', parsed.accessToken);
        
        // Session yüklənəndə cart və orders query-lərini cache-də saxla
        // Cache-də varsa, onu istifadə et - bu sayədə saytdan çıxıb yenidən daxil olduqda məlumatlar qalır
        // Yalnız cache-də yoxdursa və ya çox köhnədirsə refetch et
        const oneHour = 1000 * 60 * 60;
        const cartQuery = queryClient.getQueryState(queryKeys.cart('general'));
        if (!cartQuery || (cartQuery.dataUpdatedAt && Date.now() - cartQuery.dataUpdatedAt > oneHour)) {
          queryClient.refetchQueries({ queryKey: queryKeys.cart('general') });
        }
        
        const ordersQueries = queryClient.getQueryCache().findAll({ queryKey: ['orders'], exact: false });
        if (ordersQueries.length === 0 || ordersQueries.some(q => (q.state.dataUpdatedAt || 0) < Date.now() - oneHour)) {
          queryClient.refetchQueries({ queryKey: ['orders'], exact: false });
        }
      } catch (error) {
        console.warn('Session parse error', error);
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    // Token refresh event-ini dinlə
    const handleTokenRefresh = (event: CustomEvent) => {
      const { accessToken, refreshToken, user } = event.detail;
      setUser(user);
      setAccessToken(accessToken);
      setRefreshToken(refreshToken ?? null);
    };

    window.addEventListener('auth:token-refreshed', handleTokenRefresh as EventListener);
    return () => {
      window.removeEventListener('auth:token-refreshed', handleTokenRefresh as EventListener);
    };
  }, [queryClient]);

  const setSession = useCallback((session: AuthSessionData) => {
    setUser(session.user);
    setAccessToken(session.accessToken);
    setRefreshToken(session.refreshToken ?? null);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      localStorage.setItem('b2b_access_token', session.accessToken);
    }
    
    // Session set edildikdə cart və orders query-lərini cache-də saxla
    // Cache-də varsa, onu istifadə et - bu sayədə saytdan çıxıb yenidən daxil olduqda məlumatlar qalır
    // Yalnız cache-də yoxdursa və ya çox köhnədirsə refetch et
    const oneHour = 1000 * 60 * 60;
    const cartQuery = queryClient.getQueryState(queryKeys.cart('general'));
    if (!cartQuery || (cartQuery.dataUpdatedAt && Date.now() - cartQuery.dataUpdatedAt > oneHour)) {
      queryClient.refetchQueries({ queryKey: queryKeys.cart('general') });
    }
    
    const ordersQueries = queryClient.getQueryCache().findAll({ queryKey: ['orders'], exact: false });
    if (ordersQueries.length === 0 || ordersQueries.some(q => (q.state.dataUpdatedAt || 0) < Date.now() - oneHour)) {
      queryClient.refetchQueries({ queryKey: ['orders'], exact: false });
    }
  }, [queryClient]);

  const clearSession = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('b2b_access_token');
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: Boolean(user && accessToken),
      setSession,
      clearSession,
    }),
    [user, accessToken, refreshToken, setSession, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
