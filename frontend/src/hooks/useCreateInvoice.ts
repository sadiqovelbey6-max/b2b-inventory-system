import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';
import { toastBus } from '../lib/toastBus';

interface Invoice {
  id: string;
  invoiceNumber: string;
  total: number;
  pdfUrl?: string;
  issuedAt?: string;
}

export const useCreateInvoice = () =>
  useMutation({
    mutationFn: async (orderId: string) => {
      const response = await api.post<Invoice>('/invoices', { orderId });
      return response.data;
    },
    meta: {
      errorMessage: 'Qaimə yaradılarkən xəta baş verdi',
    },
    onSuccess: (invoice) => {
      toastBus.emit({
        title: 'Qaimə yaradıldı',
        description: `Qaimə nömrəsi: ${invoice.invoiceNumber}`,
        type: 'success',
        persist: true,
        link: invoice.id ? { label: 'Qaimələrə bax', to: '/invoices' } : undefined,
      });
    },
  });

export default useCreateInvoice;

