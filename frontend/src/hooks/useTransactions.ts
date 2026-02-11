import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

// Types
export interface Transaction {
  id: string;
  product: { id: string; code: string; name: string };
  branch: { id: string; name: string };
  order?: { id: string } | null;
  type: 'order' | 'manual_adjustment' | 'stock_in' | 'stock_out';
  quantity: number;
  status: 'pending' | 'published';
  calculatedStockAfter?: number | null;
  notes?: string | null;
  createdAt: string;
}

export interface ManualAdjustment {
  id: string;
  product: { id: string; code: string; name: string };
  branch: { id: string; name: string };
  createdBy: { id: string; email: string };
  quantityChange: number;
  stockBefore: number;
  stockAfter: number;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string | null;
  createdAt: string;
}

export interface PublishStockResult {
  published: number;
  updated: number;
}

export interface ManualAdjustmentResult {
  created?: number;
  adjustments?: ManualAdjustment[];
  errors?: string[];
  [key: string]: any; // Allow other properties
}

export interface ApproveAdjustmentsResult {
  approved: number;
}

// API functions
const publishStockUpdate = async (): Promise<PublishStockResult> => {
  const response = await api.post<PublishStockResult>('/transactions/publish-stock');
  return response.data;
};

const getCalculatedStock = async (branchId?: string): Promise<unknown[]> => {
  const params = branchId ? { branchId } : {};
  const response = await api.get<unknown[]>('/transactions/calculated-stock', { params });
  return response.data;
};

const getPublishedStock = async (branchId?: string): Promise<unknown[]> => {
  const params = branchId ? { branchId } : {};
  const response = await api.get<unknown[]>('/transactions/published-stock', { params });
  return response.data;
};

const createManualAdjustments = async (text: string, branchId: string): Promise<ManualAdjustmentResult> => {
  const response = await api.post<ManualAdjustmentResult>('/manual-adjustments/create', {
    text,
    branchId,
  });
  return response.data;
};

const getPendingAdjustments = async (branchId?: string): Promise<ManualAdjustment[]> => {
  const params = branchId ? { branchId } : {};
  const response = await api.get<ManualAdjustment[]>('/manual-adjustments/pending', { params });
  return response.data;
};

const approveAdjustments = async (adjustmentIds: string[]): Promise<ApproveAdjustmentsResult> => {
  const response = await api.post<ApproveAdjustmentsResult>('/manual-adjustments/approve', {
    adjustmentIds,
  });
  return response.data;
};

const getPendingApprovalOrders = async (branchId?: string): Promise<unknown[]> => {
  const params = branchId ? { branchId } : {};
  const response = await api.get<unknown[]>('/orders/pending-approval', { params });
  return response.data;
};

const approveOrder = async (orderId: string): Promise<unknown> => {
  const response = await api.post<unknown>(`/orders/${orderId}/approve`);
  return response.data;
};

const rejectOrder = async (orderId: string, reason?: string): Promise<unknown> => {
  const response = await api.post<unknown>(`/orders/${orderId}/reject`, { reason });
  return response.data;
};

const shipOrder = async (orderId: string): Promise<unknown> => {
  const response = await api.post<unknown>(`/orders/${orderId}/ship`);
  return response.data;
};

const deliverOrder = async (orderId: string): Promise<unknown> => {
  const response = await api.post<unknown>(`/orders/${orderId}/deliver`);
  return response.data;
};

// Hooks
export const usePublishStockUpdate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: publishStockUpdate,
    meta: {
      successMessage: 'Stok dəyərləri uğurla yeniləndi',
      errorMessage: 'Stok dəyərlərini yeniləmək mümkün olmadı',
    },
    onSuccess: () => {
      // Publish edildikdə service panellərindəki stok yenilənir
      // Admin panelindəki hesablanmış stok da yenilənməlidir
      // Tüm products query'lerini invalidate et (tüm branchId varyasyonları dahil)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === 'products';
        },
      });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'calculated-stock'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'published-stock'] });
    },
  });
};

export const useCalculatedStock = (branchId?: string) => {
  return useQuery({
    queryKey: ['transactions', 'calculated-stock', branchId],
    queryFn: () => getCalculatedStock(branchId),
    enabled: true, // Yalnız SUPER_ADMIN üçün
    refetchInterval: 5000, // Hər 5 saniyədə bir avtomatik yenilə (real-time görünüş)
  });
};

export const usePublishedStock = (branchId?: string) => {
  return useQuery({
    queryKey: ['transactions', 'published-stock', branchId],
    queryFn: () => getPublishedStock(branchId),
  });
};

export const useCreateManualAdjustments = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ text, branchId }: { text: string; branchId: string }) =>
      createManualAdjustments(text, branchId),
    meta: {
      successMessage: 'Manual düzəlişlər yaradıldı',
      errorMessage: 'Manual düzəlişləri yaratmaq mümkün olmadı',
    },
    onSuccess: () => {
      // Manual adjustment yaradılanda hesablanmış stok yenilənməlidir
      queryClient.invalidateQueries({ queryKey: ['manual-adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'calculated-stock'] });
      // Tüm products query'lerini invalidate et (tüm branchId varyasyonları dahil)
      // Bu sayədə məhsullar səhifəsindəki mövcud say yenilənir
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === 'products';
        },
      });
    },
  });
};

export const usePendingAdjustments = (branchId?: string) => {
  return useQuery({
    queryKey: ['manual-adjustments', 'pending', branchId],
    queryFn: () => getPendingAdjustments(branchId),
  });
};

export const useApproveAdjustments = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: approveAdjustments,
    meta: {
      successMessage: 'Düzəlişlər təsdiqləndi və tətbiq olundu',
      errorMessage: 'Düzəlişləri təsdiqləmək mümkün olmadı',
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manual-adjustments'] });
      // Tüm products query'lerini invalidate et (tüm branchId varyasyonları dahil)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === 'products';
        },
      });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
};

export const usePendingApprovalOrders = (branchId?: string) => {
  return useQuery({
    queryKey: ['orders', 'pending-approval', branchId],
    queryFn: () => getPendingApprovalOrders(branchId),
  });
};

export const useApproveOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: approveOrder,
    meta: {
      successMessage: 'Sifariş təsdiqləndi',
      errorMessage: 'Sifarişi təsdiqləmək mümkün olmadı',
    },
    onSuccess: () => {
      // Sifariş təsdiqlənəndə hesablanmış stok yenilənməlidir (transaction yaradılır)
      queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['orders', 'pending-approval'], exact: false });
      // Tüm products query'lerini invalidate et (tüm branchId varyasyonları dahil)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === 'products';
        },
      });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'calculated-stock'] });
    },
  });
};

export const useRejectOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason?: string }) =>
      rejectOrder(orderId, reason),
    meta: {
      successMessage: 'Sifariş rədd edildi',
      errorMessage: 'Sifarişi rədd etmək mümkün olmadı',
    },
    onSuccess: () => {
      // Sifariş rədd ediləndə hesablanmış stok yenilənməlidir (reserved qty azalır)
      queryClient.invalidateQueries({ queryKey: ['transactions', 'calculated-stock'] });
      queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['orders', 'pending-approval'], exact: false });
      // Tüm products query'lerini invalidate et (tüm branchId varyasyonları dahil)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === 'products';
        },
      });
    },
  });
};

export const useShipOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: shipOrder,
    meta: {
      successMessage: 'Sifariş çatdırıldı kimi işarələndi',
      errorMessage: 'Sifarişi çatdırıldı kimi işarələmək mümkün olmadı',
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
    },
  });
};

export const useDeliverOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deliverOrder,
    meta: {
      successMessage: 'Sifariş çatdırıldı və qaimə yaradıldı',
      errorMessage: 'Sifarişi çatdırıldı kimi işarələmək mümkün olmadı',
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['orders', 'pending-approval'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'calculated-stock'] });
      // Sifariş çatdırıldıqda top selling products yenilənməlidir
      queryClient.invalidateQueries({ queryKey: ['top-selling-products'] });
    },
  });
};

