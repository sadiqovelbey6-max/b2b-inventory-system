import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { ProductSubstitute } from '../types';

export const useProductSubstitutes = (productId: string | null) => {
  return useQuery({
    queryKey: ['product-substitutes', productId],
    queryFn: async () => {
      if (!productId) return [];
      const response = await api.get<ProductSubstitute[]>(`/products/${productId}/substitutes`);
      return response.data;
    },
    enabled: !!productId,
  });
};

export const useAddProductSubstitute = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, substituteId }: { productId: string; substituteId: string }) => {
      const response = await api.post(`/products/${productId}/substitutes`, {
        substituteId,
      });
      return response.data;
    },
    meta: {
      successMessage: 'Əvəz edici uğurla əlavə edildi',
      errorMessage: 'Əvəz edici əlavə etmək mümkün olmadı',
    },
    onSuccess: (_, variables) => {
      // Hər iki məhsulun substitute list-lərini yenilə (qarşılıqlı əlaqə üçün)
      queryClient.invalidateQueries({ queryKey: ['product-substitutes', variables.productId] });
      queryClient.invalidateQueries({ queryKey: ['product-substitutes', variables.substituteId] });
      // Tüm products query'lerini invalidate et (tüm branchId varyasyonları dahil)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === 'products';
        },
      });
    },
  });
};

export const useRemoveProductSubstitute = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, substituteId }: { productId: string; substituteId: string }) => {
      const response = await api.delete(`/products/${productId}/substitutes/${substituteId}`);
      return response.data;
    },
    meta: {
      successMessage: 'Əvəz edici uğurla silindi',
      errorMessage: 'Əvəz edici silmək mümkün olmadı',
    },
    onSuccess: (_, variables) => {
      // Hər iki məhsulun substitute list-lərini yenilə (qarşılıqlı əlaqə üçün)
      queryClient.invalidateQueries({ queryKey: ['product-substitutes', variables.productId] });
      queryClient.invalidateQueries({ queryKey: ['product-substitutes', variables.substituteId] });
      // Tüm products query'lerini invalidate et (tüm branchId varyasyonları dahil)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === 'products';
        },
      });
    },
  });
};

export const useBulkAddProductSubstitutes = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (codes: string[]) => {
      const response = await api.post('/products/substitutes/bulk', { codes });
      return response.data;
    },
    meta: {
      successMessage: 'Əvəz edicilər uğurla əlavə edildi',
      errorMessage: 'Əvəz edicilər əlavə etmək mümkün olmadı',
    },
    onSuccess: () => {
      // Bütün product-substitutes query-lərini yenilə
      queryClient.invalidateQueries({ queryKey: ['product-substitutes'] });
      // Tüm products query'lerini invalidate et (tüm branchId varyasyonları dahil)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === 'products';
        },
      });
    },
  });
};

