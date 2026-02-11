import { useEffect } from 'react';
import useAuth from '../../hooks/useAuth';
import { useTopSellingProducts } from '../../hooks/useOrders';
import { USER_ROLES } from '../../types';

export const TopSellingProductsPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === USER_ROLES.SUPER_ADMIN || user?.role === USER_ROLES.BRANCH_MANAGER;
  const { data: products, isLoading, refetch } = useTopSellingProducts(100);

  // Satış olduqca yeniləmə üçün interval
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 5000); // Hər 5 saniyədə bir yenilə

    return () => clearInterval(interval);
  }, [refetch]);

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Bu bölməyə yalnız admin istifadəçilər daxil ola bilər.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Ən çox satılanlar</h2>
        <p className="text-sm text-slate-500">
          Top 100 ən çox satılan məhsullar. Satış sayları real-time yenilənir.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Yüklənir...</div>
        ) : !products || products.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Hələ heç bir satış yoxdur.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-semibold uppercase text-slate-500 tracking-wide">
                  <th className="px-4 py-3 w-12">#</th>
                  <th className="px-4 py-3">Məhsul</th>
                  <th className="px-4 py-3">Kod</th>
                  <th className="px-4 py-3">Kateqoriya</th>
                  <th className="px-4 py-3 text-right">Satış Sayı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product, index) => (
                  <tr
                    key={product.productId}
                    className="text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                          index === 0
                            ? 'bg-yellow-100 text-yellow-800'
                            : index === 1
                            ? 'bg-slate-100 text-slate-800'
                            : index === 2
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-50 text-slate-600'
                        }`}
                      >
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {product.productImageUrl ? (
                          <img
                            src={product.productImageUrl}
                            alt={product.productName}
                            className="h-10 w-10 rounded-lg object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xs text-slate-500">
                            {product.productName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-slate-900">{product.productName}</div>
                          {product.productUnit && (
                            <div className="text-xs text-slate-500">{product.productUnit}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-900">{product.productCode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-600">
                        {product.productCategory || 'Kateqoriya yoxdur'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-lg text-primary-600">
                        {product.totalSales.toLocaleString('az-AZ')}
                      </span>
                      <span className="ml-1 text-xs text-slate-500">ədəd</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopSellingProductsPage;

