import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useCreatePayment } from '../../hooks/useCreatePayment';
import useAuth from '../../hooks/useAuth';
import { USER_ROLES } from '../../types';
import type { UserRole } from '../../types';

export const PaymentsPage = () => {
  const [orderId, setOrderId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const createPayment = useCreatePayment();
  const { user } = useAuth();
  
  // Admin paneli üçün (SUPER_ADMIN və BRANCH_MANAGER)
  const paymentRoles: UserRole[] = [USER_ROLES.SUPER_ADMIN, USER_ROLES.BRANCH_MANAGER];
  const canManagePayments = user ? paymentRoles.includes(user.role) : false;

  useEffect(() => {
    if (createPayment.isSuccess) {
      setAmount(0);
      setInvoiceId('');
      setOrderId('');
    }
  }, [createPayment.isSuccess]);

  if (!canManagePayments) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Ödəniş qeydiyyatı üçün admin icazəsi tələb olunur.
      </div>
    );
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orderId.trim() || amount <= 0) return;
    createPayment.mutate({
      orderId: orderId.trim(),
      invoiceId: invoiceId.trim() || undefined,
      amount,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Ödəniş qeydi</h2>
        <p className="text-sm text-slate-500">Manual bank ödənişlərini sistemə daxil edin.</p>
      </div>
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-600">Sifariş ID</label>
            <input
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Sifariş identifikatoru"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Qaimə ID (opsional)</label>
            <input
              value={invoiceId}
              onChange={(event) => setInvoiceId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="İstəyə bağlı"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Məbləğ</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="0.00"
            />
          </div>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
          disabled={createPayment.isPending}
        >
          {createPayment.isPending ? 'Göndərilir...' : 'Ödənişi qeyd et'}
        </button>
        {createPayment.isSuccess ? (
          <div className="text-sm text-success">Ödəniş qeydə alındı. Status: {createPayment.data?.status}</div>
        ) : null}
        {createPayment.isError ? (
          <div className="text-sm text-danger">Ödəniş qeydi zamanı xəta baş verdi.</div>
        ) : null}
      </form>
    </div>
  );
};

export default PaymentsPage;

