import { useEffect, useMemo, useState } from 'react';
import BranchSelector from '../../components/BranchSelector';
import useAuth from '../../hooks/useAuth';
import { useProducts } from '../../hooks/useProducts';
import { useOrders } from '../../hooks/useOrders';
import type { Order, Product } from '../../types';
import { USER_ROLES } from '../../types';
import { formatDateTime } from '../../utils/dateFormat';

export const DashboardPage = () => {
  const { user } = useAuth();
  const [selectedBranch, setSelectedBranch] = useState<string | null>(user?.branch?.id ?? null);

  // Magazin paneli üçün sadələşdirilmiş dashboard
  const isMagazinPanel = user?.role === USER_ROLES.USER;

  useEffect(() => {
    if (user?.branch?.id) {
      setSelectedBranch(user.branch.id);
    }
  }, [user?.branch?.id]);

  const { data: products, isLoading: isProductsLoading } = useProducts(selectedBranch ?? undefined);
  const { data: orders, isLoading: isOrdersLoading } = useOrders(selectedBranch ?? undefined);

  // Magazin paneli üçün bu səhifəyə giriş qadağandır
  if (isMagazinPanel) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Bu bölmə yalnız service panelləri üçündür. Magazin paneli üçün bütün funksiyalar "Sifarişlər" bölməsindədir.
      </div>
    );
  }

  const lowStockCount = useMemo(() => {
    if (!products || !selectedBranch) return 0;
    return products.filter((product: Product) => {
      const branchInventory = product.inventory.currentBranch;
      return branchInventory ? branchInventory.availableQty < 10 : true;
    }).length;
  }, [products, selectedBranch]);

  const inTransitCount = useMemo(() => {
    if (!products || !selectedBranch) return 0;
    return products.reduce((sum: number, product: Product) => {
      const branchInventory = product.inventory.currentBranch;
      return sum + (branchInventory?.inTransitQty ?? 0);
    }, 0);
  }, [products, selectedBranch]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">İdarə paneli</h2>
          <p className="text-sm text-slate-500">
            Məhsul vəziyyəti, ehtiyat və sifariş statusları üzrə ümumi mənzərə.
          </p>
        </div>
        <BranchSelector value={selectedBranch} onChange={setSelectedBranch} includeAllOption={false} />
      </div>

      {!selectedBranch && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          Filial seçin ki, göstəricilər hesablansın.
        </div>
      )}

      {selectedBranch ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <DashboardCard
            title="Məhsul sayı"
            value={isProductsLoading ? '...' : products?.length ?? 0}
            subtitle="Aktiv məhsullar"
          />
          <DashboardCard
            title="Aşağı stok"
            value={isProductsLoading ? '...' : lowStockCount}
            subtitle="10 əd. altı"
            tone="warning"
          />
          <DashboardCard
            title="Yoldakı məhsul"
            value={isProductsLoading ? '...' : inTransitCount}
            subtitle="Filiala göndərilən"
            tone="info"
          />
          <DashboardCard
            title="Sifarişlər"
            value={isOrdersLoading ? '...' : orders?.length ?? 0}
            subtitle="Son əməliyyatlar"
            tone="success"
          />
        </div>
      ) : null}

      {selectedBranch ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Son sifarişlər</h3>
              <p className="text-sm text-slate-500">Filial üzrə ən son 10 sifariş</p>
            </div>
          </div>
          <div className="px-6 py-4">
            {isOrdersLoading ? (
              <div className="text-sm text-slate-500">Yüklənir...</div>
            ) : orders && orders.length > 0 ? (
              <div className="space-y-3">
                {orders.slice(0, 10).map((order: Order) => (
                  <div key={order.id} className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{order.id}</div>
                      <div className="text-xs text-slate-500">{formatDateTime(order.createdAt)}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-medium uppercase px-3 py-1 rounded-full bg-primary-100 text-primary-700">
                        {order.status}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">{order.total.toFixed(2)} AZN</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Hələ sifariş yoxdur.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

interface DashboardCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  tone?: 'default' | 'warning' | 'info' | 'success';
}

const toneClasses: Record<NonNullable<DashboardCardProps['tone']>, string> = {
  default: 'bg-slate-50 text-slate-700 border-slate-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const DashboardCard = ({ title, value, subtitle, tone = 'default' }: DashboardCardProps) => (
  <div className={`rounded-2xl border px-5 py-4 shadow-sm ${toneClasses[tone]}`}>
    <div className="text-xs font-medium uppercase tracking-wide">{title}</div>
    <div className="text-2xl font-semibold mt-2">{value}</div>
    <div className="text-xs font-medium mt-3 opacity-80">{subtitle}</div>
  </div>
);

export default DashboardPage;

