import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../lib/api';
import useAuth from '../../hooks/useAuth';
import type { User, UserRole } from '../../types';
import { USER_ROLES } from '../../types';
import { queryKeys } from '../../lib/queryKeys';

interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

type PanelType = 'admin' | 'magazin';

const PANEL_ROLES: Record<PanelType, UserRole[]> = {
  admin: [USER_ROLES.SUPER_ADMIN, USER_ROLES.BRANCH_MANAGER],
  magazin: [USER_ROLES.USER],
};

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPanel, setSelectedPanel] = useState<PanelType | null>(null);
  const [email, setEmail] = useState('admin@demo.az');
  const [password, setPassword] = useState('Admin123!');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: async (): Promise<LoginResponse> => {
      const payload = {
        email,
        password,
      };
      console.log('[LoginPage] Attempting login:', { email, selectedPanel });
      console.log('[LoginPage] API baseURL:', api.defaults.baseURL);
      
      try {
        const response = await api.post<LoginResponse>('/login', payload);
        console.log('[LoginPage] Login successful:', response.data);
        return response.data;
      } catch (error: unknown) {
        console.error('[LoginPage] Login error:', error);
        if (typeof error === 'object' && error !== null && 'response' in error) {
          const axiosError = error as { response?: { status?: number; data?: { message?: string } } };
          console.error('[LoginPage] Error response:', {
            status: axiosError.response?.status,
            data: axiosError.response?.data,
          });
        }
        throw error;
      }
    },
    onSuccess: (data: LoginResponse) => {
      console.log('[LoginPage] onSuccess called:', { userRole: data.user.role, selectedPanel });
      
      // Rol yoxlaması
      if (selectedPanel) {
        const allowedRoles = PANEL_ROLES[selectedPanel];
        if (!allowedRoles.includes(data.user.role)) {
          console.log('[LoginPage] Role mismatch:', { userRole: data.user.role, allowedRoles, selectedPanel });
          setErrorMessage(`Bu panellə giriş üçün ${selectedPanel === 'admin' ? 'Admin' : 'Mağazin'} rolu lazımdır.`);
          return;
        }
      }

      setSession({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      
      // Login olduqdan sonra cart və orders query-lərini cache-də saxla
      // Cache-də varsa, onu istifadə et - bu sayədə saytdan çıxıb yenidən daxil olduqda məlumatlar qalır
      // Yalnız cache-də yoxdursa və ya çox köhnədirsə refetch et
      const cartQuery = queryClient.getQueryState(queryKeys.cart('general'));
      if (!cartQuery || cartQuery.dataUpdatedAt < Date.now() - 1000 * 60 * 60) {
        queryClient.refetchQueries({ queryKey: queryKeys.cart('general') });
      }
      
      const ordersQueries = queryClient.getQueryCache().findAll({ queryKey: ['orders'], exact: false });
      if (ordersQueries.length === 0 || ordersQueries.some(q => (q.state.dataUpdatedAt || 0) < Date.now() - 1000 * 60 * 60)) {
        queryClient.refetchQueries({ queryKey: ['orders'], exact: false });
      }
      
      const redirectTo = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard';
      console.log('[LoginPage] Navigating to:', redirectTo);
      navigate(redirectTo, { replace: true });
      setErrorMessage(null);
    },
    onError: (error: unknown) => {
      console.error('[LoginPage] onError called:', error);
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const response = (error as { response?: { data?: { message?: string }; status?: number } }).response;
        const message = response?.data?.message ?? 'Giriş zamanı xəta baş verdi';
        const status = response?.status;
        console.error('[LoginPage] Error details:', { message, status });
        setErrorMessage(message);
      } else {
        console.error('[LoginPage] Unknown error:', error);
        setErrorMessage('Giriş zamanı xəta baş verdi');
      }
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    loginMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white shadow-lg rounded-2xl p-8 border border-slate-200">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Emil 1223</h1>
          <p className="text-sm text-slate-500 mt-2">Filial əsaslı inventar və sifariş sisteminə daxil olun</p>
        </div>

        {!selectedPanel ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Panel seçin</h2>
            <button
              type="button"
              onClick={() => setSelectedPanel('admin')}
              className="w-full rounded-lg border-2 border-slate-200 bg-white px-4 py-3 text-left hover:border-primary-500 hover:bg-primary-50 transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">Admin Paneli</div>
                  <div className="text-xs text-slate-500 mt-1">Super Admin və Admin rolları üçün</div>
                </div>
                <span className="text-2xl">👨‍💼</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setSelectedPanel('magazin')}
              className="w-full rounded-lg border-2 border-slate-200 bg-white px-4 py-3 text-left hover:border-primary-500 hover:bg-primary-50 transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">Mağazin Paneli</div>
                  <div className="text-xs text-slate-500 mt-1">İstifadəçi rolları üçün</div>
                </div>
                <span className="text-2xl">🏪</span>
              </div>
            </button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {selectedPanel === 'admin' ? 'Admin Paneli' : 'Mağazin Paneli'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setSelectedPanel(null);
                  setErrorMessage(null);
                }}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                ← Geri
              </button>
            </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="admin@demo.az"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Şifrə
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="••••••••"
              required
            />
          </div>

          {errorMessage ? (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {errorMessage}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full rounded-lg bg-primary-600 text-white py-2.5 text-sm font-semibold hover:bg-primary-700 transition disabled:opacity-70"
          >
            {loginMutation.isPending ? 'Yüklənir...' : 'Daxil ol'}
          </button>
        </form>
        )}
        {selectedPanel && (
          <p className="text-xs text-slate-400 mt-6">
            Demo hesab: <span className="font-medium text-slate-500">admin@demo.az / Admin123!</span>
          </p>
        )}
      </div>
    </div>
  );
};

export default LoginPage;

