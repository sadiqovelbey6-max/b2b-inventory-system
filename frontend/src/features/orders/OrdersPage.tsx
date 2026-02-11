import { useMemo, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, TrophyIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import useAuth from '../../hooks/useAuth';
import { useOrders, useTopSellingProducts } from '../../hooks/useOrders';
import { usePendingApprovalOrders, useApproveOrder, useRejectOrder } from '../../hooks/useTransactions';
import { USER_ROLES } from '../../types';
import type { Order } from '../../types';
import { formatDateTime, formatRelativeTime } from '../../utils/dateFormat';
import api from '../../lib/api';

import MagazinOrdersPage from './MagazinOrdersPage';

export const OrdersPage = () => {
  const { user } = useAuth();
  
  // Magazin paneli üçün xüsusi səhifə
  if (user?.role === USER_ROLES.USER) {
    return <MagazinOrdersPage />;
  }

  // Admin paneli (SUPER_ADMIN və BRANCH_MANAGER) üçün sifarişlər səhifəsi
  // branchId yoxdursa, bütün sifarişləri göstər (SUPER_ADMIN üçün)
  const branchId = user?.branch?.id;
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const { data: orders, isLoading, refetch } = useOrders(branchId);
  const pendingOrdersQuery = usePendingApprovalOrders(branchId);
  const approveOrderMutation = useApproveOrder();
  const rejectOrderMutation = useRejectOrder();

  const isAdminPanel = user?.role === USER_ROLES.SUPER_ADMIN || user?.role === USER_ROLES.BRANCH_MANAGER;
  const [showTopSelling, setShowTopSelling] = useState(false);
  const [showMonthly, setShowMonthly] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Aylıq statistikaları yüklə
  const { data: monthlyStats } = useQuery({
    queryKey: ['monthly-statistics', selectedYear],
    queryFn: async () => {
      const response = await api.get('/orders/monthly-statistics', {
        params: { year: selectedYear },
      });
      return response.data;
    },
    enabled: isAdminPanel && activeTab === 'history',
  });

  // Ən çox satılan məhsullar
  const { data: topSellingProducts } = useTopSellingProducts(100);

  // Tarix üçün BÜTÜN sifarişlər (təsdiqlənmiş, çatdırılmış və ya rədd edilmiş)
  // Tarixə görə sıralanmış (ən yeni üstdə)
  const historyOrders = useMemo(() => {
    if (!orders || !Array.isArray(orders)) {
      return [];
    }
    
    const filtered = orders.filter(
      (order: Order) => 
        order.status === 'approved' || 
        order.status === 'shipped' || 
        order.status === 'delivered' || 
        order.status === 'rejected'
    );
    
    const sorted = filtered.sort((a: Order, b: Order) => {
      // Ən yeni tarix üstdə
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    return sorted; // Limit yoxdur - bütün sifarişlər
  }, [orders]);

  // Cari ay üçün sifarişlər
  const currentMonthOrders = useMemo(() => {
    if (!historyOrders || !Array.isArray(historyOrders)) {
      return [];
    }
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    return historyOrders.filter((order: Order) => {
      const orderDate = new Date(order.createdAt);
      return orderDate.getFullYear() === currentYear && orderDate.getMonth() === currentMonth;
    });
  }, [historyOrders]);

  // Ümumi xalis qazanc hesabla (yalnız çatdırılmış sifarişlər)
  const totalNetProfit = useMemo(() => {
    if (!orders || !Array.isArray(orders)) return { revenue: 0, expenses: 0, profit: 0 };
    
    let revenue = 0;
    let expenses = 0;
    
    orders
      .filter((order: Order) => order.status === 'delivered')
      .forEach((order: Order) => {
        revenue += Number(order.total || 0);
        
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            if (item.product) {
              const purchasePrice = Number(item.product.purchasePrice || 0);
              const quantity = Number(item.quantity || 0);
              expenses += purchasePrice * quantity;
            }
          });
        }
      });
    
    return {
      revenue,
      expenses,
      profit: revenue - expenses,
    };
  }, [orders]);

  // Cari il üçün aylıq statistikalar
  const currentYearStats = useMemo(() => {
    if (!monthlyStats || !Array.isArray(monthlyStats)) {
      return { revenue: 0, expenses: 0, profit: 0, orderCount: 0 };
    }
    
    return monthlyStats.reduce(
      (acc, stat) => ({
        revenue: acc.revenue + (stat.revenue || 0),
        expenses: acc.expenses + (stat.expenses || 0),
        profit: acc.profit + (stat.profit || 0),
        orderCount: acc.orderCount + (stat.orderCount || 0),
      }),
      { revenue: 0, expenses: 0, profit: 0, orderCount: 0 },
    );
  }, [monthlyStats]);

  const handleApprove = (orderId: string) => {
    approveOrderMutation.mutate(orderId, {
      onSuccess: () => {
        refetch();
      },
    });
  };

  const handleReject = (orderId: string) => {
    const reason = rejectionReason[orderId]?.trim();
    rejectOrderMutation.mutate({ orderId, reason }, {
      onSuccess: () => {
        refetch();
      },
    });
    setRejectionReason({ ...rejectionReason, [orderId]: '' });
  };

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Sifarişlər</h2>
        <p className="text-sm text-slate-500">
          Sifarişləri görüntüləyin, təsdiqləyin və ya rədd edin.
        </p>
      </div>

      {/* Tab sistemi */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="border-b border-slate-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors ${
                activeTab === 'pending'
                  ? 'text-primary-700 border-b-2 border-primary-600 bg-primary-50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Təsdiq gözləyənlər
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors ${
                activeTab === 'history'
                  ? 'text-primary-700 border-b-2 border-primary-600 bg-primary-50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Tarix
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'pending' && (
            <>
              {/* Admin paneli üçün təsdiq gözləyən sifarişlər */}
              {isAdminPanel && pendingOrdersQuery.data && Array.isArray(pendingOrdersQuery.data) && pendingOrdersQuery.data.length > 0 ? (
                <div className="space-y-4">
                  {pendingOrdersQuery.data.map((order: any) => {
                    const hasStockShortage = order.stockShortageItems && order.stockShortageItems.length > 0;
                    return (
                      <div key={order.id} className={`border rounded-xl p-4 ${hasStockShortage ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}`}>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-semibold text-slate-900">Sifariş #{order.id.slice(0, 8)}</div>
                              {hasStockShortage && (
                                <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold bg-amber-100 text-amber-800">
                                  ⚠️ Stok çatışmazlığı
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              Tarix: {formatDateTime(order.createdAt)} · Məbləğ: {Number(order.total).toFixed(2)} AZN
                            </div>
                            <div className="text-xs text-slate-500">
                              Yaradıldı: {order.createdBy?.email}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(order.id)}
                              disabled={approveOrderMutation.isPending}
                              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                            >
                              {approveOrderMutation.isPending ? 'Təsdiqlənir...' : 'Təsdiqlə'}
                            </button>
                            <button
                              onClick={() => handleReject(order.id)}
                              disabled={rejectOrderMutation.isPending}
                              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                            >
                              Rədd et
                            </button>
                          </div>
                        </div>
                        
                        {/* Stok çatışmazlığı xəbərdarlığı */}
                        {hasStockShortage && (
                          <div className="mb-4 p-3 bg-amber-100 border border-amber-300 rounded-lg">
                            <div className="text-sm font-semibold text-amber-900 mb-2">
                              ⚠️ Stok çatışmazlığı var:
                            </div>
                            <div className="space-y-1">
                              {order.stockShortageItems.map((shortage: any, idx: number) => (
                                <div key={idx} className="text-xs text-amber-800">
                                  <span className="font-semibold">{shortage.productCode} - {shortage.productName}:</span>{' '}
                                  Tələb olunan: {shortage.requestedQty}, Mövcud: {shortage.availableQty},{' '}
                                  <span className="font-semibold text-amber-900">Çatışmazlıq: {shortage.shortageQty}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="mt-4 space-y-2">
                          <div className="text-xs font-semibold text-slate-700 uppercase">Məhsullar:</div>
                          {order.items && order.items.length > 0 ? (
                            <div className="space-y-1">
                              {order.items.map((item: any, index: number) => {
                                const itemShortage = hasStockShortage 
                                  ? order.stockShortageItems.find((s: any) => s.productCode === item.product?.code)
                                  : null;
                                return (
                                  <div 
                                    key={index} 
                                    className={`text-sm flex items-center justify-between p-2 rounded ${
                                      itemShortage ? 'bg-amber-50 border border-amber-200' : 'text-slate-600'
                                    }`}
                                  >
                                    <span>
                                      {item.product?.code} - {item.product?.name}
                                      {itemShortage && (
                                        <span className="ml-2 text-xs text-amber-700 font-semibold">
                                          (Çatışmazlıq: {itemShortage.shortageQty})
                                        </span>
                                      )}
                                    </span>
                                    <span className="font-semibold">
                                      {item.quantity} x {Number(item.unitPrice).toFixed(2)} = {Number(item.lineTotal).toFixed(2)} AZN
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <input
                            type="text"
                            value={rejectionReason[order.id] ?? ''}
                            onChange={(e) => setRejectionReason({ ...rejectionReason, [order.id]: e.target.value })}
                            placeholder="Rədd səbəbi (isteğe bağlı)"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-slate-500">
                  Təsdiq gözləyən sifariş yoxdur.
                </div>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              {/* Ümumi Xalis Qazanc və Aylıq Panellər */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-primary-50 border border-primary-200 rounded-xl px-4 py-3">
                  <div className="text-xs text-primary-600 font-medium uppercase mb-1">Ümumi Xalis Qazanc</div>
                  <div className={`text-2xl font-bold ${totalNetProfit.profit >= 0 ? 'text-primary-700' : 'text-red-700'}`}>
                    {totalNetProfit.profit >= 0 ? '+' : ''}
                    {totalNetProfit.profit.toFixed(2)} AZN
                  </div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <div className="text-xs text-green-600 font-medium uppercase mb-1">Ümumi Gəlir ({selectedYear})</div>
                  <div className="text-2xl font-bold text-green-700">{currentYearStats.revenue.toFixed(2)} AZN</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <div className="text-xs text-red-600 font-medium uppercase mb-1">Ümumi Xərc ({selectedYear})</div>
                  <div className="text-2xl font-bold text-red-700">{currentYearStats.expenses.toFixed(2)} AZN</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <div className="text-xs text-slate-600 font-medium uppercase mb-1">Sifariş Sayı ({selectedYear})</div>
                  <div className="text-2xl font-bold text-slate-700">{currentYearStats.orderCount}</div>
                </div>
              </div>

              {/* İl seçimi və düymələr */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-slate-700">İl:</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowMonthly(!showMonthly)}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                      showMonthly
                        ? 'border-primary-600 bg-primary-600 text-white'
                        : 'border-primary-300 bg-primary-50 text-primary-700 hover:bg-primary-100'
                    }`}
                  >
                    <CalendarIcon className="h-5 w-5" />
                    Aylıq
                  </button>
                  <button
                    onClick={() => setShowTopSelling(true)}
                    className="flex items-center gap-2 rounded-lg border border-primary-300 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-100 transition"
                  >
                    <TrophyIcon className="h-5 w-5" />
                    Ən çox satılanlar
                  </button>
                </div>
              </div>

              {/* Aylıq görünüşü */}
              {showMonthly && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-blue-900">
                      Cari ay sifarişləri ({new Date().toLocaleDateString('az-AZ', { month: 'long', year: 'numeric' })})
                    </h3>
                    <span className="text-xs text-blue-700 font-medium">
                      {currentMonthOrders.length} sifariş
                    </span>
                  </div>
                  {currentMonthOrders.length === 0 ? (
                    <p className="text-sm text-blue-600">Bu ay üçün sifariş yoxdur.</p>
                  ) : (
                    <div className="space-y-3">
                      {currentMonthOrders.map((order: Order) => {
                        const isExpanded = expandedOrders.has(order.id);
                        const itemsCount = order.items?.length || 0;
                        return (
                          <div key={order.id} className="bg-white border border-blue-200 rounded-lg overflow-hidden">
                            <button
                              onClick={() => toggleOrderExpansion(order.id)}
                              className="w-full p-3 flex items-start justify-between text-left hover:bg-blue-50 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                  <span className="text-sm font-semibold text-slate-900">Sifariş #{order.id.slice(0, 8)}</span>
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold uppercase ${
                                      order.status === 'approved'
                                        ? 'bg-blue-100 text-blue-700'
                                        : order.status === 'shipped'
                                          ? 'bg-purple-100 text-purple-700'
                                          : order.status === 'delivered'
                                            ? 'bg-green-100 text-green-700'
                                            : order.status === 'rejected'
                                              ? 'bg-red-100 text-red-700'
                                              : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {order.status === 'approved'
                                      ? 'Təsdiqlənib'
                                      : order.status === 'shipped'
                                        ? 'Göndərildi'
                                        : order.status === 'delivered'
                                          ? 'Çatdırıldı'
                                          : order.status === 'rejected'
                                            ? 'Rədd edilib'
                                            : order.status}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500">
                                  <span className="font-semibold">Tarix:</span> {formatDateTime(order.createdAt)} ·{' '}
                                  <span className="font-semibold">Məbləğ:</span> {Number(order.total).toFixed(2)} AZN
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

                            {isExpanded && (
                              <div className="px-3 pb-3 border-t border-blue-100 bg-blue-50/50">
                                <div className="pt-3">
                                  <div className="text-xs font-semibold text-slate-700 uppercase mb-2">Məhsullar ({itemsCount}):</div>
                                  {order.items && order.items.length > 0 ? (
                                    <div className="space-y-2">
                                      {order.items.map((item: any, index: number) => (
                                        <div key={index} className="bg-white border border-slate-200 rounded p-2">
                                          <div className="text-sm font-semibold text-slate-900 mb-1">
                                            {item.product?.code} - {item.product?.name}
                                          </div>
                                          <div className="flex items-center justify-between text-xs text-slate-600">
                                            <span>Miqdar: {item.quantity} {item.product?.unit || 'ədəd'}</span>
                                            <span>Vahid qiymət: {Number(item.unitPrice).toFixed(2)} AZN</span>
                                            <span className="font-semibold">Cəmi: {Number(item.lineTotal).toFixed(2)} AZN</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-sm text-slate-500">Məhsul məlumatı yoxdur</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Sifarişlər siyahısı */}
              {isLoading ? (
                <div className="text-center py-8 text-sm text-slate-500">
                  Yüklənir...
                </div>
              ) : historyOrders && historyOrders.length > 0 ? (
                <div className="space-y-4">
                  {historyOrders.map((order: Order) => {
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
                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                                  order.status === 'approved'
                                    ? 'bg-blue-100 text-blue-700'
                                    : order.status === 'shipped'
                                      ? 'bg-purple-100 text-purple-700'
                                      : order.status === 'delivered'
                                        ? 'bg-green-100 text-green-700'
                                        : order.status === 'rejected'
                                          ? 'bg-red-100 text-red-700'
                                          : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {order.status === 'approved'
                                  ? 'Təsdiqlənib'
                                  : order.status === 'shipped'
                                    ? 'Göndərildi'
                                    : order.status === 'delivered'
                                      ? 'Çatdırıldı'
                                      : order.status === 'rejected'
                                        ? 'Rədd edilib'
                                        : order.status}
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
                              {order.approvedAt && (
                                <div>
                                  <span className="font-semibold">Təsdiqləndi:</span> {formatDateTime(order.approvedAt)}
                                </div>
                              )}
                              {order.deliveredAt && (
                                <div>
                                  <span className="font-semibold">Çatdırıldı:</span> {formatDateTime(order.deliveredAt)}
                                </div>
                              )}
                              <div>
                                <span className="font-semibold">Məbləğ:</span> {Number(order.total).toFixed(2)} AZN
                              </div>
                              {order.approvedBy && (
                                <div>
                                  <span className="font-semibold">Təsdiqlədi:</span> {order.approvedBy.email}
                                </div>
                              )}
                              {order.rejectionReason && (
                                <div className="text-red-600">
                                  <span className="font-semibold">Rədd səbəbi:</span> {order.rejectionReason}
                                </div>
                              )}
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
                  Sifariş tarixi tapılmadı.
                </div>
              )}
            </div>
          )}

          {/* Ən çox satılanlar modal */}
          {showTopSelling && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowTopSelling(false)}>
              <div className="bg-white rounded-xl shadow-xl p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Ən çox satılanlar</h3>
                  <button
                    onClick={() => setShowTopSelling(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                </div>
                {topSellingProducts && topSellingProducts.length > 0 ? (
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
                        {topSellingProducts.map((product, index) => (
                          <tr key={product.productId} className="text-sm text-slate-700 hover:bg-slate-50">
                            <td className="px-4 py-3 font-semibold text-slate-900">{index + 1}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">{product.productName}</div>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-900">{product.productCode}</td>
                            <td className="px-4 py-3 text-slate-600">{product.productCategory || '-'}</td>
                            <td className="px-4 py-3 text-right font-semibold text-primary-700">
                              {product.totalSales} {product.productUnit || 'ədəd'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-sm text-slate-500">
                    Hələ heç bir satış yoxdur.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrdersPage;

