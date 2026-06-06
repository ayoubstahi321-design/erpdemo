
import React, { useState, useRef, useEffect } from 'react';
import { Product, StockStatus, Warehouse, ProductCategory, Transfer, User } from '../types';
import { CURRENCY } from '../constants';
import { Search, Filter, Plus, Download, Upload, FileText, ScanBarcode, Pencil, Trash2, X, AlertTriangle, ArrowRightLeft, Package, Copy, Loader2, AlertCircle, Tag } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { useToast } from '../hooks/useToast';
import { sortProducts, fuzzySearch, exportToCSV, generateAutoSKU, calculateTotalStock, isProductLowStock, initializeEmptyStockLevels, getStockInWarehouse, formatStock } from '../utils/helpers';
import { exportProductsToCSV, downloadCSVTemplate, ProductCSVRow, csvRowToProduct } from '../utils/csvImportExport';
import { useCameraScanner } from '../hooks/useCameraScanner';
import { CameraModal } from './CameraModal';
import { CSVImportModal } from './CSVImportModal';
import { useProducts, useWarehouses, useSuppliers, useAppSetting } from '../hooks/useSupabaseData';
import { usePaginatedProducts } from '../hooks/usePaginatedProducts';
import { useDebounce } from '../hooks/useDebounce';
import { usePersistedString } from '../hooks/usePersistedState';
import { Pagination } from './Pagination';
import { logger } from '../utils/logger';
import BarcodeLabels from './BarcodeLabels';
import ConfirmDialog from './ConfirmDialog';

// Fallback props for when Supabase is disabled
interface InventoryProps {
  products?: Product[];
  warehouses?: Warehouse[];
  transfers?: Transfer[];
  currentUser?: User;
  onAddProduct?: (product: Product) => void;
  onUpdateProduct?: (product: Product) => void;
  onDeleteProduct?: (id: string) => void;
  onTransfer?: (transfer: Transfer) => void;
}

const Inventory: React.FC<InventoryProps> = (props) => {
  const isAdmin = props.currentUser?.role === 'Admin';
  const isAdminOrManager = props.currentUser?.role === 'Admin' || props.currentUser?.role === 'Manager';
  const { t, dir } = useLanguage();
  const toast = useToast();

  // ALWAYS call hooks (React rules - hooks must be called unconditionally)
  const productsHook = useProducts();
  const warehousesHook = useWarehouses();
  const suppliersHook = useSuppliers();
  // Persisted filters
  const [searchTerm, setSearchTerm] = usePersistedString('inventory_search', '');
  const [inputValue, setInputValue] = useState(searchTerm);
  const [categoryFilter, setCategoryFilter] = usePersistedString('inventory_category', 'All');
  const [supplierFilter, setSupplierFilter] = usePersistedString('inventory_supplier', 'All');
  const [page, setPage] = useState(1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({});
  const [transferringProduct, setTransferringProduct] = useState<Product | null>(null);
  const [transferFromId, setTransferFromId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [transferBoxes, setTransferBoxes] = useState(0);
  const [transferLooseUnits, setTransferLooseUnits] = useState(1);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustType, setAdjustType] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
  const [adjustBoxes, setAdjustBoxes] = useState(0);
  const [adjustLooseUnits, setAdjustLooseUnits] = useState(1);
  const [adjustReason, setAdjustReason] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const { value: stockMigratedValue } = useAppSetting('stock_migrated');
  const stockMigrated = stockMigratedValue === 'true';
  const [barcodePrintProducts, setBarcodePrintProducts] = useState<Product[]>([]);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Use Supabase hook data directly
  const products = productsHook.products;
  const allWarehouses = warehousesHook.warehouses;
  // Comerciales (Sales role with assigned warehouse) only see their own warehouse
  const warehouses = props.currentUser?.warehouseId
    ? allWarehouses.filter(w => w.id === props.currentUser!.warehouseId)
    : allWarehouses;
  const [adjustWarehouseId, setAdjustWarehouseId] = useState(warehouses[0]?.id || '');
  const { isCameraOpen, startCamera, stopCamera, handleSimulatedScan, videoRef } = useCameraScanner({ products });

  const transfers = props.transfers ?? [];

  // Server-side paginated products for the listing
  const suppliers = suppliersHook.suppliers;

  const { products: paginatedProducts, totalCount, loading: productsLoading, error: productsError, refresh: refreshProducts } = usePaginatedProducts({
    page,
    pageSize: 25,
    search: searchTerm,
    category: categoryFilter
  });

  // Client-side supplier filter (supplier_id not yet in paginated hook)
  const filteredBySupplier = supplierFilter === 'All'
    ? paginatedProducts
    : paginatedProducts.filter(p => p.supplierId === supplierFilter);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [searchTerm, categoryFilter, supplierFilter]);

  const loading = productsLoading ||
                  warehousesHook.loading;
  const error = productsError ||
                warehousesHook.error;

  // Server-side pagination values
  const pageSize = 25;
  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + paginatedProducts.length, totalCount);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
        <p className="text-slate-600">{t('loading')}...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 m-6">
        <div className="flex items-center mb-2">
          <AlertCircle className="w-5 h-5 text-rose-600 mr-2" />
          <h3 className="font-semibold text-rose-900">{t('error')}</h3>
        </div>
        <p className="text-sm text-rose-700 mb-4">{error.message}</p>
        {(productsHook || warehousesHook) && (
          <button
            onClick={() => {
              productsHook?.refresh();
              warehousesHook?.refresh();
            }}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
          >
            {t('retry')}
          </button>
        )}
      </div>
    );
  }

  // Identify low stock items in the current view
  const lowStockItems = paginatedProducts.filter(isProductLowStock);

  const categories = ['All', ...Object.values(ProductCategory)];
  const units = ['L', 'ml', 'kg', 'Grams', 'ton', 'pcs', 'gal'];

  const handleExportCSV = () => {
    exportProductsToCSV(products, warehouses);
  };

  const handleCSVImport = async (csvProducts: ProductCSVRow[]) => {
    try {
      // Obtener el primer almacén como predeterminado
      const defaultWarehouseId = warehouses[0]?.id;

      if (!productsHook) {
        throw new Error('La importación solo está disponible con Supabase habilitado');
      }

      // Lista de productos que iremos construyendo (para SKU auto-generados)
      const importedProducts: Product[] = [...products];

      // Convertir productos CSV a productos y agregarlos/actualizarlos uno por uno
      for (const csvRow of csvProducts) {
        // Pasar productos existentes + ya importados para generar SKU único
        const product = csvRowToProduct(csvRow, defaultWarehouseId, importedProducts);

        const newProduct = {
          ...product,
          id: crypto.randomUUID(),
          lastRestock: new Date().toISOString()
        } as Product;

        // Usar upsertProduct para manejar duplicados automáticamente
        await productsHook.upsertProduct(newProduct);

        // Añadir a la lista temporal para que el próximo SKU sea único
        importedProducts.push(newProduct);

        // Pequeña pausa para no saturar la base de datos
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Refrescar productos
      await refreshProducts();
    } catch (error) {
      logger.error('Error importing products:', error);
      throw error;
    }
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setCurrentProduct({
        category: ProductCategory.MOTOR_OIL,
        price: 0,
        cost: 0,
        minStock: 10,
        stockLevels: initializeEmptyStockLevels(warehouses),
        packSize: 1,
        unit: 'L',
        unitsPerBox: 1
    });
    setShowModal(true);
  };

  const handleOpenEdit = (product: Product) => {
    setIsEditing(true);
    setCurrentProduct({...product});
    setShowModal(true);
  };

  const handleDuplicate = (product: Product) => {
    setIsEditing(false);
    setCurrentProduct({
        ...product,
        id: undefined,
        sku: `${product.sku}-COPY`,
        stockLevels: initializeEmptyStockLevels(warehouses),
        lastRestock: new Date().toISOString()
    });
    setShowModal(true);
  };

  const handleOpenTransfer = (product: Product) => {
      setTransferringProduct(product);
      setTransferFromId(warehouses[0]?.id || '');
      setTransferToId(warehouses[1]?.id || '');
      setTransferBoxes(1);
      setTransferLooseUnits(0);
      setIsAdjusting(false);
      setAdjustWarehouseId(warehouses[0]?.id || '');
      setAdjustBoxes(0);
      setAdjustLooseUnits(0);
      setAdjustType('INCREASE');
      setAdjustReason('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!currentProduct.name) {
        toast.error(t('val_name_required'));
        return;
    }

    // Validate price > 0
    if (!currentProduct.price || currentProduct.price <= 0) {
        toast.error('Le prix de vente doit être supérieur à 0');
        return;
    }

    // Warn if cost > price (selling at a loss)
    if (currentProduct.cost && currentProduct.price && currentProduct.cost > currentProduct.price) {
        if (!confirm(t('alert_cost_exceeds_price').replace('{cost}', String(currentProduct.cost)).replace('{price}', String(currentProduct.price)))) {
            return;
        }
    }

    // Auto-generate SKU if not provided (only for new products)
    let finalSKU = currentProduct.sku;
    if (!finalSKU && !isEditing && currentProduct.category) {
      finalSKU = generateAutoSKU(currentProduct.category, products);
    }

    // Check for SKU duplicates
    const skuExists = products.some(p => p.sku === finalSKU && p.id !== currentProduct.id);
    if (skuExists) {
        toast.error(t('warning_duplicate_sku'));
        return;
    }

    // Ensure SKU is present (either provided or auto-generated)
    if (!finalSKU) {
        toast.error(t('required_fields'));
        return;
    }

    try {
      const productData = {
        ...currentProduct,
        sku: finalSKU
      };

      if (productsHook) {
        // Use Supabase hook
        if (isEditing && currentProduct.id) {
          // Strip stockLevels from product edits — stock must only change via
          // Logistics (Adjustment/Import/Transfer) to keep a proper audit trail.
          const { stockLevels: _sl, ...productWithoutStock } = productData as Product;
          await productsHook.updateProduct(currentProduct.id, productWithoutStock);
        } else {
          const newProduct = {
            ...productData,
            id: crypto.randomUUID(),
            stockLevels: productData.stockLevels || initializeEmptyStockLevels(warehouses),
            lastRestock: new Date().toISOString()
          } as Product;
          await productsHook.addProduct(newProduct);
        }
        await refreshProducts();
      } else {
        // Fallback to props (localStorage mode)
        if (isEditing && currentProduct.id) {
          props.onUpdateProduct?.(productData as Product);
        } else {
          const newProduct = {
            ...productData,
            id: crypto.randomUUID(),
            stockLevels: productData.stockLevels || initializeEmptyStockLevels(warehouses),
            lastRestock: new Date().toISOString()
          } as Product;
          props.onAddProduct?.(newProduct);
        }
      }
      setShowModal(false);
      toast.success(isEditing ? t('success_product_saved') : t('success_product_saved'));
    } catch (error: any) {
      toast.error(`${t('error_save_failed')}: ${error.message}`);
    }
  };

  const handleSubmitTransfer = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!transferringProduct) return;

      try {
        if (isAdjusting) {
          if (!adjustWarehouseId) {
            toast.error('Aucun entrepôt disponible. Créez un entrepôt d\'abord.');
            return;
          }
          if (!adjustReason) {
            toast.error(t('required_fields'));
            return;
          }
          const currentStock = getStockInWarehouse(transferringProduct, adjustWarehouseId);
          const adjPackSize = transferringProduct.unitsPerBox || 1;
          const adjUsesDual = adjPackSize > 1 && stockMigrated;
          const adjUsesBoxes = adjPackSize > 1 && !stockMigrated;
          const effectiveAdjQty = adjUsesDual
            ? adjustBoxes * adjPackSize + adjustLooseUnits
            : adjUsesBoxes
            ? adjustBoxes
            : adjustLooseUnits;
          if (effectiveAdjQty <= 0) {
            toast.error('La quantité doit être supérieure à 0');
            return;
          }
          if (adjustType === 'DECREASE' && effectiveAdjQty > currentStock) {
            const maxLabel = adjUsesDual
              ? `${Math.floor(currentStock / adjPackSize)} cais. +${currentStock % adjPackSize} uds`
              : adjUsesBoxes
              ? `${currentStock} caisses`
              : `${currentStock}`;
            toast.error(`${t('error_insufficient_stock')} (Max: ${maxLabel})`);
            return;
          }

          if (productsHook) {
            // Use Supabase hook for stock adjustment.
            // productName and companyId are passed so updateStock creates
            // an ADJUSTMENT transfer record — ensuring this quick adjustment
            // is visible in the Transfers history and counted by recalibration.
            const delta = adjustType === 'INCREASE' ? effectiveAdjQty : -effectiveAdjQty;
            const warehouseName = allWarehouses.find(w => w.id === adjustWarehouseId)?.name || adjustWarehouseId;
            await productsHook.updateStock(
              transferringProduct.id,
              adjustWarehouseId,
              delta,
              adjustReason,
              transferringProduct.name,
              props.currentUser?.companyId ?? null
            );
            await refreshProducts();
            const sign = delta > 0 ? '+' : '';
            toast.success(`${transferringProduct.name} · ${warehouseName}: ${sign}${delta} uds`);
          } else {
            // Fallback to props (localStorage mode) - use onTransfer
            const adjustment: Transfer = {
              id: crypto.randomUUID(),
              date: new Date().toISOString(),
              type: 'ADJUSTMENT',
              toWarehouseId: adjustWarehouseId,
              items: [{
                productId: transferringProduct.id,
                productName: transferringProduct.name,
                quantity: effectiveAdjQty
              }],
              status: 'Completed',
              reference: adjustType === 'INCREASE' ? 'ADJ+' : 'ADJ-',
              reason: adjustReason
            };
            props.onTransfer?.(adjustment);
          }
          setTransferringProduct(null);
          setIsAdjusting(false);
          return;
        }

        // Handle transfer between warehouses
        if (transferFromId === transferToId) {
          toast.error(t('error_same_warehouse'));
          return;
        }

        const availableStock = Math.floor(getStockInWarehouse(transferringProduct, transferFromId));
        const packSize = transferringProduct.unitsPerBox || 1;
        const usesDual = packSize > 1 && stockMigrated;
        const usesBoxes = packSize > 1 && !stockMigrated;
        const effectiveTransferUnits = usesDual
          ? transferBoxes * packSize + transferLooseUnits
          : usesBoxes
          ? transferBoxes
          : transferLooseUnits;
        if (effectiveTransferUnits <= 0) {
          toast.error('La quantité doit être supérieure à 0');
          return;
        }
        if (effectiveTransferUnits > availableStock) {
          const avail = usesDual
            ? `${Math.floor(availableStock / packSize)} cais. +${availableStock % packSize} uds`
            : usesBoxes
            ? `${availableStock} caisses`
            : `${availableStock}`;
          toast.error(`${t('error_insufficient_stock')} (Max: ${avail})`);
          return;
        }

        if (productsHook) {
          // Use Supabase hook for atomic transfer
          await productsHook.transferStock(
            transferringProduct.id,
            transferFromId,
            transferToId,
            effectiveTransferUnits,
            `Transfer from ${warehouses.find(w => w.id === transferFromId)?.name} to ${warehouses.find(w => w.id === transferToId)?.name}`
          );
          await refreshProducts();
        } else {
          // Fallback to props (localStorage mode)
          const newTransfer: Transfer = {
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            type: 'INTERNAL',
            fromWarehouseId: transferFromId,
            toWarehouseId: transferToId,
            items: [{
              productId: transferringProduct.id,
              productName: transferringProduct.name,
              quantity: effectiveTransferUnits
            }],
            status: 'Completed',
            reference: `QUICK-${Math.floor(Math.random() * 1000)}`
          };
          props.onTransfer?.(newTransfer);
        }
        setTransferringProduct(null);
        toast.success(isAdjusting ? t('success_product_saved') : t('success_transfer_completed'));
      } catch (error: any) {
        toast.error(`${t('error')}: ${error.message}`);
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('inventory')}</h1>
            <p className="text-sm text-slate-500 hidden sm:block">{t('manage_inventory_desc')}</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto flex-col sm:flex-row">
            <button
                onClick={handleOpenAdd}
                className="flex items-center justify-center px-4 py-3 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium w-full sm:w-auto text-sm"
            >
                <Plus className="w-4 h-4 me-2" />
                {t('add_product')}
            </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
            <div className={`absolute inset-y-0 ${dir === 'rtl' ? 'right-0 pr-3' : 'left-0 pl-3'} flex items-center pointer-events-none`}>
                <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
                ref={searchInputRef}
                type="text"
                placeholder={t('search_placeholder')}
                className={`w-full ${dir === 'rtl' ? 'pr-20 pl-4' : 'pl-10 pr-20'} py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm`}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { setSearchTerm(inputValue); setPage(1); }
                  if (e.key === 'Escape') { setInputValue(''); setSearchTerm(''); setPage(1); }
                }}
            />
            <div className={`absolute inset-y-0 ${dir === 'rtl' ? 'left-0 pl-1' : 'right-0 pr-1'} flex items-center gap-1`}>
              {inputValue && (
                <button
                  onClick={() => { setInputValue(''); setSearchTerm(''); setPage(1); }}
                  className="p-1 text-slate-400 hover:text-slate-600"
                  title="Effacer"
                >
                  <span className="text-xs font-bold">✕</span>
                </button>
              )}
              <button
                onClick={() => { setSearchTerm(inputValue); setPage(1); }}
                className="p-1 text-slate-400 hover:text-blue-600"
                title="Rechercher"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                onClick={() => startCamera((code) => { setInputValue(code); setSearchTerm(code); setPage(1); })}
                className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                title="Scan Barcode"
              >
                <ScanBarcode className="h-4 w-4" />
              </button>
            </div>
        </div>
        
        <div className="flex items-center space-x-3 w-full md:w-auto overflow-x-auto">
            <div className="flex items-center space-x-2 w-full md:w-auto">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                    className="w-full border-none bg-slate-50 text-sm font-medium text-slate-700 rounded-md p-2 focus:ring-0 cursor-pointer"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                >
                    {categories.map(c => <option key={c} value={c}>{c === 'All' ? t('all_categories') : c}</option>)}
                </select>
            </div>
            {suppliers.length > 0 && (
              <div className="flex items-center space-x-2 w-full md:w-auto">
                <select
                    className="w-full border-none bg-slate-50 text-sm font-medium text-slate-700 rounded-md p-2 focus:ring-0 cursor-pointer"
                    value={supplierFilter}
                    onChange={(e) => setSupplierFilter(e.target.value)}
                >
                    <option value="All">{t('all_suppliers')}</option>
                    {suppliers.filter(s => s.status === 'Active').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <button
                onClick={downloadCSVTemplate}
                className="hidden md:flex items-center px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors text-sm font-medium"
                title={t('download_template')}
            >
                <FileText className="w-4 h-4 mr-2" />
                {t('download_template')}
            </button>
            <button
                onClick={() => setShowImportModal(true)}
                className="hidden md:flex items-center px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors text-sm font-medium"
                title={t('import_products')}
            >
                <Upload className="w-4 h-4 mr-2" />
                {t('import_products')}
            </button>
            <button
                onClick={handleExportCSV}
                className="hidden md:flex items-center px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
                title={t('export_products')}
            >
                <Download className="w-4 h-4 mr-2" />
                {t('export_products')}
            </button>
            <button
                onClick={() => setBarcodePrintProducts(paginatedProducts)}
                className="hidden md:flex items-center px-3 py-2 bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors text-sm font-medium"
                title={t('print_labels')}
            >
                <Tag className="w-4 h-4 mr-2" />
                {t('labels')}
            </button>
        </div>
      </div>

      {/* Alert Banner for Low Stock */}
      {lowStockItems.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center text-rose-800">
                  <div className="bg-white p-1.5 rounded-full border border-rose-100 mr-3 shadow-sm">
                      <AlertTriangle className="w-5 h-5 text-rose-500" />
                  </div>
                  <div>
                      <span className="font-bold text-sm block">{lowStockItems.length} {t('low_stock_alert')}</span>
                      <span className="text-xs text-rose-600 opacity-90 hidden sm:inline">{t('restock_recommended')}</span>
                  </div>
              </div>
          </div>
      )}

      {/* Product List */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('product_name')} / SKU</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('supplier_ref_col')}</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('pack_size')}</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">{t('price')}</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">{t('stock')}</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('warehouse')}</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">{t('actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredBySupplier.map((product) => {
                        const stockLevels = product.stockLevels || {};
                        const totalStock = calculateTotalStock(product);
                        const isLowStock = isProductLowStock(product);

                        return (
                            <tr key={product.id} className={`hover:bg-slate-50 transition-colors group ${isLowStock ? 'bg-rose-50/40' : ''}`}>
                                <td className="px-6 py-4">
                                    <div className="flex items-center">
                                        <div className="h-10 w-10 shrink-0 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 me-4">
                                            <Package className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-colors">{product.name}</div>
                                            <div className="flex items-center space-x-2 mt-0.5">
                                                <span className="text-xs text-slate-500 font-mono bg-slate-100 px-1 rounded">{product.sku}</span>
                                                {isLowStock && <span className="inline-flex md:hidden text-[10px] text-rose-600 font-bold items-center"><AlertTriangle className="w-3 h-3 mr-0.5" /> {t('low_label')}</span>}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-medium text-slate-700">
                                            {suppliers.find(s => s.id === product.supplierId)?.name || <span className="text-slate-400">—</span>}
                                        </span>
                                        {product.supplierRef && <span className="text-xs text-slate-400 font-mono">{product.supplierRef}</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-800">{product.packSize} {product.unit}</span>
                                        <span className="text-xs text-slate-500">{product.viscosity}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="text-sm font-bold text-slate-900">{(product.price || 0).toFixed(2)} {CURRENCY}</div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className={`text-sm font-bold flex flex-col items-center justify-center ${isLowStock ? 'text-rose-600' : 'text-slate-900'}`}>
                                        <div className="flex items-center">
                                            {isLowStock && <AlertTriangle className="w-4 h-4 mr-1.5 animate-pulse text-rose-500" />}
                                            {formatStock(totalStock, product.unitsPerBox || 1, t('boxes_unit'), t('units_abbr'))}
                                        </div>
                                        {isLowStock && (
                                            <span className="text-[10px] font-medium bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded mt-1 border border-rose-200">
                                                {t('min_short')}: {product.minStock}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1">
                                        {warehouses.map(w => {
                                            const qty = stockLevels[w.id] || 0;
                                            if (qty === 0) return null;
                                            return (
                                                <span key={w.id} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200" title={w.name}>
                                                    {w.name.split(' ')[0]}: {stockMigrated ? formatStock(qty, product.unitsPerBox || 1, t('boxes_unit'), t('units_abbr')) : `${qty} ${t('boxes_unit')}`}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end space-x-2">
                                        <button onClick={() => handleOpenTransfer(product)} className="text-slate-400 hover:text-blue-600 transition-colors" title={t('move_stock')}>
                                            <ArrowRightLeft className="w-4 h-4" />
                                        </button>
                                        {isAdminOrManager && (
                                        <button onClick={() => handleDuplicate(product)} className="text-slate-400 hover:text-blue-600 transition-colors" title={t('duplicate')}>
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        )}
                                        <button onClick={() => setBarcodePrintProducts([product])} className="text-slate-400 hover:text-emerald-600 transition-colors" title={t('print_label')}>
                                            <Tag className="w-4 h-4" />
                                        </button>
                                        {isAdminOrManager && (
                                        <>
                                        <button onClick={() => handleOpenEdit(product)} className="text-slate-400 hover:text-blue-600 transition-colors">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => setProductToDelete(product)} className="text-slate-400 hover:text-rose-600 transition-colors" title={t('delete')}>
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    {filteredBySupplier.length === 0 && (
                        <tr>
                            <td colSpan={6} className="p-12 text-center text-slate-400 bg-slate-50/50">
                                <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="font-medium text-slate-500">{t('no_products_found')}</p>
                                <p className="text-xs">{t('add_first_product')}</p>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* Mobile Card List with Low Stock Indicators */}
      <div className="md:hidden grid grid-cols-1 gap-4">
          {filteredBySupplier.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200 border-dashed text-slate-400">
                  <p>{t('no_products_found')}</p>
                  <p className="text-xs mt-1">{t('add_first_product')}</p>
              </div>
          ) : (
              filteredBySupplier.map(product => {
                  const stockLevels = product.stockLevels || {};
                  const totalStock = calculateTotalStock(product);
                  const isLowStock = isProductLowStock(product);

                  return (
                      <div key={product.id} className={`bg-white p-4 rounded-xl border shadow-sm ${isLowStock ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200'}`}>
                          <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                  <h3 className="font-bold text-slate-900 text-sm line-clamp-2">{product.name}</h3>
                                  <p className="text-xs text-slate-500 font-mono mt-0.5">{product.sku}</p>
                              </div>
                              <div className={`flex flex-col items-end ${isLowStock ? 'text-rose-600' : 'text-slate-900'}`}>
                                  <span className="text-lg font-bold flex items-center">
                                      {isLowStock && <AlertTriangle className="w-4 h-4 mr-1" />}
                                      {formatStock(totalStock, product.unitsPerBox || 1, t('boxes_unit'), t('units_abbr'))}
                                  </span>
                                  <span className="text-xs text-slate-500">{product.packSize} {product.unit}</span>
                              </div>
                          </div>

                          {/* Per-warehouse stock breakdown */}
                          <div className="flex flex-wrap gap-1.5 mb-2">
                              {warehouses.map(w => {
                                  const qty = stockLevels[w.id] || 0;
                                  if (qty === 0) return null;
                                  return (
                                      <span key={w.id} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200" title={w.name}>
                                          {w.name.split(' ')[0]}: {formatStock(qty, product.unitsPerBox || 1, t('boxes_unit'), t('units_abbr'))}
                                      </span>
                                  );
                              })}
                          </div>

                          <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100">
                              <div className="text-sm font-bold text-slate-900">
                                  {(product.price || 0).toFixed(2)} {CURRENCY}
                              </div>
                              <div className="flex space-x-3">
                                  <button onClick={() => handleOpenTransfer(product)} className="text-slate-400 hover:text-blue-600">
                                      <ArrowRightLeft className="w-5 h-5" />
                                  </button>
                                  <button onClick={() => handleOpenEdit(product)} className="text-slate-400 hover:text-blue-600">
                                      <Pencil className="w-5 h-5" />
                                  </button>
                                  <button onClick={() => setProductToDelete(product)} className="text-slate-400 hover:text-rose-600">
                                      <Trash2 className="w-5 h-5" />
                                  </button>
                              </div>
                          </div>
                      </div>
                  )
              })
          )}
      </div>

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalCount} />

      {/* Add/Edit Product Modal */}
      {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900 bg-opacity-60 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
                  <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
                      <h3 className="text-lg font-bold text-slate-900">{isEditing ? t('edit') : t('add_product')}</h3>
                      <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                      {/* Name & SKU */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="col-span-1 md:col-span-2">
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('product_name')}</label>
                              <input 
                                required
                                type="text" 
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={currentProduct.name || ''}
                                onChange={(e) => setCurrentProduct({...currentProduct, name: e.target.value})}
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                {t('sku')}
                                <span className="text-xs font-normal text-slate-400 ml-1">(Auto)</span>
                              </label>
                              <input
                                type="text"
                                placeholder={!isEditing && currentProduct.category ? generateAutoSKU(currentProduct.category, products) : ''}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-emerald-500 placeholder:font-mono"
                                value={currentProduct.sku || ''}
                                onChange={(e) => setCurrentProduct({...currentProduct, sku: e.target.value.toUpperCase()})}
                              />
                              {!isEditing && !currentProduct.sku && currentProduct.category && (
                                <p className="text-xs text-emerald-600 mt-1 flex items-center">
                                  <span className="mr-1">✓</span>
                                  Se generará: <span className="font-mono font-bold ml-1">{generateAutoSKU(currentProduct.category, products)}</span>
                                </p>
                              )}
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Barcode</label>
                              <div className="relative">
                                <input 
                                    type="text" 
                                    className={`w-full border border-slate-300 rounded-lg ${dir === 'rtl' ? 'pr-3 pl-10' : 'pl-3 pr-10'} py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                                    value={currentProduct.barcode || ''}
                                    onChange={(e) => setCurrentProduct({...currentProduct, barcode: e.target.value})}
                                />
                                <button
                                    type="button"
                                    onClick={() => startCamera((code) => setCurrentProduct({...currentProduct, barcode: code}))}
                                    className={`absolute ${dir === 'rtl' ? 'left-2' : 'right-2'} top-2 text-slate-400 hover:text-blue-600`}
                                >
                                    <ScanBarcode className="w-4 h-4" />
                                </button>
                              </div>
                          </div>
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="col-span-2">
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('category')}</label>
                              <select 
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={currentProduct.category}
                                onChange={(e) => setCurrentProduct({...currentProduct, category: e.target.value as any})}
                              >
                                  {Object.values(ProductCategory).map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('viscosity')}</label>
                              <input 
                                type="text" 
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="e.g. 5W-40"
                                value={currentProduct.viscosity || ''}
                                onChange={(e) => setCurrentProduct({...currentProduct, viscosity: e.target.value})}
                              />
                          </div>
                          <div className="flex space-x-2">
                              <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('pack_size')}</label>
                                <input
                                    type="number"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    value={currentProduct.packSize || ''}
                                    onChange={(e) => setCurrentProduct({...currentProduct, packSize: parseFloat(e.target.value)})}
                                />
                              </div>
                              <div className="w-20">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('unit')}</label>
                                <select
                                    className="w-full border border-slate-300 rounded-lg px-1 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    value={currentProduct.unit}
                                    onChange={(e) => setCurrentProduct({...currentProduct, unit: e.target.value})}
                                >
                                    {units.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                              </div>
                              <div className="w-24">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('units_per_box') || 'U/Caja'}</label>
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    value={currentProduct.unitsPerBox || 1}
                                    onChange={(e) => setCurrentProduct({...currentProduct, unitsPerBox: parseInt(e.target.value) || 1})}
                                    placeholder="1"
                                />
                              </div>
                          </div>
                      </div>

                      {/* Pricing */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('price')} ({CURRENCY})</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={currentProduct.price || ''}
                                onChange={(e) => setCurrentProduct({...currentProduct, price: Math.max(0, parseFloat(e.target.value) || 0)})}
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('cost')} ({CURRENCY})</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={currentProduct.cost || ''}
                                onChange={(e) => setCurrentProduct({...currentProduct, cost: Math.max(0, parseFloat(e.target.value) || 0)})}
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('min_stock')}</label>
                              <input
                                type="number"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={currentProduct.minStock || ''}
                                onChange={(e) => setCurrentProduct({...currentProduct, minStock: parseFloat(e.target.value)})}
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fournisseur</label>
                              <select
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={currentProduct.supplierId || ''}
                                onChange={(e) => setCurrentProduct({...currentProduct, supplierId: e.target.value || undefined})}
                              >
                                <option value="">— Aucun —</option>
                                {suppliers.filter(s => s.status === 'Active').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Réf. fournisseur</label>
                              <input
                                type="text"
                                placeholder="Code article fournisseur..."
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={currentProduct.supplierRef || ''}
                                onChange={(e) => setCurrentProduct({...currentProduct, supplierRef: e.target.value || undefined})}
                              />
                          </div>
                      </div>

                      {/* Tier Pricing — Admin only */}
                      <div className={`p-4 rounded-lg border ${isAdmin ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="flex items-center gap-2 mb-3">
                              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Tarification par niveaux</span>
                              {isAdmin
                                ? <span className="text-xs text-amber-600">(optionnel — laissez vide pour désactiver)</span>
                                : <span className="text-xs text-slate-400 flex items-center gap-1">🔒 Admin uniquement</span>
                              }
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Prix VIP Niveau 1 ({CURRENCY}) TTC</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    disabled={!isAdmin}
                                    className={`w-full border rounded-lg px-3 py-2 text-sm font-bold focus:outline-none ${isAdmin ? 'border-amber-300 text-amber-900 focus:ring-2 focus:ring-amber-500 bg-white' : 'border-slate-200 text-slate-400 bg-slate-100 cursor-not-allowed'}`}
                                    placeholder="Prix catalogue VIP..."
                                    value={currentProduct.vipPrice ?? ''}
                                    onChange={(e) => isAdmin && setCurrentProduct({...currentProduct, vipPrice: e.target.value === '' ? undefined : Math.max(0, parseFloat(e.target.value) || 0)})}
                                  />
                                  {isAdmin && currentProduct.vipPrice && currentProduct.cost ? (
                                    <p className="text-xs text-amber-700 mt-1">
                                      Marge ≈ {(currentProduct.vipPrice - currentProduct.cost).toFixed(2)} DH
                                    </p>
                                  ) : null}
                                  {!isAdmin && currentProduct.vipPrice ? (
                                    <p className="text-xs text-slate-400 mt-1">{currentProduct.vipPrice.toFixed(2)} DH (lecture seule)</p>
                                  ) : null}
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Points / unité</label>
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    disabled={!isAdmin}
                                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${isAdmin ? 'border-amber-300 focus:ring-2 focus:ring-amber-500 bg-white' : 'border-slate-200 text-slate-400 bg-slate-100 cursor-not-allowed'}`}
                                    placeholder="1"
                                    value={currentProduct.points ?? 1}
                                    onChange={(e) => isAdmin && setCurrentProduct({...currentProduct, points: Math.max(0.01, parseFloat(e.target.value) || 1)})}
                                  />
                                  <p className="text-xs text-amber-600 mt-1">Ex: 1 = boîte, 10 = bidon 204L, 0.25 = petit cond.</p>
                              </div>
                          </div>
                      </div>

                      {/* Warehouse Initial Stock (Only for new products) */}
                      {!isEditing && (
                          <div className="border-t border-slate-200 pt-4">
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t('initial_stock')}</label>
                              <div className="grid grid-cols-2 gap-4">
                                  {warehouses.map(w => (
                                      <div key={w.id}>
                                          <label className="block text-xs text-slate-600 mb-1">{w.name}</label>
                                          <input 
                                            type="number"
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            value={currentProduct.stockLevels?.[w.id] || 0}
                                            onChange={(e) => setCurrentProduct({
                                                ...currentProduct,
                                                stockLevels: {
                                                    ...currentProduct.stockLevels,
                                                    [w.id]: parseInt(e.target.value) || 0
                                                }
                                            })}
                                          />
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </form>

                  <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end space-x-2">
                      <button 
                        onClick={() => setShowModal(false)}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                          {t('cancel')}
                      </button>
                      <button 
                        onClick={handleSubmit}
                        className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition-colors"
                      >
                          {t('save')}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* QUICK TRANSFER MODAL */}
      {transferringProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900 bg-opacity-60 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <h3 className="font-bold text-lg text-slate-900">{t('move_stock')} / {t('stock_adjustment')}</h3>
                      <button onClick={() => setTransferringProduct(null)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <div className="p-4">
                      <div className="flex items-center mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                          <Package className="w-8 h-8 text-blue-600 mr-3" />
                          <div>
                              <p className="font-bold text-slate-900">{transferringProduct.name}</p>
                              <p className="text-xs text-slate-500 font-mono">{transferringProduct.sku}</p>
                          </div>
                      </div>

                      {/* Mode Toggle */}
                      <div className="flex space-x-2 mb-4">
                          <button 
                            type="button" 
                            onClick={() => setIsAdjusting(false)}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg border ${!isAdjusting ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
                          >
                              {t('transfer_stock')}
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setIsAdjusting(true)}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg border ${isAdjusting ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200'}`}
                          >
                              {t('stock_adjustment')}
                          </button>
                      </div>

                      <form onSubmit={handleSubmitTransfer} className="space-y-4">
                          {isAdjusting ? (
                              <>
                                  <div className="grid grid-cols-2 gap-2">
                                      <button 
                                        type="button"
                                        onClick={() => setAdjustType('INCREASE')}
                                        className={`p-2 border rounded-lg text-xs font-bold text-center ${adjustType === 'INCREASE' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'text-slate-500'}`}
                                      >
                                          {t('add_to_list')} (+Qty)
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => setAdjustType('DECREASE')}
                                        className={`p-2 border rounded-lg text-xs font-bold text-center ${adjustType === 'DECREASE' ? 'bg-rose-50 border-rose-500 text-rose-700' : 'text-slate-500'}`}
                                      >
                                          {t('remove')} (-Qty)
                                      </button>
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('warehouse')}</label>
                                      <select 
                                          className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                                          value={adjustWarehouseId}
                                          onChange={(e) => setAdjustWarehouseId(e.target.value)}
                                      >
                                          {warehouses.map(w => (
                                              <option key={w.id} value={w.id}>{w.name} ({t('stock')}: {transferringProduct.stockLevels ? transferringProduct.stockLevels[w.id] || 0 : 0})</option>
                                          ))}
                                      </select>
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('quantity')}</label>
                                      {(() => {
                                        const ps = transferringProduct.unitsPerBox || 1;
                                        const usesDual = ps > 1 && stockMigrated;
                                        const usesBoxes = ps > 1 && !stockMigrated;
                                        const currentStock = Math.floor(getStockInWarehouse(transferringProduct, adjustWarehouseId));
                                        if (usesDual) {
                                          const maxLoose = adjustType === 'DECREASE' ? Math.max(0, currentStock - adjustBoxes * ps) : undefined;
                                          const total = adjustBoxes * ps + adjustLooseUnits;
                                          return (
                                            <>
                                              <div className="flex items-end gap-2">
                                                <div className="flex-1">
                                                  <label className="text-[10px] text-slate-500 font-semibold uppercase mb-1 block">📦 Caisses (×{ps})</label>
                                                  <input
                                                    type="number" min="0"
                                                    max={adjustType === 'DECREASE' ? Math.floor(currentStock / ps) : undefined}
                                                    className="w-full border border-slate-300 rounded-lg p-2 text-sm font-bold text-center"
                                                    value={adjustBoxes}
                                                    onChange={(e) => {
                                                      const b = Math.max(0, parseInt(e.target.value) || 0);
                                                      setAdjustBoxes(b);
                                                      if (adjustType === 'DECREASE')
                                                        setAdjustLooseUnits(prev => Math.min(prev, currentStock - b * ps));
                                                    }}
                                                  />
                                                </div>
                                                <span className="text-slate-400 font-bold pb-2.5">+</span>
                                                <div className="flex-1">
                                                  <label className="text-[10px] text-slate-500 font-semibold uppercase mb-1 block">Uds sueltas</label>
                                                  <input
                                                    type="number" min="0" max={maxLoose}
                                                    className="w-full border border-slate-300 rounded-lg p-2 text-sm font-bold text-center"
                                                    value={adjustLooseUnits}
                                                    onChange={(e) => setAdjustLooseUnits(Math.max(0, parseInt(e.target.value) || 0))}
                                                  />
                                                </div>
                                              </div>
                                              <div className={`mt-2 p-2 rounded-lg flex justify-between items-center ${adjustType === 'INCREASE' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                                                <span className={`text-xs ${adjustType === 'INCREASE' ? 'text-emerald-500' : 'text-rose-500'}`}>{adjustType === 'INCREASE' ? '+' : '-'}{total} uds</span>
                                                <span className={`text-sm font-bold ${adjustType === 'INCREASE' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                  → {formatStock(currentStock + (adjustType === 'INCREASE' ? total : -total), ps)}
                                                </span>
                                              </div>
                                            </>
                                          );
                                        }
                                        if (usesBoxes) {
                                          return (
                                            <>
                                              <div className="flex items-end gap-2">
                                                <div className="flex-1">
                                                  <label className="text-[10px] text-slate-500 font-semibold uppercase mb-1 block">📦 Caisses (×{ps})</label>
                                                  <input
                                                    type="number" min="1"
                                                    max={adjustType === 'DECREASE' ? currentStock : undefined}
                                                    className="w-full border border-slate-300 rounded-lg p-2 text-sm font-bold text-center"
                                                    value={adjustBoxes}
                                                    onChange={(e) => setAdjustBoxes(Math.max(1, parseInt(e.target.value) || 1))}
                                                  />
                                                </div>
                                                <span className="text-slate-400 font-bold pb-2.5">+</span>
                                                <div className="flex-1" title="Ejecuta la migración ⚙️ para habilitar unidades sueltas">
                                                  <label className="text-[10px] text-slate-400 font-semibold uppercase mb-1 block">Unités libres</label>
                                                  <input type="number" disabled value={0}
                                                    className="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold text-center bg-slate-50 text-slate-300 cursor-not-allowed"
                                                  />
                                                </div>
                                              </div>
                                              {adjustType === 'DECREASE' && <p className="text-xs text-slate-400 mt-1 text-right">Disponible : {currentStock} caisses · Activez la migration ⚙️ pour les unités libres</p>}
                                            </>
                                          );
                                        }
                                        return (
                                          <input
                                            type="number" min="1"
                                            className="w-full border border-slate-300 rounded-lg p-2 text-sm font-bold"
                                            value={adjustLooseUnits}
                                            onChange={(e) => setAdjustLooseUnits(Math.max(1, parseInt(e.target.value) || 1))}
                                          />
                                        );
                                      })()}
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('adjustment_reason')}</label>
                                      <input 
                                          type="text" 
                                          className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                                          placeholder={t('placeholder_reason')}
                                          value={adjustReason}
                                          onChange={(e) => setAdjustReason(e.target.value)}
                                          required
                                      />
                                  </div>
                              </>
                          ) : (
                              <>
                                  <div className="grid grid-cols-2 gap-4">
                                      <div>
                                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('source')}</label>
                                          <select
                                              className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                                              value={transferFromId}
                                              onChange={(e) => { setTransferFromId(e.target.value); setTransferBoxes(1); setTransferLooseUnits(0); }}
                                          >
                                              {warehouses.map(w => {
                                                  const qty = Math.floor(transferringProduct.stockLevels ? transferringProduct.stockLevels[w.id] || 0 : 0);
                                                  const ps = transferringProduct.unitsPerBox || 1;
                                                  const label = ps > 1 && stockMigrated
                                                    ? `${Math.floor(qty / ps)} cais. +${qty % ps} uds`
                                                    : ps > 1 ? `${qty} caj.` : `${qty} uds`;
                                                  return (
                                                      <option key={w.id} value={w.id} disabled={w.id === transferToId}>
                                                          {w.name} ({label})
                                                      </option>
                                                  );
                                              })}
                                          </select>
                                      </div>
                                      <div>
                                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('destination')}</label>
                                          <select
                                              className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                                              value={transferToId}
                                              onChange={(e) => setTransferToId(e.target.value)}
                                          >
                                              {warehouses.map(w => {
                                                  const qty = Math.floor(transferringProduct.stockLevels ? transferringProduct.stockLevels[w.id] || 0 : 0);
                                                  const displayPs = stockMigrated ? (transferringProduct.unitsPerBox || 1) : 1;
                                                  return (
                                                      <option key={w.id} value={w.id} disabled={w.id === transferFromId}>
                                                          {w.name} ({formatStock(qty, displayPs, t('boxes_unit'), t('units_abbr'))})
                                                      </option>
                                                  );
                                              })}
                                          </select>
                                      </div>
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('quantity')}</label>
                                      {(() => {
                                        const availStock = Math.floor(transferringProduct.stockLevels ? transferringProduct.stockLevels[transferFromId] || 0 : 0);
                                        const ps = transferringProduct.unitsPerBox || 1;
                                        const usesDual = ps > 1 && stockMigrated;
                                        const usesBoxes = ps > 1 && !stockMigrated;
                                        if (usesDual) {
                                          const maxBoxes = Math.floor(availStock / ps);
                                          const maxLoose = Math.max(0, availStock - transferBoxes * ps);
                                          const total = transferBoxes * ps + transferLooseUnits;
                                          return (
                                            <>
                                              <div className="flex items-end gap-2">
                                                <div className="flex-1">
                                                  <label className="text-[10px] text-slate-500 font-semibold uppercase mb-1 block">📦 Caisses (×{ps})</label>
                                                  <input
                                                    type="number" min="0" max={maxBoxes}
                                                    className="w-full border border-slate-300 rounded-lg p-2 text-sm font-bold text-center"
                                                    value={transferBoxes}
                                                    onChange={(e) => {
                                                      const b = Math.max(0, Math.min(parseInt(e.target.value) || 0, maxBoxes));
                                                      setTransferBoxes(b);
                                                      setTransferLooseUnits(prev => Math.min(prev, availStock - b * ps));
                                                    }}
                                                  />
                                                </div>
                                                <span className="text-slate-400 font-bold pb-2.5">+</span>
                                                <div className="flex-1">
                                                  <label className="text-[10px] text-slate-500 font-semibold uppercase mb-1 block">Uds sueltas</label>
                                                  <input
                                                    type="number" min="0" max={maxLoose}
                                                    className="w-full border border-slate-300 rounded-lg p-2 text-sm font-bold text-center"
                                                    value={transferLooseUnits}
                                                    onChange={(e) => setTransferLooseUnits(Math.max(0, Math.min(parseInt(e.target.value) || 0, maxLoose)))}
                                                  />
                                                </div>
                                              </div>
                                              <div className="mt-2 p-2 bg-indigo-50 rounded-lg flex justify-between items-center">
                                                <span className="text-xs text-indigo-500">Total a transferir</span>
                                                <span className="text-sm font-bold text-indigo-700">{total} unidades</span>
                                              </div>
                                              <p className="text-xs text-slate-400 mt-1 text-right">
                                                Disponible : {maxBoxes} cais. + {availStock % ps} unités ({availStock} unités)
                                              </p>
                                            </>
                                          );
                                        }
                                        if (usesBoxes) {
                                          return (
                                            <>
                                              <div className="flex items-end gap-2">
                                                <div className="flex-1">
                                                  <label className="text-[10px] text-slate-500 font-semibold uppercase mb-1 block">📦 Caisses (×{ps})</label>
                                                  <input
                                                    type="number" min="1" max={availStock}
                                                    className="w-full border border-slate-300 rounded-lg p-2 text-sm font-bold text-center"
                                                    value={transferBoxes}
                                                    onChange={(e) => setTransferBoxes(Math.max(1, Math.min(parseInt(e.target.value) || 1, availStock)))}
                                                  />
                                                </div>
                                                <span className="text-slate-400 font-bold pb-2.5">+</span>
                                                <div className="flex-1" title="Exécutez la migration ⚙️ dans l'Inventaire pour activer les unités libres">
                                                  <label className="text-[10px] text-slate-400 font-semibold uppercase mb-1 block">Unités libres</label>
                                                  <input type="number" disabled value={0}
                                                    className="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold text-center bg-slate-50 text-slate-300 cursor-not-allowed"
                                                  />
                                                </div>
                                              </div>
                                              <p className="text-xs text-slate-400 mt-1 text-right">Disponible : {availStock} caisses · Activez la migration ⚙️ pour les unités libres</p>
                                            </>
                                          );
                                        }
                                        return (
                                          <>
                                            <input
                                              type="number" min="1" max={availStock}
                                              className="w-full border border-slate-300 rounded-lg p-2 text-sm font-bold"
                                              value={transferLooseUnits}
                                              onChange={(e) => setTransferLooseUnits(Math.min(Math.max(1, parseInt(e.target.value) || 1), availStock))}
                                            />
                                            <p className="text-xs text-slate-400 mt-1 text-right">Max: {availStock}</p>
                                          </>
                                        );
                                      })()}
                                  </div>
                              </>
                          )}

                          <button 
                              type="submit" 
                              className={`w-full py-3 text-white rounded-lg font-bold shadow-md transition-colors ${isAdjusting ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                          >
                              {isAdjusting ? t('stock_adjustment') : t('transfer_stock')}
                          </button>
                      </form>
                  </div>
              </div>
          </div>
      )}

      {/* Camera Modal */}
      <CameraModal
        isOpen={isCameraOpen}
        videoRef={videoRef}
        onClose={stopCamera}
        onSimulateScan={handleSimulatedScan}
      />

      {/* CSV Import Modal */}
      {showImportModal && (
        <CSVImportModal
          onClose={() => setShowImportModal(false)}
          onImport={handleCSVImport}
          existingProducts={products}
        />
      )}

      {/* Barcode Labels Print Modal */}
      {barcodePrintProducts.length > 0 && (
        <BarcodeLabels
          products={barcodePrintProducts}
          onClose={() => setBarcodePrintProducts([])}
        />
      )}

      {/* Delete Product Confirmation */}
      <ConfirmDialog
        isOpen={!!productToDelete}
        title={t('confirm_delete')}
        message={productToDelete?.name || ''}
        confirmLabel={t('remove')}
        cancelLabel={t('cancel')}
        onConfirm={async () => {
          if (!productToDelete) return;
          try {
            await productsHook.deleteProduct(productToDelete.id);
            // If we deleted the last item on this page, go back one page
            if (paginatedProducts.length === 1 && page > 1) {
              setPage(page - 1);
            }
            await refreshProducts();
            await productsHook.refresh();
          } catch (error: any) {
            alert(`${t('error')}: ${error.message}`);
          } finally {
            setProductToDelete(null);
          }
        }}
        onCancel={() => setProductToDelete(null)}
      />
    </div>
  );
};

export default Inventory;
