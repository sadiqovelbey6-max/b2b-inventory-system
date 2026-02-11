import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Product } from '../types';
import { queryKeys } from '../lib/queryKeys';

const fetchProducts = async (branchId?: string) => {
  const response = await api.get<Product[]>('/products', {
    params: branchId ? { branch: branchId } : undefined,
  });
  return response.data;
};

const fetchCategories = async () => {
  const response = await api.get<string[]>('/products/categories');
  return response.data;
};

export const useProducts = (branchId?: string) =>
  useQuery({
    queryKey: queryKeys.products(branchId),
    queryFn: () => fetchProducts(branchId),
    // staleTime: 0 - Cache-də məlumat olsa belə, həmişə backend-dən yenidən gətir
    // Bu, kateqoriya dəyişikliklərinin dərhal görünməsi üçün lazımdır
    staleTime: 0, // Həmişə stale sayılır, yenidən fetch edilir
    // gcTime: 5 dəqiqə - Cache-də qısa müddət saxla
    gcTime: 1000 * 60 * 5, // 5 dəqiqə
    // refetchOnMount: 'always' - Həmişə yenidən fetch et
    refetchOnMount: 'always', // Həmişə yenidən fetch et
    refetchOnWindowFocus: true, // Pəncərə fokuslandıqda yenidən fetch et
    refetchInterval: false, // Avtomatik yeniləməni söndür
    // MÜHİM: Kateqoriya dəyişikliklərinin dərhal görünməsi üçün cache-i qısa müddət saxla
    // Database-də məlumatlar HƏR ZAMAN qalır, cache yalnız performans üçündür
  });

export const useCategories = () =>
  useQuery({
    queryKey: ['products', 'categories'],
    queryFn: fetchCategories,
    // staleTime: 7 gün - Kateqoriyalar çox nadir dəyişir, ona görə də uzun müddət cache-də saxlanır
    // QEYD: Database-də kateqoriyalar HƏR ZAMAN qalır!
    staleTime: 1000 * 60 * 60 * 24 * 7, // 7 gün
    // gcTime: 30 gün - Çox uzun müddət cache-də saxla
    // QEYD: Cache-dən silinsə belə, database-də qalır və lazım olduqda yenidən gətirilir
    gcTime: 1000 * 60 * 60 * 24 * 30, // 30 gün
    // refetchOnMount: 'always' - Cache-də məlumat yoxdursa və ya stale-dırsa, avtomatik olaraq backend-dən gətir
    refetchOnMount: 'always', // Cache-də məlumat yoxdursa və ya stale-dırsa, avtomatik fetch et
    refetchOnWindowFocus: false, // Pəncərə fokuslandıqda yenidən fetch etmə
  });

export interface BulkImportResult {
  processed: number;
  created: number;
  errors: string[];
  // MÜHİM: "updated" field-i silinib - yenilənmə anlayışı YOXDUR
  // Həmişə "added" kimi sayılır
}

export const useBulkImportProducts = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ text, tenantId }: { text: string; tenantId?: string }) => {
      const response = await api.post<BulkImportResult>('/products/bulk-import', {
        text,
        tenantId,
      });
      return response.data;
    },
    meta: {
      successMessage: 'Məhsullar uğurla əlavə edildi',
      errorMessage: 'Məhsulları əlavə etmək mümkün olmadı',
    },
    onSuccess: async () => {
      // Məhsul əlavə edildikdə və ya yeniləndikdə cache-i yenilə
      // MÜHİM: Cache-i tamamilə təmizlə və yenidən fetch et ki, kateqoriya dəyişiklikləri dərhal görünsün
      queryClient.removeQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === 'products';
        },
      });
      // Kateqoriyaları da remove et
      queryClient.removeQueries({ queryKey: ['products', 'categories'] });
      // Refetch et ki, kateqoriya dəyişiklikləri dərhal görünsün
      await queryClient.refetchQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === 'products';
        },
      });
      await queryClient.refetchQueries({ queryKey: ['products', 'categories'] });
    },
  });
};

export const useUpdateProductPrices = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, price, purchasePrice }: { productId: string; price?: number; purchasePrice?: number }) => {
      const response = await api.put(`/products/${productId}/prices`, {
        price,
        purchasePrice,
      });
      return response.data;
    },
    meta: {
      successMessage: 'Qiymət uğurla yeniləndi',
      errorMessage: 'Qiyməti yeniləmək mümkün olmadı',
    },
    onSuccess: () => {
      // Məhsul əlavə edildikdə və ya yeniləndikdə cache-i yenilə
      // Amma refetch etmə, yalnız cache-i invalidate et ki, lazım olduqda yenidən gətirilsin
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === 'products';
        },
      });
      // Kateqoriyaları da yenilə
      queryClient.invalidateQueries({ queryKey: ['products', 'categories'] });
    },
  });
};

export const useUpdateProductBranch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, branchName }: { productId: string; branchName?: string | null }) => {
      const response = await api.put(`/products/${productId}/prices`, {
        branchName,
      });
      return { productId, updatedProduct: response.data };
    },
    meta: {
      successMessage: 'Filial uğurla yeniləndi',
      errorMessage: 'Filialı yeniləmək mümkün olmadı',
    },
    onSuccess: async (data) => {
      const { productId, updatedProduct } = data;
      
      // Backend'den dönen güncellenmiş product bilgisini cache'e ekle
      if (updatedProduct) {
        queryClient.setQueriesData(
          { queryKey: ['products'], exact: false },
          (oldData: Product[] | undefined) => {
            if (!oldData) return oldData;
            
            return oldData.map((product) => {
              if (product.id === productId) {
                // Backend'den dönen tam product bilgisini kullan
                return {
                  ...product,
                  branch: updatedProduct.branch || null,
                };
              }
              return product;
            });
          }
        );
      }
      
      // Bütün products query-lərini invalidate et ki refetch olsun
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === 'products';
        },
      });
    },
  });
};

export const useUpdateProductsCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productIds, category }: { productIds: string[]; category: string }) => {
      const response = await api.put('/products/category', {
        productIds,
        category,
      });
      return response.data;
    },
    meta: {
      successMessage: 'Kateqoriya uğurla yeniləndi',
      errorMessage: 'Kateqoriyanı yeniləmək mümkün olmadı',
    },
    onSuccess: () => {
      // Məhsul əlavə edildikdə və ya yeniləndikdə cache-i yenilə
      // Amma refetch etmə, yalnız cache-i invalidate et ki, lazım olduqda yenidən gətirilsin
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === 'products';
        },
      });
      // Kateqoriyaları da yenilə
      queryClient.invalidateQueries({ queryKey: ['products', 'categories'] });
    },
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      const response = await api.delete(`/products/${productId}`);
      return response.data;
    },
    meta: {
      successMessage: 'Məhsul uğurla silindi',
      errorMessage: 'Məhsulu silmək mümkün olmadı',
    },
    onSuccess: () => {
      // Məhsul əlavə edildikdə və ya yeniləndikdə cache-i yenilə
      // Amma refetch etmə, yalnız cache-i invalidate et ki, lazım olduqda yenidən gətirilsin
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === 'products';
        },
      });
      // Kateqoriyaları da yenilə
      queryClient.invalidateQueries({ queryKey: ['products', 'categories'] });
    },
  });
};

export const useBulkDeleteProducts = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (productIds: string[]) => {
      const response = await api.post('/products/bulk-delete', {
        productIds,
      });
      return response.data;
    },
    meta: {
      successMessage: 'Məhsullar uğurla silindi',
      errorMessage: 'Məhsulları silmək mümkün olmadı',
    },
    onSuccess: () => {
      // Məhsullar silindikdə cache-i yenilə
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === 'products';
        },
      });
      // Kateqoriyaları da yenilə
      queryClient.invalidateQueries({ queryKey: ['products', 'categories'] });
    },
  });
};

export default useProducts;

