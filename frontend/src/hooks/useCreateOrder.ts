import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Order } from '../types';
import { queryKeys } from '../lib/queryKeys';
import { toastBus } from '../lib/toastBus';

export const useCreateOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await api.post<Order>('/orders');
      return response.data;
    },
    meta: {
      errorMessage: 'Sifariş yaradılarkən xəta baş verdi',
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cart('general') });
      queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
      // Sifariş yaradılanda hesablanmış stok yenilənməlidir (reserved qty artır)
      queryClient.invalidateQueries({ queryKey: ['transactions', 'calculated-stock'] });
      // Top selling products cache-ini də invalidate et (gələcək satışlar üçün)
      queryClient.invalidateQueries({ queryKey: ['top-selling-products'] });
      toastBus.emit({
        title: 'Yeni sifariş yaradıldı',
        description: `Sifariş ID: ${order.id}`,
        type: 'success',
        persist: true,
        link: { label: 'Sifarişlərə bax', to: '/orders' },
      });
    },
  });
};

export default useCreateOrder;

