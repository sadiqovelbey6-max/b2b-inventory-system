import { useState, useMemo } from 'react';
import { ChevronDownIcon, ChevronUpIcon, MinusIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useQueryClient } from '@tanstack/react-query';
import useAuth from '../../hooks/useAuth';
import { useOrders } from '../../hooks/useOrders';
import { useDeliverOrder } from '../../hooks/useTransactions';
import { useCreateOrder } from '../../hooks/useCreateOrder';
import { USER_ROLES } from '../../types';
import type { Order } from '../../types';
import { useCart, useUpdateCartItem } from '../../hooks/useCart';
import { queryKeys } from '../../lib/queryKeys';
import { formatDateTime, formatRelativeTime } from '../../utils/dateFormat';

export const MagazinOrdersPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'cart' | 'pending' | 'shipped' | 'delivered'>('cart');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  
  const { data: orders, isLoading, refetch } = useOrders();
  const { data: cart } = useCart();
  const updateCartItem = useUpdateCartItem();
  const deliverOrderMutation = useDeliverOrder();
  const createOrderMutation = useCreateOrder();

  // Magazin paneli üçün yalnız USER rolü
  if (user?.role !== USER_ROLES.USER) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Bu bölmə yalnız magazin panelləri üçündür.
      </div>
    );
  }

  // Sifarişləri statusa görə filtrlə
  const pendingOrders = orders?.filter((order: Order) => order.status === 'pending_approval') || [];
  const shippedOrders = orders?.filter((order: Order) => order.status === 'approved') || [];
  
  // Çatdırılmış sifarişlər - tarixə görə sıralanmış (ən yeni üstdə)
  const deliveredOrders = useMemo(() => {
    if (!orders || !Array.isArray(orders)) {
      return [];
    }
    
    const filtered = orders.filter((order: Order) => order.status === 'delivered');
    
    const sorted = filtered.sort((a: Order, b: Order) => {
      // Ən yeni tarix üstdə
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    return sorted.slice(0, 50); // Son 50 sifariş
  }, [orders]);

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const handleDeliver = (orderId: string) => {
    deliverOrderMutation.mutate(orderId, {
      onSuccess: () => {
        refetch(); // Sifarişlər yenilənməlidir ki, "delivered" tab-ında görünsün
      },
    });
  };

  const handleQuantityChange = async (productId: string, delta: number) => {
    const currentItem = cart?.items.find((item: any) => item.product?.id === productId);
    if (!currentItem) return;
    
    const newQuantity = Math.max(currentItem.quantity + delta, 0);
    try {
      await updateCartItem.mutateAsync({ productId, quantity: newQuantity });
      // Səbəti yenilə
      await queryClient.invalidateQueries({ queryKey: queryKeys.cart('general') });
    } catch (error) {
      console.error('Səbət yenilənmədi:', error);
    }
  };

  const handleRemoveItem = async (productId: string) => {
    try {
      await updateCartItem.mutateAsync({ productId, quantity: 0 });
      // Səbəti yenilə
      await queryClient.invalidateQueries({ queryKey: queryKeys.cart('general') });
    } catch (error) {
      console.error('Məhsul silinmədi:', error);
    }
  };

  const handleCreateOrder = () => {
    if (!cart || cart.items.length === 0) {
      alert('Səbət boşdur');
      return;
    }
    createOrderMutation.mutate(undefined, {
      onSuccess: () => {
        alert('Sifariş sorğusu admin paneline göndərildi!');
        // Sifariş yaradıldıqdan sonra "Təsdiq gözləyənlər" tab-ına keç
        setActiveTab('pending');
        // Sifarişləri yenilə
        refetch();
      },
      onError: (error: any) => {
        const errorMessage = error?.response?.data?.message || error?.message || 'Xəta baş verdi';
        alert(`Xəta: ${errorMessage}`);
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Sifarişlər</h2>
        <p className="text-sm text-slate-500">Səbət, yoldakı və çatdırılmış sifarişlərinizi idarə edin.</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('cart')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'cart'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Səbət {cart && cart.items.length > 0 && `(${cart.items.length})`}
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Təsdiq gözləyənlər {pendingOrders.length > 0 && `(${pendingOrders.length})`}
          </button>
          <button
            onClick={() => setActiveTab('shipped')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'shipped'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Yoldadır {shippedOrders.length > 0 && `(${shippedOrders.length})`}
          </button>
          <button
            onClick={() => setActiveTab('delivered')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'delivered'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Sifarişlər {deliveredOrders.length > 0 && `(${deliveredOrders.length})`}
          </button>
        </nav>
      </div>

      {/* Təsdiq gözləyənlər Tab */}
      {activeTab === 'pending' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">Təsdiq gözləyənlər</h3>
            <p className="text-sm text-slate-500">Admin paneldə təsdiq gözləyən sifariş sorğuları</p>
          </div>
          <div className="p-6">
            {isLoading ? (
              <div className="text-sm text-slate-500 py-8 text-center">Yüklənir...</div>
            ) : pendingOrders.length > 0 ? (
              <div className="space-y-4">
                {pendingOrders.map((order: Order) => {
                  const isExpanded = expandedOrders.has(order.id);
                  const itemsCount = order.items?.length || 0;
                  return (
                    <div key={order.id} className="border border-slate-200 rounded-xl overflow-hidden hover:bg-slate-50 transition-colors">
                      {/* Sifariş başlığı - klik edilə bilən */}
                      <button
                        onClick={() => toggleOrderExpansion(order.id)}
                        className="w-full p-4 flex items-start justify-between text-left hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm font-semibold text-slate-900">Sifariş #{order.id.slice(0, 8)}</span>
                            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase bg-yellow-100 text-yellow-700">
                              Təsdiq gözləyir
                            </span>
                            {order.stockShortageItems && order.stockShortageItems.length > 0 && (
                              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase bg-red-100 text-red-700">
                                Stok çatışmazlığı
                              </span>
                            )}
                            {itemsCount > 0 && (
                              <span className="text-xs text-slate-500">
                                {itemsCount} {itemsCount === 1 ? 'məhsul' : 'məhsul'}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 space-y-1">
                            <div>
                              <span className="font-semibold">Tarix:</span> {formatDateTime(order.createdAt)}
                              <span className="ml-2 text-slate-400">({formatRelativeTime(order.createdAt)})</span>
                            </div>
                            <div>
                              <span className="font-semibold">Məbləğ:</span> {Number(order.total).toFixed(2)} AZN
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          {isExpanded ? (
                            <ChevronUpIcon className="h-5 w-5 text-slate-400" />
                          ) : (
                            <ChevronDownIcon className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                      </button>

                      {/* Genişləndirilmiş məzmun */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-slate-200 bg-slate-50/50">
                          <div className="pt-4">
                            {/* Stok çatışmazlığı xəbərdarlığı */}
                            {order.stockShortageItems && order.stockShortageItems.length > 0 && (
                              <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                                <div className="flex items-start gap-2 mb-2">
                                  <span className="text-yellow-700 font-semibold">⚠ Stok çatışmazlığı var:</span>
                                </div>
                                <div className="space-y-1 text-sm text-yellow-800">
                                  {order.stockShortageItems.map((item: any, index: number) => (
                                    <div key={index}>
                                      {item.productCode} - {item.productName}: Tələb olunan: {item.orderedQuantity}, Mövcud: {item.availableQuantity}, Çatışmazlıq: {item.shortage}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Məhsullar */}
                            <div className="text-xs font-semibold text-slate-700 uppercase mb-3">Məhsullar ({itemsCount}):</div>
                            {order.items && order.items.length > 0 ? (
                              <div className="space-y-3">
                                {order.items.map((item: any, index: number) => {
                                  const shortageItem = order.stockShortageItems?.find((si: any) => si.productId === item.product?.id);
                                  return (
                                    <div key={index} className="bg-white border border-slate-200 rounded-lg p-3">
                                      <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                          <div className="text-sm font-semibold text-slate-900 mb-1">
                                            {item.product?.code} - {item.product?.name}
                                            {shortageItem && (
                                              <span className="ml-2 text-xs text-red-600">(Çatışmazlıq: {shortageItem.shortageQty})</span>
                                            )}
                                          </div>
                                          {item.product?.category && (
                                            <div className="text-xs text-slate-500">
                                              Kateqoriya: {item.product.category}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                        <div className="text-sm text-slate-600">
                                          <span className="font-semibold">Miqdar:</span> {item.quantity} {item.product?.unit || 'ədəd'}
                                        </div>
                                        <div className="text-sm text-slate-600">
                                          <span className="font-semibold">Vahid qiymət:</span> {Number(item.unitPrice).toFixed(2)} AZN
                                        </div>
                                        <div className="text-sm font-semibold text-slate-900">
                                          Cəmi: {Number(item.lineTotal).toFixed(2)} AZN
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-sm text-slate-500 bg-white border border-slate-200 rounded-lg p-3">
                                Məhsul məlumatı yoxdur
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Təsdiq gözləyən sifariş yoxdur.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Səbət Tab */}
      {activeTab === 'cart' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Səbət</h3>
          {cart && cart.items.length > 0 ? (
            <div className="space-y-4">
              {cart.items.map((item: any) => (
                <div key={item.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-slate-200 rounded-xl p-4">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-900">{item.product?.code} - {item.product?.name}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Vahid qiymət: {Number(item.unitPrice).toFixed(2)} AZN
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleQuantityChange(item.product?.id, -1)}
                      disabled={updateCartItem.isPending || item.quantity <= 0}
                      className="rounded-full border border-slate-200 p-2 hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Azalt"
                    >
                      <MinusIcon className="h-4 w-4" />
                    </button>
                    <span className="min-w-[50px] text-center text-sm font-semibold text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleQuantityChange(item.product?.id, 1)}
                      disabled={updateCartItem.isPending}
                      className="rounded-full bg-primary-600 p-2 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Artır"
                    >
                      <PlusIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleRemoveItem(item.product?.id)}
                      disabled={updateCartItem.isPending}
                      className="rounded-full border border-red-200 p-2 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Sil"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="text-sm font-semibold text-slate-900 min-w-[100px] text-right">
                    {Number(item.lineTotal).toFixed(2)} AZN
                  </div>
                </div>
              ))}
              <div className="border-t border-slate-200 pt-4 mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">Ümumi məbləğ:</span>
                  <span className="text-lg font-bold text-primary-600">{cart.totalAmount.toFixed(2)} AZN</span>
                </div>
                <button
                  onClick={handleCreateOrder}
                  disabled={createOrderMutation.isPending || updateCartItem.isPending}
                  className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {createOrderMutation.isPending ? 'Göndərilir...' : 'Sifariş sorğusu göndər'}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Səbət boşdur. Məhsullar səhifəsindən məhsul əlavə edin.
            </div>
          )}
        </div>
      )}

      {/* Yoldadır Tab */}
      {activeTab === 'shipped' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">Yoldadır</h3>
            <p className="text-sm text-slate-500">Admin paneldə təsdiqlənmiş sifarişlər</p>
          </div>
          <div className="p-6">
            {isLoading ? (
              <div className="text-sm text-slate-500 py-8 text-center">Yüklənir...</div>
            ) : shippedOrders.length > 0 ? (
              <div className="space-y-4">
                {shippedOrders.map((order: Order) => (
                  <div key={order.id} className="border border-slate-200 rounded-xl p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-slate-900">Sifariş #{order.id.slice(0, 8)}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          Tarix: {formatDateTime(order.createdAt)} · Məbləğ: {Number(order.total).toFixed(2)} AZN
                        </div>
                        {order.approvedAt && (
                          <div className="text-xs text-slate-500 mt-1">
                            Təsdiqləndi: {formatDateTime(order.approvedAt)}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeliver(order.id)}
                        disabled={deliverOrderMutation.isPending}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                      >
                        {deliverOrderMutation.isPending ? 'Çatdırılır...' : 'Çatdırıldı'}
                      </button>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="text-xs font-semibold text-slate-700 uppercase">Məhsullar:</div>
                      {order.items && order.items.length > 0 ? (
                        <div className="space-y-1">
                          {order.items.map((item: any, index: number) => (
                            <div key={index} className="text-sm text-slate-600 flex items-center justify-between">
                              <span>
                                {item.product?.code} - {item.product?.name}
                              </span>
                              <span className="font-semibold">
                                {item.quantity} x {Number(item.unitPrice).toFixed(2)} = {Number(item.lineTotal).toFixed(2)} AZN
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Yoldakı sifariş yoxdur.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sifarişlər (Arxiv) Tab */}
      {activeTab === 'delivered' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">Sifarişlər (Arxiv)</h3>
            <p className="text-sm text-slate-500">Çatdırılmış sifarişlərin tarixçəsi (Son 50)</p>
          </div>
          <div className="p-6">
            {isLoading ? (
              <div className="text-center py-8 text-sm text-slate-500">
                Yüklənir...
              </div>
            ) : deliveredOrders.length > 0 ? (
              <div className="space-y-4">
                {deliveredOrders.map((order: Order) => {
                  const isExpanded = expandedOrders.has(order.id);
                  const itemsCount = order.items?.length || 0;
                  return (
                    <div key={order.id} className="border border-slate-200 rounded-xl overflow-hidden hover:bg-slate-50 transition-colors">
                      {/* Sifariş başlığı - klik edilə bilən */}
                      <button
                        onClick={() => toggleOrderExpansion(order.id)}
                        className="w-full p-4 flex items-start justify-between text-left hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm font-semibold text-slate-900">Sifariş #{order.id.slice(0, 8)}</span>
                            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase bg-green-100 text-green-700">
                              Çatdırıldı
                            </span>
                            {itemsCount > 0 && (
                              <span className="text-xs text-slate-500">
                                {itemsCount} {itemsCount === 1 ? 'məhsul' : 'məhsul'}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 space-y-1">
                            <div>
                              <span className="font-semibold">Tarix:</span> {formatDateTime(order.createdAt)}
                              <span className="ml-2 text-slate-400">({formatRelativeTime(order.createdAt)})</span>
                            </div>
                            {order.deliveredAt && (
                              <div>
                                <span className="font-semibold">Çatdırıldı:</span> {formatDateTime(order.deliveredAt)}
                              </div>
                            )}
                            <div>
                              <span className="font-semibold">Məbləğ:</span> {Number(order.total).toFixed(2)} AZN
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          {isExpanded ? (
                            <ChevronUpIcon className="h-5 w-5 text-slate-400" />
                          ) : (
                            <ChevronDownIcon className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                      </button>

                      {/* Genişləndirilmiş məzmun - məhsullar */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-slate-200 bg-slate-50/50">
                          <div className="pt-4">
                            <div className="text-xs font-semibold text-slate-700 uppercase mb-3">Məhsullar ({itemsCount}):</div>
                            {order.items && order.items.length > 0 ? (
                              <div className="space-y-3">
                                {order.items.map((item: any, index: number) => (
                                  <div key={index} className="bg-white border border-slate-200 rounded-lg p-3">
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex-1">
                                        <div className="text-sm font-semibold text-slate-900 mb-1">
                                          {item.product?.code} - {item.product?.name}
                                        </div>
                                        {item.product?.category && (
                                          <div className="text-xs text-slate-500">
                                            Kateqoriya: {item.product.category}
                                          </div>
                                        )}
                                        {item.product?.unit && (
                                          <div className="text-xs text-slate-500">
                                            Vahid: {item.product.unit}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                      <div className="text-sm text-slate-600">
                                        <span className="font-semibold">Miqdar:</span> {item.quantity} {item.product?.unit || 'ədəd'}
                                      </div>
                                      <div className="text-sm text-slate-600">
                                        <span className="font-semibold">Vahid qiymət:</span> {Number(item.unitPrice).toFixed(2)} AZN
                                      </div>
                                      <div className="text-sm font-semibold text-slate-900">
                                        Cəmi: {Number(item.lineTotal).toFixed(2)} AZN
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-slate-500 bg-white border border-slate-200 rounded-lg p-3">
                                Məhsul məlumatı yoxdur
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-slate-500">
                Çatdırılmış sifariş yoxdur.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MagazinOrdersPage;

