import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { User, UserRole } from '../types';
import { queryKeys } from '../lib/queryKeys';

interface RegistrationConfig {
  id: string;
  maxUsers: number;
  allowOpenRegistration: boolean;
}

interface CreateUserPayload {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  branchId?: string;
  role: UserRole;
}

export const useAdminUsers = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.adminUsers,
    queryFn: async () => {
      const response = await api.get<User[]>('/admin/users');
      return response.data;
    },
    enabled,
  });

export const useRegistrationConfig = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.registrationConfig,
    queryFn: async () => {
      const response = await api.get<RegistrationConfig>('/admin/users/config');
      return response.data;
    },
    enabled,
  });

export const useUpdateRegistrationLimit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (maxUsers: number) => {
      const response = await api.patch<RegistrationConfig>('/admin/users/config', { maxUsers });
      return response.data;
    },
    meta: {
      successMessage: 'Qeydiyyat limiti yeniləndi',
      errorMessage: 'Qeydiyyat limitini yeniləmək mümkün olmadı',
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.registrationConfig });
    },
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateUserPayload) => {
      const response = await api.post<User>('/admin/users', payload);
      return response.data;
    },
    meta: {
      successMessage: 'İstifadəçi uğurla yaradıldı',
      errorMessage: 'İstifadəçi yaratmaq mümkün olmadı',
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers });
    },
  });
};

interface UpdateUserPayload {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: UserRole;
}

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateUserPayload }) => {
      const response = await api.patch<User>(`/admin/users/${id}`, data);
      return response.data;
    },
    meta: {
      successMessage: 'İstifadəçi uğurla yeniləndi',
      errorMessage: 'İstifadəçi yeniləmək mümkün olmadı',
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers });
    },
  });
};

export const useUser = (id: string, enabled = true) => {
  return useQuery({
    queryKey: [...queryKeys.adminUsers, id],
    queryFn: async () => {
      const response = await api.get<User>(`/admin/users/${id}`);
      return response.data;
    },
    enabled: enabled && !!id,
  });
};
