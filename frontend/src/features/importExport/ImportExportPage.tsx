import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { USER_ROLES, type UserRole, type ImportSummary } from '../../types';
import useToast from '../../hooks/useToast';
import {
  useInventoryImport,
  useProductsImport,
  useOrdersExport,
  useInvoicesExport,
  usePaymentsExport,
  useBulkSales,
} from '../../hooks/useImportExport';
import { useBulkImportProducts } from '../../hooks/useProducts';
import { getErrorMessage } from '../../lib/requestError';
import BranchSelector from '../../components/BranchSelector';

const allowedRoles: UserRole[] = [USER_ROLES.BRANCH_MANAGER, USER_ROLES.SUPER_ADMIN];

interface ImportResult {
  summary: ImportSummary;
  completedAt: string;
}

interface ActivityEntry {
  id: string;
  title: string;
  status: 'success' | 'error' | 'info';
  description?: string;
  details?: string[];
  detailsMore?: number;
  link?: { label: string; to: string };
  timestamp: string;
}

const MAX_ACTIVITY_ITEMS = 10;

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('az-AZ');

const ACTIVITY_STATUS_LABELS: Record<ActivityEntry['status'], string> = {
  success: 'Uğurlu',
  error: 'Xəta',
  info: 'Məlumat',
};

const ACTIVITY_STATUS_BADGE: Record<ActivityEntry['status'], string> = {
  success: 'bg-emerald-100 text-emerald-700',
  error: 'bg-danger-100 text-danger-700',
  info: 'bg-sky-100 text-sky-700',
};

const ACTIVITY_STATUS_DOT: Record<ActivityEntry['status'], string> = {
  success: 'bg-emerald-500',
  error: 'bg-danger-500',
  info: 'bg-sky-500',
};

export const ImportExportPage = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [productsFile, setProductsFile] = useState<File | null>(null);
  const [inventoryFile, setInventoryFile] = useState<File | null>(null);
  const [bulkProductsText, setBulkProductsText] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkSalesText, setBulkSalesText] = useState('');
  const [selectedBranchForSales, setSelectedBranchForSales] = useState<string | null>(user?.branch?.id ?? null);
  const [productsResult, setProductsResult] = useState<ImportResult | null>(null);
  const [inventoryResult, setInventoryResult] = useState<ImportResult | null>(null);
  const [_salesResult, setSalesResult] = useState<{ summary: { processed: number; updated?: number; errors: string[] }; completedAt: string } | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityEntry[]>([]);

  const productsSuccessHandledAt = useRef<ImportSummary | null>(null);
  const inventorySuccessHandledAt = useRef<ImportSummary | null>(null);
  const bulkProductsSuccessHandledAt = useRef<unknown>(null);
  const bulkSalesSuccessHandledAt = useRef<unknown>(null);
  const ordersSuccessHandledAt = useRef<number>(0);
  const invoicesSuccessHandledAt = useRef<number>(0);
  const paymentsSuccessHandledAt = useRef<number>(0);

  const productsErrorHandledRef = useRef<unknown>(null);
  const inventoryErrorHandledRef = useRef<unknown>(null);
  const bulkProductsErrorHandledRef = useRef<unknown>(null);
  const ordersErrorHandledRef = useRef<unknown>(null);
  const invoicesErrorHandledRef = useRef<unknown>(null);
  const paymentsErrorHandledRef = useRef<unknown>(null);

  const pushActivity = useCallback(
    (activity: Omit<ActivityEntry, 'id' | 'timestamp'> & { timestamp?: string }) => {
      const entry: ActivityEntry = {
        id: createId(),
        timestamp: activity.timestamp ?? new Date().toISOString(),
        ...activity,
      };
      setActivityFeed((prev) => [entry, ...prev].slice(0, MAX_ACTIVITY_ITEMS));
    },
    [],
  );

  const clearActivityFeed = useCallback(() => {
    setActivityFeed([]);
  }, []);

  const productsImport = useProductsImport();
  const inventoryImport = useInventoryImport();
  const bulkProductsImport = useBulkImportProducts();
  const bulkSalesMutation = useBulkSales();
  const ordersExport = useOrdersExport();
  const invoicesExport = useInvoicesExport();
  const paymentsExport = usePaymentsExport();

  useEffect(() => {
    if (
      productsImport.isSuccess &&
      productsImport.data &&
      productsImport.data !== productsSuccessHandledAt.current
    ) {
      productsSuccessHandledAt.current = productsImport.data;
      const completedAt = new Date().toISOString();
      const summary = productsImport.data;
      setProductsResult({ summary, completedAt });
      const errorPreview = summary.errors.slice(0, 4);
      const remainingErrors = Math.max(summary.errors.length - errorPreview.length, 0);
      pushActivity({
        title: 'Məhsul importu tamamlandı',
        status: summary.errors.length > 0 ? 'info' : 'success',
        description: `Sətir: ${summary.processed} • Yeni: ${summary.created} • Yenilənən: ${summary.updated ?? 0} • Xəta: ${summary.errors.length}`,
        details: errorPreview,
        detailsMore: remainingErrors > 0 ? remainingErrors : undefined,
        link: { label: 'Audit loglarına bax', to: '/audit' },
        timestamp: completedAt,
      });
    }
  }, [
    productsImport.isSuccess,
    productsImport.data,
    pushActivity,
  ]);

  useEffect(() => {
    if (
      productsImport.isError &&
      productsImport.error &&
      productsImport.error !== productsErrorHandledRef.current
    ) {
      productsErrorHandledRef.current = productsImport.error;
      pushActivity({
        title: 'Məhsul importu uğursuz oldu',
        status: 'error',
        description: getErrorMessage(productsImport.error),
      });
    }
  }, [productsImport.isError, productsImport.error, pushActivity]);

  useEffect(() => {
    if (
      bulkProductsImport.isSuccess &&
      bulkProductsImport.data &&
      bulkProductsImport.data !== bulkProductsSuccessHandledAt.current
    ) {
      bulkProductsSuccessHandledAt.current = bulkProductsImport.data;
      const completedAt = new Date().toISOString();
      const summary = bulkProductsImport.data;
      const errorPreview = summary.errors.slice(0, 4);
      const remainingErrors = Math.max(summary.errors.length - errorPreview.length, 0);
      pushActivity({
        title: 'Toplu məhsul əlavə etmə tamamlandı',
        status: summary.errors.length > 0 ? 'info' : 'success',
        description: `Sətir: ${summary.processed} • Yeni: ${summary.created} • Yenilənən: ${'updated' in summary ? (summary as { updated?: number }).updated ?? 0 : 0} • Xəta: ${summary.errors.length}`,
        details: errorPreview,
        detailsMore: remainingErrors > 0 ? remainingErrors : undefined,
        link: { label: 'Məhsullara bax', to: '/products' },
        timestamp: completedAt,
      });
    }
  }, [
    bulkProductsImport.isSuccess,
    bulkProductsImport.data,
    pushActivity,
  ]);

  useEffect(() => {
    if (
      bulkProductsImport.isError &&
      bulkProductsImport.error &&
      bulkProductsImport.error !== bulkProductsErrorHandledRef.current
    ) {
      bulkProductsErrorHandledRef.current = bulkProductsImport.error;
      pushActivity({
        title: 'Toplu məhsul əlavə etmə uğursuz oldu',
        status: 'error',
        description: getErrorMessage(bulkProductsImport.error),
      });
    }
  }, [bulkProductsImport.isError, bulkProductsImport.error, pushActivity]);

  useEffect(() => {
    if (
      inventoryImport.isSuccess &&
      inventoryImport.data &&
      inventoryImport.data !== inventorySuccessHandledAt.current
    ) {
      inventorySuccessHandledAt.current = inventoryImport.data;
      const completedAt = new Date().toISOString();
      const summary = inventoryImport.data;
      setInventoryResult({ summary, completedAt });
      const errorPreview = summary.errors.slice(0, 4);
      const remainingErrors = Math.max(summary.errors.length - errorPreview.length, 0);
      pushActivity({
        title: 'Inventar importu tamamlandı',
        status: summary.errors.length > 0 ? 'info' : 'success',
        description: `Sətir: ${summary.processed} • Yeni: ${summary.created} • Yenilənən: ${summary.updated ?? 0} • Xəta: ${summary.errors.length}`,
        details: errorPreview,
        detailsMore: remainingErrors > 0 ? remainingErrors : undefined,
        link: { label: 'Audit loglarına bax', to: '/audit' },
        timestamp: completedAt,
      });
    }
  }, [
    inventoryImport.isSuccess,
    inventoryImport.data,
    pushActivity,
  ]);

  useEffect(() => {
    if (
      inventoryImport.isError &&
      inventoryImport.error &&
      inventoryImport.error !== inventoryErrorHandledRef.current
    ) {
      inventoryErrorHandledRef.current = inventoryImport.error;
      pushActivity({
        title: 'Inventar importu uğursuz oldu',
        status: 'error',
        description: getErrorMessage(inventoryImport.error),
      });
    }
  }, [inventoryImport.isError, inventoryImport.error, pushActivity]);

  useEffect(() => {
    if (
      ordersExport.isSuccess &&
      !ordersSuccessHandledAt.current
    ) {
      ordersSuccessHandledAt.current = Date.now();
      const format = ordersExport.variables
        ? ordersExport.variables.toUpperCase()
        : undefined;
      pushActivity({
        title: 'Sifariş eksportu hazırdır',
        status: 'success',
        description: format ? `Format: ${format}` : undefined,
      });
    }
  }, [
    ordersExport.isSuccess,
    ordersExport.variables,
    pushActivity,
  ]);

  useEffect(() => {
    if (
      ordersExport.isError &&
      ordersExport.error &&
      ordersExport.error !== ordersErrorHandledRef.current
    ) {
      ordersErrorHandledRef.current = ordersExport.error;
      pushActivity({
        title: 'Sifariş eksportu uğursuz oldu',
        status: 'error',
        description: getErrorMessage(ordersExport.error),
      });
    }
  }, [ordersExport.isError, ordersExport.error, pushActivity]);

  useEffect(() => {
    if (
      invoicesExport.isSuccess &&
      !invoicesSuccessHandledAt.current
    ) {
      invoicesSuccessHandledAt.current = Date.now();
      const format = invoicesExport.variables
        ? invoicesExport.variables.toUpperCase()
        : undefined;
      pushActivity({
        title: 'Qaimə eksportu hazırdır',
        status: 'success',
        description: format ? `Format: ${format}` : undefined,
      });
    }
  }, [
    invoicesExport.isSuccess,
    invoicesExport.variables,
    pushActivity,
  ]);

  useEffect(() => {
    if (
      invoicesExport.isError &&
      invoicesExport.error &&
      invoicesExport.error !== invoicesErrorHandledRef.current
    ) {
      invoicesErrorHandledRef.current = invoicesExport.error;
      pushActivity({
        title: 'Qaimə eksportu uğursuz oldu',
        status: 'error',
        description: getErrorMessage(invoicesExport.error),
      });
    }
  }, [invoicesExport.isError, invoicesExport.error, pushActivity]);

  useEffect(() => {
    if (
      paymentsExport.isSuccess &&
      !paymentsSuccessHandledAt.current
    ) {
      paymentsSuccessHandledAt.current = Date.now();
      const format = paymentsExport.variables
        ? paymentsExport.variables.toUpperCase()
        : undefined;
      pushActivity({
        title: 'Ödəniş eksportu hazırdır',
        status: 'success',
        description: format ? `Format: ${format}` : undefined,
      });
    }
  }, [
    paymentsExport.isSuccess,
    paymentsExport.variables,
    pushActivity,
  ]);

  useEffect(() => {
    if (
      paymentsExport.isError &&
      paymentsExport.error &&
      paymentsExport.error !== paymentsErrorHandledRef.current
    ) {
      paymentsErrorHandledRef.current = paymentsExport.error;
      pushActivity({
        title: 'Ödəniş eksportu uğursuz oldu',
        status: 'error',
        description: getErrorMessage(paymentsExport.error),
      });
    }
  }, [paymentsExport.isError, paymentsExport.error, pushActivity]);

  useEffect(() => {
    if (
      bulkSalesMutation.isSuccess &&
      bulkSalesMutation.data &&
      bulkSalesMutation.data !== bulkSalesSuccessHandledAt.current
    ) {
      bulkSalesSuccessHandledAt.current = bulkSalesMutation.data;
      const completedAt = new Date().toISOString();
      const summary = bulkSalesMutation.data;
      setSalesResult({ summary, completedAt });
      const errorPreview = summary.errors.slice(0, 4);
      const remainingErrors = Math.max(summary.errors.length - errorPreview.length, 0);
      pushActivity({
        title: 'Toplu satış tamamlandı',
        status: summary.errors.length > 0 ? 'info' : 'success',
        description: `Sətir: ${summary.processed} • Yenilənən: ${summary.updated} • Xəta: ${summary.errors.length}`,
        details: errorPreview,
        detailsMore: remainingErrors > 0 ? remainingErrors : undefined,
        link: { label: 'Məhsullara bax', to: '/products' },
        timestamp: completedAt,
      });
      setBulkSalesText('');
    }
  }, [
    bulkSalesMutation.isSuccess,
    bulkSalesMutation.data,
    pushActivity,
  ]);

  useEffect(() => {
    if (
      bulkSalesMutation.isError &&
      bulkSalesMutation.error &&
      bulkSalesMutation.error !== bulkProductsErrorHandledRef.current
    ) {
      bulkProductsErrorHandledRef.current = bulkSalesMutation.error;
      pushActivity({
        title: 'Toplu satış uğursuz oldu',
        status: 'error',
        description: getErrorMessage(bulkSalesMutation.error),
      });
    }
  }, [bulkSalesMutation.isError, bulkSalesMutation.error, pushActivity]);

  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Bu bölməyə yalnız admin istifadəçilər daxil ola bilər.
      </div>
    );
  }

  const handleProductsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!productsFile) {
      addToast({ title: 'Fayl seçin', type: 'info', duration: 3000 });
      return;
    }
    productsImport.mutate(productsFile);
  };

  const handleBulkProductsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!bulkProductsText.trim()) {
      addToast({ title: 'Məhsul məlumatlarını daxil edin', type: 'info', duration: 3000 });
      return;
    }
    bulkProductsImport.mutate({ text: bulkProductsText });
  };

  const handleInventorySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inventoryFile) {
      addToast({ title: 'Fayl seçin', type: 'info', duration: 3000 });
      return;
    }
    inventoryImport.mutate(inventoryFile);
  };

  const handleBulkSalesSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!bulkSalesText.trim()) {
      addToast({ title: 'Satış məlumatlarını daxil edin', type: 'info', duration: 3000 });
      return;
    }
    if (!selectedBranchForSales) {
      addToast({ title: 'Filial seçin', type: 'info', duration: 3000 });
      return;
    }
    bulkSalesMutation.mutate({ text: bulkSalesText, branchId: selectedBranchForSales });
  };

  const isUploading = productsImport.isPending || inventoryImport.isPending || bulkProductsImport.isPending || bulkSalesMutation.isPending;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Import / Export mərkəzi</h2>
        <p className="text-sm text-slate-500">
          CSV/Excel faylları vasitəsilə məhsul və inventar məlumatlarını yeniləyin, sifariş, qaimə və ödəniş rəylərini ixrac edin.
        </p>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Məhsul importu</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowBulkImport(false)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
                  !showBulkImport
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                CSV Fayl
              </button>
              <button
                type="button"
                onClick={() => setShowBulkImport(true)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
                  showBulkImport
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Metn formatı
              </button>
            </div>
          </div>
          {!showBulkImport ? (
            <>
              <p className="text-sm text-slate-500 mt-1">
                CSV faylında məhsul kodları, ad, kateqoriya və qiymət məlumatlarını yeniləyə bilərsiniz.
              </p>
              <form onSubmit={handleProductsSubmit} className="mt-4 space-y-3">
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(event) => setProductsFile(event.target.files?.[0] ?? null)}
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={productsImport.isPending}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                >
                  {productsImport.isPending ? 'Yüklənir...' : 'Məhsulları import et'}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-500 mt-1 mb-2">
                Məhsulları metn formatında kopyalayıb yapışdırın. Format: <span className="font-mono text-xs bg-slate-100 px-1 rounded">KOD AD [QIYMƏT] [KATEQORİYA] [VAHİD]</span>
              </p>
              <p className="text-xs text-slate-400 mb-3">
                Nümunə: <span className="font-mono">PRD001 Test Məhsul 10.5 Elektronika ədəd</span>
              </p>
              <form onSubmit={handleBulkProductsSubmit} className="mt-4 space-y-3">
                <textarea
                  value={bulkProductsText}
                  onChange={(e) => setBulkProductsText(e.target.value)}
                  placeholder="PRD001 Test Məhsul 1 10.5&#10;PRD002 Test Məhsul 2 20.0&#10;PRD003 Test Məhsul 3 15.5"
                  rows={8}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {bulkProductsText.split('\n').filter((line) => line.trim().length > 0).length} sətir
                  </span>
                  <button
                    type="submit"
                    disabled={bulkProductsImport.isPending || !bulkProductsText.trim()}
                    className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                  >
                    {bulkProductsImport.isPending ? 'Yüklənir...' : 'Məhsulları əlavə et'}
                  </button>
                </div>
              </form>
              {bulkProductsImport.isSuccess && bulkProductsImport.data ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold text-slate-900 mb-2">Nəticə</h4>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500">Yaradılan:</span>
                      <span className="ml-2 font-semibold text-emerald-600">{bulkProductsImport.data.created}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Yenilənən:</span>
                      <span className="ml-2 font-semibold text-primary-600">{(bulkProductsImport.data as { updated?: number }).updated ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Xəta:</span>
                      <span className={`ml-2 font-semibold ${bulkProductsImport.data.errors.length > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
                        {bulkProductsImport.data.errors.length}
                      </span>
                    </div>
                  </div>
                  {bulkProductsImport.data.errors.length > 0 && (
                    <details className="mt-3 rounded-lg border border-amber-200 bg-white p-3 text-xs text-amber-800">
                      <summary className="cursor-pointer text-sm font-medium text-amber-700">
                        Xətalar ({bulkProductsImport.data.errors.length})
                      </summary>
                      <ul className="mt-2 list-disc space-y-1 pl-4 max-h-40 overflow-y-auto">
                        {bulkProductsImport.data.errors.slice(0, 10).map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                        {bulkProductsImport.data.errors.length > 10 && (
                          <li className="italic text-amber-600">
                            +{bulkProductsImport.data.errors.length - 10} əlavə xəta
                          </li>
                        )}
                      </ul>
                    </details>
                  )}
                </div>
              ) : null}
            </>
          )}
          {productsResult ? (
            <ImportSummaryCard title="Məhsul importu nəticəsi" result={productsResult} />
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Inventar importu</h3>
          <p className="text-sm text-slate-500 mt-1">
            Filiallara görə mövcud, yolda olan və rezervdəki sayları CSV faylı ilə yeniləyin.
          </p>
          <form onSubmit={handleInventorySubmit} className="mt-4 space-y-3">
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(event) => setInventoryFile(event.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={inventoryImport.isPending}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {inventoryImport.isPending ? 'Yüklənir...' : 'Inventarı import et'}
            </button>
          </form>
          {inventoryResult ? (
            <ImportSummaryCard title="Inventar importu nəticəsi" result={inventoryResult} />
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Export</h3>
        <p className="text-sm text-slate-500 mt-1">
          Sifariş, qaimə və ödəniş məlumatlarını Excel/CSV və ya PDF formatında ixrac edə bilərsiniz.
        </p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <ExportCard
            title="Sifarişlər"
            isLoading={ordersExport.isPending}
            onExportCsv={() => ordersExport.mutate('csv')}
            onExportPdf={() => ordersExport.mutate('pdf')}
          />
          <ExportCard
            title="Qaimələr"
            isLoading={invoicesExport.isPending}
            onExportCsv={() => invoicesExport.mutate('csv')}
            onExportPdf={() => invoicesExport.mutate('pdf')}
          />
          <ExportCard
            title="Ödənişlər"
            isLoading={paymentsExport.isPending}
            onExportCsv={() => paymentsExport.mutate('csv')}
            onExportPdf={() => paymentsExport.mutate('pdf')}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Toplu satış (məhsul sayını azaltma)</h3>
        <p className="text-sm text-slate-500 mt-1 mb-4">
          Fiziki satışları metn formatında qeyd edin. Hər sətirdə məhsul kodu və satılan sayı olmalıdır. Format: <span className="font-mono text-xs bg-slate-100 px-1 rounded">KOD SAYI</span>
        </p>
        <p className="text-xs text-slate-400 mb-3">
          Nümunə: <span className="font-mono">PRD001 5&#10;PRD002 3&#10;PRD003 10</span>
        </p>
        <form onSubmit={handleBulkSalesSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <BranchSelector
                value={selectedBranchForSales}
                onChange={setSelectedBranchForSales}
                includeAllOption={false}
                label="Filial"
              />
            </div>
          </div>
          <textarea
            value={bulkSalesText}
            onChange={(e) => setBulkSalesText(e.target.value)}
            placeholder="PRD001 5&#10;PRD002 3&#10;PRD003 10"
            rows={8}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {bulkSalesText.split('\n').filter((line) => line.trim().length > 0).length} sətir
            </span>
            <button
              type="submit"
              disabled={bulkSalesMutation.isPending || !bulkSalesText.trim() || !selectedBranchForSales}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {bulkSalesMutation.isPending ? 'Yenilənir...' : 'Satışları qeyd et'}
            </button>
          </div>
          {bulkSalesMutation.isSuccess && bulkSalesMutation.data ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Nəticə</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500">Yenilənən:</span>
                  <span className="ml-2 font-semibold text-primary-600">{bulkSalesMutation.data.updated}</span>
                </div>
                <div>
                  <span className="text-slate-500">Xəta:</span>
                  <span className={`ml-2 font-semibold ${bulkSalesMutation.data.errors.length > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
                    {bulkSalesMutation.data.errors.length}
                  </span>
                </div>
              </div>
              {bulkSalesMutation.data.errors.length > 0 && (
                <details className="mt-3 rounded-lg border border-amber-200 bg-white p-3 text-xs text-amber-800">
                  <summary className="cursor-pointer text-sm font-medium text-amber-700">
                    Xətalar ({bulkSalesMutation.data.errors.length})
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-4 max-h-40 overflow-y-auto">
                    {bulkSalesMutation.data.errors.slice(0, 10).map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                    {bulkSalesMutation.data.errors.length > 10 && (
                      <li className="italic text-amber-600">
                        +{bulkSalesMutation.data.errors.length - 10} əlavə xəta
                      </li>
                    )}
                  </ul>
                </details>
              )}
            </div>
          ) : null}
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-slate-900">Əməliyyat jurnalı</h3>
          {activityFeed.length > 0 ? (
            <button
              type="button"
              onClick={clearActivityFeed}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              Jurnalı təmizlə
            </button>
          ) : null}
        </div>
        {activityFeed.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Hələ heç bir import və ya eksport əməliyyatı qeydə alınmayıb. Əməliyyat tamamlandıqda nəticələr burada görünəcək.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {activityFeed.map((activity) => (
              <li
                key={activity.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full ${ACTIVITY_STATUS_DOT[activity.status]}`}
                      />
                      <p className="text-sm font-semibold text-slate-900">
                        {activity.title}
                      </p>
                    </div>
                    {activity.description ? (
                      <p className="mt-1 text-xs text-slate-500">{activity.description}</p>
                    ) : null}
                    {activity.details && activity.details.length > 0 ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-500">
                        {activity.details.map((detail, index) => (
                          <li key={index}>{detail}</li>
                        ))}
                        {activity.detailsMore ? (
                          <li className="italic text-slate-400">
                            +{activity.detailsMore} əlavə xəta. Detallar üçün audit loglarına baxın.
                          </li>
                        ) : null}
                      </ul>
                    ) : null}
                    {activity.link ? (
                      <Link
                        to={activity.link.to}
                        className="mt-2 inline-flex text-xs font-medium text-primary-600 hover:text-primary-700"
                      >
                        {activity.link.label}
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${ACTIVITY_STATUS_BADGE[activity.status]}`}
                    >
                      {ACTIVITY_STATUS_LABELS[activity.status]}
                    </span>
                    <time className="text-[11px] text-slate-400">
                      {formatDateTime(activity.timestamp)}
                    </time>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isUploading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex h-2 w-2 animate-ping rounded-full bg-primary-500" />
          Fayl yüklənir... prosesi tamamlanana qədər gözləyin.
        </div>
      ) : null}
    </div>
  );
};

const ImportSummaryCard = ({
  title,
  result,
}: {
  title: string;
  result: ImportResult;
}) => {
  const { summary, completedAt } = result;
  const errorPreview = summary.errors.slice(0, 6);
  const remainingErrors = Math.max(summary.errors.length - errorPreview.length, 0);
  const hasErrors = summary.errors.length > 0;

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          <p className="text-xs text-slate-500">
            Son yeniləmə: {formatDateTime(completedAt)}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
            hasErrors ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {hasErrors ? 'Xəbərdarlıqlı' : 'Uğurlu'}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-600 sm:grid-cols-4">
        <div>
          <dt className="font-medium text-slate-500">Məcmu sətir</dt>
          <dd className="mt-1 text-base font-semibold text-slate-900">
            {summary.processed}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Yeni yaradılan</dt>
          <dd className="mt-1 text-base font-semibold text-emerald-600">
            {summary.created}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Yenilənən</dt>
          <dd className="mt-1 text-base font-semibold text-primary-600">
            {'updated' in summary ? summary.updated : 0}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Xəta sayı</dt>
          <dd
            className={`mt-1 text-base font-semibold ${
              hasErrors ? 'text-amber-700' : 'text-slate-800'
            }`}
          >
            {summary.errors.length}
          </dd>
        </div>
      </dl>
      {hasErrors ? (
        <details className="mt-4 rounded-lg border border-amber-200 bg-white p-3 text-xs text-amber-800">
          <summary className="cursor-pointer text-sm font-medium text-amber-700">
            Xətalar ({summary.errors.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {errorPreview.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
            {remainingErrors > 0 ? (
              <li className="italic text-amber-600">
                +{remainingErrors} əlavə xəta. Detallar üçün audit loglarından istifadə edin.
              </li>
            ) : null}
          </ul>
        </details>
      ) : null}
    </div>
  );
};

const ExportCard = ({
  title,
  isLoading,
  onExportCsv,
  onExportPdf,
}: {
  title: string;
  isLoading: boolean;
  onExportCsv: () => void;
  onExportPdf: () => void;
}) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <h4 className="text-base font-semibold text-slate-900">{title}</h4>
    <p className="mt-1 text-xs text-slate-500">Mövcud məlumatları yükləyin.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onExportCsv}
        disabled={isLoading}
        className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
      >
        CSV kimi
      </button>
      <button
        type="button"
        onClick={onExportPdf}
        disabled={isLoading}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
      >
        PDF kimi
      </button>
    </div>
  </div>
);

export default ImportExportPage;

