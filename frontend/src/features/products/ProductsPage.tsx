import { useMemo, useState, useEffect, useRef, type FormEvent } from 'react';
import { MagnifyingGlassIcon, PlusIcon, MinusIcon, XMarkIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { useProducts, useBulkImportProducts, useUpdateProductsCategory, useDeleteProduct, useBulkDeleteProducts, useCategories } from '../../hooks/useProducts';
import { useCodeLookup } from '../../hooks/useCodeLookup';
import { useCart, useUpdateCartItem } from '../../hooks/useCart';
import { useCreateManualAdjustments } from '../../hooks/useTransactions';
import { USER_ROLES } from '../../types';
import type { CartItem, Product, CodeLookupProduct } from '../../types';

export const ProductsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isAdminPanel = user?.role === USER_ROLES.SUPER_ADMIN || user?.role === USER_ROLES.BRANCH_MANAGER;
  const isMagazinPanel = user?.role === USER_ROLES.USER; // Mağazin paneli USER rolü ilə
  
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showStockAdjustment, setShowStockAdjustment] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [bulkAdjustmentText, setBulkAdjustmentText] = useState('');
  const [bulkProductText, setBulkProductText] = useState('');
  const [manualAdjustments, setManualAdjustments] = useState<Map<string, number>>(new Map());
  const [quantityInputs, setQuantityInputs] = useState<Map<string, string>>(new Map());
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [targetCategory, setTargetCategory] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryModalTab, setCategoryModalTab] = useState<'select' | 'add'>('select');
  const [categoryBulkProductText, setCategoryBulkProductText] = useState('');

  // Kateqoriyaları backend-dən gətir və cache et
  const { data: categoriesData = [] } = useCategories();
  
  // MÜHİM: Yalnız default kateqoriyaları istifadə et (avtomatik kateqoriya yaradılması söndürülüb)
  // Backend-dən gələn kateqoriyalar artıq yalnız default kateqoriyalardır
  const allCategories = useMemo(() => {
    // Backend-dən gələn kateqoriyalar artıq default kateqoriyalardır
    // Əlavə birləşdirməyə ehtiyac yoxdur
    const unique = Array.from(new Set(categoriesData.filter(Boolean)));
    return unique.sort((a, b) => a.localeCompare(b, 'az'));
  }, [categoriesData]);
  
  const categories = useMemo(() => {
    return allCategories.map((cat) => ({ name: cat, value: cat }));
  }, [allCategories]);

  // Məhsullar ümumi bazada olduğu üçün filial seçimi yoxdur
  // Service paneli üçün də branchId göndərmirik, çünki ümumi bazada olan inventory-ni göstərmək lazımdır
  const { data: products, isLoading: isLoadingProducts } = useProducts(undefined);
  const codeLookup = useCodeLookup();
  // Cart yalnız Magazin paneli üçündür
  const { data: cart } = useCart();
  const updateCartItem = useUpdateCartItem();
  const createManualAdjustments = useCreateManualAdjustments();
  const bulkImportProducts = useBulkImportProducts();
  const updateProductsCategory = useUpdateProductsCategory();
  const deleteProduct = useDeleteProduct();
  const bulkDeleteProducts = useBulkDeleteProducts();

  const searchMode = useMemo<'code' | 'general'>(() => {
    const trimmed = search.trim();
    if (!trimmed) return 'general';
    const isCodePattern = /^[A-Z0-9_-]+$/i.test(trimmed);
    return isCodePattern ? 'code' : 'general';
  }, [search]);

  // Kod axtarışı üçün cache edilmiş nəticə
  const [cachedCodeLookup, setCachedCodeLookup] = useState<{ code: string; products: Product[] } | null>(null);
  const cachedCodeRef = useRef<string | null>(null);

  useEffect(() => {
    if (searchMode === 'code' && search.trim()) {
      const code = search.trim().toUpperCase();
      // Əgər cache-də varsa, yenidən sorğu göndərmə
      if (cachedCodeRef.current === code) {
        return;
      }
      cachedCodeRef.current = code;
      const timeoutId = setTimeout(() => {
        codeLookup.mutate(
          { code, branchId: undefined },
          {
            onSuccess: (data: CodeLookupProduct[]) => {
              const mappedProducts = data
                .map((item) => ({
                  id: item.id,
                  code: item.code,
                  name: item.name,
                  description: item.description,
                  imageUrl: item.imageUrl,
                  category: item.category,
                  barcode: item.barcode,
                  unit: item.unit,
                  price: item.price,
                  inventory: {
                    byBranch: [],
                    currentBranch: {
                      branchId: '',
                      branchName: 'Ümumi',
                      availableQty: item.inventory.availableQty,
                      inTransitQty: item.inventory.inTransitQty,
                      reservedQty: item.inventory.reservedQty,
                    },
                  },
                  isSubstitute: item.isSubstitute || false,
                }));
                // Magazin paneli də admin paneli kimi bütün məhsulları göstərir
                // Stok filtresi yoxdur
              setCachedCodeLookup({ code, products: mappedProducts });
            },
          },
        );
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      // Kod axtarışı deyilsə, cache-i təmizlə
      cachedCodeRef.current = null;
      setCachedCodeLookup(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, searchMode]);

  const filteredProducts = useMemo<Product[]>(() => {
    if (!products) return [];
    
    // Magazin paneli də admin paneli kimi bütün məhsulları göstərir
    // Stok filtresi yoxdur - admin panelindəki kimi bütün məhsullar görünür
    
    // Kateqoriya filteri
    let categoryFiltered = products;
    if (selectedCategory) {
      const selectedCategoryTrimmed = selectedCategory.trim();
      console.log(`[ProductsPage] Seçilmiş kateqoriya: "${selectedCategoryTrimmed}"`);
      console.log(`[ProductsPage] Ümumi məhsul sayı: ${products.length}`);
      
      // Debug: bütün məhsulların kateqoriyalarını göstər
      const categoryCounts = new Map<string, number>();
      products.forEach((product: Product) => {
        const cat = product.category?.trim() || '(boş)';
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
      });
      console.log(`[ProductsPage] Kateqoriya sayıları:`, Object.fromEntries(categoryCounts));
      
      categoryFiltered = products.filter(
        (product: Product) => {
          const productCategory = product.category?.trim() || '';
          const matches = productCategory === selectedCategoryTrimmed;
          if (!matches && productCategory && selectedCategoryTrimmed) {
            console.log(`[ProductsPage] Kateqoriya uyğun gəlmir: "${productCategory}" !== "${selectedCategoryTrimmed}"`);
          }
          return matches;
        },
      );
      console.log(`[ProductsPage] Tapılan məhsullar: ${categoryFiltered.length}`);
      
      // Debug: tapılan məhsulların kodlarını göstər
      if (categoryFiltered.length > 0) {
        console.log(`[ProductsPage] Tapılan məhsul kodları:`, categoryFiltered.slice(0, 5).map((p: Product) => p.code));
      }
    }
    
    const query = search.trim().toLowerCase();
    if (!query) {
      return [...categoryFiltered].sort((a, b) => a.name.localeCompare(b.name, 'az'));
    }
    // MÜHİM: Tam eyni adla axtarış üçün, əgər query tam eyni adla uyğun gəlirsə, yalnız tam uyğun olanları göstər
    // Bu, "HAVA FILTERI" kimi tam adlar üçün düzgün say göstərmək üçün lazımdır
    const exactMatch = categoryFiltered.find(
      (product: Product) => product.name.toLowerCase().trim() === query,
    );
    if (exactMatch) {
      // Tam eyni adla uyğun gələn məhsul varsa, yalnız tam uyğun olanları göstər
      return categoryFiltered.filter(
        (product: Product) => product.name.toLowerCase().trim() === query,
      );
    }
    // Tam uyğun yoxdursa, includes filtri ilə axtar
    return categoryFiltered.filter(
      (product: Product) =>
        product.code.toLowerCase().includes(query) ||
        product.name.toLowerCase().includes(query) ||
        (product.category ?? '').toLowerCase().includes(query),
    );
  }, [products, search, selectedCategory]);

  const displayProducts = useMemo<Product[]>(() => {
    if (searchMode === 'code' && search.trim()) {
      // Cache-dən istifadə et, əgər yoxdursa boş array qaytar
      if (cachedCodeLookup && cachedCodeLookup.code === search.trim().toUpperCase()) {
        // Kod axtarışı rejimində də kateqoriya filtri tətbiq et
        let codeLookupProducts = cachedCodeLookup.products;
        if (selectedCategory) {
          codeLookupProducts = codeLookupProducts.filter(
            (product: Product) => product.category === selectedCategory,
          );
        }
        return codeLookupProducts;
      }
      return [];
    }
    return filteredProducts;
  }, [searchMode, search, cachedCodeLookup, filteredProducts, selectedCategory]);

  const cartQuantities = useMemo<Map<string, number>>(() => {
    if (!cart) return new Map<string, number>();
    return new Map(
      cart.items.map((item: CartItem) => [item.product.id, item.quantity]),
    );
  }, [cart]);

  // Cart dəyişdikdə input dəyərlərini yenilə
  useEffect(() => {
    if (cart) {
      setQuantityInputs((prev) => {
        const newMap = new Map(prev);
        cart.items.forEach((item: CartItem) => {
          newMap.set(item.product.id, item.quantity.toString());
        });
        return newMap;
      });
    }
  }, [cart]);

  const handleQuantityChange = (productId: string, delta: number) => {
    const current = cartQuantities.get(productId) ?? 0;
    const newQuantity = Math.max(current + delta, 0);
    updateCartItem.mutate({ productId, quantity: newQuantity });
    // Input dəyərini yenilə
    setQuantityInputs((prev) => {
      const newMap = new Map(prev);
      newMap.set(productId, newQuantity.toString());
      return newMap;
    });
  };

  const handleQuantityInputChange = (productId: string, value: string) => {
    // Yalnız rəqəm və boş string qəbul et
    if (value === '' || /^\d+$/.test(value)) {
      setQuantityInputs((prev) => {
        const newMap = new Map(prev);
        newMap.set(productId, value);
        return newMap;
      });
    }
  };

  const handleQuantityInputBlur = (productId: string) => {
    const inputValue = quantityInputs.get(productId);
    if (inputValue === undefined || inputValue === '') {
      // Input boşdursa, cari miqdarı göstər
      const current = cartQuantities.get(productId) ?? 0;
      setQuantityInputs((prev) => {
        const newMap = new Map(prev);
        newMap.set(productId, current.toString());
        return newMap;
      });
      return;
    }
    const quantity = parseInt(inputValue, 10);
    if (!isNaN(quantity) && quantity >= 0) {
      updateCartItem.mutate({ productId, quantity });
    } else {
      // Etibarsız dəyər, cari miqdarı göstər
      const current = cartQuantities.get(productId) ?? 0;
      setQuantityInputs((prev) => {
        const newMap = new Map(prev);
        newMap.set(productId, current.toString());
        return newMap;
      });
    }
  };

  const handleQuantityInputKeyDown = (_productId: string, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
  };

  const handleManualStockAdjustment = (productCode: string, delta: number) => {
    setManualAdjustments((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(productCode) ?? 0;
      newMap.set(productCode, current + delta);
      return newMap;
    });
  };

  const handleBulkStockAdjustment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!bulkAdjustmentText.trim()) {
      alert('Düzəliş mətnini daxil edin');
      return;
    }
    // Məhsullar ümumi bazada olduğu üçün branchId göndərmirik
    createManualAdjustments.mutate(
      { text: bulkAdjustmentText, branchId: '' },
      {
        onSuccess: (data) => {
          setBulkAdjustmentText('');
          alert(`Uğurla yaradıldı! ${data.created || data.adjustments?.length || 0} düzəliş yaradıldı.`);
        },
        onError: (error: any) => {
          const errorMessage = error?.response?.data?.message || error?.message || 'Xəta baş verdi';
          alert(`Xəta: ${errorMessage}`);
          console.error('Manual adjustment error:', error);
        },
      },
    );
  };

  const handleApplyManualAdjustments = () => {
    if (manualAdjustments.size === 0) {
      alert('Manual düzəlişlər edin');
      return;
    }
    const lines: string[] = [];
    manualAdjustments.forEach((delta, code) => {
      if (delta !== 0) {
        lines.push(`${code}: ${delta > 0 ? '+' : ''}${delta}`);
      }
    });
    if (lines.length > 0) {
      // Məhsullar ümumi bazada olduğu üçün branchId göndərmirik
      createManualAdjustments.mutate(
        { text: lines.join('\n'), branchId: '' },
        {
          onSuccess: (data) => {
            setManualAdjustments(new Map());
            alert(`Uğurla yaradıldı! ${data.created || data.adjustments?.length || 0} düzəliş yaradıldı.`);
          },
          onError: (error: any) => {
            const errorMessage = error?.response?.data?.message || error?.message || 'Xəta baş verdi';
            alert(`Xəta: ${errorMessage}`);
            console.error('Manual adjustment error:', error);
          },
        },
      );
    }
  };

  const handleBulkProductImport = (e: FormEvent) => {
    e.preventDefault();
    if (!bulkProductText.trim()) return;

    bulkImportProducts.mutate(
      { text: bulkProductText },
      {
        onSuccess: () => {
          setBulkProductText('');
          setShowAddProduct(false);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Məhsul kataloqu</h2>
            {isMagazinPanel && cart && cart.items.length > 0 && (
              <button
                onClick={() => navigate('/cart')}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
              >
                <ShoppingCartIcon className="h-5 w-5" />
                Səbət ({cart.items.reduce((sum, item) => sum + item.quantity, 0)})
              </button>
            )}
          </div>
          <p className="text-sm text-slate-500">Ümumi bazada stok vəziyyətini izləyin və səbətə əlavə edin.</p>
        </div>
        <div className="flex items-center gap-3">
          {isMagazinPanel && cart && cart.items.length > 0 && (
            <button
              onClick={() => navigate('/cart')}
              className="hidden md:flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
            >
              <ShoppingCartIcon className="h-5 w-5" />
              Səbət ({cart.items.reduce((sum, item) => sum + item.quantity, 0)})
            </button>
          )}
          {isAdminPanel && (
            <>
              <button
                onClick={() => setShowAddProduct(!showAddProduct)}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                {showAddProduct ? 'Yeni məhsul əlavə etməni gizlət' : 'Yeni məhsul əlavə et'}
              </button>
              <button
                onClick={() => setShowStockAdjustment(!showStockAdjustment)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {showStockAdjustment ? 'Stok düzəlişini gizlət' : 'Stok düzəlişi'}
              </button>
            </>
          )}
        </div>
      </div>

      {isAdminPanel && showAddProduct && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Yeni Məhsul Əlavə Et</h3>
              <p className="text-sm text-slate-500">
                Copy-paste formatında yeni məhsullar əlavə edin. Format: <span className="font-mono text-xs bg-slate-100 px-1 rounded">KOD AD [QIYMƏT] [KATEQORİYA] [VAHİD]</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Məsələn: <span className="font-mono">PRD001 Yeni Məhsul 10.50 Elektronika ədəd</span>
              </p>
            </div>
          </div>

          <form onSubmit={handleBulkProductImport} className="space-y-3">
            <textarea
              value={bulkProductText}
              onChange={(e) => setBulkProductText(e.target.value)}
              placeholder="PRD001 Yeni Məhsul 1 10.50 Elektronika ədəd&#10;PRD002 Başqa Məhsul 2 25.00 Qida kq&#10;PRD003 Üçüncü Məhsul 3"
              rows={10}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {bulkProductText.split('\n').filter((line) => line.trim().length > 0).length} sətir
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={bulkImportProducts.isPending || !bulkProductText.trim()}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    {bulkImportProducts.isPending ? 'Əlavə edilir...' : 'Məhsulları əlavə et'}
                  </button>
                </div>
              </div>
            {bulkImportProducts.isError && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                <div className="font-semibold mb-1">Xəta baş verdi:</div>
                <div>{(bulkImportProducts.error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Məhsulları əlavə etmək mümkün olmadı'}</div>
              </div>
            )}
            {bulkImportProducts.isSuccess && bulkImportProducts.data && (
              <div className="text-sm bg-green-50 p-3 rounded-lg">
                <div className="font-semibold text-green-900 mb-2">Uğurla əlavə edildi!</div>
                <div className="grid grid-cols-2 gap-3 text-xs text-green-700">
                  <div>
                    <span className="text-slate-600">İşlənmiş:</span>
                    <span className="ml-2 font-semibold">{bulkImportProducts.data.processed}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Əlavə edildi:</span>
                    <span className="ml-2 font-semibold text-green-600">{bulkImportProducts.data.created}</span>
                  </div>
                </div>
                {bulkImportProducts.data.errors.length > 0 && (
                  <details className="mt-3 rounded-lg border border-amber-200 bg-white p-3 text-xs text-amber-800">
                    <summary className="cursor-pointer text-sm font-medium text-amber-700">
                      Xətalar ({bulkImportProducts.data.errors.length})
                    </summary>
                    <ul className="mt-2 list-disc space-y-1 pl-4 max-h-40 overflow-y-auto">
                      {bulkImportProducts.data.errors.slice(0, 10).map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                      {bulkImportProducts.data.errors.length > 10 && (
                        <li className="italic text-amber-600">+{bulkImportProducts.data.errors.length - 10} əlavə xəta</li>
                      )}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </form>
        </div>
      )}

      {isAdminPanel && showStockAdjustment && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Stok Əlavə Etmə / Azaltma</h3>
            <p className="text-sm text-slate-500">
              Məhsullar ümumi bazada saxlanılır. Copy-paste formatında və ya manual olaraq stok dəyişiklikləri edin. Format: <span className="font-mono text-xs bg-slate-100 px-1 rounded">KOD +SAY</span> və ya <span className="font-mono text-xs bg-slate-100 px-1 rounded">KOD -SAY</span> (iki nöqtə işarəsi vacib deyil)
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-600">Copy-Paste Formatı</label>
              <form onSubmit={handleBulkStockAdjustment} className="space-y-3">
                <textarea
                  value={bulkAdjustmentText}
                  onChange={(e) => setBulkAdjustmentText(e.target.value)}
                  placeholder="PRD001 +5&#10;PRD002 -2&#10;PRD003 +10"
                  rows={8}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="submit"
                  disabled={createManualAdjustments.isPending || !bulkAdjustmentText.trim()}
                  className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                >
                  {createManualAdjustments.isPending ? 'Yaradılır...' : 'Düzəlişləri yarat'}
                </button>
                {createManualAdjustments.isError && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    {(createManualAdjustments.error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Xəta baş verdi'}
                  </div>
                )}
                {createManualAdjustments.isSuccess && (
                  <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                    Düzəlişlər uğurla yaradıldı!
                  </div>
                )}
              </form>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-600">Manual Düzəlişlər</label>
              <div className="border border-slate-200 rounded-lg p-4 space-y-2 max-h-64 overflow-y-auto">
                {manualAdjustments.size === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">
                    Məhsullar cədvəlində + və - düymələrindən istifadə edərək düzəlişlər edin
                  </p>
                ) : (
                  Array.from(manualAdjustments.entries()).map(([code, delta]) => (
                    <div key={code} className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{code}</span>
                      <span className={delta > 0 ? 'text-green-600' : 'text-red-600'}>
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <button
                onClick={handleApplyManualAdjustments}
                disabled={createManualAdjustments.isPending || manualAdjustments.size === 0}
                className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {createManualAdjustments.isPending ? 'Tətbiq edilir...' : 'Düzəlişləri tətbiq et'}
              </button>
              {createManualAdjustments.isError && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {(createManualAdjustments.error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Xəta baş verdi'}
                </div>
              )}
              {createManualAdjustments.isSuccess && (
                <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                  Düzəlişlər uğurla yaradıldı!
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Kateqoriya Bölmələri */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Kateqoriyalar</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories.map((category) => (
            <div key={category.value} className="relative">
              <button
                onClick={() => {
                  setSelectedCategory(selectedCategory === category.value ? null : category.value);
                  setSearch(''); // Kateqoriya seçildikdə axtarışı təmizlə
                }}
                className={`w-full rounded-lg border-2 px-4 py-3 text-sm font-semibold transition ${
                  selectedCategory === category.value
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-primary-300 hover:bg-primary-50'
                }`}
              >
                {category.name}
              </button>
              {isAdminPanel && (
                <button
                  onClick={() => {
                    setTargetCategory(category.value);
                    setShowCategoryModal(true);
                    setSelectedProducts(new Set());
                    setCategorySearch('');
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary-500 text-white text-xs font-bold hover:bg-primary-600 flex items-center justify-center shadow-md"
                  title="Məhsul əlavə et"
                >
                  +
                </button>
              )}
            </div>
          ))}
        </div>
        {selectedCategory && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-slate-600">
              Seçilmiş kateqoriya: <span className="font-semibold text-slate-900">{selectedCategory}</span>
            </span>
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-sm text-slate-500 hover:text-slate-700 underline"
            >
              Təmizlə
            </button>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="relative w-full md:w-80">
            <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchMode === 'code' ? 'Məhsul kodunu daxil edin...' : 'Kod, ad və ya kateqoriya ilə axtar...'}
              className="w-full rounded-lg border border-slate-200 pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex items-center gap-4">
            {isAdminPanel && selectedProducts.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">
                  Seçilmiş: <span className="font-semibold text-slate-900">{selectedProducts.size}</span>
                </span>
                <button
                  onClick={() => {
                    if (confirm(`${selectedProducts.size} məhsulu silmək istədiyinizə əminsiniz?`)) {
                      bulkDeleteProducts.mutate(Array.from(selectedProducts), {
                        onSuccess: () => {
                          setSelectedProducts(new Set());
                        },
                      });
                    }
                  }}
                  disabled={bulkDeleteProducts.isPending}
                  className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  {bulkDeleteProducts.isPending ? 'Silinir...' : `Seçilmişləri sil (${selectedProducts.size})`}
                </button>
                <button
                  onClick={() => setSelectedProducts(new Set())}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Seçimi ləğv et
                </button>
              </div>
            )}
            <div className="text-sm text-slate-500">
              Tapılan məhsullar: <span className="font-semibold text-slate-800">{displayProducts.length}</span>
              {searchMode === 'code' && codeLookup.isPending && (
                <span className="ml-2 text-xs">(Kod axtarışı...)</span>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase text-slate-500 tracking-wide">
                {isAdminPanel && (
                  <th className="px-4 py-3 w-12">
                    <input
                      type="checkbox"
                      checked={displayProducts.length > 0 && displayProducts.every((p: Product) => selectedProducts.has(p.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProducts(new Set(displayProducts.map((p: Product) => p.id)));
                        } else {
                          setSelectedProducts(new Set());
                        }
                      }}
                      className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                      title="Hamısını seç/seçimi ləğv et"
                    />
                  </th>
                )}
                <th className="px-4 py-3">Kod</th>
                <th className="px-4 py-3">Məhsul</th>
                <th className="px-4 py-3">Qiymət</th>
                {isAdminPanel && <th className="px-4 py-3">Mövcud</th>}
                {isAdminPanel && showStockAdjustment && <th className="px-4 py-3">Stok düzəlişi</th>}
                {isAdminPanel && <th className="px-4 py-3 text-right">Əməliyyat</th>}
                {isMagazinPanel && <th className="px-4 py-3 text-right">Əməliyyat</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingProducts ? (
                <tr>
                  <td colSpan={
                    (isAdminPanel ? 1 : 0) + // Checkbox sütunu
                    (isAdminPanel ? 1 : 0) + // Mövcud sütunu
                    (isAdminPanel && showStockAdjustment ? 1 : 0) + 
                    (isAdminPanel ? 1 : 0) +
                    (isMagazinPanel ? 1 : 0) + 
                    3 // Kod, Məhsul, Qiymət
                  } className="px-4 py-6 text-center text-sm text-slate-500">
                    Yüklənir...
                  </td>
                </tr>
              ) : displayProducts.length === 0 ? (
                <tr>
                  <td colSpan={
                    (isAdminPanel ? 1 : 0) + // Checkbox sütunu
                    (isAdminPanel ? 1 : 0) + // Mövcud sütunu
                    (isAdminPanel && showStockAdjustment ? 1 : 0) + 
                    (isAdminPanel ? 1 : 0) +
                    (isMagazinPanel ? 1 : 0) + 
                    3 // Kod, Məhsul, Qiymət
                  } className="px-4 py-6 text-center text-sm text-slate-500">
                    {searchMode === 'code' ? 'Bu kodla məhsul tapılmadı.' : 'Göstəriləcək məhsul yoxdur.'}
                  </td>
                </tr>
              ) : (
                displayProducts.map((product: Product) => {
                  const branchInventory = product.inventory.currentBranch;
                  const quantity = cartQuantities.get(product.id) ?? 0;
                  const stockAdjustment = manualAdjustments.get(product.code) ?? 0;
                  const isSubstitute = product.isSubstitute || false;
                  const isSelected = selectedProducts.has(product.id);
                  return (
                    <tr 
                      key={product.id} 
                      className={`text-sm text-slate-700 ${isSubstitute ? 'bg-amber-50/50 border-l-4 border-l-amber-400' : ''} ${isSelected ? 'bg-primary-50' : ''}`}
                    >
                      {isAdminPanel && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedProducts((prev) => {
                                const newSet = new Set(prev);
                                if (newSet.has(product.id)) {
                                  newSet.delete(product.id);
                                } else {
                                  newSet.add(product.id);
                                }
                                return newSet;
                              });
                            }}
                            className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 font-semibold">
                        <div className="flex items-center gap-2">
                          {product.code}
                          {isSubstitute && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-semibold">
                              Əvəz edici
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="h-10 w-10 rounded-lg object-cover border border-slate-200" />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xs text-slate-500">
                              {product.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-slate-900">{product.name}</div>
                            <div className="text-xs text-slate-500">
                              {product.category ?? 'Kategoriya yoxdur'} · {product.unit ?? 'ədəd'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{product.price.toFixed(2)} AZN</td>
                      {isAdminPanel && (
                        <td className="px-4 py-3 font-semibold">
                          {branchInventory?.calculatedQty ?? branchInventory?.availableQty ?? 0}
                        </td>
                      )}
                      {isAdminPanel && showStockAdjustment && (
                        <td className="px-4 py-3">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handleManualStockAdjustment(product.code, -1)}
                              disabled={createManualAdjustments.isPending}
                              className="rounded-full border border-red-200 p-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
                              title="Stok azalt"
                            >
                              <MinusIcon className="h-4 w-4" />
                            </button>
                            <span className={`w-12 text-center text-xs font-semibold ${stockAdjustment !== 0 ? stockAdjustment > 0 ? 'text-green-600' : 'text-red-600' : 'text-slate-400'}`}>
                              {stockAdjustment !== 0 ? (stockAdjustment > 0 ? `+${stockAdjustment}` : stockAdjustment) : '0'}
                            </span>
                            <button
                              onClick={() => handleManualStockAdjustment(product.code, 1)}
                              disabled={createManualAdjustments.isPending}
                              className="rounded-full border border-green-200 p-1 text-green-600 hover:bg-green-50 disabled:opacity-50"
                              title="Stok artır"
                            >
                              <PlusIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                      {isAdminPanel && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              if (confirm(`"${product.name}" məhsulunu silmək istədiyinizə əminsiniz?`)) {
                                deleteProduct.mutate(product.id);
                              }
                            }}
                            disabled={deleteProduct.isPending}
                            className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                            title="Məhsulu sil"
                          >
                            {deleteProduct.isPending ? 'Silinir...' : 'Sil'}
                          </button>
                        </td>
                      )}
                      {isMagazinPanel && (
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handleQuantityChange(product.id, -1)}
                              disabled={updateCartItem.isPending || quantity === 0}
                              className="rounded-full border border-slate-200 p-1 hover:bg-slate-100 disabled:opacity-50"
                            >
                              <MinusIcon className="h-4 w-4" />
                            </button>
                            <input
                              type="text"
                              value={quantityInputs.get(product.id) ?? quantity.toString()}
                              onChange={(e) => handleQuantityInputChange(product.id, e.target.value)}
                              onBlur={() => handleQuantityInputBlur(product.id)}
                              onKeyDown={(e) => handleQuantityInputKeyDown(product.id, e)}
                              className="w-16 text-center text-sm font-semibold border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              disabled={updateCartItem.isPending}
                            />
                            <button
                              onClick={() => handleQuantityChange(product.id, 1)}
                              disabled={updateCartItem.isPending}
                              className="rounded-full bg-primary-600 p-1 text-white hover:bg-primary-700 disabled:opacity-50"
                            >
                              <PlusIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Kateqoriyaya Məhsul Əlavə Etmə Modalı */}
      {showCategoryModal && targetCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Məhsulları "{targetCategory}" kateqoriyasına əlavə et
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Mövcud məhsulları seçin və ya yeni məhsulları toplu şəkildə əlavə edin
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setTargetCategory(null);
                  setSelectedProducts(new Set());
                  setCategorySearch('');
                  setCategoryModalTab('select');
                  setCategoryBulkProductText('');
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="px-6 pt-4 border-b border-slate-200">
              <nav className="flex gap-4">
                <button
                  onClick={() => setCategoryModalTab('select')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    categoryModalTab === 'select'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Mövcud məhsulları seç
                </button>
                <button
                  onClick={() => setCategoryModalTab('add')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    categoryModalTab === 'add'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Yeni məhsullar əlavə et (Copy-Paste)
                </button>
              </nav>
            </div>

            {categoryModalTab === 'select' && (
              <>
                <div className="p-6 border-b border-slate-200">
                  <div className="relative w-full">
                    <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                    <input
                      type="search"
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      placeholder="Kod, ad və ya kateqoriya ilə axtar..."
                      className="w-full rounded-lg border border-slate-200 pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {isLoadingProducts ? (
                    <div className="text-center text-sm text-slate-500 py-8">Yüklənir...</div>
                  ) : (
                    <div className="space-y-2">
                      {products
                        ?.filter((product: Product) => {
                          const query = categorySearch.trim().toLowerCase();
                          if (!query) return true;
                          return (
                            product.code.toLowerCase().includes(query) ||
                            product.name.toLowerCase().includes(query) ||
                            (product.category ?? '').toLowerCase().includes(query)
                          );
                        })
                        .map((product: Product) => {
                          const isSelected = selectedProducts.has(product.id);
                          return (
                            <div
                              key={product.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                                isSelected
                                  ? 'border-primary-500 bg-primary-50'
                                  : 'border-slate-200 bg-white hover:border-primary-300'
                              }`}
                              onClick={() => {
                                setSelectedProducts((prev) => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(product.id)) {
                                    newSet.delete(product.id);
                                  } else {
                                    newSet.add(product.id);
                                  }
                                  return newSet;
                                });
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                              />
                              <div className="flex-1">
                                <div className="text-sm font-semibold text-slate-900">{product.code}</div>
                                <div className="text-sm text-slate-600">{product.name}</div>
                                {product.category && (
                                  <div className="text-xs text-slate-500 mt-1">
                                    Cari kateqoriya: {product.category}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      {products?.filter((product: Product) => {
                        const query = categorySearch.trim().toLowerCase();
                        if (!query) return true;
                        return (
                          product.code.toLowerCase().includes(query) ||
                          product.name.toLowerCase().includes(query) ||
                          (product.category ?? '').toLowerCase().includes(query)
                        );
                      }).length === 0 && (
                        <div className="text-center text-sm text-slate-500 py-8">Məhsul tapılmadı</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    Seçilmiş məhsullar: <span className="font-semibold text-slate-900">{selectedProducts.size}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setShowCategoryModal(false);
                        setTargetCategory(null);
                        setSelectedProducts(new Set());
                        setCategorySearch('');
                        setCategoryModalTab('select');
                        setCategoryBulkProductText('');
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Ləğv et
                    </button>
                    <button
                      onClick={() => {
                        if (selectedProducts.size === 0) {
                          alert('Zəhmət olmasa, ən azı bir məhsul seçin');
                          return;
                        }
                        updateProductsCategory.mutate(
                          {
                            productIds: Array.from(selectedProducts),
                            category: targetCategory,
                          },
                          {
                            onSuccess: () => {
                              setShowCategoryModal(false);
                              setTargetCategory(null);
                              setSelectedProducts(new Set());
                              setCategorySearch('');
                              setCategoryModalTab('select');
                              setCategoryBulkProductText('');
                              alert(`${selectedProducts.size} məhsul "${targetCategory}" kateqoriyasına uğurla əlavə edildi`);
                            },
                            onError: (error: any) => {
                              const errorMessage = error?.response?.data?.message || error?.message || 'Xəta baş verdi';
                              alert(`Xəta: ${errorMessage}`);
                            },
                          },
                        );
                      }}
                      disabled={selectedProducts.size === 0 || updateProductsCategory.isPending}
                      className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                    >
                      {updateProductsCategory.isPending ? 'Əlavə edilir...' : 'Əlavə et'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {categoryModalTab === 'add' && (
              <>
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 mb-2">Toplu məhsul əlavə et</h4>
                      <p className="text-xs text-slate-500 mb-3">
                        Məhsulları copy-paste edin. Format: <span className="font-mono bg-slate-100 px-1 rounded">KOD AD [QIYMƏT] [VAHİD]</span>
                      </p>
                      <p className="text-xs text-slate-400 mb-4">
                        Məsələn: <span className="font-mono">PRD001 Yeni Məhsul 10.50 ədəd</span>
                        <br />
                        <span className="text-amber-600 font-medium">Qeyd: Bütün məhsullar "{targetCategory}" kateqoriyasına avtomatik təyin ediləcək</span>
                      </p>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!categoryBulkProductText.trim()) {
                            alert('Zəhmət olmasa, məhsul məlumatlarını daxil edin');
                            return;
                          }
                          // Məhsulları əlavə et və kateqoriyaya təyin et
                          // Backend format: KOD AD [QIYMƏT] [KATEQORİYA] [VAHİD]
                          // Backend parse: qiymətdən sonra gələn ilk söz kateqoriya, sonrakı vahid olur
                          const lines = categoryBulkProductText.split('\n').filter((line) => line.trim().length > 0);
                          const productsWithCategory = lines.map((line) => {
                            const trimmed = line.trim();
                            if (!trimmed) return '';
                            
                            const parts = trimmed.split(/\s+/);
                            if (parts.length < 2) return trimmed;
                            
                            // Qiyməti tap (rəqəm formatında)
                            let priceIndex = -1;
                            for (let i = 1; i < parts.length; i++) {
                              const part = parts[i];
                              const numValue = parseFloat(part.replace(',', '.'));
                              if (!isNaN(numValue) && numValue >= 0 && /^\d+([.,]\d+)?$/.test(part)) {
                                priceIndex = i;
                                break;
                              }
                            }
                            
                            // Əgər qiymət varsa, kateqoriyanı qiymətdən dərhal sonra əlavə et
                            if (priceIndex >= 0) {
                              // Format: KOD AD QIYMƏT [KATEQORİYA] [VAHİD]
                              // Kateqoriyanı qiymətdən sonra, mövcud hissələrdən əvvəl əlavə et
                              const beforePrice = parts.slice(0, priceIndex + 1).join(' ');
                              const afterPrice = parts.slice(priceIndex + 1).join(' ');
                              
                              // Əgər qiymətdən sonra bir şey varsa, o vahid ola bilər
                              // Yəni: KOD AD QIYMƏT VAHİD → KOD AD QIYMƏT KATEQORİYA VAHİD
                              // Yoxsa: KOD AD QIYMƏT → KOD AD QIYMƏT KATEQORİYA
                              // MÜHİM: Kateqoriyanı həmişə qiymətdən dərhal sonra əlavə et
                              // Format: KOD AD QIYMƏT KATEQORİYA [VAHİD]
                              // Backend parse: qiymətdən sonra gələn ilk söz kateqoriya olur
                              if (afterPrice.trim()) {
                                // Qiymətdən sonra vahid var, kateqoriyanı arasına qoy
                                // Format: KOD AD QIYMƏT KATEQORİYA VAHİD
                                return `${beforePrice} ${targetCategory} ${afterPrice}`;
                              } else {
                                // Qiymətdən sonra heç nə yoxdur, kateqoriyanı əlavə et
                                // Format: KOD AD QIYMƏT KATEQORİYA
                                return `${beforePrice} ${targetCategory}`;
                              }
                            } else {
                              // Qiymət yoxdursa, kateqoriyanı sonuna əlavə et
                              // Format: KOD AD → KOD AD KATEQORİYA
                              return `${trimmed} ${targetCategory}`;
                            }
                          }).join('\n');

                          // Debug: göndərilən məlumatı console-da göstər
                          console.log('Göndərilən məhsul məlumatları:', productsWithCategory);
                          console.log('Hədəf kateqoriya:', targetCategory);

                          bulkImportProducts.mutate(
                            { text: productsWithCategory },
                            {
                              onSuccess: async (data) => {
                                console.log('Backend cavabı:', data);
                                console.log('Hədəf kateqoriya:', targetCategory);
                                
                                // MÜHİM: Yenilənmə anlayışı YOXDUR - həmişə "added" kimi sayılır
                                let alertMessage = '';
                                if (data.errors && data.errors.length > 0) {
                                  alertMessage = `İşlənmiş: ${data.processed || 0}\nƏlavə edildi: ${data.created || 0}\nXətalar: ${data.errors.length}\n\nXətalar:\n${data.errors.slice(0, 5).join('\n')}`;
                                } else {
                                  if (data.created > 0) {
                                    alertMessage = `${data.created} məhsul "${targetCategory}" kateqoriyasına uğurla əlavə edildi!`;
                                  } else {
                                    alertMessage = `Məhsullar işləndi, amma heç bir dəyişiklik olmadı.`;
                                  }
                                }
                                
                                // MÜHİM: Cache-i tamamilə təmizlə və yenidən fetch et
                                console.log('[ProductsPage] Cache tamamilə təmizlənir...');
                                
                                // Bütün products query-lərini remove et (cache-dən sil)
                                queryClient.removeQueries({ 
                                  predicate: (query) => {
                                    return query.queryKey[0] === 'products';
                                  },
                                });
                                
                                // Kateqoriyaları da remove et
                                queryClient.removeQueries({ queryKey: ['products', 'categories'] });
                                
                                console.log('[ProductsPage] Cache təmizləndi, yenidən fetch edilir...');
                                
                                // MÜHİM: Yenidən fetch et (cache boş olduğu üçün mütləq backend-dən gətirəcək)
                                await queryClient.refetchQueries({ 
                                  queryKey: ['products'],
                                  exact: false, // Bütün products query-lərini refetch et
                                });
                                
                                await queryClient.refetchQueries({ 
                                  queryKey: ['products', 'categories'],
                                  exact: false,
                                });
                                
                                console.log('[ProductsPage] Cache yeniləndi və refetch edildi');
                                
                                // MÜHİM: Bir az gözlə ki, refetch tamamlansın və UI yenilənsin
                                await new Promise(resolve => setTimeout(resolve, 2000));
                                
                                // MÜHİM: Əlavə olaraq, query-ni yenidən fetch et ki, kateqoriya filter-i düzgün işləsin
                                console.log('[ProductsPage] Query yenidən fetch edilir (kateqoriya filter üçün)...');
                                
                                // MÜHİM: Cache-i yenidən təmizlə və yenidən fetch et
                                queryClient.removeQueries({ 
                                  predicate: (query) => {
                                    return query.queryKey[0] === 'products';
                                  },
                                });
                                
                                await queryClient.refetchQueries({ 
                                  queryKey: ['products'],
                                  exact: false,
                                });
                                
                                // MÜHİM: Bir az daha gözlə ki, UI yenilənsin
                                await new Promise(resolve => setTimeout(resolve, 500));
                                
                                // MÜHİM: Əgər kateqoriya seçilibsə, onu yenidən seç ki, filter yenilənsin
                                if (targetCategory) {
                                  console.log(`[ProductsPage] Kateqoriya filter yenilənir: "${targetCategory}"`);
                                  // Əvvəlcə null et, sonra yenidən seç ki, filter yenilənsin
                                  setSelectedCategory(null);
                                  await new Promise(resolve => setTimeout(resolve, 200));
                                  setSelectedCategory(targetCategory);
                                  // Bir az daha gözlə ki, filter tətbiq edilsin
                                  await new Promise(resolve => setTimeout(resolve, 300));
                                }
                                
                                // Modal bağla
                                setCategoryBulkProductText('');
                                setShowCategoryModal(false);
                                setTargetCategory(null);
                                setCategoryModalTab('select');
                                
                                // Mesajı göstər
                                alert(alertMessage);
                              },
                              onError: (error: any) => {
                                console.error('Xəta:', error);
                                const errorMessage = error?.response?.data?.message || error?.message || 'Xəta baş verdi';
                                alert(`Xəta: ${errorMessage}`);
                              },
                            },
                          );
                        }}
                        className="space-y-3"
                      >
                        <textarea
                          value={categoryBulkProductText}
                          onChange={(e) => setCategoryBulkProductText(e.target.value)}
                          placeholder={`PRD001 Yeni Məhsul 1 10.50 ədəd\nPRD002 Başqa Məhsul 2 25.00 kq\nPRD003 Üçüncü Məhsul 3`}
                          rows={12}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">
                            {categoryBulkProductText.split('\n').filter((line) => line.trim().length > 0).length} sətir
                          </span>
                          <button
                            type="submit"
                            disabled={bulkImportProducts.isPending || !categoryBulkProductText.trim()}
                            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                          >
                            {bulkImportProducts.isPending ? 'Əlavə edilir...' : 'Məhsulları əlavə et'}
                          </button>
                        </div>
                        {bulkImportProducts.isError && (
                          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                            <div className="font-semibold mb-1">Xəta baş verdi:</div>
                            <div>{(bulkImportProducts.error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Məhsulları əlavə etmək mümkün olmadı'}</div>
                          </div>
                        )}
                        {bulkImportProducts.isSuccess && bulkImportProducts.data && (
                          <div className="text-sm bg-green-50 p-3 rounded-lg">
                            <div className="font-semibold text-green-900 mb-2">Uğurla əlavə edildi!</div>
                            <div className="grid grid-cols-2 gap-3 text-xs text-green-700">
                              <div>
                                <span className="text-slate-600">İşlənmiş:</span>
                                <span className="ml-2 font-semibold">{bulkImportProducts.data.processed}</span>
                              </div>
                              <div>
                                <span className="text-slate-600">Əlavə edildi:</span>
                                <span className="ml-2 font-semibold text-green-600">{bulkImportProducts.data.created}</span>
                              </div>
                            </div>
                            {bulkImportProducts.data.errors.length > 0 && (
                              <details className="mt-3 rounded-lg border border-amber-200 bg-white p-3 text-xs text-amber-800">
                                <summary className="cursor-pointer text-sm font-medium text-amber-700">
                                  Xətalar ({bulkImportProducts.data.errors.length})
                                </summary>
                                <ul className="mt-2 list-disc space-y-1 pl-4 max-h-40 overflow-y-auto">
                                  {bulkImportProducts.data.errors.slice(0, 10).map((error, index) => (
                                    <li key={index}>{error}</li>
                                  ))}
                                  {bulkImportProducts.data.errors.length > 10 && (
                                    <li className="italic text-amber-600">+{bulkImportProducts.data.errors.length - 10} əlavə xəta</li>
                                  )}
                                </ul>
                              </details>
                            )}
                          </div>
                        )}
                      </form>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-200 flex items-center justify-end">
                  <button
                    onClick={() => {
                      setShowCategoryModal(false);
                      setTargetCategory(null);
                      setCategoryModalTab('select');
                      setCategoryBulkProductText('');
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Bağla
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;

