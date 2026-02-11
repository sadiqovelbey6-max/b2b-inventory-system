import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  uploadProductsCsv,
  uploadInventoryCsv,
  exportOrders,
  exportInvoices,
  exportPayments,
  bulkSales,
} from '../services/importExportService';
import { toastBus } from '../lib/toastBus';

export const useProductsImport = () =>
  useMutation({
    mutationFn: uploadProductsCsv,
    meta: {
      successMessage: 'Məhsul məlumatları yükləndi',
      errorMessage: 'Məhsul importu uğursuz oldu',
      notification: {
        description: 'Məhsul CSV faylı uğurla emal olundu.',
        persist: true,
        link: { label: 'Audit loglarına bax', to: '/audit' },
      },
    },
  });

export const useInventoryImport = () =>
  useMutation({
    mutationFn: uploadInventoryCsv,
    meta: {
      successMessage: 'Inventar məlumatları yeniləndi',
      errorMessage: 'Inventar importu uğursuz oldu',
      notification: {
        description: 'Inventar CSV faylı uğurla yeniləndi.',
        persist: true,
        link: { label: 'Audit loglarına bax', to: '/audit' },
      },
    },
  });

export const useOrdersExport = () =>
  useMutation({
    mutationFn: exportOrders,
    meta: {
      errorMessage: 'Sifariş faylını yükləmək mümkün olmadı',
    },
    onSuccess: (_, format) => {
      toastBus.emit({
        title: 'Sifariş eksportu hazırdır',
        description: `Fayl formatı: ${format.toUpperCase()}`,
        type: 'success',
        persist: true,
      });
    },
  });

export const useInvoicesExport = () =>
  useMutation({
    mutationFn: exportInvoices,
    meta: {
      errorMessage: 'Qaimə faylını yükləmək mümkün olmadı',
    },
    onSuccess: (_, format) => {
      toastBus.emit({
        title: 'Qaimə eksportu hazırdır',
        description: `Fayl formatı: ${format.toUpperCase()}`,
        type: 'success',
        persist: true,
      });
    },
  });

export const usePaymentsExport = () =>
  useMutation({
    mutationFn: exportPayments,
    meta: {
      errorMessage: 'Ödəniş faylını yükləmək mümkün olmadı',
    },
    onSuccess: (_, format) => {
      toastBus.emit({
        title: 'Ödəniş eksportu hazırdır',
        description: `Fayl formatı: ${format.toUpperCase()}`,
        type: 'success',
        persist: true,
      });
    },
  });

export const useBulkSales = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ text, branchId }: { text: string; branchId: string }) =>
      bulkSales(text, branchId),
    meta: {
      successMessage: 'Satışlar uğurla qeydə alındı',
      errorMessage: 'Satışları qeyd etmək mümkün olmadı',
      notification: {
        description: 'Fiziki satışlar sistemə daxil edildi və məhsul sayları yeniləndi.',
        persist: true,
        link: { label: 'Məhsullara bax', to: '/products' },
      },
    },
    onSuccess: () => {
      // Tüm products query'lerini invalidate et (tüm branchId varyasyonları dahil)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === 'products';
        },
      });
    },
  });
};

