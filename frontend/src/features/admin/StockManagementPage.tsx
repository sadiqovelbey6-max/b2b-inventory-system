import { useState } from 'react';
import useAuth from '../../hooks/useAuth';
import {
  useCalculatedStock,
  useCreateManualAdjustments,
} from '../../hooks/useTransactions';
import { USER_ROLES } from '../../types';

export const StockManagementPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === USER_ROLES.SUPER_ADMIN || user?.role === USER_ROLES.BRANCH_MANAGER;
  const [manualAdjustmentText, setManualAdjustmentText] = useState('');

  const calculatedStockQuery = useCalculatedStock(undefined);
  const createAdjustmentMutation = useCreateManualAdjustments();

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Bu bölməyə yalnız admin daxil ola bilər.
      </div>
    );
  }

  const handleManualAdjustmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAdjustmentText.trim()) return;

    createAdjustmentMutation.mutate(
      { text: manualAdjustmentText, branchId: '' },
      {
        onSuccess: () => {
          setManualAdjustmentText('');
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Stok idarəetməsi</h2>
        <p className="text-sm text-slate-500">Real-time stok saylarını izləyin və idarə edin.</p>
      </div>

      {/* Manual Stock Adjustments */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Manual say yeniləmə</h3>
        <p className="text-sm text-slate-500 mb-4">
          Copy-paste formatında manual düzəlişlər yaradın. Format: <span className="font-mono text-xs bg-slate-100 px-1 rounded">PRD001 +5</span> və ya <span className="font-mono text-xs bg-slate-100 px-1 rounded">PRD001 -2</span> (iki nöqtə işarəsi vacib deyil)
        </p>
        <form onSubmit={handleManualAdjustmentSubmit} className="space-y-4">
          <textarea
            value={manualAdjustmentText}
            onChange={(e) => setManualAdjustmentText(e.target.value)}
            placeholder="PRD001 +5&#10;PRD002 -2&#10;PRD003 +10"
            rows={8}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {manualAdjustmentText.split('\n').filter((line) => line.trim().length > 0).length} sətir
            </span>
            <button
              type="submit"
              disabled={createAdjustmentMutation.isPending || !manualAdjustmentText.trim()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {createAdjustmentMutation.isPending ? 'Yaradılır...' : 'Düzəlişləri yarat'}
            </button>
          </div>
          {createAdjustmentMutation.isSuccess && createAdjustmentMutation.data ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Nəticə</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500">Yaradılan:</span>
                  <span className="ml-2 font-semibold text-primary-600">{createAdjustmentMutation.data.created}</span>
                </div>
                <div>
                  <span className="text-slate-500">Xəta:</span>
                  <span
                    className={`ml-2 font-semibold ${
                      (createAdjustmentMutation.data.errors ?? []).length > 0 ? 'text-amber-700' : 'text-slate-800'
                    }`}
                  >
                    {(createAdjustmentMutation.data.errors ?? []).length}
                  </span>
                </div>
              </div>
              {(createAdjustmentMutation.data.errors ?? []).length > 0 && (
                <details className="mt-3 rounded-lg border border-amber-200 bg-white p-3 text-xs text-amber-800">
                  <summary className="cursor-pointer text-sm font-medium text-amber-700">
                    Xətalar ({(createAdjustmentMutation.data.errors ?? []).length})
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-4 max-h-40 overflow-y-auto">
                    {(createAdjustmentMutation.data.errors ?? []).slice(0, 10).map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                    {(createAdjustmentMutation.data.errors ?? []).length > 10 && (
                      <li className="italic text-amber-600">+{(createAdjustmentMutation.data.errors ?? []).length - 10} əlavə xəta</li>
                    )}
                  </ul>
                </details>
              )}
            </div>
          ) : null}
        </form>
      </div>

      {/* Real-time Stock */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Stok sayları (Real-time)</h3>
          <p className="text-sm text-slate-500">
            Pending transaction-ları nəzərə alaraq hesablanmış stok dəyərləri. Stok sayları avtomatik yenilənir (hər 5 saniyədə bir yenilənir).
          </p>
        </div>
        {calculatedStockQuery.isLoading ? (
          <div className="text-sm text-slate-500 py-8 text-center">Yüklənir...</div>
        ) : calculatedStockQuery.data && Array.isArray(calculatedStockQuery.data) && calculatedStockQuery.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Məhsul Kodu</th>
                  <th className="px-4 py-3 text-left">Məhsul Adı</th>
                  <th className="px-4 py-3 text-left">Stok Sayı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {calculatedStockQuery.data.map((inv: any) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{inv.product?.code}</td>
                    <td className="px-4 py-3">{inv.product?.name}</td>
                    <td className="px-4 py-3 font-semibold text-primary-600">{inv.calculatedQty ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-slate-500 py-8 text-center">Stok məlumatı tapılmadı.</div>
        )}
      </div>
    </div>
  );
};

export default StockManagementPage;

