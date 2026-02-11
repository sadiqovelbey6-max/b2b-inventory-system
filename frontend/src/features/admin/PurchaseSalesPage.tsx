import { useMemo, useState, useEffect } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import useAuth from '../../hooks/useAuth';
import { useProducts, useUpdateProductPrices, useUpdateProductBranch } from '../../hooks/useProducts';
import { USER_ROLES } from '../../types';
import type { Product } from '../../types';

export const PurchaseSalesPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === USER_ROLES.SUPER_ADMIN || user?.role === USER_ROLES.BRANCH_MANAGER;
  const [search, setSearch] = useState('');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'purchasePrice' | 'price' | 'warehouseName' | null>(null);
  const [priceInputs, setPriceInputs] = useState<Map<string, { purchasePrice: string; price: string; warehouseName: string }>>(new Map());
  const [showConfirmDialog, setShowConfirmDialog] = useState<{ productId: string; field: 'purchasePrice' | 'price' | 'warehouseName'; oldValue: number | string; newValue: number | string } | null>(null);

  const { data: products, isLoading: isLoadingProducts } = useProducts(undefined);
  const updateProductPrices = useUpdateProductPrices();
  const updateProductBranch = useUpdateProductBranch();

  // Initialize price inputs when products load
  useEffect(() => {
    if (products && products.length > 0) {
      setPriceInputs((prev) => {
        const newInputs = new Map(prev);
        products.forEach((product: Product) => {
          if (!newInputs.has(product.id)) {
            newInputs.set(product.id, {
              purchasePrice: (product.purchasePrice || 0).toString(),
              price: (product.price || 0).toString(),
              warehouseName: product.branch?.name || '',
            });
          }
        });
        return newInputs;
      });
    }
  }, [products]);


  const filteredProducts = useMemo<Product[]>(() => {
    if (!products) return [];
    
    const query = search.trim().toLowerCase();
    if (!query) {
      // Sabit sıralama: əvvəlcə koduna görə, sonra adına görə
      return [...products].sort((a, b) => {
        const codeCompare = a.code.localeCompare(b.code, 'az');
        if (codeCompare !== 0) return codeCompare;
        return a.name.localeCompare(b.name, 'az');
      });
    }
    
    // Axtarış zamanı da sıralama saxla
    return products
      .filter(
        (product: Product) =>
          product.code.toLowerCase().includes(query) ||
          product.name.toLowerCase().includes(query) ||
          (product.category ?? '').toLowerCase().includes(query),
      )
      .sort((a, b) => {
        const codeCompare = a.code.localeCompare(b.code, 'az');
        if (codeCompare !== 0) return codeCompare;
        return a.name.localeCompare(b.name, 'az');
      });
  }, [products, search]);

  const handlePriceClick = (productId: string, field: 'purchasePrice' | 'price' | 'warehouseName') => {
    setEditingProductId(productId);
    setEditingField(field);
  };

  const handlePriceChange = (productId: string, field: 'purchasePrice' | 'price' | 'warehouseName', value: string | null) => {
    setPriceInputs((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(productId) || { purchasePrice: '0', price: '0', warehouseName: '' };
      newMap.set(productId, { ...current, [field]: value || '' });
      return newMap;
    });
  };

  const handlePriceBlur = (productId: string, field: 'purchasePrice' | 'price' | 'warehouseName') => {
    const product = products?.find((p: Product) => p.id === productId);
    if (!product) return;

    if (field === 'warehouseName') {
      const inputValue = priceInputs.get(productId)?.[field] || '';
      const newValue = inputValue.trim();
      const oldValue = product.branch?.name || '';

      if (newValue !== oldValue) {
        setShowConfirmDialog({ productId, field, oldValue, newValue });
      } else {
        setEditingProductId(null);
        setEditingField(null);
      }
    } else {
      const inputValue = priceInputs.get(productId)?.[field] || '0';
      const newValue = parseFloat(inputValue) || 0;
      const oldValue = field === 'purchasePrice' ? (product.purchasePrice || 0) : (product.price || 0);

      if (newValue !== oldValue) {
        setShowConfirmDialog({ productId, field, oldValue, newValue });
      } else {
        setEditingProductId(null);
        setEditingField(null);
      }
    }
  };

  const handleConfirmUpdate = () => {
    if (!showConfirmDialog) return;

    const { productId, field, newValue } = showConfirmDialog;

    if (field === 'warehouseName') {
      updateProductBranch.mutate(
        { productId, branchName: (newValue as string)?.trim() || null },
        {
          onSuccess: (data) => {
            // Cache-də branch məlumatını yenilə
            if (data?.updatedProduct) {
              setPriceInputs((prev) => {
                const newMap = new Map(prev);
                const current = newMap.get(productId) || { purchasePrice: '0', price: '0', warehouseName: '' };
                newMap.set(productId, {
                  ...current,
                  warehouseName: data.updatedProduct.branch?.name || '',
                });
                return newMap;
              });
            }
            setShowConfirmDialog(null);
            setEditingProductId(null);
            setEditingField(null);
          },
          onError: () => {
            // Reset to original value on error
            const product = products?.find((p: Product) => p.id === productId);
            if (product) {
              const oldValue = product.branch?.name || '';
              setPriceInputs((prev) => {
                const newMap = new Map(prev);
                const current = newMap.get(productId) || { purchasePrice: '0', price: '0', warehouseName: '' };
                newMap.set(productId, {
                  ...current,
                  warehouseName: oldValue,
                });
                return newMap;
              });
            }
            setShowConfirmDialog(null);
            setEditingProductId(null);
            setEditingField(null);
          },
        },
      );
    } else {
      const updateData: { purchasePrice?: number; price?: number } = {};
      if (field === 'purchasePrice') {
        updateData.purchasePrice = newValue as number;
      } else if (field === 'price') {
        updateData.price = newValue as number;
      }

      updateProductPrices.mutate(
        { productId, ...updateData },
        {
          onSuccess: () => {
            setShowConfirmDialog(null);
            setEditingProductId(null);
            setEditingField(null);
          },
          onError: () => {
            // Reset to original value on error
            const product = products?.find((p: Product) => p.id === productId);
            if (product) {
              const oldValue = field === 'purchasePrice' ? (product.purchasePrice || 0) : (product.price || 0);
              setPriceInputs((prev) => {
                const newMap = new Map(prev);
                const current = newMap.get(productId) || { purchasePrice: '0', price: '0', warehouseName: '' };
                newMap.set(productId, {
                  ...current,
                  [field]: oldValue.toString(),
                });
                return newMap;
              });
            }
            setShowConfirmDialog(null);
            setEditingProductId(null);
            setEditingField(null);
          },
        },
      );
    }
  };

  const handleCancelUpdate = () => {
    if (!showConfirmDialog) return;

    const { productId, field } = showConfirmDialog;
    const product = products?.find((p: Product) => p.id === productId);
    if (product) {
      if (field === 'warehouseName') {
        const oldValue = product.branch?.name || '';
        setPriceInputs((prev) => {
          const newMap = new Map(prev);
          const current = newMap.get(productId) || { purchasePrice: '0', price: '0', warehouseName: '' };
          newMap.set(productId, {
            ...current,
            warehouseName: oldValue,
          });
          return newMap;
        });
      } else {
        const oldValue = field === 'purchasePrice' ? (product.purchasePrice || 0) : (product.price || 0);
        setPriceInputs((prev) => {
          const newMap = new Map(prev);
          const current = newMap.get(productId) || { purchasePrice: '0', price: '0', warehouseName: '' };
          newMap.set(productId, {
            ...current,
            [field]: oldValue.toString(),
          });
          return newMap;
        });
      }
    }
    setShowConfirmDialog(null);
    setEditingProductId(null);
    setEditingField(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent, productId: string, field: 'purchasePrice' | 'price' | 'warehouseName') => {
    if (event.key === 'Enter') {
      handlePriceBlur(productId, field);
    } else if (event.key === 'Escape') {
      handleCancelUpdate();
    }
  };


  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Bu bölməyə yalnız admin istifadəçilər daxil ola bilər.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Alqı-satqı</h2>
        <p className="text-sm text-slate-500">Bütün məhsulların alış və satış qiymətləri, xalis qazanc.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="p-4 border-b border-slate-200">
          <div className="relative w-full md:w-80">
            <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Kod, ad və ya kateqoriya ilə axtar..."
              className="w-full rounded-lg border border-slate-200 pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase text-slate-500 tracking-wide">
                <th className="px-4 py-3">Kod</th>
                <th className="px-4 py-3">Məhsul</th>
                <th className="px-4 py-3">Anbar</th>
                <th className="px-4 py-3 text-right">Alış Qiyməti</th>
                <th className="px-4 py-3 text-right">Satış Qiyməti</th>
                <th className="px-4 py-3 text-right">Xalis Qazanc</th>
                <th className="px-4 py-3 text-right">Qazanc Faizi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingProducts ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                    Yüklənir...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                    Məhsul tapılmadı.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product: Product) => {
                  const isEditingPurchasePrice = editingProductId === product.id && editingField === 'purchasePrice';
                  const isEditingPrice = editingProductId === product.id && editingField === 'price';
                  const isEditingWarehouseName = editingProductId === product.id && editingField === 'warehouseName';
                  
                  const purchasePriceInput = priceInputs.get(product.id)?.purchasePrice || '0';
                  const priceInput = priceInputs.get(product.id)?.price || '0';
                  const warehouseNameInput = priceInputs.get(product.id)?.warehouseName || '';
                  
                  const purchasePrice = isEditingPurchasePrice ? parseFloat(purchasePriceInput) || 0 : (product.purchasePrice || 0);
                  const salePrice = isEditingPrice ? parseFloat(priceInput) || 0 : (product.price || 0);
                  const profit = salePrice - purchasePrice;
                  const profitPercentage = purchasePrice > 0 ? ((profit / purchasePrice) * 100) : 0;

                  return (
                    <tr key={product.id} className="text-sm text-slate-700 hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">{product.code}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{product.name}</div>
                        <div className="text-xs text-slate-500">
                          {product.category ?? 'Kategoriya yoxdur'} · {product.unit ?? 'ədəd'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isEditingWarehouseName ? (
                          <input
                            type="text"
                            value={warehouseNameInput}
                            onChange={(e) => handlePriceChange(product.id, 'warehouseName', e.target.value)}
                            onBlur={() => handlePriceBlur(product.id, 'warehouseName')}
                            onKeyDown={(e) => handleKeyDown(e, product.id, 'warehouseName')}
                            className="w-full font-medium text-slate-700 border border-primary-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            autoFocus
                            placeholder="Anbar adı"
                          />
                        ) : (
                          <span
                            className="font-medium text-slate-700 cursor-pointer hover:text-primary-600 hover:underline"
                            onClick={() => handlePriceClick(product.id, 'warehouseName')}
                          >
                            {product.branch?.name ?? 'Ümumi'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditingPurchasePrice ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={purchasePriceInput}
                            onChange={(e) => handlePriceChange(product.id, 'purchasePrice', e.target.value)}
                            onBlur={() => handlePriceBlur(product.id, 'purchasePrice')}
                            onKeyDown={(e) => handleKeyDown(e, product.id, 'purchasePrice')}
                            className="w-24 text-right font-semibold text-slate-700 border border-primary-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            autoFocus
                          />
                        ) : (
                          <span
                            className="font-semibold text-slate-700 cursor-pointer hover:text-primary-600 hover:underline"
                            onClick={() => handlePriceClick(product.id, 'purchasePrice')}
                          >
                            {purchasePrice.toFixed(2)} AZN
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditingPrice ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={priceInput}
                            onChange={(e) => handlePriceChange(product.id, 'price', e.target.value)}
                            onBlur={() => handlePriceBlur(product.id, 'price')}
                            onKeyDown={(e) => handleKeyDown(e, product.id, 'price')}
                            className="w-24 text-right font-semibold text-slate-900 border border-primary-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            autoFocus
                          />
                        ) : (
                          <span
                            className="font-semibold text-slate-900 cursor-pointer hover:text-primary-600 hover:underline"
                            onClick={() => handlePriceClick(product.id, 'price')}
                          >
                            {salePrice.toFixed(2)} AZN
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-semibold ${
                            profit >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {profit >= 0 ? '+' : ''}
                          {profit.toFixed(2)} AZN
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-semibold ${
                            profitPercentage >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {profitPercentage >= 0 ? '+' : ''}
                          {profitPercentage.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {showConfirmDialog.field === 'purchasePrice' 
                ? 'Alış qiyməti dəyişdirilsin?' 
                : showConfirmDialog.field === 'price'
                ? 'Satış qiyməti dəyişdirilsin?'
                : 'Anbar adı dəyişdirilsin?'}
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              {showConfirmDialog.field === 'purchasePrice' 
                ? 'Alış qiyməti' 
                : showConfirmDialog.field === 'price'
                ? 'Satış qiyməti'
                : 'Anbar adı'}:{' '}
              <span className="font-semibold">
                {showConfirmDialog.field === 'warehouseName' 
                  ? (showConfirmDialog.oldValue || 'Ümumi')
                  : `${(showConfirmDialog.oldValue as number).toFixed(2)} AZN`}
              </span> →{' '}
              <span className="font-semibold text-primary-600">
                {showConfirmDialog.field === 'warehouseName' 
                  ? (showConfirmDialog.newValue || 'Ümumi')
                  : `${(showConfirmDialog.newValue as number).toFixed(2)} AZN`}
              </span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelUpdate}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                disabled={updateProductPrices.isPending || updateProductBranch.isPending}
              >
                Ləğv et
              </button>
              <button
                onClick={handleConfirmUpdate}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                disabled={updateProductPrices.isPending || updateProductBranch.isPending}
              >
                {(updateProductPrices.isPending || updateProductBranch.isPending) ? 'Yenilənir...' : 'Təsdiqlə'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseSalesPage;
