import { useState, useMemo } from 'react';
import { useProducts } from '../../hooks/useProducts';
import { useProductSubstitutes, useAddProductSubstitute, useRemoveProductSubstitute, useBulkAddProductSubstitutes } from '../../hooks/useProductSubstitutes';
import type { Product } from '../../types';

export const ProductSubstitutesPage = () => {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [substituteSearchQuery, setSubstituteSearchQuery] = useState('');
  const [bulkCodes, setBulkCodes] = useState('');
  const [showBulkAdd, setShowBulkAdd] = useState(false);

  const { data: products, isLoading: isLoadingProducts } = useProducts(undefined);
  const { data: substitutes, isLoading: isLoadingSubstitutes } = useProductSubstitutes(selectedProductId);
  const addSubstitute = useAddProductSubstitute();
  const removeSubstitute = useRemoveProductSubstitute();
  const bulkAddSubstitutes = useBulkAddProductSubstitutes();

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(
      (product: Product) =>
        product.code.toLowerCase().includes(query) ||
        product.name.toLowerCase().includes(query) ||
        (product.category ?? '').toLowerCase().includes(query),
    );
  }, [products, searchQuery]);

  const availableSubstitutes = useMemo(() => {
    if (!products || !selectedProductId) return [];
    if (!substituteSearchQuery.trim()) return products.filter((p: Product) => p.id !== selectedProductId);
    const query = substituteSearchQuery.toLowerCase();
    return products.filter(
      (product: Product) =>
        product.id !== selectedProductId &&
        (product.code.toLowerCase().includes(query) ||
          product.name.toLowerCase().includes(query) ||
          (product.category ?? '').toLowerCase().includes(query)),
    );
  }, [products, selectedProductId, substituteSearchQuery]);

  const selectedProduct = useMemo(() => {
    if (!selectedProductId || !products) return null;
    return products.find((p: Product) => p.id === selectedProductId) || null;
  }, [selectedProductId, products]);

  const handleAddSubstitute = (substituteId: string) => {
    if (!selectedProductId) return;
    addSubstitute.mutate(
      { productId: selectedProductId, substituteId },
      {
        onSuccess: () => {
          setSubstituteSearchQuery('');
        },
      },
    );
  };

  const handleRemoveSubstitute = (substituteId: string) => {
    if (!selectedProductId) return;
    removeSubstitute.mutate({ productId: selectedProductId, substituteId });
  };

  const handleBulkAdd = () => {
    if (!bulkCodes.trim()) {
      return;
    }

    // Kodları parse et (hər sətir bir kod)
    const codes = bulkCodes
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((code) => code.toUpperCase());

    if (codes.length < 2) {
      alert('Ən azı 2 kod daxil edin');
      return;
    }

    bulkAddSubstitutes.mutate(codes, {
      onSuccess: () => {
        setBulkCodes('');
        setShowBulkAdd(false);
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Məhsul əvəz ediciləri</h2>
        <p className="text-sm text-slate-500">
          Məhsulların bir-birini əvəz edə bilməsini təyin edin. Bir məhsulu digərinə əvəz edici təyin etdikdə, avtomatik olaraq qarşılıqlı əlaqə yaradılır. Bitmiş məhsulun kodunu axtaranda əvəz edicilər avtomatik görünəcək.
        </p>
      </div>

      {/* Toplu əlavə etmə bölməsi */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Toplu əvəz edici əlavə et</h3>
            <p className="text-sm text-slate-500">
              Copy-paste ilə kodları daxil edin. Hər sətirdə bir kod olmalıdır. Bütün kodlar bir-birinin əvəz edicisi olacaq.
            </p>
          </div>
          <button
            onClick={() => {
              setShowBulkAdd(!showBulkAdd);
              if (showBulkAdd) {
                setBulkCodes('');
              }
            }}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
          >
            {showBulkAdd ? 'Bağla' : 'Toplu əlavə et'}
          </button>
        </div>

        {showBulkAdd && (
          <div className="space-y-3">
            <textarea
              value={bulkCodes}
              onChange={(e) => setBulkCodes(e.target.value)}
              placeholder="Kodları buraya daxil edin (hər sətirdə bir kod):&#10;281131R100&#10;281133J000&#10;28113D3300&#10;..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[150px] font-mono"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {bulkCodes
                  .split('\n')
                  .map((line) => line.trim())
                  .filter((line) => line.length > 0).length > 0
                  ? `${bulkCodes.split('\n').map((line) => line.trim()).filter((line) => line.length > 0).length} kod tapıldı`
                  : 'Kod daxil edin'}
              </p>
              <button
                onClick={handleBulkAdd}
                disabled={bulkAddSubstitutes.isPending || !bulkCodes.trim() || bulkCodes.split('\n').map((line) => line.trim()).filter((line) => line.length > 0).length < 2}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkAddSubstitutes.isPending ? 'Əlavə edilir...' : 'Əlavə et'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sol tərəf: Məhsul seçimi */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Məhsul seçin</h3>
            <p className="text-sm text-slate-500">Hansı məhsulun əvəz edicilərini təyin etmək istəyirsiniz?</p>
          </div>

          <div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Məhsul kodu, adı və ya kateqoriyası ilə axtar..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {isLoadingProducts ? (
            <div className="text-center py-8 text-sm text-slate-500">Yüklənir...</div>
          ) : (
            <div className="border border-slate-200 rounded-lg max-h-96 overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-500">Məhsul tapılmadı</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredProducts.map((product: Product) => (
                    <button
                      key={product.id}
                      onClick={() => setSelectedProductId(product.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                        selectedProductId === product.id ? 'bg-primary-50 border-l-4 border-l-primary-600' : ''
                      }`}
                    >
                      <div className="font-semibold text-slate-900">{product.code}</div>
                      <div className="text-sm text-slate-600">{product.name}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {product.category ?? 'Kategoriya yoxdur'} · Mövcud: {product.inventory.currentBranch?.availableQty ?? 0}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sağ tərəf: Əvəz edicilər */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          {selectedProduct ? (
            <>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Əvəz edicilər</h3>
                <p className="text-sm text-slate-500">
                  <span className="font-semibold">{selectedProduct.code}</span> məhsulunun əvəz ediciləri
                </p>
              </div>

              {/* Mövcud əvəz edicilər */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">Mövcud əvəz edicilər</label>
                {isLoadingSubstitutes ? (
                  <div className="text-center py-4 text-sm text-slate-500">Yüklənir...</div>
                ) : substitutes && substitutes.length > 0 ? (
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {substitutes.map((substitute) => (
                      <div key={substitute.id} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-slate-900">{substitute.code}</div>
                          <div className="text-sm text-slate-600">{substitute.name}</div>
                          <div className="text-xs text-slate-500">
                            Mövcud: {substitute.inventory.availableQty}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveSubstitute(substitute.id)}
                          disabled={removeSubstitute.isPending}
                          className="text-red-600 hover:text-red-700 text-sm font-semibold disabled:opacity-50"
                        >
                          Sil
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-sm text-slate-500 border border-slate-200 rounded-lg">
                    Hələ əvəz edici əlavə edilməyib
                  </div>
                )}
              </div>

              {/* Yeni əvəz edici əlavə et */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">Yeni əvəz edici əlavə et</label>
                <input
                  type="text"
                  value={substituteSearchQuery}
                  onChange={(e) => setSubstituteSearchQuery(e.target.value)}
                  placeholder="Məhsul kodu, adı və ya kateqoriyası ilə axtar..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {substituteSearchQuery.trim() && (
                  <div className="border border-slate-200 rounded-lg max-h-64 overflow-y-auto">
                    {availableSubstitutes.length === 0 ? (
                      <div className="text-center py-4 text-sm text-slate-500">Məhsul tapılmadı</div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {availableSubstitutes.map((product: Product) => (
                          <button
                            key={product.id}
                            onClick={() => handleAddSubstitute(product.id)}
                            disabled={addSubstitute.isPending}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors disabled:opacity-50"
                          >
                            <div className="font-semibold text-slate-900">{product.code}</div>
                            <div className="text-sm text-slate-600">{product.name}</div>
                            <div className="text-xs text-slate-500">
                              Mövcud: {product.inventory.currentBranch?.availableQty ?? 0}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <p className="text-sm">Sol tərəfdən məhsul seçin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

