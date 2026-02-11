import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import type { Order } from '../types';
import { queryKeys } from '../lib/queryKeys';

const fetchOrders = async (branchId?: string) => {
  const response = await api.get<Order[]>('/orders', {
    params: branchId ? { branchId } : undefined,
  });
  return response.data;
};

export const useOrders = (branchId?: string) =>
  useQuery({
    queryKey: queryKeys.orders(branchId),
    queryFn: () => fetchOrders(branchId),
    // Service panelində branchId ola bilər, amma yoxdursa da sifarişlər göstərilməlidir
    enabled: true,
    staleTime: 1000 * 60 * 60 * 24, // 24 saat - cache-də çox uzun müddət saxla
    gcTime: 1000 * 60 * 60 * 24 * 7, // 7 gün - garbage collection zamanı
    refetchOnMount: false, // Cache-də varsa yenidən fetch etmə
    refetchOnWindowFocus: false, // Pəncərə fokuslandıqda yenidən fetch etmə
  });

export interface TopSellingProduct {
  productId: string;
  productCode: string;
  productName: string;
  productCategory?: string;
  productUnit?: string;
  productImageUrl?: string;
  totalSales: number;
}

const fetchTopSellingProducts = async (limit?: number) => {
  const response = await api.get<TopSellingProduct[]>('/orders/top-selling', {
    params: limit ? { limit } : undefined,
  });
  return response.data;
};

export const useTopSellingProducts = (limit?: number) =>
  useQuery({
    queryKey: ['top-selling-products', limit],
    queryFn: () => fetchTopSellingProducts(limit),
    refetchInterval: 30000, // Hər 30 saniyədə bir yenilə
  });

export default useOrders;

