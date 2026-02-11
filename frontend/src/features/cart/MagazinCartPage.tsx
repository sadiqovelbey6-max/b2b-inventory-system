import { useMemo } from 'react';
import { MinusIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useQueryClient } from '@tanstack/react-query';
import useAuth from '../../hooks/useAuth';
import { useCart, useUpdateCartItem } from '../../hooks/useCart';
import { useCreateOrder } from '../../hooks/useCreateOrder';
import { queryKeys } from '../../lib/queryKeys';
import { USER_ROLES } from '../../types';
import type { CartItem } from '../../types';

export const MagazinCartPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Yalnız magazin paneli üçün
  if (user?.role !== USER_ROLES.USER) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Bu bölmə yalnız magazin panelləri üçündür.
      </div>
    );
  }

  const { data: cart, isLoading } = useCart();
  const updateCart = useUpdateCartItem();
  const createOrder = useCreateOrder();

  const totalItems = useMemo(() => {
    if (!cart) return 0;
    return cart.items.reduce((sum: number, item: CartItem) => sum + item.quantity, 0);
  }, [cart]);

  const handleQuantity = async (productId: string, quantity: number) => {
    try {
      await updateCart.mutateAsync({ productId, quantity });
      // Səbəti yenilə
      await queryClient.invalidateQueries({ queryKey: queryKeys.cart('general') });
    } catch (error) {
      console.error('Səbət yenilənmədi:', error);
    }
  };

  const handleSubmitOrder = () => {
    createOrder.mutate(undefined, {
      onSuccess: () => {
        // Sifariş yaradıldıqdan sonra səbət avtomatik yenilənəcək (useCreateOrder hook-da)
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Səbət</h2>
        <p className="text-sm text-slate-500">Səbətdəki məhsulları idarə edin və sifariş verin.</p>
      </div>

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
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-900">{item.product.name}</div>
                    <div className="text-xs text-slate-500">Kod: {item.product.code}</div>
                    <div className="text-xs text-slate-500 mt-1">Qiymət: {item.unitPrice.toFixed(2)} AZN</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleQuantity(item.product.id, Math.max(item.quantity - 1, 0))}
                      className="rounded-full border border-slate-200 p-2 hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={updateCart.isPending || item.quantity <= 0}
                      title="Azalt"
                    >
                      <MinusIcon className="h-4 w-4" />
                    </button>
                    <span className="min-w-[50px] text-center text-sm font-semibold text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleQuantity(item.product.id, item.quantity + 1)}
                      className="rounded-full bg-primary-600 p-2 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={updateCart.isPending}
                      title="Artır"
                    >
                      <PlusIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleQuantity(item.product.id, 0)}
                      className="rounded-full border border-red-200 p-2 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={updateCart.isPending}
                      title="Sil"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="text-sm font-semibold text-slate-900 min-w-[100px] text-right">
                    {item.lineTotal.toFixed(2)} AZN
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-sm text-slate-500 text-center">
              Səbət boşdur. Məhsullar səhifəsindən məhsul əlavə edin.
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Sifariş məlumatları</div>
            <div className="text-sm text-slate-500 mt-1">Səbətdəki məhsullar üçün sifariş yaradın</div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <span className="text-sm text-slate-500">Məhsul sayı</span>
            <span className="text-sm font-semibold text-slate-900">{totalItems}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <span className="text-sm text-slate-500">Cəm məbləğ</span>
            <span className="text-xl font-semibold text-slate-900">
              {(cart?.totalAmount ?? 0).toFixed(2)} AZN
            </span>
          </div>
          <button
            onClick={handleSubmitOrder}
            disabled={createOrder.isPending || !cart || cart.items.length === 0}
            className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {createOrder.isPending ? 'Göndərilir...' : 'Sifarişi təsdiqlə'}
          </button>
          {createOrder.isSuccess && (
            <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
              ✅ Sifariş yaradıldı! Sifariş ID: {createOrder.data?.id ?? ''}
            </div>
          )}
          {createOrder.isError && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
              ❌ Sifariş hazırlığı zamanı xəta baş verdi.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MagazinCartPage;
