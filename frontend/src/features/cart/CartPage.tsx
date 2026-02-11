import { useMemo, useState } from 'react';
import { MinusIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import BranchSelector from '../../components/BranchSelector';
import useAuth from '../../hooks/useAuth';
import { useCart, useUpdateCartItem } from '../../hooks/useCart';
import { useCreateOrder } from '../../hooks/useCreateOrder';
import { USER_ROLES } from '../../types';
import type { CartItem } from '../../types';

export const CartPage = () => {
  const { user } = useAuth();
  
  // Service panellər üçün bu səhifəyə giriş qadağandır
  if (user?.role === USER_ROLES.USER || user?.role === USER_ROLES.BRANCH_MANAGER || user?.role === USER_ROLES.SUPER_ADMIN) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Bu bölmə mövcud deyil.
      </div>
    );
  }

  const [selectedBranch, setSelectedBranch] = useState<string | null>(user?.branch?.id ?? null);

  const { data: cart, isLoading } = useCart();
  const updateCart = useUpdateCartItem();
  const createOrder = useCreateOrder();

  const totalItems = useMemo(() => {
    if (!cart) return 0;
    return cart.items.reduce((sum: number, item: CartItem) => sum + item.quantity, 0);
  }, [cart]);

  const handleQuantity = (productId: string, quantity: number) => {
    updateCart.mutate({ productId, quantity });
  };

  const handleSubmitOrder = () => {
    createOrder.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Səbət</h2>
          <p className="text-sm text-slate-500">Filiala aid sifariş səbətini tamamlayın.</p>
        </div>
        <BranchSelector value={selectedBranch} onChange={setSelectedBranch} includeAllOption={false} />
      </div>

      {!selectedBranch ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
          Səbətə əməliyyat aparmaq üçün əvvəlcə filial seçin.
        </div>
      ) : null}

      {selectedBranch ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Səbət detallar</h3>
              <p className="text-sm text-slate-500">Məhsul miqdarlarını buradan idarə edə bilərsiniz.</p>
            </div>
            <div className="text-sm text-slate-500">Məhsul sayı: {totalItems}</div>
          </div>

          {isLoading ? (
            <div className="p-6 text-sm text-slate-500">Yüklənir...</div>
          ) : cart && cart.items.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {cart.items.map((item: CartItem) => (
                <div key={item.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{item.product.name}</div>
                    <div className="text-xs text-slate-500">Kod: {item.product.code}</div>
                    <div className="text-xs text-slate-500 mt-1">Qiymət: {item.unitPrice.toFixed(2)} AZN</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleQuantity(item.product.id, Math.max(item.quantity - 1, 0))}
                      className="rounded-full border border-slate-200 p-1 hover:bg-slate-100"
                      disabled={updateCart.isPending}
                    >
                      <MinusIcon className="h-4 w-4" />
                    </button>
                    <span className="min-w-[40px] text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => handleQuantity(item.product.id, item.quantity + 1)}
                      className="rounded-full bg-primary-600 p-1 text-white hover:bg-primary-700"
                      disabled={updateCart.isPending}
                    >
                      <PlusIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleQuantity(item.product.id, 0)}
                      className="rounded-full border border-slate-200 p-1 hover:bg-slate-100 text-danger"
                      disabled={updateCart.isPending}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{item.lineTotal.toFixed(2)} AZN</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-sm text-slate-500">Səbət boşdur.</div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Filial</div>
            <div className="text-sm text-slate-500">{cart?.branch?.name ?? 'Seçilməyib'}</div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Məhsul sayı</span>
            <span className="text-sm font-semibold text-slate-900">{totalItems}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Cəm məbləğ</span>
            <span className="text-xl font-semibold text-slate-900">{(cart?.totalAmount ?? 0).toFixed(2)} AZN</span>
          </div>
          <button
            onClick={handleSubmitOrder}
            disabled={createOrder.isPending || !cart || cart.items.length === 0}
            className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {createOrder.isPending ? 'Göndərilir...' : 'Sifarişi təsdiqlə'}
          </button>
          {createOrder.isSuccess ? (
            <div className="text-xs text-success">
              Sifariş yaradıldı! Sifariş ID: {createOrder.data?.id ?? ''}
            </div>
          ) : null}
          {createOrder.isError ? (
            <div className="text-xs text-danger">Sifariş hazırlığı zamanı xəta baş verdi.</div>
          ) : null}
        </div>
        </div>
      ) : null}
    </div>
  );
};

export default CartPage;

