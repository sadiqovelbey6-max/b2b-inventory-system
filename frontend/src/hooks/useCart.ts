import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Cart } from '../types';
import { queryKeys } from '../lib/queryKeys';

const fetchCart = async () => {
  const response = await api.get<Cart>('/cart');
  return response.data;
};

export const useCart = () => {
  return useQuery({
    queryKey: queryKeys.cart('general'),
    queryFn: () => fetchCart(),
    enabled: true,
    staleTime: 1000 * 60 * 60 * 24, // 24 saat - cache-də çox uzun müddət saxla
    gcTime: 1000 * 60 * 60 * 24 * 7, // 7 gün - garbage collection zamanı
    refetchOnMount: false, // Cache-də varsa yenidən fetch etmə
    refetchOnWindowFocus: false, // Pəncərə fokuslandıqda yenidən fetch etmə
  });
};

export const useUpdateCartItem = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      const response = await api.post<Cart>('/cart/items', {
        productId,
        quantity,
      });
      return response.data;
    },
    meta: {
      errorMessage: 'Səbət yenilənmədi',
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cart('general') });
    },
  });
};

