import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';
import type { CodeLookupProduct } from '../types';

interface CodeLookupPayload {
  code: string;
  branchId?: string;
}

export const useCodeLookup = () =>
  useMutation({
    mutationFn: async (payload: CodeLookupPayload) => {
      const response = await api.post<CodeLookupProduct[]>('/code-lookup', payload);
      return response.data;
    },
  });

export default useCodeLookup;

