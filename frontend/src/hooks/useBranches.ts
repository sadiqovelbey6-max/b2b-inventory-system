import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Branch } from '../types';
import { queryKeys } from '../lib/queryKeys';

const fetchBranches = async () => {
  const response = await api.get<Branch[]>('/branches');
  return response.data;
};

export const useBranches = () =>
  useQuery({
    queryKey: queryKeys.branches,
    queryFn: fetchBranches,
  });

interface CreateBranchPayload {
  code: string;
  name: string;
}

export const useCreateBranch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateBranchPayload) => {
      const response = await api.post<Branch>('/branches', payload);
      return response.data;
    },
    meta: {
      successMessage: 'Filial uğurla yaradıldı',
      errorMessage: 'Filial yaratmaq mümkün olmadı',
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.branches });
    },
  });
};

export const useDeleteBranch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/branches/${id}`);
    },
    meta: {
      successMessage: 'Filial uğurla silindi',
      errorMessage: 'Filial silmək mümkün olmadı',
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.branches });
    },
  });
};

export default useBranches;

