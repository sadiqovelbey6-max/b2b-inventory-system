import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import useAuth from '../../hooks/useAuth';
import api from '../../lib/api';
import type { TwoFactorSetupResult, User } from '../../types';
import { toastBus } from '../../lib/toastBus';

const extractErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? 'Əməliyyat zamanı xəta baş verdi';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Əməliyyat zamanı xəta baş verdi';
};

const SecurityPage = () => {
  const { user, accessToken, refreshToken, setSession, clearSession } = useAuth();
  const [setupData, setSetupData] = useState<TwoFactorSetupResult | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const twoFactorActive = Boolean(user?.twoFactorEnabled);

  const applyUserUpdate = (updatedUser: User) => {
    if (!accessToken) {
      clearSession();
      return;
    }
    setSession({
      user: updatedUser,
      accessToken,
      ...(refreshToken ? { refreshToken } : {}),
    });
  };

  const setupMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<TwoFactorSetupResult>('/2fa/setup');
      return response.data;
    },
    onSuccess: (data) => {
      setSetupData(data);
      setSuccessMessage('Authenticator tətbiqinizlə QR kodu oxuyun və aşağıdakı mərhələni tamamlayın.');
      setErrorMessage(null);
    },
    onError: (error) => {
      setErrorMessage(extractErrorMessage(error));
      setSuccessMessage(null);
    },
  });

  const enableMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await api.post<User>('/2fa/enable', { code });
      return response.data;
    },
    onSuccess: (updatedUser) => {
      applyUserUpdate(updatedUser);
      setSetupData(null);
      setTwoFactorCode('');
      setSuccessMessage('İki faktorlu giriş aktivləşdirildi.');
      setErrorMessage(null);
      toastBus.emit({
        title: '2FA aktivdir',
        description: 'Artıq giriş zamanı Authenticator kodu tələb olunacaq.',
        type: 'success',
        persist: true,
      });
    },
    onError: (error) => {
      setErrorMessage(extractErrorMessage(error));
      setSuccessMessage(null);
    },
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<User>('/2fa/disable');
      return response.data;
    },
    onSuccess: (updatedUser) => {
      applyUserUpdate(updatedUser);
      setSetupData(null);
      setTwoFactorCode('');
      setSuccessMessage('İki faktorlu giriş deaktiv edildi.');
      setErrorMessage(null);
      toastBus.emit({
        title: '2FA deaktiv edildi',
        description: 'Hesabınız üçün iki faktorlu autentifikasiya söndürüldü.',
        type: 'info',
        persist: true,
      });
    },
    onError: (error) => {
      setErrorMessage(extractErrorMessage(error));
      setSuccessMessage(null);
    },
  });

  const isActionInProgress = useMemo(
    () =>
      setupMutation.isPending || enableMutation.isPending || disableMutation.isPending,
    [setupMutation.isPending, enableMutation.isPending, disableMutation.isPending],
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <h1 className="text-xl font-semibold text-slate-900">Hesab təhlükəsizliyi</h1>
        <p className="mt-2 text-sm text-slate-500">
          İki faktorlu autentifikasiya hesabınızı əlavə qoruma ilə təmin edir. Authenticator tətbiqindən (Google Authenticator,
          Microsoft Authenticator, Authy və s.) istifadə etməyiniz tövsiyə olunur.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm font-medium text-slate-600">Status:</span>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              twoFactorActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {twoFactorActive ? 'Aktivdir' : 'Aktiv deyil'}
          </span>
        </div>

        {successMessage ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          {twoFactorActive ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                2FA deaktiv olunduqda yalnız şifrə ilə daxil olmaq mümkün olacaq. Təhlükəsizlik səbəbinə görə bunu yalnız zərurət
                olduqda edin.
              </p>
              <button
                type="button"
                onClick={() => disableMutation.mutate()}
                className="inline-flex items-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                disabled={isActionInProgress}
              >
                {disableMutation.isPending ? 'Deaktiv edilir...' : '2FA-nı deaktiv et'}
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Aktivləşdirdikdən sonra giriş zamanı hər dəfə şifrədən əlavə 6 rəqəmli kod daxil etməli olacaqsınız.
              </p>
              {setupData ? (
                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <span className="text-sm font-medium text-slate-700">QR kodu</span>
                    <div className="mt-2 flex items-center justify-center">
                      <img
                        src={setupData.qrCodeDataUrl}
                        alt="2FA QR kodu"
                        className="h-48 w-48 rounded-lg border border-slate-200 bg-white p-3"
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-700">Backup kodu</span>
                    <div className="mt-1 rounded-lg bg-white px-3 py-2 font-mono text-sm tracking-widest text-slate-800">
                      {setupData.secret}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Bu kodu itirməyin. Authenticator tətbiqini itirsəniz, bu kodla yenidən quraşdıra bilərsiniz.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="twoFactorCode" className="block text-sm font-medium text-slate-700">
                      Təsdiq kodu
                    </label>
                    <input
                      id="twoFactorCode"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={twoFactorCode}
                      onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, ''))}
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="000000"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Authenticator tətbiqində görünən 6 rəqəmli kodu daxil edib 2FA-nı aktivləşdirin.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => enableMutation.mutate(twoFactorCode)}
                      className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                      disabled={isActionInProgress || twoFactorCode.length !== 6}
                    >
                      {enableMutation.isPending ? 'Aktivləşdirilir...' : '2FA-nı aktiv et'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSetupData(null);
                        setTwoFactorCode('');
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      className="inline-flex items-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                      disabled={isActionInProgress}
                    >
                      Yenidən başla
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setupMutation.mutate()}
                  className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                  disabled={isActionInProgress}
                >
                  {setupMutation.isPending ? 'Hazırlanır...' : 'QR kodu generasiya et'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SecurityPage;

