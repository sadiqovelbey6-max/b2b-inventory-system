import { useState } from 'react';
import type { FormEvent } from 'react';
import { useCreateInvoice } from '../../hooks/useCreateInvoice';
import useAuth from '../../hooks/useAuth';
import { USER_ROLES } from '../../types';
import type { UserRole } from '../../types';

export const InvoicesPage = () => {
  const [orderId, setOrderId] = useState('');
  const createInvoice = useCreateInvoice();
  const { user } = useAuth();
  
  // Admin paneli üçün (SUPER_ADMIN və BRANCH_MANAGER)
  const invoiceRoles: UserRole[] = [USER_ROLES.SUPER_ADMIN, USER_ROLES.BRANCH_MANAGER];
  const canManageInvoices = user ? invoiceRoles.includes(user.role) : false;
  if (!canManageInvoices) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Qaimə yaratmaq üçün təsdiqlənmiş icazə tələb olunur.
      </div>
    );
  }


  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orderId.trim()) return;
    createInvoice.mutate(orderId.trim());
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Qaimələr</h2>
        <p className="text-sm text-slate-500">Sifarişlər üçün PDF qaimələr yaradın.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-600">Sifariş ID</label>
          <input
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            placeholder="Sifariş identifikatorunu daxil edin"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
          disabled={createInvoice.isPending}
        >
          {createInvoice.isPending ? 'Yaradılır...' : 'Qaimə yarat'}
        </button>
        {createInvoice.isSuccess ? (
          <div className="text-sm text-success">
            Qaimə yaradıldı: {createInvoice.data.invoiceNumber}{' '}
            {createInvoice.data.pdfUrl ? (
              <a
                href={createInvoice.data.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary-600 underline ml-2"
              >
                PDF-i aç
              </a>
            ) : null}
          </div>
        ) : null}
        {createInvoice.isError ? (
          <div className="text-sm text-danger">Qaimə yaradılması zamanı xəta baş verdi.</div>
        ) : null}
      </form>
    </div>
  );
};

export default InvoicesPage;

