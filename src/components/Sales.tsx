
import React, { useState, useRef, useEffect, lazy, Suspense, useMemo } from 'react';
import { Sale, Product, Warehouse, SaleItem, Customer, User, Payment, PaymentMethod, Return, ReturnItem, CompanySettings } from '../types';
import { FileText, User as UserIcon, Calendar, Plus, X, MapPin, ScanBarcode, Trash2, ShoppingCart, Briefcase, UserCircle, AlertCircle, Check, Phone, Building2, Printer, Share2, Navigation, Map, FileCheck, Percent, Camera, CreditCard, Banknote, History, Wallet, ArrowRight, Coins, Landmark, FileSignature, Undo2, Loader2, QrCode, FileSpreadsheet, Download, Filter, Search, Truck, CheckSquare, Tag, Pencil } from 'lucide-react';
import { CURRENCY } from '../constants';
import { useLanguage } from '../services/i18n';
import { Logo } from './Logo';
import { sortProducts, calculateItemTotal, exportToCSV, generateInvoiceNumber, formatStock } from '../utils/helpers';
import { TVA_RATES, getProductTaxRate, getVolumeTierForAmount, getItemVolumeDiscount } from '../utils/pricing';
import type { VolumeTier } from '../types';
// Lazy load PDF component (only loaded when printing)
const PrintableDocument = lazy(() => import('./PrintableDocument'));
import { useProducts, useWarehouses, useCustomers, useReturns } from '../hooks/useSupabaseData';
import { usePaginatedSales } from '../hooks/usePaginatedSales';
import { useSalesMutations } from '../hooks/useSalesMutations';
import { useCustomerUnpaidBalance } from '../hooks/useCustomerUnpaidBalance';
import { useDebounce } from '../hooks/useDebounce';
import { usePersistedString, usePersistedState } from '../hooks/usePersistedState';
import { Pagination } from './Pagination';
import { useInvoiceCalculationForSales } from '../hooks/useInvoiceCalculation';
import { useWarehouseSelectionForSales } from '../hooks/useWarehouseSelection';
import { generateDocumentNumber } from '../services/documentNumbering';
import { supabase } from '../services/supabaseClient';
import { logger } from '../utils/logger';
import { useStore } from '../store/useStore';

// Fallback props for when Supabase is disabled
interface SalesProps {
  sales?: Sale[];
  products?: Product[];
  warehouses?: Warehouse[];
  customers?: Customer[];
  currentUser: User;
  companySettings: CompanySettings;
  onNewSale?: (sale: Sale) => void;
  onRegisterPayment?: (saleId: string, payment: Payment) => void;
  onNewReturn: (newReturn: Return) => void;
  onUpdateSettings?: (settings: CompanySettings) => void;
}

const Sales: React.FC<SalesProps> = (props) => {
  const { t } = useLanguage();
  // Declare currentUser early — used in useMemo hooks below (avoid TDZ crash)
  const currentUser = props.currentUser;

  // ALWAYS call hooks (React rules - hooks must be called unconditionally)
  const salesMutations = useSalesMutations(); // lightweight: no data fetch, only mutations
  const productsHook = useProducts();
  const warehousesHook = useWarehouses();
  const customersHook = useCustomers();
  const returnsHook = useReturns();
  const { activeCompanyId, companyProfiles, setActiveCompany, userAssignedCompanyIds } = useStore();

  // Filter companies visible to this user: Admin sees all, others only their assigned ones
  const visibleCompanyProfiles = useMemo(() => {
    if (currentUser.role === 'Admin' || userAssignedCompanyIds.length === 0) return companyProfiles;
    return companyProfiles.filter(p => userAssignedCompanyIds.includes(p.id));
  }, [companyProfiles, currentUser.role, userAssignedCompanyIds]);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<Sale | null>(null);
  const [showReturnModal, setShowReturnModal] = useState<Sale | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [returnedItems, setReturnedItems] = useState<Record<string, number>>({});
  const [returnReason, setReturnReason] = useState('');
  const [viewingDocument, setViewingDocument] = useState<{sale: Sale, type: 'INVOICE' | 'DELIVERY_NOTE' | 'QUOTE'} | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null); // Sale being edited
  // Persisted filters
  const [searchTerm, setSearchTerm] = usePersistedString('sales_search', '');
  const [inputValue, setInputValue] = useState(searchTerm);
  const [statusFilter, setStatusFilter] = usePersistedState<'All' | 'Paid' | 'Unpaid' | 'Partial' | 'Returned' | 'Quote'>('sales_statusFilter', 'All');
  const [isQuoteMode, setIsQuoteMode] = useState(false);
  const [page, setPage] = useState(1);
  const [currentSaleItems, setCurrentSaleItems] = useState<SaleItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [checkNumber, setCheckNumber] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [bankName, setBankName] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [globalDiscountType, setGlobalDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [globalDiscountValue, setGlobalDiscountValue] = useState(0);
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const [editInvoiceNumber, setEditInvoiceNumber] = useState('');
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const [recentProducts, setRecentProducts] = useState<string[]>([]);
  const [showTierGrid, setShowTierGrid] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Use Supabase hook data directly
  const products = productsHook.products;
  const warehouses = warehousesHook.warehouses;
  const allCustomers = customersHook.customers;
  // Filter customers by active company (show company's customers + unassigned legacy)
  const customers = useMemo(() => {
    if (!activeCompanyId) return allCustomers;
    return allCustomers.filter(c => !c.companyId || c.companyId === activeCompanyId);
  }, [allCustomers, activeCompanyId]);
  const returns = returnsHook.returns;

  // ─── Volume Tier Pricing (invoice total → DH/box discount) ──────────────────
  const [manualVolumeTier, setManualVolumeTier] = useState<VolumeTier | null>(null);

  // Fetch volume tiers via SECURITY DEFINER RPC — bypasses RLS, works for all roles
  const [volumeTiers, setVolumeTiers] = useState<VolumeTier[]>([]);
  useEffect(() => {
    const companyId = activeCompanyId || companyProfiles[0]?.id;
    if (!companyId) return;
    supabase
      .rpc('get_company_volume_settings', { p_company_id: companyId })
      .single()
      .then(({ data }) => {
        const d = data as any;
        if (d?.volumeDiscountEnabled !== false && d?.volumeTiers?.length) setVolumeTiers(d.volumeTiers);
        else setVolumeTiers([]);
      });
  }, [activeCompanyId, companyProfiles]);

  // Gross total (pre-discount unit prices) to avoid feedback loop when discounts reduce total
  const grossInvoiceTotal = useMemo(() =>
    currentSaleItems.reduce((sum, item) => {
      const upb = item.sellMode === 'box' ? (item.unitsPerBox || 1) : 1;
      return sum + item.unitPrice * item.quantity * upb;
    }, 0),
  [currentSaleItems]);

  // Tier that the current invoice qualifies for automatically
  const invoiceTier = useMemo(
    () => volumeTiers.length > 0 ? getVolumeTierForAmount(grossInvoiceTotal, volumeTiers) : null,
    [grossInvoiceTotal, volumeTiers]
  );

  // Effective tier: invoice-based auto OR manually selected by seller
  const activeVolumeTier = invoiceTier || manualVolumeTier;

  // Reset manual tier when customer changes
  useEffect(() => {
    setManualVolumeTier(null);
  }, [selectedCustomerId]);

  // Welcome discount: -5 DH/box for first-time buyers (no prior sales)
  const [isFirstOrder, setIsFirstOrder] = useState(false);
  useEffect(() => {
    if (!selectedCustomerId) { setIsFirstOrder(false); return; }
    supabase
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', selectedCustomerId)
      .neq('document_type', 'QUOTE')
      .then(({ count }) => setIsFirstOrder((count ?? 0) === 0));
  }, [selectedCustomerId]);

  // Auto-apply tier discount to all items whenever the active tier changes
  useEffect(() => {
    if (editingSale || !activeVolumeTier) return;
    setCurrentSaleItems(prevItems => {
      if (prevItems.length === 0) return prevItems;
      let changed = false;
      const newItems = prevItems.map(item => {
        if (item.isGift) return item;
        const unitsPerBox = item.unitsPerBox || 1;
        const discountPerUnit = getItemVolumeDiscount(activeVolumeTier, item.sellMode || 'unit', unitsPerBox);
        const effectivePrice = item.sellMode === 'box' ? item.unitPrice * unitsPerBox : item.unitPrice;
        // Cost floor: non-Admin cannot have final price below product cost.
        // Admin is exempt so they can configure tiers that go to cost price or below.
        const product = products.find(p => p.id === item.productId);
        const costTTC = product?.cost || 0;
        const maxDisc = (costTTC > 0 && currentUser.role !== 'Admin')
          ? Math.max(0, item.unitPrice - costTTC)   // cap at cost
          : Math.max(0, item.unitPrice - 0.01);      // fallback: avoid negative
        // Store 4dp so ×upb rounds to exact DH/colis
        const capped = Math.round(Math.min(discountPerUnit, maxDisc) * 10000) / 10000;
        if (item.discount === capped && item.discountType === 'fixed') return item;
        changed = true;
        return {
          ...item,
          discount: capped,
          discountType: 'fixed' as const,
          total: calculateItemTotal(item.quantity, effectivePrice, calcEffectiveDiscount(capped, 'fixed', item.sellMode, item.unitsPerBox), 'fixed'),
        };
      });
      return changed ? newItems : prevItems;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingSale, activeVolumeTier]);

  // Unified warehouse selection hooks (eliminates duplication)
  const warehouseSelection = useWarehouseSelectionForSales(currentUser, warehouses);
  const returnWarehouseSelection = useWarehouseSelectionForSales(currentUser, warehouses);
  const saleWarehouseSelection = useWarehouseSelectionForSales(currentUser, warehouses);

  const selectedWarehouseId = warehouseSelection.selectedWarehouseId;

  // Server-side paginated sales for the listing
  const { sales: paginatedSales, totalCount, loading: salesLoading, error: salesError, refresh: refreshSales } = usePaginatedSales({
    page,
    pageSize: 25,
    search: searchTerm,
    statusFilter,
    warehouseId: selectedWarehouseId
  });

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [searchTerm, statusFilter, selectedWarehouseId]);
  const setSelectedWarehouseId = warehouseSelection.setSelectedWarehouseId;
  const returnWarehouseId = returnWarehouseSelection.selectedWarehouseId;
  const setReturnWarehouseId = returnWarehouseSelection.setSelectedWarehouseId;
  const saleWarehouseId = saleWarehouseSelection.selectedWarehouseId;
  const setSaleWarehouseId = saleWarehouseSelection.setSelectedWarehouseId;

  const companySettings = props.companySettings;
  const onNewReturn = props.onNewReturn;

  // Personal stats for Sales role — computed from all their visible sales
  const salesRepStats = useMemo(() => {
    if (currentUser.role !== 'Sales') return null;
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const allSales = props.sales || [];
    const activeSales = allSales.filter(s => s.documentType !== 'QUOTE' && s.status !== 'Cancelled' && s.returnStatus !== 'full');
    const monthSales = activeSales.filter(s => s.date?.startsWith(thisMonth));
    const totalVendido = activeSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalCobrado = activeSales.reduce((sum, s) => sum + s.amountPaid, 0);
    const totalPendiente = totalVendido - totalCobrado;
    const clientesActivos = new Set(activeSales.map(s => s.customerId)).size;
    return { monthCount: monthSales.length, totalVendido, totalCobrado, totalPendiente, clientesActivos };
  }, [props.sales, currentUser.role]);

  // Use consolidated invoice calculation hook (eliminates duplication)
  // IMPORTANT: Must be called before any conditional returns (Rules of Hooks)
  const totals = useInvoiceCalculationForSales(
    currentSaleItems,
    globalDiscountType,
    globalDiscountValue
  );

  // Keep calculateTotal as wrapper for backward compatibility
  const calculateTotal = () => totals;

  // Discount limits — respects per-user discountLimit override from profiles table
  const maxLineDiscPct = currentUser.discountLimit !== undefined
    ? currentUser.discountLimit
    : (currentUser.role === 'Admin' ? 100 : currentUser.role === 'Manager' ? 50 : 15);
  const maxGlobalDiscPct = currentUser.discountLimit !== undefined
    ? currentUser.discountLimit
    : (currentUser.role === 'Admin' ? 100 : currentUser.role === 'Manager' ? 50 : 20);

  // Calculate customer credit status for new sales (server-side query, not loading all sales)
  const customerCreditStatus = useCustomerUnpaidBalance(selectedCustomerId || null, totals.total);

  // Keyboard shortcut: Ctrl+F to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && showModal) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal]);

  // Only block on salesLoading for the initial load (no data yet).
  // During re-fetches (e.g. company filter change), keep showing existing rows
  // instead of replacing them with a full-screen spinner.
  const loading = (salesLoading && paginatedSales.length === 0) ||
                  productsHook.loading ||
                  warehousesHook.loading ||
                  customersHook.loading;
  const error = salesError ||
                productsHook.error ||
                warehousesHook.error ||
                customersHook.error;

  // Server-side pagination values
  const pageSize = 25;
  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + paginatedSales.length, totalCount);

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
        {(productsHook || warehousesHook || customersHook) && (
          <button
            onClick={() => {
              refreshSales();
              productsHook?.refresh();
              warehousesHook?.refresh();
              customersHook?.refresh();
            }}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
          >
            {t('retry')}
          </button>
        )}
      </div>
    );
  }

  // Export Logic
  const handleExportCSV = () => {
    const headers = [
        "Date", 
        "Ref", 
        "Customer", 
        "Type", 
        "Items Summary", 
        "Total Amount", 
        "Paid", 
        "Payment Status", 
        "Warehouse"
    ];

    const rows = paginatedSales.map(s => {
        const itemsSummary = s.items ? s.items.map(i => `${i.quantity}x ${i.productName}`).join('; ') : '';
        const warehouseName = warehouses.find(w => w.id === s.warehouseId)?.name || s.warehouseId;
        
        return [
            new Date(s.date).toLocaleDateString(),
            s.id,
            `"${s.customerName}"`,
            s.customerType,
            `"${itemsSummary.replace(/"/g, '""')}"`,
            s.totalAmount.toFixed(2),
            s.amountPaid.toFixed(2),
            s.paymentStatus,
            `"${warehouseName}"`
        ].join(",");
    });

    exportToCSV(`VENTES_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  const addItemToSale = (product: Product) => {
      // In edit mode, allow adding same product as new line (for traceability)
      // In normal mode, block duplicates
      if (!editingSale) {
          const existing = currentSaleItems.find(i => i.productId === product.id);
          if (existing) {
              alert(t('item_in_cart_adjust'));
              return;
          }
      }
      const unitsPerBox = product.unitsPerBox || 1;
      const hasBoxOption = unitsPerBox > 1;
      const stockUnits = product.stockLevels ? product.stockLevels[saleWarehouseId] || 0 : 0;
      const unitsForOneItem = hasBoxOption ? unitsPerBox : 1;
      if (!isQuoteMode && stockUnits < unitsForOneItem) {
          alert(t('out_of_stock'));
          return;
      }
      const sellMode: 'unit' | 'box' = 'unit';
      const basePrice = product.price;
      const effectivePrice = basePrice;

      // Apply volume tier discount when adding an item (if customer qualifies)
      // Cost floor: non-Admin → final price cannot go below product cost
      const costTTC = product.cost || 0;
      const maxDiscByBase = Math.max(0, basePrice - 0.01); // absolute floor: no negative prices
      const maxDiscByCost = (costTTC > 0 && currentUser.role !== 'Admin')
        ? Math.max(0, basePrice - costTTC)  // cap at cost
        : maxDiscByBase;
      const maxDiscountAllowed = Math.min(maxDiscByBase, maxDiscByCost);

      let itemDiscount = 0;
      let itemDiscountType: 'percentage' | 'fixed' = 'fixed';
      if (activeVolumeTier) {
          const discountPerUnit = getItemVolumeDiscount(activeVolumeTier, sellMode, unitsPerBox);
          // Cap against per-unit base price AND cost floor, store 4dp so ×upb rounds to exact DH/colis
          itemDiscount = Math.round(Math.min(discountPerUnit, maxDiscountAllowed) * 10000) / 10000;
          itemDiscountType = 'fixed';
      } else if (isFirstOrder && !isQuoteMode && !editingSale) {
          // Welcome discount: -5 DH/box for first-time buyers (also capped at cost floor)
          const discountPerUnit = Math.round((5 / (unitsPerBox || 1)) * 10000) / 10000;
          itemDiscount = Math.min(discountPerUnit, maxDiscountAllowed);
          itemDiscountType = 'fixed';
      }

      setCurrentSaleItems([...currentSaleItems, {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: basePrice,
          discount: itemDiscount,
          discountType: itemDiscountType,
          total: calculateItemTotal(1, effectivePrice, calcEffectiveDiscount(itemDiscount, 'fixed', sellMode, unitsPerBox), itemDiscountType),
          sellMode,
          unitsPerBox
      }]);
      setItemSearch('');
      setSelectedSearchIndex(0);

      // Track recent products (last 10)
      setRecentProducts(prev => {
          const updated = [product.id, ...prev.filter(id => id !== product.id)];
          return updated.slice(0, 10);
      });
  };

  // When selling by box with a fixed DH discount, user enters DH/unit → multiply by unitsPerBox
  const calcEffectiveDiscount = (discount: number, discountType: 'percentage' | 'fixed', sellMode: 'unit' | 'box' | undefined, unitsPerBox: number | undefined) => {
      if ((sellMode === 'box') && discountType === 'fixed') {
          return discount * (unitsPerBox || 1);
      }
      return discount;
  };

  const updateItem = (index: number, field: keyof SaleItem, value: number | string) => {
      const item = currentSaleItems[index];

      if (field === 'quantity') {
          const product = products.find(p => p.id === item.productId);
          const stockUnits = product && product.stockLevels ? product.stockLevels[saleWarehouseId] || 0 : 0;
          const packSize = item.unitsPerBox || 1;
          const maxQty = item.sellMode === 'box' ? Math.floor(stockUnits / packSize) : stockUnits;
          if (!isQuoteMode && Number(value) > maxQty) {
              alert(`${t('insufficient_stock_max')} ${maxQty} ${item.sellMode === 'box' ? t('boxes_unit') : t('units_abbr')}`);
              return;
          }
      }

      // Cost floor: clamp discount so final price never goes below product cost (Admin exempt)
      if (field === 'discount' && !item.isGift && currentUser.role !== 'Admin') {
          const product = products.find(p => p.id === item.productId);
          if (product && product.cost > 0) {
              const costTTC = product.cost; // cost is stored as TTC in this system
              const pricePerUnit = item.unitPrice; // TTC per unit
              const discountType = item.discountType || 'percentage';
              let maxAllowed: number;
              if (discountType === 'percentage') {
                  maxAllowed = pricePerUnit > 0 ? Math.max(0, ((pricePerUnit - costTTC) / pricePerUnit) * 100) : 0;
                  if (Number(value) > maxAllowed) {
                      alert(t('alert_max_disc_pct').replace('{pct}', maxAllowed.toFixed(1)).replace('{cost}', costTTC.toFixed(2)));
                      value = Math.floor(maxAllowed * 10) / 10;
                  }
              } else {
                  maxAllowed = Math.max(0, pricePerUnit - costTTC);
                  if (Number(value) > maxAllowed) {
                      alert(t('alert_max_disc_dh').replace('{dh}', maxAllowed.toFixed(2)).replace('{cost}', costTTC.toFixed(2)));
                      value = Math.floor(maxAllowed * 100) / 100;
                  }
              }
          }
      }

      // Create new object with updated field (React requires immutable updates)
      const updatedItem = { ...item, [field]: value };
      // Gift items always have total = 0 regardless of quantity
      if (updatedItem.isGift) {
          updatedItem.total = 0;
      } else {
          // Use effective price based on sell mode
          const effectivePrice = updatedItem.sellMode === 'box'
              ? updatedItem.unitPrice * (updatedItem.unitsPerBox || 1)
              : updatedItem.unitPrice;
          // Fixed DH discount: user enters per-unit value → multiply by unitsPerBox for box mode
          const effectiveDiscount = calcEffectiveDiscount(updatedItem.discount, updatedItem.discountType || 'percentage', updatedItem.sellMode, updatedItem.unitsPerBox);
          updatedItem.total = calculateItemTotal(
              updatedItem.quantity,
              effectivePrice,
              effectiveDiscount,
              updatedItem.discountType || 'percentage'
          );
      }

      const newItems = currentSaleItems.map((it, i) => i === index ? updatedItem : it);
      setCurrentSaleItems(newItems);
  };

  const toggleItemDiscountType = (index: number) => {
      const item = currentSaleItems[index];
      const isCurrentlyPercent = (item.discountType || 'percentage') === 'percentage';
      const newType: 'percentage' | 'fixed' = isCurrentlyPercent ? 'fixed' : 'percentage';
      const effectivePrice = item.sellMode === 'box' ? item.unitPrice * (item.unitsPerBox || 1) : item.unitPrice;

      // Convert discount value instead of resetting to 0
      let convertedDiscount = 0;
      if (isCurrentlyPercent && item.discount > 0) {
          // % → DH: multiply effectivePrice by percentage (per unit)
          convertedDiscount = item.sellMode === 'box'
              ? item.unitPrice * (item.discount / 100)   // DH per unit
              : effectivePrice * (item.discount / 100);  // DH per unit
      } else if (!isCurrentlyPercent && item.discount > 0) {
          // DH → %: divide by effectivePrice
          const dhPerUnit = item.sellMode === 'box' ? item.discount * (item.unitsPerBox || 1) : item.discount;
          convertedDiscount = effectivePrice > 0 ? (dhPerUnit / effectivePrice) * 100 : 0;
      }

      const effectiveForTotal = calcEffectiveDiscount(convertedDiscount, newType, item.sellMode, item.unitsPerBox);
      const updatedItem: SaleItem = {
          ...item,
          discountType: newType,
          discount: Math.round(convertedDiscount * 10000) / 10000,
          total: calculateItemTotal(item.quantity, effectivePrice, effectiveForTotal, newType)
      };

      const newItems = currentSaleItems.map((it, i) => i === index ? updatedItem : it);
      setCurrentSaleItems(newItems);
  };

  const toggleSellMode = (index: number) => {
      const item = currentSaleItems[index];
      const product = products.find(p => p.id === item.productId);
      if (!product) return;

      const stockUnits = product.stockLevels ? product.stockLevels[saleWarehouseId] || 0 : 0;
      const boxQty = item.unitsPerBox || 1;
      const currentMode = item.sellMode || 'unit';
      const newMode: 'unit' | 'box' = currentMode === 'box' ? 'unit' : 'box';

      // Convert quantity when switching modes
      let newQty: number;
      if (currentMode === 'box' && newMode === 'unit') {
          newQty = item.quantity * boxQty;
      } else {
          newQty = Math.max(1, Math.floor(item.quantity / boxQty));
      }

      // Cap to available stock (quotes are exempt — can quote any quantity)
      if (!isQuoteMode) {
          const maxInNewMode = newMode === 'box' ? Math.floor(stockUnits / boxQty) : stockUnits;
          if (newQty > maxInNewMode) newQty = Math.max(1, maxInNewMode);
      }

      const effectivePrice = newMode === 'box' ? item.unitPrice * boxQty : item.unitPrice;
      const updatedItem: SaleItem = {
          ...item,
          sellMode: newMode,
          quantity: newQty,
          discount: 0, // Reset discount on mode switch to avoid confusion
          total: calculateItemTotal(newQty, effectivePrice, 0, item.discountType || 'percentage')
      };

      const newItems = currentSaleItems.map((it, i) => i === index ? updatedItem : it);
      setCurrentSaleItems(newItems);
  };

  const toggleGift = (index: number) => {
      const item = currentSaleItems[index];
      const newIsGift = !item.isGift;
      const effectivePrice = item.sellMode === 'box' ? item.unitPrice * (item.unitsPerBox || 1) : item.unitPrice;
      const updatedItem: SaleItem = {
          ...item,
          isGift: newIsGift,
          discount: 0,
          discountType: 'percentage',
          total: newIsGift ? 0 : calculateItemTotal(item.quantity, effectivePrice, 0)
      };
      setCurrentSaleItems(currentSaleItems.map((it, i) => i === index ? updatedItem : it));
  };

  const removeItem = (index: number) => {
      setCurrentSaleItems(currentSaleItems.filter((_, i) => i !== index));
  };

  const handleCreateSale = async (e: React.FormEvent) => {
      e.preventDefault();
      // Prevent double submission
      if (isSubmitting) return;

      if (!selectedCustomerId || currentSaleItems.length === 0) {
          alert(t('select_customer_add_items'));
          return;
      }

      // Credit limit enforcement: require confirmation from Admin/Manager
      if (customerCreditStatus?.wouldExceed) {
          if (!['Admin', 'Manager'].includes(currentUser.role)) {
              alert(t('alert_credit_blocked').replace('{avail}', customerCreditStatus.availableCredit.toFixed(2)).replace('{limit}', customerCreditStatus.creditLimit.toFixed(2)));
              return;
          }
          if (!confirm(t('alert_credit_confirm').replace('{avail}', customerCreditStatus.availableCredit.toFixed(2)).replace('{limit}', customerCreditStatus.creditLimit.toFixed(2)))) {
              return;
          }
      }

      // Hard cost floor check before submission (Admin exempt)
      for (const item of currentSaleItems) {
          if (item.isGift) continue;
          if (currentUser.role === 'Admin') continue;
          const product = products.find(p => p.id === item.productId);
          if (!product || product.cost <= 0) continue;
          const costTTC = product.cost; // cost is stored as TTC in this system
          const pricePerUnit = item.unitPrice;
          const discountType = item.discountType || 'percentage';
          const finalPrice = discountType === 'percentage'
              ? pricePerUnit * (1 - item.discount / 100)
              : pricePerUnit - item.discount;
          if (finalPrice < costTTC - 0.01) {
              alert(t('alert_below_cost').replace('{product}', item.productName).replace('{price}', finalPrice.toFixed(2)).replace('{cost}', costTTC.toFixed(2)));
              return;
          }
      }

      setIsSubmitting(true);

      const customer = customers.find(c => c.id === selectedCustomerId)!;
      const taxRate = TVA_RATES.STANDARD; // 20%

      // Reuse already calculated totals (no duplication)
      const invoice = {
        itemsSubtotal: totals.itemsSubtotal,
        globalDiscountAmount: totals.globalDiscountAmount,
        subtotalAfterGlobalDiscount: totals.subtotal,
        totalHT: totals.subtotal,
        totalTVA: totals.tax,
        totalTTC: totals.total
      };

      try {
        // EDIT QUOTE MODE: Update existing presupuesto (no stock touch)
        if (editingSale && editingSale.documentType === 'QUOTE') {
          await salesMutations.updateQuote(
            editingSale.id,
            {
              date: saleDate ? `${saleDate}T12:00:00.000Z` : editingSale.date,
              warehouseId: saleWarehouseId,
              customerId: customer.id,
              customerName: customer.name,
              customerType: customer.type,
              source: editingSale.source || 'B2B',
              documentType: 'QUOTE',
              isFastSale: false,
              companyId: editingSale.companyId || null,
              invoiceNumber: editingSale.invoiceNumber,
              globalDiscountType: globalDiscountValue > 0 ? globalDiscountType : undefined,
              globalDiscountValue: globalDiscountValue > 0 ? globalDiscountValue : undefined,
              globalDiscountAmount: invoice.globalDiscountAmount,
              itemsSubtotal: invoice.itemsSubtotal,
              subtotalAmount: invoice.subtotalAfterGlobalDiscount,
              taxRate: taxRate,
              taxAmount: invoice.totalTVA,
              totalAmount: invoice.totalTTC,
              amountPaid: 0,
              paymentStatus: 'Unpaid',
              payments: [],
              creditedAmount: 0,
              status: 'Pending',
            } as any,
            currentSaleItems
          );
        // EDIT MODE: Update existing sale
        } else if (editingSale) {
          await salesMutations.updateSaleItems(
            editingSale.id,
            currentSaleItems,
            {
              itemsSubtotal: invoice.itemsSubtotal,
              globalDiscountAmount: invoice.globalDiscountAmount,
              subtotalAmount: invoice.subtotalAfterGlobalDiscount,
              taxAmount: invoice.totalTVA,
              totalAmount: invoice.totalTTC
            },
            currentUser.id,
            saleDate ? `${saleDate}T12:00:00.000Z` : undefined,
            editInvoiceNumber || undefined
          );
        } else if (isQuoteMode) {
          // QUOTE MODE: create presupuesto — no invoice number, no stock deduction
          const [saleDateYear, saleDateMonth] = saleDate
            ? saleDate.split('-').map(Number)
            : [new Date().getFullYear(), new Date().getMonth() + 1];
          const companyId = activeCompanyId || currentUser.companyId || null;
          const quoteNumber = await generateDocumentNumber('QUOTE', companyId, saleDateYear, saleDateMonth);

          const newQuote: Omit<Sale, 'id'> = {
              invoiceNumber: quoteNumber,
              date: saleDate ? `${saleDate}T12:00:00.000Z` : new Date().toISOString(),
              warehouseId: saleWarehouseId,
              customerId: customer.id,
              customerName: customer.name,
              customerType: customer.type,
              items: currentSaleItems,
              source: 'B2B',
              documentType: 'QUOTE',
              isFastSale: false,
              companyId,
              globalDiscountType: globalDiscountValue > 0 ? globalDiscountType : undefined,
              globalDiscountValue: globalDiscountValue > 0 ? globalDiscountValue : undefined,
              globalDiscountAmount: invoice.globalDiscountAmount,
              itemsSubtotal: invoice.itemsSubtotal,
              subtotalAmount: invoice.subtotalAfterGlobalDiscount,
              taxRate: taxRate,
              taxAmount: invoice.totalTVA,
              totalAmount: invoice.totalTTC,
              amountPaid: 0,
              paymentStatus: 'Unpaid',
              payments: [],
              creditedAmount: 0,
              status: 'Pending'
          };

          await salesMutations.createQuote(newQuote, currentUser.id);
        } else {
          // CREATE MODE: New sale — always BL. FAC only on explicit customer request via "BL → Facture".
          const docType: 'INVOICE' | 'DELIVERY_NOTE' = 'DELIVERY_NOTE';

          const [saleDateYear, saleDateMonth] = saleDate
            ? saleDate.split('-').map(Number)
            : [new Date().getFullYear(), new Date().getMonth() + 1];
          const companyId = activeCompanyId || currentUser.companyId || null;
          let docNumber: string | undefined;
          try {
            docNumber = await generateDocumentNumber(docType, companyId, saleDateYear, saleDateMonth);
          } catch (error) {
            logger.error('Failed to generate document number, using fallback', error);
            docNumber = undefined;
          }

          const newSale: Omit<Sale, 'id'> = {
              invoiceNumber: undefined,
              deliveryNoteNumber: docNumber,
              date: saleDate ? `${saleDate}T12:00:00.000Z` : new Date().toISOString(),
              warehouseId: saleWarehouseId,
              customerId: customer.id,
              customerName: customer.name,
              customerType: customer.type,
              items: currentSaleItems,
              source: 'B2B',
              documentType: docType,
              isFastSale: false,
              companyId,
              globalDiscountType: globalDiscountValue > 0 ? globalDiscountType : undefined,
              globalDiscountValue: globalDiscountValue > 0 ? globalDiscountValue : undefined,
              globalDiscountAmount: invoice.globalDiscountAmount,
              itemsSubtotal: invoice.itemsSubtotal,
              subtotalAmount: invoice.subtotalAfterGlobalDiscount,
              taxRate: taxRate,
              taxAmount: invoice.totalTVA,
              totalAmount: invoice.totalTTC,
              amountPaid: 0,
              paymentStatus: 'Unpaid',
              payments: [],
              creditedAmount: 0,
              status: 'Completed'
          };

          await salesMutations.createSale(newSale, currentUser.id);
        }

        await Promise.all([refreshSales(), productsHook.refresh()]);
        // Reset form state
        setShowModal(false);
        setEditingSale(null);
        setIsQuoteMode(false);
        setCurrentSaleItems([]);
        setSelectedCustomerId('');
        setManualVolumeTier(null);
        setGlobalDiscountType('percentage');
        setGlobalDiscountValue(0);
        setSaleDate(new Date().toISOString().split('T')[0]);
      } catch (error: any) {
        alert(`${t('error')}: ${error.message}`);
      } finally {
        setIsSubmitting(false);
      }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!showPaymentModal) return;
      if (!['Admin', 'Manager', 'Accountant', 'Sales'].includes(currentUser.role)) {
          alert('Action non autorisée.');
          return;
      }

      // Validate payment amount
      if (!paymentAmount || paymentAmount <= 0) {
        alert('Le montant doit être supérieur à 0');
        return;
      }

      const remaining = Math.max(0, showPaymentModal.totalAmount - showPaymentModal.amountPaid - (showPaymentModal.creditedAmount || 0));
      if (paymentAmount > remaining + 0.01) {
        alert(`Le paiement (${paymentAmount.toFixed(2)}) dépasse le solde restant (${remaining.toFixed(2)})`);
        return;
      }

      // Validate Check/Traite payments require additional fields
      if ((paymentMethod === 'Check' || paymentMethod === 'Traite') && (!checkNumber.trim() || !dueDate)) {
        alert(t('check_traite_require_number_date') || 'Check/Traite payments require number and due date');
        return;
      }

      const payment: Omit<Payment, 'id'> = {
          date: new Date().toISOString(),
          amount: paymentAmount,
          method: paymentMethod,
          checkNumber: (paymentMethod === 'Check' || paymentMethod === 'Traite') ? checkNumber : undefined,
          bankName: (paymentMethod === 'Check' || paymentMethod === 'Traite' || paymentMethod === 'Bank Transfer') ? (bankName || undefined) : undefined,
          dueDate: (paymentMethod === 'Check' || paymentMethod === 'Traite') ? dueDate : undefined,
          // Set payment status based on method
          paymentStatus: (paymentMethod === 'Check' || paymentMethod === 'Traite') ? 'Pending' : 'Cashed',
          reference: paymentReference || undefined,
          recordedBy: currentUser.id
      };

      try {
        await salesMutations.registerPayment(showPaymentModal.id, payment);


        await refreshSales();
        setShowPaymentModal(null);
        setPaymentAmount(0);
        setCheckNumber('');
        setDueDate('');
        setBankName('');
        setPaymentReference('');
      } catch (error: any) {
        alert(`${t('error')}: ${error.message}`);
      }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!showReturnModal) return;

      const itemsToReturn: ReturnItem[] = [];
      Object.entries(returnedItems).forEach(([pId, qty]) => {
          // Explicitly cast to number to handle TS inference issues
          const quantity = qty as number;
          if (quantity > 0) {
              const productName = showReturnModal.items.find(i => i.productId === pId)?.productName || '';
              itemsToReturn.push({ productId: pId, productName, quantity });
          }
      });

      if (itemsToReturn.length === 0) {
          alert("No items selected for return.");
          return;
      }

      // ✅ VALIDATION: Check that we're not returning more than what was sold
      let validationError = '';
      for (const returnItem of itemsToReturn) {
          const originalItem = showReturnModal.items.find(i => i.productId === returnItem.productId);
          if (!originalItem) {
              validationError = `Product ${returnItem.productName} not found in original order`;
              break;
          }

          // ⚠️ CRITICAL: Validate return quantity is not GREATER than original
          if (returnItem.quantity > originalItem.quantity) {
              validationError = `❌ CRITICAL: Cannot return ${returnItem.quantity} units of "${returnItem.productName}". ` +
                  `Only ${originalItem.quantity} were sold!`;
              break;
          }

          // Calculate already returned quantity for this product
          const alreadyReturned = returns
              .filter(ret => ret.originalSaleId === showReturnModal.id)
              .flatMap(ret => ret.items || [])
              .filter(item => item.productId === returnItem.productId)
              .reduce((sum, item) => sum + item.quantity, 0);

          const totalReturnedIfApproved = alreadyReturned + returnItem.quantity;

          if (totalReturnedIfApproved > originalItem.quantity) {
              validationError = `Cannot return ${returnItem.quantity} units of "${returnItem.productName}". ` +
                  `Sold: ${originalItem.quantity}, Already returned: ${alreadyReturned}, ` +
                  `Available to return: ${originalItem.quantity - alreadyReturned}`;
              break;
          }
      }

      if (validationError) {
          alert(validationError);
          return;
      }

      const newReturn: Omit<Return, 'id'> = {
          date: new Date().toISOString(),
          originalSaleId: showReturnModal.id,
          customerId: showReturnModal.customerId,
          customerName: showReturnModal.customerName,
          items: itemsToReturn,
          reason: returnReason,
          warehouseId: returnWarehouseId
      };

      try {
        if (returnsHook) {
          // Use Supabase hook to create return
          await returnsHook.createReturn(newReturn);
          await Promise.all([refreshSales(), productsHook.refresh()]);
        } else {
          // Fallback to props (localStorage mode)
          const returnWithId = { ...newReturn, id: crypto.randomUUID() } as Return;
          onNewReturn(returnWithId);
        }
        setShowReturnModal(null);
        setReturnedItems({});
        setReturnReason('');
      } catch (error: any) {
        alert(`${t('error')}: ${error.message}`);
      }
  };

  const handleReturnAll = () => {
      if (!showReturnModal) return;
      const allItems: Record<string, number> = {};
      showReturnModal.items.forEach(item => {
          // Subtract already-returned quantities to prevent over-return
          const alreadyReturned = returns
              .filter(ret => ret.originalSaleId === showReturnModal.id)
              .flatMap(ret => ret.items || [])
              .filter(ri => ri.productId === item.productId)
              .reduce((sum, ri) => sum + ri.quantity, 0);
          const availableToReturn = item.quantity - alreadyReturned;
          if (availableToReturn > 0) {
              allItems[item.productId] = availableToReturn;
          }
      });
      setReturnedItems(allItems);
  };

  const handleConfirmQuote = async (quote: Sale) => {
      if (!confirm('Confirmer ce devis et créer un Bon de Livraison ?')) return;
      try {
          const [qYear, qMonth] = quote.date.split('T')[0].split('-').map(Number);
          const companyId = quote.companyId || activeCompanyId || currentUser.companyId || null;
          const blNumber = await generateDocumentNumber('DELIVERY_NOTE', companyId, qYear, qMonth);
          await salesMutations.confirmQuote(quote, blNumber, currentUser.id);
          await Promise.all([refreshSales(), productsHook.refresh()]);
          alert(`Bon de Livraison ${blNumber} créé avec succès`);
      } catch (err: any) {
          alert('Erreur: ' + (err.message || 'Échec de la confirmation'));
      }
  };

  const handleDeleteQuote = async (quoteId: string) => {
      if (!confirm('Supprimer ce presupuesto? Cette action est irréversible.')) return;
      try {
          await salesMutations.deleteQuote(quoteId);
          await refreshSales();
      } catch (err: any) {
          alert('Erreur: ' + (err.message || 'Échec de la suppression'));
      }
  };

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'Paid': return 'bg-emerald-100 text-emerald-800';
          case 'Partial': return 'bg-amber-100 text-amber-800';
          case 'Unpaid': return 'bg-rose-100 text-rose-800';
          default: return 'bg-slate-100 text-slate-800';
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
         <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('sales')}</h1>
            <p className="text-sm text-slate-500">{t('manage_b2b_desc')}</p>
         </div>
         <div className="flex gap-2 w-full sm:w-auto">
             <button
                onClick={() => { setIsQuoteMode(false); setSaleDate(new Date().toISOString().split('T')[0]); setShowModal(true); }}
                className="flex items-center justify-center px-4 py-3 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm font-medium flex-1 sm:flex-none text-sm"
             >
                 <Plus className="w-4 h-4 mr-2" />
                 {currentUser.role === 'Sales' ? 'Nouveau BL' : t('new_sale')}
             </button>
             <button
                onClick={() => { setIsQuoteMode(true); setSaleDate(new Date().toISOString().split('T')[0]); setShowModal(true); }}
                className="flex items-center justify-center px-4 py-3 sm:py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 shadow-sm font-medium flex-1 sm:flex-none text-sm"
             >
                 <FileText className="w-4 h-4 mr-2" />
                 Presupuesto
             </button>
         </div>
      </div>

      {/* Sales rep personal dashboard */}
      {salesRepStats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
            <p className="text-xs text-blue-500 font-medium uppercase tracking-wide">Ce mois</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">{salesRepStats.monthCount}</p>
            <p className="text-xs text-blue-400">BL / FAC</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Vendu</p>
            <p className="text-lg font-bold text-slate-800 mt-1">{salesRepStats.totalVendido.toLocaleString('fr-MA')} DH</p>
            <p className="text-xs text-slate-400">total cumulé</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
            <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Encaissé</p>
            <p className="text-lg font-bold text-emerald-700 mt-1">{salesRepStats.totalCobrado.toLocaleString('fr-MA')} DH</p>
            <p className="text-xs text-emerald-400">réglé</p>
          </div>
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-center">
            <p className="text-xs text-rose-500 font-medium uppercase tracking-wide">En attente</p>
            <p className="text-lg font-bold text-rose-700 mt-1">{salesRepStats.totalPendiente.toLocaleString('fr-MA')} DH</p>
            <p className="text-xs text-rose-400">à encaisser</p>
          </div>
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
            <p className="text-xs text-violet-500 font-medium uppercase tracking-wide">Clients</p>
            <p className="text-2xl font-bold text-violet-700 mt-1">{salesRepStats.clientesActivos}</p>
            <p className="text-xs text-violet-400">actifs</p>
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:w-96">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                    type="text"
                    placeholder={t('search_placeholder')}
                    className="pl-10 pr-16 py-2 w-full border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { setSearchTerm(inputValue); setPage(1); }
                      if (e.key === 'Escape') { setInputValue(''); setSearchTerm(''); setPage(1); }
                    }}
                />
                {inputValue && (
                  <button
                    onClick={() => { setInputValue(''); setSearchTerm(''); setPage(1); }}
                    className="absolute inset-y-0 right-8 flex items-center pr-1 text-slate-400 hover:text-slate-600"
                    title="Effacer"
                  >
                    <span className="text-xs font-bold">✕</span>
                  </button>
                )}
                <button
                  onClick={() => { setSearchTerm(inputValue); setPage(1); }}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-blue-600"
                  title="Rechercher"
                >
                  <Search className="h-4 w-4" />
                </button>
            </div>
            
            <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <select 
                    className="border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                    <option value="All">{t('all_invoices')}</option>
                    <option value="Paid">{t('paid')}</option>
                    <option value="Partial">{t('partial')}</option>
                    <option value="Unpaid">{t('unpaid')}</option>
                    <option value="Returned">🔄 {t('returned') || 'Devuelto'}</option>
                    <option value="Quote">📋 Presupuestos</option>
                </select>
                <button
                    onClick={handleExportCSV}
                    className="flex items-center px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium whitespace-nowrap"
                >
                    <Download className="w-4 h-4 mr-2" />
                    {t('export_csv')}
                </button>
                {visibleCompanyProfiles.length > 0 && (
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                        <select
                            className="border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium text-slate-700 min-w-[130px]"
                            value={activeCompanyId || ''}
                            onChange={(e) => setActiveCompany(e.target.value || null)}
                        >
                            {visibleCompanyProfiles.length > 1 && currentUser.role === 'Admin' && (
                                <option value="">{t('all_companies') || 'Toutes les entreprises'}</option>
                            )}
                            {visibleCompanyProfiles.map(p => (
                                <option key={p.id} value={p.id}>{p.profileName}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
          {paginatedSales.length === 0 ? (
              <div className="text-center p-12 bg-white rounded-xl border border-slate-200 border-dashed flex flex-col items-center justify-center text-slate-400">
                  <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
                  <p>{t('no_products_found')}</p>
                  <p className="text-sm">{t('new_sale')}</p>
              </div>
          ) : (
              paginatedSales.map(sale => {
                  const isFullyReturned = (sale as any).returnStatus === 'full';
                  const hasAnyReturn = !!(sale as any).returnStatus; // 'full' or 'partial'
                  const isQuote = sale.documentType === 'QUOTE';
                  return (
                  <div key={sale.id} className={`rounded-xl border shadow-sm overflow-hidden transition-shadow ${isFullyReturned ? 'bg-slate-50 border-slate-300 opacity-60' : isQuote ? 'bg-violet-50 border-violet-200 hover:shadow-md' : 'bg-white border-slate-200 hover:shadow-md'}`}>
                      <div className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="flex items-start gap-4">
                              <div className={`p-3 rounded-lg shrink-0 ${isFullyReturned ? 'bg-slate-100 text-slate-400' : sale.customerType === 'Professional' ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'}`}>
                                  {sale.customerType === 'Professional' ? <Briefcase className="w-6 h-6" /> : <UserIcon className="w-6 h-6" />}
                              </div>
                              <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                      <h3 className={`font-bold ${isFullyReturned ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{sale.customerName}</h3>
                                      <span className="text-xs text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{sale.invoiceNumber || sale.deliveryNoteNumber || `#${sale.id.slice(0, 8)}...`}</span>
                                      {(() => {
                                        const c = customers.find(cu => cu.id === sale.customerId);
                                        if (!c?.latitude) return null;
                                        return (
                                          <div className="flex gap-1">
                                            <a href={`https://www.google.com/maps?q=${c.latitude},${c.longitude}`} target="_blank" rel="noopener noreferrer"
                                              className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-700 hover:bg-blue-200">Maps</a>
                                            <a href={`https://waze.com/ul?ll=${c.latitude},${c.longitude}&navigate=yes`} target="_blank" rel="noopener noreferrer"
                                              className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-cyan-100 text-cyan-700 hover:bg-cyan-200">Waze</a>
                                          </div>
                                        );
                                      })()}
                                  </div>
                                  <div className="text-sm text-slate-500 mt-1 flex flex-wrap gap-x-4">
                                      <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" /> {new Date(sale.date).toLocaleDateString()}</span>
                                      <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" /> {warehouses.find(w => w.id === sale.warehouseId)?.name}</span>
                                      {!activeCompanyId && sale.companyId && (
                                        <span className="flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
                                          <Building2 className="w-3 h-3 mr-1" />
                                          {companyProfiles.find(c => c.id === sale.companyId)?.profileName || 'Empresa'}
                                        </span>
                                      )}
                                  </div>
                              </div>
                          </div>

                          <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                              <div className="text-right">
                                  <span className={`block text-2xl font-bold ${isFullyReturned ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{sale.totalAmount.toFixed(2)} <span className="text-sm text-slate-400">{CURRENCY}</span></span>
                                  {(() => {
                                      const reste = Math.max(0, sale.totalAmount - sale.amountPaid - (sale.creditedAmount || 0));
                                      return reste > 0.01 ? (
                                          <p className="text-xs font-bold text-orange-600 mt-0.5">
                                              Reste: {reste.toFixed(2)} <span className="font-normal text-orange-400">{CURRENCY}</span>
                                          </p>
                                      ) : null;
                                  })()}
                                  <div className="flex items-center justify-end gap-2 mt-1">
                                      {isQuote ? (
                                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">
                                              DEVIS
                                          </span>
                                      ) : (
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getStatusBadge(sale.paymentStatus)}`}>
                                          {t(sale.paymentStatus.toLowerCase())}
                                      </span>
                                      )}
                                      {/* Return Status Badge */}
                                      {(sale as any).returnStatus === 'full' ? (
                                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-600 text-white tracking-wide">
                                              ANNULÉE
                                          </span>
                                      ) : (sale as any).returnStatus === 'partial' ? (
                                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 flex items-center">
                                              <Undo2 className="w-3 h-3 mr-1" /> Avoir partiel
                                          </span>
                                      ) : sale.creditedAmount > 0 ? (
                                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 flex items-center">
                                              <Undo2 className="w-3 h-3 mr-1" /> Avoir
                                          </span>
                                      ) : null}
                                  </div>
                              </div>
                          </div>
                      </div>

                      {/* Quick Actions Bar */}
                      <div className={`p-3 border-t flex flex-wrap gap-2 justify-end ${isQuote ? 'bg-violet-50 border-violet-100' : 'bg-slate-50 border-slate-100'}`}>
                          {isQuote ? (
                              <>
                                  <button
                                      onClick={() => setViewingDocument({sale, type: 'QUOTE' as any})}
                                      className="flex items-center px-3 py-1.5 bg-white border border-violet-200 text-violet-700 rounded-md text-sm font-medium hover:bg-violet-50 shadow-sm"
                                  >
                                      <Printer className="w-3 h-3 mr-2" /> PDF Devis
                                  </button>
                                  {['Admin', 'Manager'].includes(props.currentUser.role) && (
                                  <button
                                      onClick={() => {
                                          setEditingSale(sale);
                                          setIsQuoteMode(true);
                                          setSelectedCustomerId(sale.customerId);
                                          setCurrentSaleItems([...sale.items]);
                                          setGlobalDiscountType(sale.globalDiscountType || 'percentage');
                                          setGlobalDiscountValue(sale.globalDiscountValue || 0);
                                          setSaleWarehouseId(sale.warehouseId);
                                          setSaleDate(sale.date ? sale.date.split('T')[0] : new Date().toISOString().split('T')[0]);
                                          setShowModal(true);
                                      }}
                                      className="flex items-center px-3 py-1.5 bg-violet-600 text-white rounded-md text-sm font-medium hover:bg-violet-700 shadow-sm"
                                  >
                                      <Pencil className="w-3 h-3 mr-2" /> Modifier
                                  </button>
                                  )}
                                  <button
                                      onClick={() => handleConfirmQuote(sale)}
                                      className="flex items-center px-3 py-1.5 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 shadow-sm"
                                  >
                                      <Check className="w-3 h-3 mr-2" /> Confirmer
                                  </button>
                                  <button
                                      onClick={() => handleDeleteQuote(sale.id)}
                                      className="flex items-center px-3 py-1.5 bg-rose-600 text-white rounded-md text-sm font-medium hover:bg-rose-700 shadow-sm"
                                  >
                                      <Trash2 className="w-3 h-3 mr-2" /> Supprimer
                                  </button>
                              </>
                          ) : (
                          <>
                          <button
                              onClick={() => setViewingDocument({sale, type: 'INVOICE'})}
                              className="flex items-center px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 shadow-sm"
                          >
                              <Printer className="w-3 h-3 mr-2" /> {t('invoice')}
                          </button>
                          <button
                              onClick={() => setViewingDocument({sale, type: 'DELIVERY_NOTE'})}
                              className="flex items-center px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 shadow-sm"
                          >
                              <Truck className="w-3 h-3 mr-2" /> {t('delivery_note')}
                          </button>
                          {/* Convert BL → Invoice button */}
                          {sale.documentType === 'DELIVERY_NOTE' && !sale.invoiceNumber && ['Admin', 'Manager'].includes(props.currentUser.role) && (
                          <button
                              onClick={async () => {
                                  try {
                                      const companyId = sale.companyId || activeCompanyId || currentUser.companyId || null;
                                      const [blYear, blMonth] = sale.date.split('T')[0].split('-').map(Number);
                                      const suggested = await generateDocumentNumber('INVOICE', companyId, blYear, blMonth);
                                      const finalNumber = window.prompt('Numéro de facture (modifiable):', suggested);
                                      if (!finalNumber || !finalNumber.trim()) return;
                                      const { error } = await supabase
                                          .from('sales')
                                          .update({
                                              document_type: 'INVOICE',
                                              invoice_number: finalNumber.trim(),
                                          })
                                          .eq('id', sale.id);
                                      if (error) throw error;
                                      await refreshSales();
                                  } catch (err: any) {
                                      alert('Erreur: ' + (err.message || 'Échec de la conversion'));
                                  }
                              }}
                              className="flex items-center px-3 py-1.5 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 shadow-sm"
                          >
                              <FileCheck className="w-3 h-3 mr-2" /> BL → Facture
                          </button>
                          )}
                          {['Admin', 'Manager', 'Accountant'].includes(props.currentUser.role) && !hasAnyReturn && (
                          <button
                              onClick={() => {
                                  setEditingSale(sale);
                                  setSelectedCustomerId(sale.customerId);
                                  setCurrentSaleItems([...sale.items]);
                                  setGlobalDiscountType(sale.globalDiscountType || 'percentage');
                                  setGlobalDiscountValue(sale.globalDiscountValue || 0);
                                  setSaleWarehouseId(sale.warehouseId);
                                  setSaleDate(sale.date ? sale.date.split('T')[0] : new Date().toISOString().split('T')[0]);
                                  setEditInvoiceNumber(sale.invoiceNumber || '');
                                  setShowModal(true);
                              }}
                              className="flex items-center px-3 py-1.5 rounded-md text-sm font-medium shadow-sm bg-blue-600 text-white hover:bg-blue-700"
                          >
                              <Pencil className="w-3 h-3 mr-2" /> {t('edit') || 'Modifier'}
                          </button>
                          )}
                          {sale.paymentStatus !== 'Paid' && !isQuote && ['Admin', 'Manager', 'Accountant', 'Sales'].includes(currentUser.role) && (
                              <button
                                  onClick={() => {
                                      setShowPaymentModal(sale);
                                      setPaymentAmount(Math.max(0, sale.totalAmount - sale.amountPaid - (sale.creditedAmount || 0)));
                                  }}
                                  className="flex items-center px-3 py-1.5 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 shadow-sm"
                              >
                                  <Banknote className="w-3 h-3 mr-2" /> {t('register_payment')}
                              </button>
                          )}
                          {!isFullyReturned && !isQuote && (
                          <button
                              onClick={() => {
                                  setShowReturnModal(sale);
                                  setReturnWarehouseId(sale.warehouseId);
                              }}
                              className="flex items-center px-3 py-1.5 bg-rose-600 text-white rounded-md text-sm font-medium hover:bg-rose-700 shadow-sm"
                          >
                              <Undo2 className="w-3 h-3 mr-2" /> {t('process_return')}
                          </button>
                          )}
                          </>
                          )}
                      </div>
                  </div>
              );})
          )}
      </div>

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalCount} />

      {/* NEW/EDIT SALE MODAL */}
      {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900 bg-opacity-60 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden max-h-[95vh] flex flex-col">
                  <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
                      <h3 className="text-lg font-bold text-slate-900">
                          {editingSale && editingSale.documentType === 'QUOTE' ? (
                              <span className="flex items-center gap-2">
                                  <Pencil className="w-5 h-5 text-violet-600" />
                                  Modifier Devis - {editingSale.invoiceNumber || editingSale.id.slice(0, 8)}
                              </span>
                          ) : editingSale ? (
                              <span className="flex items-center gap-2">
                                  <Pencil className="w-5 h-5 text-blue-600" />
                                  {t('edit_invoice') || 'Modifier Facture'} - {editingSale.invoiceNumber || editingSale.id.slice(0, 8)}
                              </span>
                          ) : isQuoteMode ? (
                              <span className="flex items-center gap-2">
                                  <FileText className="w-5 h-5 text-violet-600" />
                                  Nouveau Devis
                              </span>
                          ) : (
                              <span className="flex items-center gap-2">
                                  <Truck className="w-5 h-5 text-blue-600" />
                                  Nouveau Bon de Livraison
                              </span>
                          )}
                      </h3>
                      <button onClick={() => { setShowModal(false); setEditingSale(null); setIsQuoteMode(false); setManualVolumeTier(null); }} className="text-slate-400 hover:text-slate-600">
                          <X className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6">
                      {/* Header Selection */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">{t('select_customer')}</label>
                              <select
                                  className={`w-full border border-slate-300 rounded-lg p-2.5 text-sm ${editingSale && editingSale.documentType !== 'QUOTE' ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                                  value={selectedCustomerId}
                                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                                  disabled={!!editingSale && editingSale.documentType !== 'QUOTE'}
                              >
                                  <option value="">-- {t('select_customer')} --</option>
                                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
                              </select>
                              {isFirstOrder && selectedCustomerId && !editingSale && !isQuoteMode && (
                                  <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 w-fit">
                                      ⭐ {t('first_order_promo')}
                                  </div>
                              )}
                              {selectedCustomerId && volumeTiers.length > 0 && !editingSale && (
                                  <div className="mt-1.5 text-xs">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                          {[...volumeTiers].sort((a, b) => a.minAmount - b.minAmount).map(vt => {
                                              const unlocked = grossInvoiceTotal >= vt.minAmount;
                                              const isAuto = invoiceTier?.id === vt.id;
                                              const isManual = manualVolumeTier?.id === vt.id;
                                              const missing = vt.minAmount - grossInvoiceTotal;
                                              if (unlocked) {
                                                  return (
                                                      <button
                                                          key={vt.id}
                                                          onClick={() => setManualVolumeTier(isManual ? null : vt)}
                                                          className={`px-2 py-0.5 rounded-full border text-xs font-semibold transition-colors ${isAuto ? 'bg-amber-500 text-white border-amber-500' : isManual ? 'bg-violet-600 text-white border-violet-600' : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'}`}
                                                          title={isAuto ? 'Appliqué automatiquement' : 'Cliquer pour appliquer'}
                                                      >
                                                          {isAuto ? '✓ ' : ''}{vt.label} — {vt.discountPerBox} DH/colis
                                                      </button>
                                                  );
                                              }
                                              return (
                                                  <span
                                                      key={vt.id}
                                                      className="px-2 py-0.5 rounded-full border text-xs font-medium bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
                                                      title={`Encore ${missing.toLocaleString('fr-MA')} ${companySettings.currencySymbol || 'DH'} pour débloquer`}
                                                  >
                                                      🔒 {vt.label} — {vt.discountPerBox} {companySettings.currencySymbol || 'DH'} ({missing.toLocaleString('fr-MA')} {companySettings.currencySymbol || 'DH'} manquants)
                                                  </span>
                                              );
                                          })}
                                      </div>
                                  </div>
                              )}
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">{t('warehouse')}</label>
                              <select
                                  className={`w-full border border-slate-300 rounded-lg p-2.5 text-sm ${editingSale && editingSale.documentType !== 'QUOTE' ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                                  value={saleWarehouseId}
                                  onChange={(e) => setSaleWarehouseId(e.target.value)}
                                  disabled={!!editingSale && editingSale.documentType !== 'QUOTE'}
                              >
                                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">
                                  Date facture
                                  {saleDate && new Date(saleDate).getMonth() !== new Date().getMonth() && (
                                      <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">mois passé</span>
                                  )}
                              </label>
                              <input
                                  type="date"
                                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                                  value={saleDate}
                                  onChange={(e) => setSaleDate(e.target.value)}
                              />
                          </div>
                          {editingSale && (
                              <div>
                                  <label className="block text-sm font-medium text-slate-700 mb-1">
                                      N° Facture
                                  </label>
                                  <input
                                      type="text"
                                      className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-mono"
                                      value={editInvoiceNumber}
                                      placeholder="FAC-2026-00001"
                                      onChange={(e) => setEditInvoiceNumber(e.target.value)}
                                  />
                              </div>
                          )}
                      </div>

                      {/* Recent & Frequent Products */}
                      {(recentProducts.length > 0 || currentSaleItems.length === 0) && (
                          <div className="mb-4 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                              <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wide flex items-center">
                                      <History className="w-3 h-3 mr-1" />
                                      {recentProducts.length > 0 ? t('recent_products') || 'Recientes' : t('frequent_products') || 'Frecuentes'}
                                  </span>
                                  <span className="text-xs text-blue-500">Ctrl+F para buscar</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                  {(recentProducts.length > 0
                                      ? recentProducts.slice(0, 8).map(id => products.find(p => p.id === id)).filter((p): p is Product => !!p)
                                      : sortProducts(products).slice(0, 10)
                                  ).map((product) => {
                                      const stock = product.stockLevels ? product.stockLevels[saleWarehouseId] || 0 : 0;
                                      return (
                                          <button
                                              key={product.id}
                                              onClick={() => addItemToSale(product)}
                                              disabled={!isQuoteMode && stock <= 0}
                                              className="px-3 py-1.5 bg-white rounded-lg border border-blue-200 hover:border-blue-500 hover:bg-blue-50 text-xs font-medium text-slate-700 hover:text-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 group"
                                          >
                                              <span className="truncate max-w-[120px]">{product.name}</span>
                                              <span className={`text-[10px] font-bold ${stock > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>({formatStock(stock, product.unitsPerBox || 1)})</span>
                                          </button>
                                      );
                                  })}
                              </div>
                          </div>
                      )}

                      {/* Product Adder */}
                      <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <label className="block text-sm font-medium text-slate-700 mb-2">{t('add_product_label')}</label>
                          <div className="relative">
                              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                              <input
                                  ref={searchInputRef}
                                  type="text"
                                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder={t('search_by_name_sku')}
                                  value={itemSearch}
                                  onChange={(e) => {
                                      setItemSearch(e.target.value);
                                      setSelectedSearchIndex(0);
                                  }}
                                  onKeyDown={(e) => {
                                      const filteredProds = sortProducts(products)
                                          .filter(p => {
                                              const search = itemSearch.toLowerCase();
                                              return p.name.toLowerCase().includes(search) ||
                                                     p.sku.toLowerCase().includes(search) ||
                                                     p.category?.toLowerCase().includes(search);
                                          });

                                      if (e.key === 'ArrowDown') {
                                          e.preventDefault();
                                          setSelectedSearchIndex(prev => Math.min(prev + 1, filteredProds.length - 1));
                                      } else if (e.key === 'ArrowUp') {
                                          e.preventDefault();
                                          setSelectedSearchIndex(prev => Math.max(prev - 1, 0));
                                      } else if (e.key === 'Enter' && filteredProds[selectedSearchIndex]) {
                                          e.preventDefault();
                                          addItemToSale(filteredProds[selectedSearchIndex]);
                                      } else if (e.key === 'Escape') {
                                          setItemSearch('');
                                          setSelectedSearchIndex(0);
                                      }
                                  }}
                              />
                              {itemSearch && (
                                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 max-h-60 overflow-y-auto z-10">
                                      {sortProducts(products)
                                          .filter(p => {
                                              const search = itemSearch.toLowerCase();
                                              return p.name.toLowerCase().includes(search) ||
                                                     p.sku.toLowerCase().includes(search) ||
                                                     p.category?.toLowerCase().includes(search);
                                          })
                                          .map((p, idx) => {
                                              const stock = p.stockLevels ? p.stockLevels[saleWarehouseId] || 0 : 0;
                                              const isSelected = idx === selectedSearchIndex;
                                              return (
                                                  <button
                                                      key={p.id}
                                                      onClick={() => addItemToSale(p)}
                                                      className={`w-full text-left px-4 py-3 border-b border-slate-50 last:border-0 flex justify-between items-center group transition-colors ${
                                                          isSelected ? 'bg-blue-100 border-blue-200' : 'hover:bg-blue-50'
                                                      }`}
                                                  >
                                                      <div className="flex-1 min-w-0">
                                                          <p className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-slate-900 group-hover:text-blue-700'}`}>{p.name}</p>
                                                          <p className="text-xs text-slate-500">
                                                              SKU: {p.sku} • {p.category} • {p.packSize}{p.unit}
                                                          </p>
                                                      </div>
                                                      <div className="text-right ml-3">
                                                          <p className="text-sm font-bold text-slate-900">{p.price} {CURRENCY}</p>
                                                          <p className={`text-xs font-medium ${stock > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                              Stock: {formatStock(stock, p.unitsPerBox || 1)}
                                                          </p>
                                                      </div>
                                                  </button>
                                              );
                                          })}
                                  </div>
                              )}
                          </div>
                      </div>

                      {/* Volume tier reminder badge — shown when a discount is active */}
                      {activeVolumeTier && currentSaleItems.length > 0 && (
                        <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                          <span className="font-semibold text-amber-800">{activeVolumeTier.label}</span>
                          <span className="text-amber-700">— Remise {activeVolumeTier.discountPerBox} DH/colis appliquée automatiquement</span>
                        </div>
                      )}

                      {/* Items Table */}
                      <table className="w-full text-left text-sm border-collapse">
                          <thead className="bg-slate-100 text-slate-500 uppercase font-bold text-xs">
                              <tr>
                                  <th className="p-3 rounded-tl-lg">{t('product')}</th>
                                  <th className="p-3 w-24">{t('price')}</th>
                                  <th className="p-3 w-24">{t('quantity_short')}</th>
                                  <th className="p-3 w-32">{t('discount') || 'Remise'}</th>
                                  <th className="p-3 w-24 text-right">{t('total')}</th>
                                  <th className="p-3 w-10 rounded-tr-lg"></th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {currentSaleItems.map((item, idx) => {
                                  const product = products.find(p => p.id === item.productId);
                                  const packInfo = product ? `${product.packSize}${product.unit}` : '';
                                  const isPercentage = (item.discountType || 'percentage') === 'percentage';
                                  // Original items (first N items where N = original count) are locked in edit mode
                                  // EXCEPT: Admin and Manager can edit/delete everything (wholesale pricing flexibility)
                                  const originalItemCount = editingSale?.items?.length || 0;
                                  const isOriginalItem = !!editingSale && idx < originalItemCount;
                                  const canEditAll = currentUser.role === 'Admin' || currentUser.role === 'Manager';
                                  const isLocked = isOriginalItem && !canEditAll;
                                  const isBoxMode = item.sellMode === 'box';
                                  const hasBoxOption = (item.unitsPerBox || 1) > 1;
                                  const effectiveUnitPrice = isBoxMode ? item.unitPrice * (item.unitsPerBox || 1) : item.unitPrice;
                                  const isGift = !!item.isGift;
                                  return (
                                  <tr key={idx} className={isGift ? 'bg-emerald-50' : isLocked ? 'bg-slate-50' : ''}>
                                      <td className="p-3">
                                          <div className="flex items-center gap-1 flex-wrap">
                                          <span className="font-medium text-slate-900">{item.productName}</span>
                                          {packInfo && <span className="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{packInfo}</span>}
                                          {isGift && <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">🎁 OFFERT</span>}
                                          </div>
                                          <div className="flex items-center gap-1 mt-0.5">
                                          {hasBoxOption && !isLocked && (
                                              <button
                                                  type="button"
                                                  onClick={() => toggleSellMode(idx)}
                                                  className={`ml-2 text-xs font-bold px-1.5 py-0.5 rounded border transition-colors ${
                                                      isBoxMode
                                                          ? 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200'
                                                          : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                                                  }`}
                                                  title={isBoxMode ? `${t('box_sing')} × ${item.unitsPerBox} ${t('click_unit')}` : `${t('unit_sing')} ${t('click_box')}`}
                                              >
                                                  {isBoxMode ? `📦 ×${item.unitsPerBox}` : '1 ud'}
                                              </button>
                                          )}
                                          {!isLocked && (
                                              <button
                                                  type="button"
                                                  onClick={() => toggleGift(idx)}
                                                  className={`text-xs font-bold px-1.5 py-0.5 rounded border transition-colors ${
                                                      isGift
                                                          ? 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200'
                                                          : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200'
                                                  }`}
                                                  title={isGift ? 'Quitar gratuidad' : 'Marcar como OFFERT (precio 0)'}
                                              >
                                                  🎁
                                              </button>
                                          )}
                                          </div>
                                      </td>
                                      <td className="p-3">
                                          {isGift ? (
                                              <span className="text-emerald-600 font-bold text-sm">0.00</span>
                                          ) : canEditAll ? (
                                              <div className="flex flex-col gap-0.5">
                                                  <input
                                                      type="number"
                                                      min="0"
                                                      step="1"
                                                      className="w-20 border border-blue-300 bg-blue-50 rounded px-1 py-0.5 text-center font-bold text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                                      value={item.unitPrice}
                                                      onFocus={(e) => e.target.select()}
                                                      onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                      title="Modificar precio unitario"
                                                  />
                                                  {isBoxMode && <div className="text-xs text-slate-400 text-center">= {effectiveUnitPrice.toFixed(2)}{t('per_box')}</div>}
                                              </div>
                                          ) : (
                                              <><div>{effectiveUnitPrice.toFixed(2)}</div>
                                                {isBoxMode && <div className="text-xs text-slate-400">{item.unitPrice.toFixed(2)}/ud</div>}</>
                                          )}
                                      </td>
                                      <td className="p-3">
                                          <input
                                              type="number"
                                              min="1"
                                              step="1"
                                              className={`w-16 border rounded px-1 py-0.5 text-center font-bold ${isLocked ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed' : 'border-slate-300'}`}
                                              value={item.quantity}
                                              onFocus={(e) => e.target.select()}
                                              onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                                              disabled={isLocked}
                                          />
                                      </td>
                                      <td className="p-3">
                                          {isGift ? (
                                              <span className="text-xs text-emerald-500 italic">—</span>
                                          ) : (
                                              <>
                                                  <div className="flex items-center gap-1">
                                                      <input
                                                          type="number"
                                                          min="0"
                                                          max={isPercentage ? maxLineDiscPct : undefined}
                                                          step="1"
                                                          className={`w-16 border rounded px-1 py-0.5 text-center font-bold focus:ring-1 focus:ring-blue-500 outline-none ${
                                                              isLocked ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed' :
                                                              item.discount > 0 ? 'border-rose-300 text-rose-600 bg-rose-50' : 'border-slate-300 text-slate-600'
                                                          }`}
                                                          value={item.discount}
                                                          onFocus={(e) => e.target.select()}
                                                          onChange={(e) => {
                                                              const val = parseFloat(e.target.value) || 0;
                                                              updateItem(idx, 'discount', isPercentage ? Math.max(0, Math.min(maxLineDiscPct, val)) : Math.max(0, val));
                                                          }}
                                                          disabled={isLocked}
                                                      />
                                                      <button
                                                          type="button"
                                                          onClick={() => toggleItemDiscountType(idx)}
                                                          disabled={isLocked}
                                                          className={`px-2 py-0.5 text-xs font-bold rounded transition-colors ${
                                                              isLocked ? 'bg-slate-100 text-slate-400 cursor-not-allowed' :
                                                              isPercentage
                                                                  ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                                          }`}
                                                          title={isPercentage ? '%' : isBoxMode ? t('dh_per_unit_in_box') : 'DH'}
                                                      >
                                                          {isPercentage ? '%' : isBoxMode ? 'DH/ud' : 'DH'}
                                                      </button>
                                                  </div>
                                                  {/* DH equivalent when in % mode */}
                                                  {isPercentage && item.discount > 0 && (
                                                      <div className="text-xs text-rose-500 mt-0.5 font-semibold">
                                                          -{(effectiveUnitPrice * item.quantity * (item.discount / 100)).toFixed(2)} DH
                                                      </div>
                                                  )}
                                                  {/* Hint: fixed DH discount in box mode is per unit */}
                                                  {isBoxMode && !isPercentage && item.discount > 0 && (
                                                      <div className="text-xs text-amber-600 mt-0.5">
                                                          ×{item.unitsPerBox} = {(item.discount * (item.unitsPerBox || 1)).toFixed(2)} DH{t('per_box')}
                                                      </div>
                                                  )}
                                              </>
                                          )}
                                      </td>
                                      <td className={`p-3 text-right font-bold ${isGift ? 'text-emerald-600' : ''}`}>{item.total.toFixed(2)}</td>
                                      <td className="p-3 text-center">
                                          {isLocked ? (
                                              <span className="text-slate-300" title={t('cannot_remove_original_item') || 'No se puede eliminar - usa devolución'}>
                                                  <Trash2 className="w-4 h-4" />
                                              </span>
                                          ) : (
                                              <button onClick={() => removeItem(idx)} className="text-slate-400 hover:text-rose-600">
                                                  <Trash2 className="w-4 h-4" />
                                              </button>
                                          )}
                                      </td>
                                  </tr>
                              );})}
                              {currentSaleItems.length === 0 && (
                                  <tr>
                                      <td colSpan={6} className="p-8 text-center text-slate-400 italic">{t('cart_empty_instruction')}</td>
                                  </tr>
                              )}
                          </tbody>
                          {currentSaleItems.length > 0 && (
                              <tfoot className="border-t-2 border-slate-200">
                                  {/* Volume tier progress indicator */}
                                  {volumeTiers.length > 0 && !isQuoteMode && !editingSale && (() => {
                                      const nextTier = volumeTiers
                                          .filter(t => t.minAmount > grossInvoiceTotal)
                                          .sort((a, b) => a.minAmount - b.minAmount)[0] ?? null;
                                      const amountToNext = nextTier ? Math.ceil(nextTier.minAmount - grossInvoiceTotal) : 0;
                                      const progressPct = nextTier
                                          ? Math.min(100, (grossInvoiceTotal / nextTier.minAmount) * 100)
                                          : 100;
                                      const currentSavings = currentSaleItems.reduce((sum, item) => {
                                          if (item.discountType !== 'fixed' || item.discount <= 0) return sum;
                                          const unitsQty = item.quantity * (item.sellMode === 'box' ? (item.unitsPerBox || 1) : 1);
                                          return sum + item.discount * unitsQty;
                                      }, 0);
                                      const isWelcome = isFirstOrder && !activeVolumeTier;

                                      if (!activeVolumeTier && !nextTier && !isWelcome) return null;

                                      const isMaxTier = activeVolumeTier && !nextTier;

                                      return (
                                          <tr>
                                              <td colSpan={6} className="px-3 pt-2 pb-1">
                                                  <div className={`rounded-lg px-3 py-2 text-xs flex flex-col gap-1.5 ${
                                                      isMaxTier ? 'bg-emerald-50 border border-emerald-200' :
                                                      activeVolumeTier ? 'bg-blue-50 border border-blue-200' :
                                                      isWelcome ? 'bg-amber-50 border border-amber-200' :
                                                      'bg-slate-50 border border-slate-200'
                                                  }`}>
                                                      <div className="flex items-center justify-between">
                                                          <div className="flex items-center gap-2 font-semibold">
                                                              {isMaxTier ? (
                                                                  <span className="text-emerald-700">✓ {t('vol_max_active')} — −{activeVolumeTier.discountPerBox} DH{t('per_box')} ({activeVolumeTier.label})</span>
                                                              ) : activeVolumeTier ? (
                                                                  <span className="text-blue-700">−{activeVolumeTier.discountPerBox} {companySettings.currencySymbol || 'DH'}{t('per_box')} {t('vol_active')} ({activeVolumeTier.label}) → {t('vol_add')} {amountToNext.toLocaleString('fr-MA')} {companySettings.currencySymbol || 'DH'} {t('vol_more_then')} −{nextTier!.discountPerBox} {companySettings.currencySymbol || 'DH'}{t('per_box')}</span>
                                                              ) : isWelcome ? (
                                                                  <span className="text-amber-700">⭐ {t('first_order_promo')} {t('vol_applied')}{nextTier ? ` · ${t('vol_add')} ${amountToNext.toLocaleString('fr-MA')} ${companySettings.currencySymbol || 'DH'} → −${nextTier.discountPerBox} ${companySettings.currencySymbol || 'DH'}${t('per_box')}` : ''}</span>
                                                              ) : (
                                                                  <span className="text-slate-600">{t('vol_add')} {amountToNext.toLocaleString('fr-MA')} DH → −{nextTier!.discountPerBox} DH{t('per_box')} {t('vol_on_order')}</span>
                                                              )}
                                                          </div>
                                                          {currentSavings > 0 && (
                                                              <span className={`font-bold ${isMaxTier ? 'text-emerald-700' : 'text-blue-700'}`}>
                                                                  Ahorro: {currentSavings.toFixed(2)} DH
                                                              </span>
                                                          )}
                                                      </div>
                                                      {nextTier && (
                                                          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                              <div
                                                                  className={`h-full rounded-full transition-all duration-300 ${activeVolumeTier ? 'bg-blue-500' : isWelcome ? 'bg-amber-400' : 'bg-slate-400'}`}
                                                                  style={{ width: `${progressPct}%` }}
                                                              />
                                                          </div>
                                                      )}
                                                  </div>
                                              </td>
                                          </tr>
                                      );
                                  })()}
                                  {/* Global Discount Controls */}
                                  {/* Global discount — hidden for Sales role (max 0%) */}
                                  {currentUser.role !== 'Sales' && currentUser.role !== 'Warehouse' && currentUser.role !== 'Accountant' && (
                                  <tr className="bg-slate-50">
                                      <td colSpan={6} className="p-3">
                                          <div className="flex items-center justify-between">
                                              <div className="flex items-center">
                                                  <Tag className="w-4 h-4 mr-2 text-slate-500" />
                                                  <span className="text-sm font-bold text-slate-600 uppercase">{t('global_discount')}</span>
                                                  {currentUser.role === 'Manager' && (
                                                      <span className="ml-2 text-xs text-slate-400">(max 50%)</span>
                                                  )}
                                              </div>
                                              <div className="flex items-center space-x-2">
                                                  <div className="flex bg-slate-200 rounded-lg p-0.5 border border-slate-300">
                                                      <button
                                                          type="button"
                                                          onClick={() => setGlobalDiscountType('percentage')}
                                                          className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                                                              globalDiscountType === 'percentage'
                                                                  ? 'bg-white text-blue-600 shadow-sm'
                                                                  : 'text-slate-500 hover:text-slate-700'
                                                          }`}
                                                      >
                                                          %
                                                      </button>
                                                      <button
                                                          type="button"
                                                          onClick={() => setGlobalDiscountType('fixed')}
                                                          className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                                                              globalDiscountType === 'fixed'
                                                                  ? 'bg-white text-blue-600 shadow-sm'
                                                                  : 'text-slate-500 hover:text-slate-700'
                                                          }`}
                                                      >
                                                          DH
                                                      </button>
                                                  </div>
                                                  <input
                                                      type="number"
                                                      min="0"
                                                      max={globalDiscountType === 'percentage' ? maxGlobalDiscPct : undefined}
                                                      step="1"
                                                      className="w-24 border border-slate-300 rounded-lg p-1.5 text-right font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                                      value={globalDiscountValue}
                                                      onFocus={(e) => e.target.select()}
                                                      onChange={(e) => {
                                                          const val = parseFloat(e.target.value) || 0;
                                                          setGlobalDiscountValue(globalDiscountType === 'percentage' ? Math.max(0, Math.min(maxGlobalDiscPct, val)) : Math.max(0, val));
                                                      }}
                                                      placeholder={globalDiscountType === 'percentage' ? '0%' : '0.00'}
                                                  />
                                              </div>
                                          </div>
                                      </td>
                                  </tr>
                                  )}

                                  {/* Subtotal before global discount */}
                                  {globalDiscountValue > 0 && (
                                      <tr>
                                          <td colSpan={4} className="p-3 text-right font-bold text-slate-500 uppercase">{t('subtotal_items')}</td>
                                          <td className="p-3 text-right font-bold text-slate-800">{calculateTotal().itemsSubtotal.toFixed(2)}</td>
                                          <td></td>
                                      </tr>
                                  )}

                                  {/* Global discount amount */}
                                  {globalDiscountValue > 0 && (
                                      <tr>
                                          <td colSpan={4} className="p-3 text-right font-bold text-rose-600 uppercase">
                                              {t('global_discount')}
                                              {globalDiscountType === 'percentage' ? ` (${globalDiscountValue}%)` : ''}
                                          </td>
                                          <td className="p-3 text-right font-bold text-rose-600">-{calculateTotal().globalDiscountAmount.toFixed(2)}</td>
                                          <td></td>
                                      </tr>
                                  )}

                                  <tr>
                                      <td colSpan={4} className="p-3 text-right font-bold text-slate-500 uppercase">{t('subtotal_ht')}</td>
                                      <td className="p-3 text-right font-bold text-slate-800">{calculateTotal().subtotal.toFixed(2)}</td>
                                      <td></td>
                                  </tr>
                                  <tr>
                                      <td colSpan={4} className="p-3 text-right font-bold text-slate-500 uppercase">{t('tva_amount')}</td>
                                      <td className="p-3 text-right font-bold text-slate-800">{calculateTotal().tax.toFixed(2)}</td>
                                      <td></td>
                                  </tr>
                                  <tr className="bg-blue-50">
                                      <td colSpan={4} className="p-3 text-right font-black text-blue-900 uppercase text-lg">{t('total_ttc')}</td>
                                      <td className="p-3 text-right font-black text-blue-600 text-lg">{calculateTotal().total.toFixed(2)}</td>
                                      <td></td>
                                  </tr>
                                  {/* Credit limit warning */}
                                  {customerCreditStatus?.wouldExceed && (
                                      <tr className="bg-amber-50">
                                          <td colSpan={6} className="p-3">
                                              <div className="flex items-center gap-2 text-amber-700 text-sm">
                                                  <AlertCircle className="w-5 h-5 shrink-0" />
                                                  <div>
                                                      <span className="font-bold">{t('credit_limit_warning') || 'Limite de crédit dépassée!'}</span>
                                                      <span className="ml-2 text-amber-600">
                                                          {t('available') || 'Disponible'}: {customerCreditStatus.availableCredit.toFixed(2)} / {customerCreditStatus.creditLimit.toFixed(2)} MAD
                                                      </span>
                                                  </div>
                                              </div>
                                          </td>
                                      </tr>
                                  )}
                              </tfoot>
                          )}
                      </table>
                  </div>

                  <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end space-x-3">
                      <button 
                          onClick={() => setShowModal(false)}
                          className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors"
                      >
                          {t('cancel')}
                      </button>
                      <button
                          onClick={handleCreateSale}
                          disabled={isSubmitting}
                          className={`px-6 py-3 text-white font-bold rounded-lg shadow-lg transition-colors flex items-center ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' : isQuoteMode ? 'bg-violet-600 hover:bg-violet-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                      >
                          {isSubmitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Check className="w-5 h-5 mr-2" />}
                          {isSubmitting ? (t('processing') || 'Traitement...') : isQuoteMode ? 'Enregistrer le Devis' : editingSale ? t('confirm_sale') : 'Enregistrer BL'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* PAYMENT MODAL */}
      {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900 bg-opacity-60 backdrop-blur-sm overflow-y-auto">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm my-auto animate-in fade-in zoom-in-95 max-h-[95vh] flex flex-col">
                  <div className="p-6 overflow-y-auto flex-1">
                      <h3 className="text-xl font-bold text-slate-900 mb-4 text-center">{t('register_payment')}</h3>
                      <div className="bg-slate-50 p-4 rounded-xl mb-4 text-center">
                          <p className="text-sm text-slate-500 mb-1">{t('total_due')}</p>
                          <p className="text-3xl font-black text-slate-900">
                              {Math.max(0, showPaymentModal.totalAmount - showPaymentModal.amountPaid - (showPaymentModal.creditedAmount || 0)).toFixed(2)} <span className="text-lg font-medium text-slate-400">{CURRENCY}</span>
                          </p>
                      </div>

                      {/* Payment history with delete option */}
                      {showPaymentModal.payments && showPaymentModal.payments.length > 0 && (
                          <div className="mb-4">
                              <p className="text-xs font-bold text-slate-500 uppercase mb-2">Paiements enregistrés</p>
                              <div className="space-y-1">
                                  {showPaymentModal.payments.map(p => (
                                      <div key={p.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm">
                                          <div className="flex-1 min-w-0">
                                              <span className="font-bold text-emerald-700">{p.amount.toFixed(2)} {CURRENCY}</span>
                                              <span className="text-slate-400 mx-1.5">·</span>
                                              <span className="text-slate-600">{p.method}</span>
                                              {p.checkNumber && <span className="text-slate-400 text-xs ml-1">#{p.checkNumber}</span>}
                                              <span className="text-slate-400 ml-1.5 text-xs">{new Date(p.date).toLocaleDateString()}</span>
                                          </div>
                                          {(props.currentUser.role === 'Admin' || props.currentUser.role === 'Manager') && (
                                              <button
                                                  type="button"
                                                  onClick={async () => {
                                                      if (!confirm(`Supprimer ce paiement de ${p.amount.toFixed(2)} ${CURRENCY} ?`)) return;
                                                      try {
                                                          await salesMutations.deletePayment(showPaymentModal.id, p.id);
                                                          await refreshSales();
                                                          // Refresh modal sale data
                                                          setShowPaymentModal(prev => prev ? {
                                                              ...prev,
                                                              amountPaid: Math.max(0, prev.amountPaid - p.amount),
                                                              payments: prev.payments.filter(x => x.id !== p.id)
                                                          } : null);
                                                      } catch (err: any) {
                                                          alert(`Erreur: ${err.message}`);
                                                      }
                                                  }}
                                                  className="ml-2 p-1 text-slate-300 hover:text-rose-500 transition-colors shrink-0"
                                                  title="Supprimer ce paiement"
                                              >
                                                  <X className="w-3.5 h-3.5" />
                                              </button>
                                          )}
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}

                      <form onSubmit={handlePaymentSubmit} className="space-y-4">
                          <div>
                              <div className="flex justify-between items-center mb-1">
                                  <label className="text-sm font-bold text-slate-700">{t('amount_paid') || 'Montant encaissé'}</label>
                                  <button
                                      type="button"
                                      onClick={() => setPaymentAmount(Math.max(0, showPaymentModal.totalAmount - showPaymentModal.amountPaid - (showPaymentModal.creditedAmount || 0)))}
                                      className="text-xs text-emerald-600 font-semibold hover:underline"
                                  >
                                      Tout payer
                                  </button>
                              </div>
                              <input
                                  type="number"
                                  min="0"
                                  max={Math.max(0, showPaymentModal.totalAmount - showPaymentModal.amountPaid - (showPaymentModal.creditedAmount || 0))}
                                  className="w-full p-3 border border-slate-300 rounded-lg font-bold text-lg text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                  value={paymentAmount || ''}
                                  onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      const remaining = showPaymentModal.totalAmount - showPaymentModal.amountPaid - (showPaymentModal.creditedAmount || 0);
                                      setPaymentAmount(Math.max(0, Math.min(val, remaining)));
                                  }}
                                  step="0.01"
                                  autoFocus
                              />
                              {(() => {
                                const rem = Math.max(0, showPaymentModal.totalAmount - showPaymentModal.amountPaid - (showPaymentModal.creditedAmount || 0));
                                const after = rem - (paymentAmount || 0);
                                if ((paymentAmount || 0) > 0.001 && after > 0.01) {
                                  return <p className="mt-1.5 text-sm text-amber-600 font-medium text-center">Restant après: <strong>{after.toFixed(2)} {CURRENCY}</strong></p>;
                                }
                                if ((paymentAmount || 0) >= rem - 0.001 && (paymentAmount || 0) > 0) {
                                  return <p className="mt-1.5 text-sm text-emerald-600 font-medium text-center">✓ Solde soldé</p>;
                                }
                                return null;
                              })()}
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1">{t('payment_method')}</label>
                              <div className="grid grid-cols-2 gap-2">
                                  {['Cash', 'Check', 'Bank Transfer', 'Traite'].map(m => (
                                      <button 
                                          key={m}
                                          type="button"
                                          onClick={() => setPaymentMethod(m as PaymentMethod)}
                                          className={`py-2 text-sm font-medium rounded-lg border transition-all ${paymentMethod === m ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                      >
                                          {t(m === 'Bank Transfer' ? 'virement' : m.toLowerCase()) || m}
                                      </button>
                                  ))}
                              </div>
                          </div>

                          {/* Additional fields for Check/Traite */}
                          {(paymentMethod === 'Check' || paymentMethod === 'Traite') && (
                              <>
                                  <div>
                                      <label className="block text-sm font-bold text-slate-700 mb-1">
                                          {paymentMethod === 'Check' ? t('check_number') : t('traite_number')} *
                                      </label>
                                      <input
                                          type="text"
                                          className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                          value={checkNumber}
                                          onChange={(e) => setCheckNumber(e.target.value)}
                                          placeholder={t('enter_number') || 'Enter number'}
                                          required
                                      />
                                  </div>
                                  <div>
                                      <label className="block text-sm font-bold text-slate-700 mb-1">
                                          {t('bank_name') || 'Banque'}
                                      </label>
                                      <input
                                          type="text"
                                          className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                          value={bankName}
                                          onChange={(e) => setBankName(e.target.value)}
                                          placeholder="Attijariwafa, BMCE, CIH..."
                                      />
                                  </div>
                                  <div>
                                      <label className="block text-sm font-bold text-slate-700 mb-1">
                                          {t('due_date')} *
                                      </label>
                                      <input
                                          type="date"
                                          className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                          value={dueDate}
                                          onChange={(e) => setDueDate(e.target.value)}
                                          required
                                      />
                                  </div>
                              </>
                          )}

                          {/* Bank name for Bank Transfer */}
                          {paymentMethod === 'Bank Transfer' && (
                              <div>
                                  <label className="block text-sm font-bold text-slate-700 mb-1">
                                      {t('bank_name') || 'Banque'}
                                  </label>
                                  <input
                                      type="text"
                                      className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                      value={bankName}
                                      onChange={(e) => setBankName(e.target.value)}
                                      placeholder="Attijariwafa, BMCE, CIH..."
                                  />
                              </div>
                          )}

                          {/* Reference field (optional for all payment methods) */}
                          <div>
                              <label className="block text-sm font-bold text-slate-700 mb-1">
                                  {t('reference')} ({t('optional')})
                              </label>
                              <input
                                  type="text"
                                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                  value={paymentReference}
                                  onChange={(e) => setPaymentReference(e.target.value)}
                                  placeholder={t('transaction_reference') || 'Transaction reference'}
                              />
                          </div>

                          <button
                              type="submit"
                              className={`w-full py-3 font-bold rounded-lg shadow-md transition-colors mt-2 ${
                                  (paymentMethod === 'Check' || paymentMethod === 'Traite') && (!checkNumber.trim() || !dueDate)
                                      ? 'bg-slate-400 cursor-not-allowed'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              }`}
                              disabled={(paymentMethod === 'Check' || paymentMethod === 'Traite') && (!checkNumber.trim() || !dueDate)}
                          >
                              {t('confirm_payment')}
                          </button>
                          <button 
                              type="button"
                              onClick={() => setShowPaymentModal(null)}
                              className="w-full py-2 text-slate-500 font-medium hover:text-slate-700"
                          >
                              {t('cancel')}
                          </button>
                      </form>
                  </div>
              </div>
          </div>
      )}

      {/* RETURN MODAL */}
      {showReturnModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900 bg-opacity-60 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
                  <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                      <h3 className="text-lg font-bold text-slate-900">{t('process_return')} - {showReturnModal.invoiceNumber || showReturnModal.deliveryNoteNumber || `#${showReturnModal.id.slice(0, 8)}`}</h3>
                      <button onClick={() => setShowReturnModal(null)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <div className="p-6 flex-1 overflow-y-auto">
                      <div className="mb-4">
                          <label className="block text-sm font-medium text-slate-700 mb-1">{t('return_reason')}</label>
                          <input 
                              type="text" 
                              className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                              placeholder={t('placeholder_reason')}
                              value={returnReason}
                              onChange={(e) => setReturnReason(e.target.value)}
                          />
                      </div>
                      
                      <div className="mb-4">
                          <label className="block text-sm font-medium text-slate-700 mb-1">{t('return_stock_to')}</label>
                          <select 
                              className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                              value={returnWarehouseId}
                              onChange={(e) => setReturnWarehouseId(e.target.value)}
                          >
                              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                      </div>

                      <div className="border rounded-lg overflow-hidden">
                          <div className="bg-slate-100 p-2 flex justify-between items-center border-b border-slate-200">
                              <h4 className="font-bold text-sm text-slate-600 ml-2">{t('items_to_return')}</h4>
                              <button 
                                  type="button" 
                                  onClick={handleReturnAll}
                                  className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded border border-blue-200 flex items-center"
                              >
                                  <CheckSquare className="w-3 h-3 mr-1" /> {t('return_all')}
                              </button>
                          </div>
                          <table className="w-full text-sm text-left">
                              <thead className="bg-slate-50 font-bold text-slate-600">
                                  <tr>
                                      <th className="p-3">{t('product')}</th>
                                      <th className="p-3 text-center">{t('sold')}</th>
                                      <th className="p-3 text-center">Ya Devuelto</th>
                                      <th className="p-3 text-center">{t('return_qty')}</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                  {showReturnModal.items.map(item => {
                                      // Calculate how much was already returned for this product
                                      const alreadyReturned = returns
                                          .filter(ret => ret.originalSaleId === showReturnModal.id)
                                          .flatMap(ret => ret.items || [])
                                          .filter(returnItem => returnItem.productId === item.productId)
                                          .reduce((sum, returnItem) => sum + returnItem.quantity, 0);

                                      const availableToReturn = item.quantity - alreadyReturned;
                                      const currentReturnAmount = returnedItems[item.productId] || 0;

                                      return (
                                          <tr key={item.productId} className={currentReturnAmount > 0 ? "bg-rose-50/50" : ""}>
                                              <td className="p-3">
                                                  <span className="font-medium text-slate-900">{item.productName}</span>
                                              </td>
                                              <td className="p-3 text-center text-slate-500">{item.quantity}</td>
                                              <td className="p-3 text-center">
                                                  <span className={alreadyReturned > 0 ? "text-amber-600 font-semibold" : "text-slate-500"}>
                                                      {alreadyReturned}
                                                  </span>
                                              </td>
                                              <td className="p-3 text-center">
                                                  <div className="flex flex-col items-center gap-1">
                                                      <input 
                                                          type="number" 
                                                          min="0" 
                                                          max={availableToReturn}
                                                          className={`w-20 border rounded-lg p-1.5 text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${
                                                              currentReturnAmount > 0 
                                                              ? 'border-rose-300 text-rose-600 bg-white' 
                                                              : 'border-slate-300 text-slate-600 bg-slate-50'
                                                          } ${availableToReturn === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                          value={currentReturnAmount || ''}
                                                          placeholder="0"
                                                          disabled={availableToReturn === 0}
                                                          onFocus={(e) => e.target.select()}
                                                          onChange={(e) => {
                                                              const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                                              // ✅ STRICT VALIDATION: Never allow more than available
                                                              const finalVal = Math.min(availableToReturn, Math.max(0, val || 0));
                                                              
                                                              // ⚠️ Alert if user tried to enter more than available
                                                              if (val > availableToReturn && val > 0) {
                                                                  console.warn(`Cannot return ${val} units. Only ${availableToReturn} available.`);
                                                              }
                                                              
                                                              setReturnedItems({
                                                                  ...returnedItems,
                                                                  [item.productId]: finalVal
                                                              });
                                                          }}
                                                      />
                                                      {availableToReturn === 0 && (
                                                          <span className="text-xs text-amber-600 font-semibold">Completamente devuelto</span>
                                                      )}
                                                      {availableToReturn > 0 && (
                                                          <span className="text-xs text-slate-500">Max: {availableToReturn}</span>
                                                      )}
                                                  </div>
                                              </td>
                                          </tr>
                                      );
                                  })}
                              </tbody>
                          </table>
                      </div>
                  </div>

                  <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
                      <button 
                          onClick={handleReturnSubmit}
                          className="px-6 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 shadow-md"
                      >
                          {t('confirm_return')}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* DOCUMENT VIEWER */}
      {viewingDocument && (
          <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="text-white text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>Chargement du document...</div></div>}>
            <PrintableDocument
                sale={viewingDocument.sale}
                type={viewingDocument.type}
                customer={customers.find(c => c.id === viewingDocument.sale.customerId)}
                warehouse={warehouses.find(w => w.id === viewingDocument.sale.warehouseId)}
                companySettings={companySettings}
                products={products}
                onClose={() => setViewingDocument(null)}
                onSaveSignature={props.onUpdateSettings ? (sig) => props.onUpdateSettings!({ ...companySettings, signatureBase64: sig }) : undefined}
            />
          </Suspense>
      )}
    </div>
  );
};

export default Sales;
