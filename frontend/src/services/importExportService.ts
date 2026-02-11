import api from '../lib/api';
import type { ImportSummary } from '../types';

export const uploadProductsCsv = async (file: File): Promise<ImportSummary> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/admin/import/products', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const uploadInventoryCsv = async (file: File): Promise<ImportSummary> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/admin/import/inventory', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

const downloadBlob = async (url: string, filename: string) => {
  const response = await api.get<Blob>(url, {
    responseType: 'blob',
  });

  const blobUrl = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
};

export const exportOrders = async (format: 'csv' | 'pdf') => {
  await downloadBlob(`/admin/export/orders.${format}`, `orders.${format}`);
};

export const exportInvoices = async (format: 'csv' | 'pdf') => {
  await downloadBlob(`/admin/export/invoices.${format}`, `invoices.${format}`);
};

export const exportPayments = async (format: 'csv' | 'pdf') => {
  await downloadBlob(`/admin/export/payments.${format}`, `payments.${format}`);
};

export interface BulkSalesResult {
  processed: number;
  updated: number;
  errors: string[];
}

export const bulkSales = async (text: string, branchId: string): Promise<BulkSalesResult> => {
  const response = await api.post<BulkSalesResult>('/inventory/bulk-sales', {
    text,
    branchId,
  });
  return response.data;
};

