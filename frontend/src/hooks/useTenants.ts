import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

export interface Tenant {
  id: string;
  name: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  users?: Array<{
    id: string;
    email: string;
    branch: {
      id: string;
      name: string;
    } | null;
  }>;
}

export const useTenants = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.tenants,
    queryFn: async () => {
      const response = await api.get<Tenant[]>('/tenants');
      return response.data;
    },
    enabled,
  });

export const useTenant = (id: string, enabled = true) =>
  useQuery({
    queryKey: [...queryKeys.tenants, id],
    queryFn: async () => {
      const response = await api.get<Tenant>(`/tenants/${id}`);
      return response.data;
    },
    enabled: enabled && !!id,
  });

export const useCreateTenant = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      contactEmail?: string;
      contactPhone?: string;
    }) => {
      const response = await api.post<Tenant>('/tenants', data);
      return response.data;
    },
    meta: {
      successMessage: 'Müştəri uğurla yaradıldı',
      errorMessage: 'Müştəri yaratmaq mümkün olmadı',
    },
    onSuccess: (newTenant) => {
      // Cache-i birbaşa yenilə
      queryClient.setQueryData<Tenant[]>(queryKeys.tenants, (old) => {
        if (!old) return [newTenant];
        // Yeni tenant artıq mövcuddursa yenilə, yoxsa əlavə et
        const existingIndex = old.findIndex((t) => t.id === newTenant.id);
        if (existingIndex >= 0) {
          const updated = [...old];
          updated[existingIndex] = newTenant;
          return updated;
        }
        return [...old, newTenant];
      });
      
      // Query-ləri invalidate et və refetch et
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.tenants,
        exact: false 
      });
      
      queryClient.refetchQueries({ 
        queryKey: queryKeys.tenants,
        type: 'active'
      });
    },
  });
};

export const useUpdateTenant = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        name?: string;
        description?: string;
        contactEmail?: string;
        contactPhone?: string;
        isActive?: boolean;
      };
    }) => {
      const response = await api.put<Tenant>(`/tenants/${id}`, data);
      return response.data;
    },
    meta: {
      successMessage: 'Müştəri uğurla yeniləndi',
      errorMessage: 'Müştəri yeniləmək mümkün olmadı',
    },
    onSuccess: (updatedTenant) => {
      // Cache-i birbaşa yenilə
      queryClient.setQueryData<Tenant[]>(queryKeys.tenants, (old) => {
        if (!old) return [updatedTenant];
        return old.map((t) => (t.id === updatedTenant.id ? updatedTenant : t));
      });
      
      // Query-ləri invalidate et və refetch et
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.tenants,
        exact: false 
      });
      
      // Refetch et - bu cache-i yeniləyəcək
      queryClient.refetchQueries({ 
        queryKey: queryKeys.tenants,
        type: 'active'
      }).catch((err) => {
        console.error('Refetch error:', err);
      });
    },
  });
};

export const useDeleteTenant = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tenants/${id}`);
    },
    meta: {
      successMessage: 'Müştəri uğurla silindi',
      errorMessage: 'Müştəri silmək mümkün olmadı',
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants });
    },
  });
};

