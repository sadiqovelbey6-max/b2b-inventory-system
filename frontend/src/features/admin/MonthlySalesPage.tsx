import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import useAuth from '../../hooks/useAuth';
import api from '../../lib/api';
import { USER_ROLES } from '../../types';
import { formatDate, formatDateTime } from '../../utils/dateFormat';

interface MonthlyStatistic {
  month: number;
  monthName: string;
  year: number;
  revenue: number;
  expenses: number;
  profit: number;
  orderCount: number;
}

interface MonthlyDetails {
  year: number;
  month: number;
  monthName: string;
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  orderCount: number;
  orders: Array<{
    id: string;
    createdAt: string;
    total: number;
    expenses: number;
    profit: number;
    itemCount: number;
  }>;
}

const fetchMonthlyStatistics = async (year?: number): Promise<MonthlyStatistic[]> => {
  const params = year ? { year } : {};
  const response = await api.get<MonthlyStatistic[]>('/orders/monthly-statistics', { params });
  return response.data;
};

const fetchMonthlyDetails = async (year: number, month: number): Promise<MonthlyDetails> => {
  const response = await api.get<MonthlyDetails>('/orders/monthly-details', {
    params: { year, month },
  });
  return response.data;
};

export const MonthlySalesPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === USER_ROLES.SUPER_ADMIN || user?.role === USER_ROLES.BRANCH_MANAGER;
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const { data: monthlyStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['monthly-statistics', selectedYear],
    queryFn: () => fetchMonthlyStatistics(selectedYear),
  });

  const { data: monthlyDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['monthly-details', selectedYear, selectedMonth],
    queryFn: () => fetchMonthlyDetails(selectedYear, selectedMonth!),
    enabled: selectedMonth !== null,
  });

  const totalYearStats = useMemo(() => {
    if (!monthlyStats) return { revenue: 0, expenses: 0, profit: 0, orderCount: 0 };
    return monthlyStats.reduce(
      (acc, stat) => ({
        revenue: acc.revenue + stat.revenue,
        expenses: acc.expenses + stat.expenses,
        profit: acc.profit + stat.profit,
        orderCount: acc.orderCount + stat.orderCount,
      }),
      { revenue: 0, expenses: 0, profit: 0, orderCount: 0 },
    );
  }, [monthlyStats]);

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Bu bölməyə yalnız admin istifadəçilər daxil ola bilər.
      </div>
    );
  }

  if (selectedMonth !== null) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedMonth(null)}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ChevronLeftIcon className="h-5 w-5" />
            Geri
          </button>
          <h2 className="text-xl font-semibold text-slate-900">
            {monthlyDetails?.monthName} {selectedYear}
          </h2>
          <div></div>
        </div>

        {isLoadingDetails ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            Yüklənir...
          </div>
        ) : monthlyDetails ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="text-xs text-green-600 font-medium uppercase mb-1">Ümumi Gəlir</div>
                <div className="text-2xl font-bold text-green-700">{monthlyDetails.totalRevenue.toFixed(2)} AZN</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="text-xs text-red-600 font-medium uppercase mb-1">Ümumi Xərc</div>
                <div className="text-2xl font-bold text-red-700">{monthlyDetails.totalExpenses.toFixed(2)} AZN</div>
              </div>
              <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
                <div className="text-xs text-primary-600 font-medium uppercase mb-1">Xalis Qazanc</div>
                <div className={`text-2xl font-bold ${monthlyDetails.totalProfit >= 0 ? 'text-primary-700' : 'text-red-700'}`}>
                  {monthlyDetails.totalProfit >= 0 ? '+' : ''}
                  {monthlyDetails.totalProfit.toFixed(2)} AZN
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-600 font-medium uppercase mb-1">Sifariş Sayı</div>
                <div className="text-2xl font-bold text-slate-700">{monthlyDetails.orderCount}</div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
              <div className="p-4 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900">Sifarişlər</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-semibold uppercase text-slate-500 tracking-wide">
                      <th className="px-4 py-3">Tarix</th>
                      <th className="px-4 py-3 text-right">Gəlir</th>
                      <th className="px-4 py-3 text-right">Xərc</th>
                      <th className="px-4 py-3 text-right">Qazanc</th>
                      <th className="px-4 py-3 text-right">Məhsul Sayı</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthlyDetails.orders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                          Bu ay üçün sifariş yoxdur.
                        </td>
                      </tr>
                    ) : (
                      monthlyDetails.orders.map((order) => (
                        <tr key={order.id} className="text-sm text-slate-700 hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <div>{formatDate(order.createdAt)}</div>
                              <div className="text-xs text-slate-500">{formatDateTime(order.createdAt)}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-green-600">
                            {order.total.toFixed(2)} AZN
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-red-600">
                            {order.expenses.toFixed(2)} AZN
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`font-semibold ${order.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}
                            >
                              {order.profit >= 0 ? '+' : ''}
                              {order.profit.toFixed(2)} AZN
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">{order.itemCount}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            Məlumat tapılmadı.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Aylıq</h2>
          <p className="text-sm text-slate-500">Aylıq gəlir, xərc və xalis qazanc statistikaları.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedYear(selectedYear - 1)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <button
            onClick={() => setSelectedYear(selectedYear + 1)}
            disabled={selectedYear >= new Date().getFullYear()}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="text-xs text-green-600 font-medium uppercase mb-1">Ümumi Gəlir ({selectedYear})</div>
          <div className="text-2xl font-bold text-green-700">{totalYearStats.revenue.toFixed(2)} AZN</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="text-xs text-red-600 font-medium uppercase mb-1">Ümumi Xərc ({selectedYear})</div>
          <div className="text-2xl font-bold text-red-700">{totalYearStats.expenses.toFixed(2)} AZN</div>
        </div>
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
          <div className="text-xs text-primary-600 font-medium uppercase mb-1">Xalis Qazanc ({selectedYear})</div>
          <div className={`text-2xl font-bold ${totalYearStats.profit >= 0 ? 'text-primary-700' : 'text-red-700'}`}>
            {totalYearStats.profit >= 0 ? '+' : ''}
            {totalYearStats.profit.toFixed(2)} AZN
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-600 font-medium uppercase mb-1">Sifariş Sayı ({selectedYear})</div>
          <div className="text-2xl font-bold text-slate-700">{totalYearStats.orderCount}</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">Aylar</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase text-slate-500 tracking-wide">
                <th className="px-4 py-3">Ay</th>
                <th className="px-4 py-3 text-right">Gəlir</th>
                <th className="px-4 py-3 text-right">Xərc</th>
                <th className="px-4 py-3 text-right">Xalis Qazanc</th>
                <th className="px-4 py-3 text-right">Sifariş Sayı</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingStats ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    Yüklənir...
                  </td>
                </tr>
              ) : monthlyStats && monthlyStats.length > 0 ? (
                monthlyStats.map((stat) => (
                  <tr
                    key={stat.month}
                    className="text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                    onClick={() => setSelectedMonth(stat.month)}
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900">{stat.monthName}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">
                      {stat.revenue.toFixed(2)} AZN
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">
                      {stat.expenses.toFixed(2)} AZN
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-semibold ${stat.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {stat.profit >= 0 ? '+' : ''}
                        {stat.profit.toFixed(2)} AZN
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{stat.orderCount}</td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRightIcon className="h-5 w-5 text-slate-400" />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    Bu il üçün məlumat yoxdur.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MonthlySalesPage;

