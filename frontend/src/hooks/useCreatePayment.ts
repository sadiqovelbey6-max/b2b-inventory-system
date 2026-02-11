import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';
import { toastBus } from '../lib/toastBus';

interface PaymentPayload {
  orderId: string;
  invoiceId?: string;
  amount: number;
  method?: string;
}

interface PaymentResponse {
  id: string;
  amount: number;
  status: string;
  method: string;
}

export const useCreatePayment = () =>
  useMutation({
    mutationFn: async (payload: PaymentPayload) => {
      const response = await api.post<PaymentResponse>('/payments', payload);
      return response.data;
    },
    meta: {
      errorMessage: 'Ödənişi qeyd etmək mümkün olmadı',
    },
    onSuccess: (payment, variables) => {
      toastBus.emit({
        title: 'Ödəniş qeydə alındı',
        description: `Məbləğ: ${payment.amount} AZN`,
        type: 'success',
        persist: true,
        link: variables.orderId
          ? { label: 'Ödənişlərə bax', to: '/payments' }
          : undefined,
      });
    },
  });

export default useCreatePayment;

