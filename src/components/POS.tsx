
import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { Sale, Product, Warehouse, SaleItem, Customer, User, CompanySettings, ProductCategory, DocumentType, PaymentMethod } from '../types';
import { ShoppingCart, Search, X, Trash2, Banknote, Coins, CreditCard, Plus, Minus, Store, ScanBarcode, Percent, ChevronUp, AlertCircle, Tag, Building2, RotateCcw, Receipt, FileText, Truck, FileCheck, Landmark, FileSignature, Box, Package, WifiOff, CloudUpload } from 'lucide-react';
import { CURRENCY } from '../constants';
import { useLanguage } from '../services/i18n';
import { sortProducts, fuzzySearch, calculateItemTotal, formatStock } from '../utils/helpers';
import { TVA_RATES, getOrderTier, calculateTierDiscountPercent, calculateTierPrice, TIER_CONFIGS, getProductTaxRate } from '../utils/pricing';
// Lazy load PDF component (only loaded when printing)
const PrintableDocument = lazy(() => import('./PrintableDocument'));
import { useCameraScanner } from '../hooks/useCameraScanner';
import { CameraModal } from './CameraModal';
import { useStore } from '../store/useStore';
import { useProducts, useWarehouses, useCustomers, useWarehouseCompanies } from '../hooks/useSupabaseData';
import { useInvoiceCalculationForPOS } from '../hooks/useInvoiceCalculation';
import { useWarehouseSelectionForPOS } from '../hooks/useWarehouseSelection';
import { logger } from '../utils/logger';
import { generateDocumentNumber } from '../services/documentNumbering';
import { useNetworkStatus } from '../services/offline';

interface POSProps {
  products: Product[];
  warehouses: Warehouse[];
  customers: Customer[];
  currentUser: User;
  companySettings: CompanySettings;
  sales: Sale[];
  onCreateSale: (sale: Sale, userId: string) => Promise<Sale>;
  onRefreshSales: () => Promise<void>;
  onNewSale: (sale: Sale) => void;
  pendingOfflineSales?: number;
}

const POS: React.FC<POSProps> = ({ products: propsProducts, warehouses: propsWarehouses, customers: propsCustomers, currentUser, companySettings, sales, onCreateSale, onRefreshSales, onNewSale, pendingOfflineSales = 0 }) => {
  const { t } = useLanguage();

  // ✅ Use Supabase hooks for real-time data synchronization
  const productsHook = useProducts();
  const warehousesHook = useWarehouses();
  const customersHook = useCustomers();
  const { warehouseCompanies } = useWarehouseCompanies();
  const { isOnline } = useNetworkStatus();

  // ✅ Use hook data directly (Supabase)
  const products = productsHook.products;
  const allWarehouses = warehousesHook.warehouses;
  const allCustomers = customersHook.customers;

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      logger.debug('POS: Auto-refresh triggered');
      Promise.all([
        productsHook.refresh(),
        warehousesHook.refresh(),
        customersHook.refresh(),
        onRefreshSales(),
      ]).catch(err => logger.error('Auto-refresh error', err));
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [productsHook, warehousesHook, customersHook, onRefreshSales]);

  // --- DISCOUNT LIMITS BY ROLE (respects per-user discountLimit override) ---
  const maxLineDiscountPercent = currentUser.discountLimit !== undefined
    ? currentUser.discountLimit
    : (currentUser.role === 'Admin' ? 100 : currentUser.role === 'Manager' ? 50 : 15);
  const maxGlobalDiscountPercent = currentUser.discountLimit !== undefined
    ? currentUser.discountLimit
    : (currentUser.role === 'Admin' ? 100 : currentUser.role === 'Manager' ? 50 : 0);

  // --- STATE MANAGEMENT ---
  // Unified warehouse selection hook (eliminates duplication)
  const { selectedWarehouseId, setSelectedWarehouseId } = useWarehouseSelectionForPOS(currentUser, allWarehouses);

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Persist cart state in localStorage to survive page refresh
  const [cart, setCartState] = useState<SaleItem[]>(() => {
    try {
      const saved = localStorage.getItem('pos_cart');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const setCart = (newCart: SaleItem[] | ((prev: SaleItem[]) => SaleItem[])) => {
    const value = typeof newCart === 'function' ? newCart(cart) : newCart;
    setCartState(value);
    localStorage.setItem('pos_cart', JSON.stringify(value));
  };

  const [globalDiscountType, setGlobalDiscountTypeState] = useState<'percentage' | 'fixed'>(() => {
    try {
      return (localStorage.getItem('pos_discountType') as 'percentage' | 'fixed') || 'percentage';
    } catch { return 'percentage'; }
  });
  const setGlobalDiscountType = (v: 'percentage' | 'fixed') => {
    setGlobalDiscountTypeState(v);
    localStorage.setItem('pos_discountType', v);
  };

  const [globalDiscountValue, setGlobalDiscountValueState] = useState(() => {
    try {
      return parseFloat(localStorage.getItem('pos_discountValue') || '0') || 0;
    } catch { return 0; }
  });
  const setGlobalDiscountValue = (v: number) => {
    setGlobalDiscountValueState(v);
    localStorage.setItem('pos_discountValue', String(v));
  };

  const [selectedCustomerId, setSelectedCustomerIdState] = useState(() => {
    try {
      return localStorage.getItem('pos_customerId') || '';
    } catch { return ''; }
  });
  const setSelectedCustomerId = (v: string) => {
    setSelectedCustomerIdState(v);
    localStorage.setItem('pos_customerId', v);
  };

  const [showTierGrid, setShowTierGrid] = useState(false);

  const [selectedCompanyId, setSelectedCompanyIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem('pos_companyId') || null;
    } catch { return null; }
  });
  const setSelectedCompanyId = (v: string | null) => {
    const changed = v !== selectedCompanyId;
    setSelectedCompanyIdState(v);
    if (v) localStorage.setItem('pos_companyId', v);
    else localStorage.removeItem('pos_companyId');
    // Reset customer when company changes (customer may belong to different company)
    if (changed) {
      setSelectedCustomerId('');
    }
  };

  // Filter customers by selected company (show company's customers + unassigned legacy)
  const customers = useMemo(() => {
    if (!selectedCompanyId) return allCustomers;
    return allCustomers.filter(c => !c.companyId || c.companyId === selectedCompanyId);
  }, [allCustomers, selectedCompanyId]);

  // Filter warehouses by selected company (via warehouse_companies junction table)
  const warehouses = useMemo(() => {
    if (!selectedCompanyId) return allWarehouses;
    const companyWarehouseIds = warehouseCompanies
      .filter(wc => wc.companyId === selectedCompanyId)
      .map(wc => wc.warehouseId);
    // Show company's warehouses + unassigned warehouses (legacy)
    return allWarehouses.filter(w =>
      companyWarehouseIds.includes(w.id) ||
      !warehouseCompanies.some(wc => wc.warehouseId === w.id)
    );
  }, [allWarehouses, warehouseCompanies, selectedCompanyId]);

  // Auto-reset warehouse when company changes and current warehouse is not in filtered list
  useEffect(() => {
    if (warehouses.length > 0 && !warehouses.some(w => w.id === selectedWarehouseId)) {
      setSelectedWarehouseId(warehouses[0].id);
    }
  }, [warehouses, selectedWarehouseId, setSelectedWarehouseId]);

  const [documentType, setDocumentTypeState] = useState<DocumentType>(() => {
    try {
      return (localStorage.getItem('pos_documentType') as DocumentType) || 'TICKET';
    } catch { return 'TICKET'; }
  });
  const setDocumentType = (v: DocumentType) => {
    setDocumentTypeState(v);
    localStorage.setItem('pos_documentType', v);
  };

  const [showCheckout, setShowCheckout] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false); // Mobile/Tablet Drawer State
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [showDiscount, setShowDiscount] = useState(false);

  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Payment details for Check/Traite/Bank Transfer
  const [checkNumber, setCheckNumber] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [bankName, setBankName] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // --- HOOKS ---
  const { isCameraOpen, startCamera, stopCamera, handleSimulatedScan, videoRef } = useCameraScanner({ products });
  const { companyProfiles, activeCompanyId, userAssignedCompanyIds } = useStore();

  // Filter companies visible to this user: Admin sees all, others only their assigned ones
  const visibleCompanyProfiles = useMemo(() => {
    if (currentUser.role === 'Admin' || userAssignedCompanyIds.length === 0) return companyProfiles;
    return companyProfiles.filter((p: any) => userAssignedCompanyIds.includes(p.id));
  }, [companyProfiles, currentUser.role, userAssignedCompanyIds]);

  // --- INITIALIZATION ---
  useEffect(() => {
      // Auto-select "Walk-in" customer if available
      if (customers.length > 0 && !selectedCustomerId) {
          const walkIn = customers.find(c =>
              c.name.toLowerCase().includes('comptoir') ||
              c.name.toLowerCase().includes('walk-in')
          );
          if (walkIn) setSelectedCustomerId(walkIn.id);
      }
  }, [customers, selectedCustomerId]);

  useEffect(() => {
      // Auto-select active company — prefer the global activeCompanyId, fallback to first visible
      if (visibleCompanyProfiles.length > 0 && !selectedCompanyId) {
          const preferred = visibleCompanyProfiles.find((p: any) => p.id === activeCompanyId);
          setSelectedCompanyId(preferred ? preferred.id : visibleCompanyProfiles[0].id);
      }
  }, [visibleCompanyProfiles, activeCompanyId, selectedCompanyId]);

  // Get effective company settings (from selected profile or default)
  const effectiveCompanySettings = useMemo(() => {
      if (selectedCompanyId && companyProfiles.length > 0) {
          const profile = companyProfiles.find(p => p.id === selectedCompanyId);
          return profile ? profile.settings : companySettings;
      }
      return companySettings;
  }, [selectedCompanyId, companyProfiles, companySettings]);

  // --- COMPUTED DATA ---
  const filteredProducts = useMemo(() => {
      let result = sortProducts(products);
      
      // 1. Filter by Category
      if (selectedCategory !== 'All') {
          result = result.filter(p => p.category === selectedCategory);
      }

      // 2. Filter by Search (Name, SKU, Barcode)
      if (searchQuery) {
          result = result.filter(p => 
              fuzzySearch(p.name, searchQuery) || 
              fuzzySearch(p.sku, searchQuery) ||
              (p.barcode && fuzzySearch(p.barcode, searchQuery))
          );
      }
      return result;
  }, [products, selectedCategory, searchQuery]);

  // Use consolidated invoice calculation hook (eliminates duplication)
  const cartTotals = useInvoiceCalculationForPOS(
    cart,
    globalDiscountType,
    globalDiscountValue
  );

  // Calculate customer credit status
  const customerCreditStatus = useMemo(() => {
    if (!selectedCustomerId) return null;

    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer || !customer.creditLimit || customer.creditLimit <= 0) return null;

    // Calculate total unpaid balance for this customer
    const customerSales = (sales || []).filter(s => s.customerId === selectedCustomerId);
    const unpaidBalance = customerSales.reduce((sum, sale) => {
      const paidAmount = (sale.payments || []).reduce((p, payment) => p + payment.amount, 0);
      const remaining = (sale.totalAmount || 0) - paidAmount - (sale.creditedAmount || 0);
      return sum + (remaining > 0 ? remaining : 0);
    }, 0);

    const creditLimit = customer.creditLimit;
    const availableCredit = creditLimit - unpaidBalance;
    const wouldExceed = (unpaidBalance + cartTotals.totalTTC) > creditLimit;

    return {
      creditLimit,
      unpaidBalance,
      availableCredit,
      wouldExceed,
      newTotal: unpaidBalance + cartTotals.totalTTC
    };
  }, [selectedCustomerId, customers, sales, cartTotals.totalTTC]);

  const filteredCustomersForSearch = useMemo(() => {
    if (!customerSearchQuery.trim()) return customers.slice(0, 15);
    const q = customerSearchQuery.toLowerCase().trim();
    const qPhone = q.replace(/\s/g, '');
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.replace(/\s/g, '').includes(qPhone))
    ).slice(0, 10);
  }, [customers, customerSearchQuery]);

  const recentCustomerSales = useMemo(() => {
    if (!selectedCustomerId) return [];
    return (sales || [])
      .filter(s => s.customerId === selectedCustomerId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);
  }, [selectedCustomerId, sales]);

  // --- TIER PRICING ---
  const tierConfigs = effectiveCompanySettings?.tierConfigs ?? TIER_CONFIGS;
  const orderPoints = useMemo(() =>
    cart.reduce((sum, item) => {
      const p = products.find(pr => pr.id === item.productId);
      return sum + item.quantity * (p?.points ?? 1);
    }, 0),
  [cart, products]);
  const orderTier = useMemo(() => getOrderTier(orderPoints, tierConfigs), [orderPoints, tierConfigs]);

  // Minimum points required to unlock any discount (first tier with marginFactor > 0)
  const minDiscountPoints = useMemo(() => {
    const activeTiers = tierConfigs.filter(c => c.marginFactor > 0);
    return activeTiers.length > 0 ? Math.min(...activeTiers.map(c => c.minPoints)) : Infinity;
  }, [tierConfigs]);

  // Re-apply tier discounts when orderTier changes
  useEffect(() => {
    setCart(prev => {
      if (prev.length === 0) return prev;
      let changed = false;
      const next = prev.map(item => {
        const p = products.find(pr => pr.id === item.productId);
        if (!p?.price || !p.cost) return item;
        // Only apply discount once the order reaches the minimum discount threshold
        const disc = orderPoints >= minDiscountPoints
          ? calculateTierDiscountPercent(p.price, p.cost, orderTier, tierConfigs)
          : 0;
        if (item.discount === disc && item.discountType === 'percentage') return item;
        changed = true;
        const baseUnitPrice = p.price;
        const effectivePrice = item.sellMode === 'box' ? baseUnitPrice * (item.unitsPerBox || 1) : baseUnitPrice;
        return { ...item, unitPrice: baseUnitPrice, discount: disc, discountType: 'percentage' as const, total: calculateItemTotal(item.quantity, effectivePrice, disc, 'percentage') };
      });
      return changed ? next : prev;
    });
  }, [orderTier, orderPoints, minDiscountPoints, products, tierConfigs]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- HANDLERS ---

  const handleAddToCart = (product: Product) => {
      const stock = (product.stockLevels && product.stockLevels[selectedWarehouseId]) || 0;
      const existingIdx = cart.findIndex(i => i.productId === product.id);

      // Get units per box from product (default 1 = no box, sell by unit)
      const unitsPerBox = product.unitsPerBox || 1;
      const hasBoxOption = unitsPerBox > 1;

      // Default: box mode if product has unitsPerBox > 1, otherwise unit mode
      const existingItem = existingIdx >= 0 ? cart[existingIdx] : null;
      const sellMode = existingItem?.sellMode || (hasBoxOption ? 'box' : 'unit');

      // Stock is in individual units. Compare units needed against stock in units.
      const stockUnits = stock;
      const cartUnitsUsed = existingItem
        ? existingItem.sellMode === 'box'
          ? existingItem.quantity * (existingItem.unitsPerBox || 1)
          : existingItem.quantity
        : 0;
      const addingUnits = sellMode === 'box' ? unitsPerBox : 1;

      if (cartUnitsUsed + addingUnits > stockUnits) {
          alert(`${t('error_insufficient_stock')} (${formatStock(stockUnits, unitsPerBox, t('boxes_unit'), t('units_abbr'))})`);
          return;
      }

      const baseUnitPrice = product.price;
      const tierDiscount = (product.price && product.cost && orderPoints >= minDiscountPoints)
          ? calculateTierDiscountPercent(product.price, product.cost, orderTier, tierConfigs)
          : 0;

      if (existingIdx >= 0) {
          const newCart = [...cart];
          const item = newCart[existingIdx];
          item.quantity += 1;
          const effectivePrice = item.sellMode === 'box' ? item.unitPrice * (item.unitsPerBox || 1) : item.unitPrice;
          item.total = calculateItemTotal(item.quantity, effectivePrice, item.discount, item.discountType || 'percentage');
          setCart(newCart);
      } else {
          const effectivePrice = hasBoxOption ? baseUnitPrice * unitsPerBox : baseUnitPrice;
          setCart([...cart, {
              productId: product.id,
              productName: `${product.name} (${product.packSize}${product.unit})`,
              quantity: 1,
              unitPrice: baseUnitPrice,
              discount: tierDiscount,
              discountType: 'percentage',
              total: calculateItemTotal(1, effectivePrice, tierDiscount),
              sellMode: hasBoxOption ? 'box' : 'unit',
              unitsPerBox: unitsPerBox
          }]);
      }
  };

  const handleUpdateQuantity = (idx: number, delta: number) => {
      const newCart = [...cart];
      const item = newCart[idx];
      const product = products.find(p => p.id === item.productId);

      if (!product) return;

      const stockUnits = (product.stockLevels && product.stockLevels[selectedWarehouseId]) || 0;
      const packSize = item.unitsPerBox || 1;
      const newQty = item.quantity + delta;
      const unitsNeeded = item.sellMode === 'box' ? newQty * packSize : newQty;

      if (unitsNeeded > stockUnits) {
          alert(`${t('error_insufficient_stock')} (${formatStock(stockUnits, packSize, t('boxes_unit'), t('units_abbr'))})`);
          return;
      }

      if (newQty <= 0) {
          // Remove item
          setCart(cart.filter((_, i) => i !== idx));
          return;
      }

      item.quantity = newQty;
      // Gift items keep total = 0 regardless of quantity
      if (item.isGift) {
          item.total = 0;
      } else {
          const effectivePrice = item.sellMode === 'box' ? item.unitPrice * (item.unitsPerBox || 1) : item.unitPrice;
          item.total = calculateItemTotal(newQty, effectivePrice, item.discount, item.discountType || 'percentage');
      }
      setCart(newCart);
  };

  const handleSetItemQuantity = (idx: number, val: number) => {
      if (isNaN(val)) return; // Prevent NaN
      const newCart = [...cart];
      const item = newCart[idx];
      const product = products.find(p => p.id === item.productId);

      if (!product) return;

      const stockUnits = (product.stockLevels && product.stockLevels[selectedWarehouseId]) || 0;
      const packSize = item.unitsPerBox || 1;

      let newQty = val;
      const maxQty = item.sellMode === 'box' ? Math.floor(stockUnits / packSize) : stockUnits;
      if (newQty > maxQty) {
          newQty = maxQty;
      }
      if (newQty < 1) newQty = 1; // Prevent 0 or negative via text input

      item.quantity = newQty;
      // Gift items keep total = 0 regardless of quantity
      if (item.isGift) {
          item.total = 0;
      } else {
          const effectivePrice = item.sellMode === 'box' ? item.unitPrice * (item.unitsPerBox || 1) : item.unitPrice;
          item.total = calculateItemTotal(newQty, effectivePrice, item.discount, item.discountType || 'percentage');
      }
      setCart(newCart);
  };

  const handleUpdateDiscount = (idx: number, newDiscount: number, discountType?: 'percentage' | 'fixed') => {
      const newCart = [...cart];
      const item = newCart[idx];
      const type = discountType ?? item.discountType ?? 'percentage';
      // Para porcentaje, limitar a 0-100. Para fijo, solo >= 0
      const discount = type === 'percentage'
          ? Math.max(0, Math.min(100, newDiscount))
          : Math.max(0, newDiscount);
      item.discount = discount;
      item.discountType = type;
      const effectivePrice = item.sellMode === 'box' ? item.unitPrice * (item.unitsPerBox || 1) : item.unitPrice;
      // Fixed DH discount in box mode: user enters per-unit value → multiply by unitsPerBox
      const effectiveDiscount = (item.sellMode === 'box' && type === 'fixed')
          ? discount * (item.unitsPerBox || 1)
          : discount;
      item.total = calculateItemTotal(item.quantity, effectivePrice, effectiveDiscount, type);
      setCart(newCart);
  };

  const toggleItemDiscountType = (idx: number) => {
      const newCart = [...cart];
      const item = newCart[idx];
      const isCurrentlyPercent = (item.discountType || 'percentage') === 'percentage';
      const newType: 'percentage' | 'fixed' = isCurrentlyPercent ? 'fixed' : 'percentage';
      const effectivePrice = item.sellMode === 'box' ? item.unitPrice * (item.unitsPerBox || 1) : item.unitPrice;

      // Convert discount value instead of resetting to 0
      let convertedDiscount = 0;
      if (isCurrentlyPercent && item.discount > 0) {
          convertedDiscount = item.sellMode === 'box'
              ? item.unitPrice * (item.discount / 100)
              : effectivePrice * (item.discount / 100);
      } else if (!isCurrentlyPercent && item.discount > 0) {
          const dhPerUnit = item.sellMode === 'box' ? item.discount * (item.unitsPerBox || 1) : item.discount;
          convertedDiscount = effectivePrice > 0 ? (dhPerUnit / effectivePrice) * 100 : 0;
      }

      const effectiveForTotal = (item.sellMode === 'box' && newType === 'fixed')
          ? convertedDiscount * (item.unitsPerBox || 1)
          : convertedDiscount;
      item.discountType = newType;
      item.discount = Math.round(convertedDiscount * 10000) / 10000;
      item.total = calculateItemTotal(item.quantity, effectivePrice, effectiveForTotal, newType);
      setCart(newCart);
  };

  const toggleSellMode = (idx: number) => {
      const newCart = [...cart];
      const item = newCart[idx];
      const product = products.find(p => p.id === item.productId);
      if (!product) return;

      const stockUnits = (product.stockLevels && product.stockLevels[selectedWarehouseId]) || 0;
      const boxQty = item.unitsPerBox || 1;
      const currentMode = item.sellMode || 'unit';
      const newMode = currentMode === 'box' ? 'unit' : 'box';

      // Convert quantity when switching modes
      let newQty: number;
      if (currentMode === 'box' && newMode === 'unit') {
          newQty = item.quantity * boxQty;
      } else {
          newQty = Math.max(1, Math.floor(item.quantity / boxQty));
      }

      // Cap to available stock (stock is in individual units)
      const maxInNewMode = newMode === 'box' ? Math.floor(stockUnits / boxQty) : stockUnits;
      if (newQty > maxInNewMode) {
          newQty = Math.max(1, maxInNewMode);
      }

      item.sellMode = newMode;
      item.quantity = newQty;
      item.discount = 0; // Reset discount on mode switch to avoid confusion
      const effectivePrice = newMode === 'box' ? item.unitPrice * boxQty : item.unitPrice;
      item.total = calculateItemTotal(newQty, effectivePrice, 0, item.discountType || 'percentage');
      setCart(newCart);
  };

  const toggleGift = (idx: number) => {
      const newCart = [...cart];
      const item = newCart[idx];
      const newIsGift = !item.isGift;
      const effectivePrice = item.sellMode === 'box' ? item.unitPrice * (item.unitsPerBox || 1) : item.unitPrice;
      item.isGift = newIsGift;
      item.discount = 0;
      item.discountType = 'percentage';
      item.total = newIsGift ? 0 : calculateItemTotal(item.quantity, effectivePrice, 0);
      setCart(newCart);
  };

  const handleFinalizeSale = async (method: PaymentMethod) => {
      // Prevent double-click: ignore if already processing
      if (isProcessingPayment) return;
      setIsProcessingPayment(true);

      try {
      // Validate customer for INVOICE and DELIVERY_NOTE
      if (documentType !== 'TICKET') {
        const customer = customers.find(c => c.id === selectedCustomerId);
        if (!customer || customer.id === 'walk-in' || !customer.name || customer.name.toLowerCase().includes('comptoir')) {
          alert(t('customer_required_for_invoice') || 'Debe seleccionar un cliente válido para generar factura o bono de entrega');
          return;
        }
      }

      // Validate check details for Check and Traite payments
      if ((method === 'Check' || method === 'Traite') && (!checkNumber.trim() || !dueDate || !bankName.trim())) {
        alert(t('enter_check_details') || 'Veuillez remplir tous les champs: numéro, banque et date d\'échéance');
        return;
      }

      // Credit limit enforcement — Sales role is hard-blocked; Admin/Manager can confirm
      if (customerCreditStatus?.wouldExceed) {
        if (!['Admin', 'Manager'].includes(currentUser.role)) {
          alert(t('alert_credit_blocked').replace('{avail}', customerCreditStatus.availableCredit.toFixed(2)).replace('{limit}', customerCreditStatus.creditLimit.toFixed(2)));
          setIsProcessingPayment(false);
          return;
        }
        if (!confirm(t('alert_credit_confirm').replace('{avail}', customerCreditStatus.availableCredit.toFixed(2)).replace('{limit}', customerCreditStatus.creditLimit.toFixed(2)))) {
          setIsProcessingPayment(false);
          return;
        }
      }

      // Hard cost floor check — Admin exempt; others cannot sell below product cost
      for (const item of cart) {
        if (item.isGift) continue;
        if (currentUser.role === 'Admin') continue;
        const product = products.find(p => p.id === item.productId);
        if (!product || product.cost <= 0) continue;
        const costTTC = product.cost;
        const pricePerUnit = item.unitPrice;
        const discountType = item.discountType || 'percentage';
        const finalPrice = discountType === 'percentage'
          ? pricePerUnit * (1 - item.discount / 100)
          : pricePerUnit - item.discount;
        if (finalPrice < costTTC - 0.01) {
          alert(t('alert_below_cost').replace('{product}', item.productName).replace('{price}', finalPrice.toFixed(2)).replace('{cost}', costTTC.toFixed(2)));
          setIsProcessingPayment(false);
          return;
        }
      }

      const customer = customers.find(c => c.id === selectedCustomerId) || {
          id: 'walk-in',
          name: t('pos_walkin'),
          type: 'Individual',
          email: '',
          phone: '',
          address: '',
          city: ''
      } as Customer;

      const taxRate = TVA_RATES.STANDARD; // 20%

      // Reuse already calculated totals (no duplication)
      const invoice = {
        itemsSubtotal: cartTotals.itemsSubtotal,
        globalDiscountAmount: cartTotals.globalDiscountAmount,
        subtotalAfterGlobalDiscount: cartTotals.subtotal,
        totalHT: cartTotals.subtotal,
        totalTVA: cartTotals.taxAmount,
        totalTTC: cartTotals.totalTTC
      };

      // Validate company assignment (required for data isolation and invoicing)
      const companyId = selectedCompanyId || currentUser.companyId || null;
      // Non-Admin users must always have a company — RLS and server-side validation
      // in create_sale_atomic both enforce this. Block early with a clear message.
      if (!companyId && currentUser.role !== 'Admin') {
        alert('No tienes empresa asignada. Contacta al administrador.');
        return;
      }
      // Admin with companies configured must explicitly select one
      if (!companyId && companyProfiles.length > 0) {
        alert('Veuillez sélectionner une entreprise avant de créer une vente.');
        return;
      }

      // Generate sequential document number
      let documentNumber: string | undefined;
      try {
        documentNumber = await generateDocumentNumber(documentType, companyId);
        logger.info('Document number generated for POS sale', { documentType, companyId, number: documentNumber });
      } catch (error) {
        logger.error('Failed to generate document number', error);
        alert('⚠️ Impossible de générer le numéro de document. Vérifiez votre connexion et réessayez.');
        return;
      }

      const newSale: Sale = {
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          warehouseId: selectedWarehouseId,
          customerId: customer.id,
          customerName: customer.name,
          customerType: customer.type,
          items: cart,
          // Sale metadata - NEW FIELDS
          source: 'POS',
          documentType: documentType, // Use selected document type
          isFastSale: documentType === 'TICKET', // Fast sale only for tickets
          // Multi-tenant company ID
          companyId,
          // Document number (generated sequentially)
          ...(documentType === 'INVOICE' && documentNumber ? { invoiceNumber: documentNumber } : {}),
          ...(documentType === 'DELIVERY_NOTE' && documentNumber ? { deliveryNoteNumber: documentNumber } : {}),
          ...(documentType === 'TICKET' && documentNumber ? { invoiceNumber: documentNumber } : {}), // Tickets also use invoiceNumber field
          // Global discount fields
          globalDiscountType: globalDiscountValue > 0 ? globalDiscountType : undefined,
          globalDiscountValue: globalDiscountValue > 0 ? globalDiscountValue : undefined,
          globalDiscountAmount: invoice.globalDiscountAmount,
          // Financial breakdown
          itemsSubtotal: invoice.itemsSubtotal,
          subtotalAmount: invoice.subtotalAfterGlobalDiscount,
          taxRate: taxRate,
          taxAmount: invoice.totalTVA,
          totalAmount: invoice.totalTTC,
          // Payment
          amountPaid: invoice.totalTTC,
          paymentStatus: 'Paid',
          payments: [{
              id: crypto.randomUUID(),
              date: new Date().toISOString(),
              amount: invoice.totalTTC,
              method: method,
              // Add bank name for Check, Traite, and Bank Transfer
              ...(method === 'Check' || method === 'Traite' || method === 'Bank Transfer' ? {
                bankName: bankName || undefined
              } : {}),
              // Add check details for Check and Traite payments
              ...(method === 'Check' || method === 'Traite' ? {
                checkNumber: checkNumber,
                dueDate: dueDate,
                paymentStatus: 'Pending' as const
              } : {
                // Cash, Bank Transfer, Credit Card are immediately cashed
                paymentStatus: 'Cashed' as const
              }),
              recordedBy: currentUser.id
          }],
          creditedAmount: 0,
          status: 'Completed'
      };

      // ✅ Save to Supabase using hook (unified with Sales component)
      try {
        await onCreateSale(newSale, currentUser.id);
        productsHook.refresh();
      } catch (error: any) {
        logger.error('Error saving POS sale', error);
        alert(`${t('error_saving_sale') || 'Erreur lors de l\'enregistrement de la vente'} : ${error?.message || error}`);
        return;
      }
      setCompletedSale(newSale);
      setShowCheckout(false);
      setIsCartOpen(false);
      // Clear cart and persisted state
      setCart([]);
      setGlobalDiscountType('percentage');
      setGlobalDiscountValue(0);
      setSelectedCustomerId('');
      // Reset payment tracking fields
      setCheckNumber('');
      setDueDate('');
      setBankName('');
      setSelectedPaymentMethod('');
      } finally {
        setIsProcessingPayment(false);
      }
  };

  const handleClearCart = () => {
      if (cart.length > 0 && !confirm(t('confirm_clear_cart'))) return;
      setCart([]);
      setGlobalDiscountType('percentage');
      setGlobalDiscountValue(0);
      setSelectedCustomerId('');
  };

  // --- BLOQUEO SI USUARIO SIN ALMACÉN ---
  if (currentUser.role !== 'Admin' && currentUser.role !== 'Manager' && !currentUser.warehouseId) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] -m-4 lg:-m-8 bg-slate-100">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center border border-amber-200">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Aucun Entrepôt Assigné</h2>
          <p className="text-slate-600 mb-4">
            Vous n'avez pas d'entrepôt assigné pour effectuer des ventes.
          </p>
          <p className="text-sm text-slate-500">
            {t('contact_admin_warehouse')}
          </p>
        </div>
      </div>
    );
  }

  // --- RENDER ---
  return (
    <div className="flex flex-col min-h-0 -m-4 lg:-m-8 bg-slate-100 relative h-[calc(100%+2rem)] lg:h-[calc(100%+4rem)]">
      {/* Offline / pending sync banner */}
      {(!isOnline || pendingOfflineSales > 0) && (
        <div className={`flex items-center gap-2 px-4 py-2 text-sm font-medium shrink-0 ${!isOnline ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'}`}>
          {!isOnline ? (
            <><WifiOff className="w-4 h-4" /> Sin conexión — las ventas se guardan localmente y se sincronizarán al reconectar</>
          ) : (
            <><CloudUpload className="w-4 h-4" /> {pendingOfflineSales} {pendingOfflineSales === 1 ? 'venta pendiente' : 'ventas pendientes'} de sincronizar…</>
          )}
        </div>
      )}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
          
          {/* --- LEFT COLUMN: PRODUCTS GRID --- */}
          <div className="flex-1 flex flex-col p-4 overflow-hidden lg:border-r lg:border-slate-200">
              
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4 shrink-0">
                  <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                      <input 
                          type="text" 
                          placeholder={t('search_product_pos')}
                          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-shadow"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      <button onClick={() => startCamera((code) => setSearchQuery(code))} className="absolute right-2 top-2 p-1 text-slate-400 hover:text-blue-600 transition-colors">
                          <ScanBarcode className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                    <select 
                        className="w-full sm:w-40 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-medium bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                        <option value="All">{t('all_categories')}</option>
                        {Object.values(ProductCategory).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    {/* Selector de almacén - Solo visible para Admin/Manager */}
                    {(currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
                      <select
                          className="w-full sm:w-40 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-medium bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:border-blue-400 transition-colors"
                          value={selectedWarehouseId}
                          onChange={(e) => {
                              handleClearCart();
                              setSelectedWarehouseId(e.target.value);
                          }}
                      >
                          <option value="">Seleccionar almacén ({warehouses.length})</option>
                          {warehouses.length === 0 && <option disabled>Chargement des entrepôts...</option>}
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    )}

                    {/* Badge de almacén fijo para usuarios no-admin */}
                    {currentUser.role !== 'Admin' && currentUser.role !== 'Manager' && (
                      <div className="w-full sm:w-40 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-medium bg-slate-50 text-slate-700 shadow-sm flex items-center">
                        <Store className="w-4 h-4 mr-2 text-slate-500" />
                        {warehouses.find(w => w.id === selectedWarehouseId)?.name || 'Sin almacén'}
                      </div>
                    )}
                  </div>
              </div>

              {/* Product Grid */}
              <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 auto-rows-[10rem] gap-3 pb-24 lg:pb-0">
                  {filteredProducts.map(p => {
                      const stock = (p.stockLevels && p.stockLevels[selectedWarehouseId]) || 0;
                      const hasStock = stock > 0;
                      return (
                          <button
                              key={p.id}
                              onClick={() => handleAddToCart(p)}
                              disabled={!hasStock}
                              className={`flex flex-col justify-between p-3 rounded-xl border shadow-sm transition-all text-left bg-white relative group h-40
                                  ${!hasStock ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'hover:border-blue-400 hover:shadow-md active:scale-95'}
                              `}
                          >
                              <div className="w-full">
                                  <div className="flex justify-between items-start mb-2">
                                      <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded tracking-wide">
                                          {p.packSize} {p.unit}
                                      </span>
                                      <span className={`text-[10px] font-bold ${hasStock ? 'text-emerald-600' : 'text-rose-500'}`}>
                                          {formatStock(stock, p.packSize, t('boxes_unit'), t('units_abbr'))}
                                      </span>
                                  </div>
                                  <h3 className="font-bold text-slate-800 text-sm leading-tight line-clamp-2 min-h-[2.5rem]" title={p.name}>
                                      {p.name}
                                  </h3>
                                  <p className="text-[10px] text-slate-400 truncate mt-1 font-mono">{p.sku}</p>
                              </div>
                              <div className="mt-3 flex justify-between items-end">
                                  <div className="text-lg font-black text-blue-600">
                                      {p.price.toFixed(0)} <span className="text-xs text-slate-400 font-medium">{CURRENCY}</span>
                                  </div>
                                  <div className="bg-blue-50 text-blue-600 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Plus className="w-4 h-4" />
                                  </div>
                              </div>
                          </button>
                      )
                  })}
                  {filteredProducts.length === 0 && (
                      <div className="col-span-full flex flex-col items-center justify-center text-slate-400 pt-20">
                          <Search className="w-12 h-12 mb-2 opacity-20" />
                          <p>{t('no_products_found')}</p>
                      </div>
                  )}
              </div>
          </div>

          {/* --- RIGHT COLUMN: CART (Responsive) --- */}
          {/* Mobile/Tablet: Drawer (< 1024px) | Desktop: Static Sidebar (>= 1024px) */}
          <div className={`
              bg-white shadow-2xl flex flex-col min-h-0 z-30 shrink-0 border-l border-slate-200
              fixed inset-0 w-full transition-transform duration-300 ease-in-out
              lg:static lg:w-96 lg:translate-x-0 lg:shadow-none
              ${isCartOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
          `}>
              {/* Header: Title + Customer + Company inline */}
              <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
                  <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                          <Store className="w-4 h-4 mr-1.5 text-slate-600" />
                          <h2 className="font-bold text-sm text-slate-800">{t('pos')}</h2>
                          <span className="ml-2 bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{cart.length}</span>
                      </div>
                      <div className="flex items-center gap-2">
                          <button onClick={handleClearCart} className="text-[10px] text-rose-500 hover:text-rose-700 font-medium">
                              {t('clear')}
                          </button>
                          <button onClick={() => setIsCartOpen(false)} className="lg:hidden p-1.5 bg-white rounded-full shadow-sm text-slate-600">
                              <X className="w-4 h-4" />
                          </button>
                      </div>
                  </div>
                  {/* Customer + Company inline */}
                  <div className="flex gap-2">
                      {/* Searchable customer combobox (name or phone) */}
                      <div className="flex-1 relative">
                          <input
                              type="text"
                              className={`w-full p-1.5 border rounded-lg text-xs focus:ring-2 outline-none ${
                                  !selectedCustomerId
                                      ? 'border-rose-300 bg-rose-50 focus:ring-rose-500 placeholder-rose-400'
                                      : 'border-slate-300 bg-white focus:ring-blue-500'
                              }`}
                              placeholder={`-- ${t('customer')} --`}
                              value={showCustomerDropdown
                                  ? customerSearchQuery
                                  : (customers.find(c => c.id === selectedCustomerId)?.name || '')}
                              onFocus={() => { setShowCustomerDropdown(true); setCustomerSearchQuery(''); }}
                              onChange={(e) => setCustomerSearchQuery(e.target.value)}
                              onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                          />
                          {showCustomerDropdown && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                                  {filteredCustomersForSearch.length === 0 ? (
                                      <div className="px-3 py-2 text-xs text-slate-400 text-center">Sin resultados</div>
                                  ) : (
                                      filteredCustomersForSearch.map(c => (
                                          <button
                                              key={c.id}
                                              className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex justify-between items-center border-b border-slate-50 last:border-0"
                                              onMouseDown={() => {
                                                  setSelectedCustomerId(c.id);
                                                  setCustomerSearchQuery('');
                                                  setShowCustomerDropdown(false);
                                              }}
                                          >
                                              <span className="font-medium text-slate-800 truncate">{c.name}</span>
                                              {c.phone && <span className="text-slate-400 ml-2 shrink-0 font-mono">{c.phone}</span>}
                                          </button>
                                      ))
                                  )}
                              </div>
                          )}
                      </div>
                      {visibleCompanyProfiles.length > 0 && (
                          <div className="flex items-center gap-1 min-w-0 shrink-0">
                              <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <select
                                  className="p-1.5 border border-blue-300 rounded-lg text-xs bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-blue-900 max-w-[120px]"
                                  value={selectedCompanyId || ''}
                                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                              >
                                  {visibleCompanyProfiles.map((profile: any) => (
                                      <option key={profile.id} value={profile.id}>{profile.profileName}</option>
                                  ))}
                              </select>
                          </div>
                      )}
                  </div>
                  {/* Recent purchases history */}
                  {selectedCustomerId && recentCustomerSales.length > 0 && (
                      <div className="mt-2 bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
                          <div className="px-2 py-0.5 text-[9px] font-bold uppercase text-slate-400 tracking-wide">
                              Últimas compras
                          </div>
                          {recentCustomerSales.map(s => {
                              const pending = s.totalAmount - s.amountPaid - (s.creditedAmount || 0);
                              return (
                                  <div key={s.id} className="flex items-center justify-between px-2 py-1 border-t border-slate-100">
                                      <div>
                                          <span className="text-[10px] font-medium text-slate-700">
                                              {new Date(s.date).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                          </span>
                                          <span className="text-[9px] text-slate-400 ml-1">{s.invoiceNumber || s.id.slice(0, 6)}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                          <span className="text-[10px] font-bold text-slate-800">{s.totalAmount.toFixed(0)} MAD</span>
                                          {pending > 0.01 ? (
                                              <span className="text-[8px] font-bold text-rose-600 bg-rose-50 px-1 py-0.5 rounded border border-rose-100">-{pending.toFixed(0)}</span>
                                          ) : (
                                              <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100">✓</span>
                                          )}
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  )}
              </div>

              {/* Tier Badge + Grille — hidden when all marginFactors are 0 (disabled) */}
              {cart.length > 0 && tierConfigs.some(c => c.marginFactor > 0) && cart.some(i => products.find(p => p.id === i.productId)?.vipPrice) && (() => {
                const TIER_PALETTE = ['bg-slate-100 text-slate-700 border-slate-300', 'bg-amber-50 text-amber-700 border-amber-300', 'bg-slate-200 text-slate-700 border-slate-400', 'bg-yellow-50 text-yellow-700 border-yellow-400'];
                const tierConfig = tierConfigs.find(c => c.tier === orderTier);
                if (!tierConfig) return null;
                const sortedConfigs = [...tierConfigs].sort((a, b) => a.minPoints - b.minPoints);
                const publicConfigs = sortedConfigs.filter(c => c.maxPoints != null && c.maxPoints !== Infinity);
                const nextConfig = publicConfigs.find(c => c.minPoints > orderPoints);
                const tierColor = TIER_PALETTE[Math.min(orderTier - 1, TIER_PALETTE.length - 1)] || TIER_PALETTE[0];

                const calcSavings = (t: number) => cart.reduce((sum, item) => {
                  const p = products.find(pr => pr.id === item.productId);
                  if (!p?.price || !p.cost) return sum;
                  const tp = calculateTierPrice(p.price, p.cost, t, tierConfigs);
                  const base = item.sellMode === 'box' ? p.price * (item.unitsPerBox || 1) : p.price;
                  const eff = item.sellMode === 'box' ? tp * (item.unitsPerBox || 1) : tp;
                  return sum + (base - eff) * item.quantity;
                }, 0);

                const baseTotal = cart.reduce((sum, item) => {
                  const p = products.find(pr => pr.id === item.productId);
                  if (!p?.price) return sum + item.total;
                  const base = item.sellMode === 'box' ? p.price * (item.unitsPerBox || 1) : p.price;
                  return sum + base * item.quantity;
                }, 0);

                const totalSavings = calcSavings(orderTier);

                return (
                  <div className="px-3 py-2 border-b border-slate-100">
                    <button
                      onClick={() => setShowTierGrid(v => !v)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs ${tierColor} hover:opacity-90 transition-opacity`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{'★'.repeat(Math.min(orderTier, 4))}</span>
                        <span className="font-bold">{tierConfig.label}</span>
                        <span className="opacity-60">{orderPoints.toFixed(1)} pts</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {totalSavings > 0 && <span className="font-bold text-emerald-600">-{totalSavings.toFixed(2)} DH</span>}
                        {nextConfig && <span className="opacity-50">+{(nextConfig.minPoints - orderPoints).toFixed(1)}→{nextConfig.label}</span>}
                        <span className="opacity-40">{showTierGrid ? '▲' : '▼'}</span>
                      </div>
                    </button>
                    {showTierGrid && (
                      <div className="mt-1 border border-slate-200 rounded-lg overflow-hidden bg-white text-xs">
                        {publicConfigs.map((cfg, idx) => {
                          const isCurrent = cfg.tier === orderTier;
                          const isReached = orderPoints >= cfg.minPoints;
                          const rowPalette = ['text-amber-700', 'text-slate-600', 'text-yellow-700', 'text-purple-700'];
                          if (!isReached) {
                            return (
                              <div key={cfg.tier} className="flex justify-between items-center px-3 py-1.5 border-b border-slate-50 last:border-0 opacity-40">
                                <span>🔒 {cfg.label}</span>
                                <span className="text-slate-400">+{(cfg.minPoints - orderPoints).toFixed(1)} pts</span>
                                <span className="text-slate-400">{(cfg.marginFactor * 100).toFixed(0)}%</span>
                                <span className="text-slate-300">—</span>
                              </div>
                            );
                          }
                          const sav = calcSavings(cfg.tier);
                          return (
                            <div key={cfg.tier} className={`flex justify-between items-center px-3 py-1.5 border-b border-slate-50 last:border-0 ${isCurrent ? 'bg-emerald-50' : ''}`}>
                              <span className={`font-bold ${rowPalette[Math.min(idx, rowPalette.length-1)]}`}>
                                {cfg.label}{isCurrent ? ' ←' : ''}
                              </span>
                              <span className="text-emerald-600">{cfg.minPoints === 0 ? '—' : `✓ ${cfg.minPoints}pts`}</span>
                              <span className="font-bold text-slate-600">{(cfg.marginFactor * 100).toFixed(0)}%</span>
                              <span className="font-bold text-emerald-600">{sav > 0.005 ? `-${sav.toFixed(2)} DH` : '—'}</span>
                            </div>
                          );
                        })}
                        <div className="px-3 py-1 bg-slate-50 text-[10px] text-slate-400">
                          Catalogue: {baseTotal.toFixed(2)} DH · {orderPoints.toFixed(1)} pts
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Cart Items - compact table style */}
              <div className="flex-1 min-h-0 overflow-y-auto bg-white">
                  {cart.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 p-4">
                          <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
                          <p className="text-sm font-medium">{t('cart_empty')}</p>
                          <p className="text-xs">{t('scan_or_click_pos')}</p>
                      </div>
                  ) : (
                      <div className="divide-y divide-slate-100">
                          {cart.map((item, idx) => {
                              const hasBoxOption = (item.unitsPerBox || 1) > 1;
                              const isBoxMode = item.sellMode === 'box' && hasBoxOption;
                              const isGift = !!item.isGift;
                              const effectivePrice = isBoxMode
                                  ? item.unitPrice * (item.unitsPerBox || 1)
                                  : item.unitPrice;
                              return (
                              <div key={idx} className={`px-3 py-2 group transition-colors ${isGift ? 'bg-emerald-50 hover:bg-emerald-100/50' : 'hover:bg-blue-50/50'}`}>
                                  {/* Row 1: Name + Mode Toggle + Gift + Total */}
                                  <div className="flex justify-between items-center">
                                      <div className="flex items-center flex-1 min-w-0 mr-2 gap-1 flex-wrap">
                                          <p className="font-semibold text-xs text-slate-900 truncate">{item.productName}</p>
                                          {isGift && <span className="text-[8px] font-bold text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded border border-emerald-300">🎁 OFFERT</span>}
                                          {/* Sell mode badge */}
                                          {hasBoxOption && (
                                              <button
                                                  onClick={() => toggleSellMode(idx)}
                                                  className={`px-1.5 py-0.5 text-[8px] font-bold rounded flex items-center gap-0.5 shrink-0 transition-colors ${
                                                      isBoxMode
                                                          ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                                          : 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                                                  }`}
                                                  title={isBoxMode ? `${t('box_sing')} × ${item.unitsPerBox}` : t('unit_sing')}
                                              >
                                                  {isBoxMode ? <Box className="w-2.5 h-2.5" /> : <Package className="w-2.5 h-2.5" />}
                                                  {isBoxMode ? `x${item.unitsPerBox}` : 'U'}
                                              </button>
                                          )}
                                          {/* Gift toggle - only Admin/Manager can mark items as free */}
                                          {(currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
                                          <button
                                              onClick={() => toggleGift(idx)}
                                              className={`px-1 py-0.5 text-[9px] font-bold rounded transition-colors ${
                                                  isGift ? 'bg-emerald-200 text-emerald-800 hover:bg-emerald-300' : 'bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'
                                              }`}
                                              title={isGift ? 'Quitar gratuidad' : 'Marcar OFFERT'}
                                          >🎁</button>
                                          )}
                                      </div>
                                      <span className={`font-bold text-sm shrink-0 ${isGift ? 'text-emerald-600' : 'text-blue-600'}`}>{item.total.toFixed(2)}</span>
                                  </div>
                                  {/* Row 2: Qty controls + price info + discount */}
                                  <div className="flex items-center justify-between mt-1">
                                      <div className="flex items-center gap-1">
                                          <button onClick={() => handleUpdateQuantity(idx, -1)} className="w-6 h-6 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded text-slate-600 transition-colors"><Minus className="w-3 h-3" /></button>
                                          <input
                                              type="number"
                                              min="1"
                                              className="w-8 text-center font-bold text-xs text-slate-800 bg-transparent focus:outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                              value={item.quantity}
                                              onChange={(e) => handleSetItemQuantity(idx, parseInt(e.target.value) || 0)}
                                              onFocus={(e) => e.target.select()}
                                          />
                                          <button onClick={() => handleUpdateQuantity(idx, 1)} className="w-6 h-6 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded text-slate-600 transition-colors"><Plus className="w-3 h-3" /></button>
                                          <span className="text-[10px] text-slate-400 ml-1">
                                              x {effectivePrice.toFixed(2)}
                                              <span className="text-[8px] ml-0.5">{isBoxMode ? t('per_box') : '/u'}</span>
                                          </span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                          {/* Inline discount with type toggle */}
                                          <input
                                              type="number"
                                              min="0"
                                              max={(item.discountType || 'percentage') === 'percentage' ? maxLineDiscountPercent : undefined}
                                              step={(item.discountType || 'percentage') === 'fixed' ? 0.01 : 1}
                                              className={`w-12 border rounded px-1 py-0.5 text-center text-[10px] font-bold focus:ring-1 focus:ring-blue-500 outline-none ${item.discount > 0 ? 'border-rose-300 text-rose-600 bg-rose-50' : 'border-slate-200 text-slate-400 bg-slate-50'}`}
                                              value={item.discount}
                                              onChange={(e) => {
                                                  const val = parseFloat(e.target.value) || 0;
                                                  const isPercent = (item.discountType || 'percentage') === 'percentage';
                                                  const maxFixed = item.unitPrice * (item.sellMode === 'box' ? (item.unitsPerBox || 1) : 1) * (maxLineDiscountPercent / 100);
                                                  handleUpdateDiscount(idx, Math.max(0, isPercent ? Math.min(maxLineDiscountPercent, val) : Math.min(maxFixed, val)));
                                              }}
                                              onFocus={(e) => e.target.select()}
                                          />
                                          <button
                                              onClick={() => toggleItemDiscountType(idx)}
                                              className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition-colors ${
                                                  (item.discountType || 'percentage') === 'fixed'
                                                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                              }`}
                                              title={(item.discountType || 'percentage') === 'percentage' ? 'Passer en MAD' : isBoxMode ? 'DH par unité (× unités de la caisse)' : 'Passer en %'}
                                          >
                                              {(item.discountType || 'percentage') === 'percentage' ? '%' : isBoxMode ? 'DH/u' : 'DH'}
                                          </button>
                                          {/* Hint: fixed DH discount in box mode is per unit */}
                                          {isBoxMode && (item.discountType || 'percentage') === 'fixed' && item.discount > 0 && (
                                              <span className="text-[8px] text-amber-600 ml-0.5">×{item.unitsPerBox}</span>
                                          )}
                                          {/* Delete button */}
                                          <button
                                              onClick={() => setCart(cart.filter((_, i) => i !== idx))}
                                              className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                                          >
                                              <X className="w-3 h-3" />
                                          </button>
                                      </div>
                                  </div>
                              </div>
                              );
                          })}
                      </div>
                  )}
              </div>

              {/* Footer: Totals + Pay button - always visible */}
              <div className="px-3 py-2 bg-slate-900 text-white shrink-0">
                  {/* Global discount toggle */}
                  <button
                      onClick={() => setShowDiscount(!showDiscount)}
                      className="flex items-center w-full text-[10px] text-slate-400 hover:text-slate-200 transition-colors mb-1"
                  >
                      <Tag className="w-3 h-3 mr-1" />
                      <span>{t('global_discount')}</span>
                      {globalDiscountValue > 0 && (
                          <span className="ml-1 text-rose-400 font-bold">
                              -{globalDiscountType === 'percentage' ? `${globalDiscountValue}%` : `${globalDiscountValue} DH`}
                          </span>
                      )}
                      <ChevronUp className={`w-3 h-3 ml-auto transition-transform ${showDiscount ? '' : 'rotate-180'}`} />
                  </button>
                  {showDiscount && maxGlobalDiscountPercent > 0 ? (
                      <div className="flex items-center gap-2 mb-2">
                          <div className="flex bg-slate-800 rounded p-0.5 shrink-0">
                              <button onClick={() => setGlobalDiscountType('percentage')} className={`px-2 py-0.5 rounded text-[10px] font-bold ${globalDiscountType === 'percentage' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>%</button>
                              <button onClick={() => setGlobalDiscountType('fixed')} className={`px-2 py-0.5 rounded text-[10px] font-bold ${globalDiscountType === 'fixed' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>DH</button>
                          </div>
                          <input
                              type="number" min="0" max={globalDiscountType === 'percentage' ? maxGlobalDiscountPercent : cartTotals.itemsSubtotal * (maxGlobalDiscountPercent / 100)}
                              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-right text-xs font-bold text-white focus:ring-1 focus:ring-blue-500 outline-none"
                              value={globalDiscountValue}
                              onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const max = globalDiscountType === 'percentage' ? maxGlobalDiscountPercent : cartTotals.itemsSubtotal * (maxGlobalDiscountPercent / 100);
                                  setGlobalDiscountValue(Math.max(0, Math.min(max, val)));
                              }}
                              onFocus={(e) => e.target.select()}
                          />
                      </div>
                  ) : showDiscount && (
                      <div className="mb-2 p-2 bg-slate-800 rounded text-slate-400 text-[10px] text-center">
                          Remise globale non autorisée pour votre rôle
                      </div>
                  )}

                  {/* Credit limit warning */}
                  {customerCreditStatus?.wouldExceed && (
                      <div className="mb-2 p-2 bg-amber-900/50 border border-amber-600 rounded-lg text-amber-200 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <div>
                              <span className="font-bold">{t('credit_limit_warning') || 'Limite de crédit dépassée!'}</span>
                              <span className="block text-amber-300/80">
                                  {t('available') || 'Disponible'}: {customerCreditStatus.availableCredit.toFixed(2)} / {customerCreditStatus.creditLimit.toFixed(2)} MAD
                              </span>
                          </div>
                      </div>
                  )}

                  {/* Totals row */}
                  <div className="flex justify-between items-baseline text-[10px] text-slate-400 mb-1">
                      <span>HT: {cartTotals.subtotal.toFixed(2)} | TVA: {cartTotals.taxAmount.toFixed(2)}
                          {globalDiscountValue > 0 && <span className="text-rose-400"> | -{cartTotals.globalDiscountAmount.toFixed(2)}</span>}
                      </span>
                  </div>

                  {/* Total + Pay button on same level */}
                  <div className="flex items-center gap-3">
                      <div className="flex-1">
                          <div className="text-2xl font-black tracking-tight">
                              {cartTotals.totalTTC.toFixed(2)} <span className="text-xs font-normal text-slate-400">DH</span>
                          </div>
                      </div>
                      <button
                          onClick={() => {
                              setShowCheckout(true);
                          }}
                          disabled={cart.length === 0 || selectedCustomerId === ''}
                          className={`px-6 py-3 rounded-xl font-bold text-sm shadow-lg transition-all transform active:scale-95 flex items-center ${
                              cart.length === 0 || selectedCustomerId === '' ? 'bg-slate-700 text-slate-500 cursor-not-allowed' :
                              customerCreditStatus?.wouldExceed ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-emerald-500 text-white hover:bg-emerald-600'
                          }`}
                      >
                          <Banknote className="w-5 h-5 mr-1.5" />
                          {t('checkout')}
                      </button>
                  </div>
              </div>
          </div>
      </div>

      {/* --- MOBILE FLOATING BAR (Only visible < 1024px) --- */}
      {!isCartOpen && (
          <div className="lg:hidden absolute bottom-6 left-4 right-4 z-20 animate-in slide-in-from-bottom-10 duration-500">
              <button 
                  onClick={() => setIsCartOpen(true)}
                  className="w-full bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex justify-between items-center font-bold border border-slate-700 backdrop-blur-md bg-opacity-95"
              >
                  <div className="flex items-center">
                      <div className="bg-blue-600 w-8 h-8 rounded-full flex items-center justify-center mr-3 shadow-md border border-blue-400 relative">
                          <span className="text-xs">{cart.length}</span>
                      </div>
                      <span className="text-sm font-medium">{t('view_cart')}</span>
                  </div>
                  <div className="flex items-center">
                      <span className="text-lg mr-2">{cartTotals.totalTTC.toFixed(2)}</span>
                      <span className="text-xs text-slate-400 font-normal">DH</span>
                      <ChevronUp className="w-5 h-5 ml-2 text-slate-400" />
                  </div>
              </button>
          </div>
      )}

      {/* --- CHECKOUT MODAL --- */}
      {showCheckout && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900 bg-opacity-80 backdrop-blur-sm">
              <div className="bg-white w-full max-w-md rounded-2xl overflow-y-auto max-h-[90vh] shadow-2xl animate-in zoom-in-95">
                  <div className="p-6 text-center">
                      <h2 className="text-2xl font-bold text-slate-900 mb-1">{t('checkout')}</h2>
                      <p className="text-slate-500">{t('select_payment_method')}</p>

                      {/* Document Type Selector */}
                      <div className="mt-6 mb-4">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          {t('document_type') || 'Tipo de Documento'}
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => setDocumentType('TICKET')}
                            className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                              documentType === 'TICKET'
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <Receipt className="w-6 h-6 mb-1" />
                            <span className="text-xs font-bold">{t('ticket') || 'Ticket'}</span>
                          </button>
                          <button
                            onClick={() => setDocumentType('INVOICE')}
                            className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                              documentType === 'INVOICE'
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <FileText className="w-6 h-6 mb-1" />
                            <span className="text-xs font-bold">{t('invoice')}</span>
                          </button>
                          <button
                            onClick={() => setDocumentType('DELIVERY_NOTE')}
                            className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                              documentType === 'DELIVERY_NOTE'
                                ? 'border-amber-500 bg-amber-50 text-amber-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <Truck className="w-6 h-6 mb-1" />
                            <span className="text-xs font-bold">{t('delivery_note')}</span>
                          </button>
                        </div>
                        {documentType !== 'TICKET' && (
                          <p className="mt-2 text-xs text-amber-600 font-medium">
                            ⚠️ {t('customer_required') || 'Requiere cliente válido'}
                          </p>
                        )}
                      </div>

                      <div className="my-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                          <div className="text-5xl font-black text-blue-600 mb-2 tracking-tight">
                              {cartTotals.totalTTC.toFixed(2)}
                          </div>
                          <div className="text-sm text-slate-400 font-bold uppercase tracking-widest">{t('total_ttc')} (MAD)</div>
                      </div>

                      <label className="block text-sm font-semibold text-slate-700 mb-3 text-left">
                          {t('payment_method')}
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                          <button
                              onClick={() => handleFinalizeSale('Cash')}
                              disabled={isProcessingPayment}
                              className={`flex flex-col items-center justify-center p-4 bg-emerald-50 border-2 border-emerald-100 rounded-xl transition-all group ${isProcessingPayment ? 'opacity-50 cursor-not-allowed' : 'hover:border-emerald-500 hover:bg-emerald-100 active:scale-95'}`}
                          >
                              <div className="bg-white p-3 rounded-full mb-2 shadow-sm group-hover:scale-110 transition-transform">
                                  {isProcessingPayment ? <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" /> : <Coins className="w-6 h-6 text-emerald-600" />}
                              </div>
                              <span className="font-bold text-sm text-emerald-800">{isProcessingPayment ? 'Traitement...' : t('cash')}</span>
                          </button>

                          <button
                              onClick={() => handleFinalizeSale('Credit Card')}
                              disabled={isProcessingPayment}
                              className={`flex flex-col items-center justify-center p-4 bg-blue-50 border-2 border-blue-100 rounded-xl transition-all group ${isProcessingPayment ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-500 hover:bg-blue-100 active:scale-95'}`}
                          >
                              <div className="bg-white p-3 rounded-full mb-2 shadow-sm group-hover:scale-110 transition-transform">
                                  {isProcessingPayment ? <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /> : <CreditCard className="w-6 h-6 text-blue-600" />}
                              </div>
                              <span className="font-bold text-sm text-blue-800">{isProcessingPayment ? 'Traitement...' : t('card')}</span>
                          </button>

                          <button
                              onClick={() => setSelectedPaymentMethod('Check')}
                              disabled={isProcessingPayment}
                              className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all group ${isProcessingPayment ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'} ${
                                selectedPaymentMethod === 'Check'
                                  ? 'bg-amber-100 border-amber-500'
                                  : 'bg-amber-50 border-amber-100 hover:border-amber-500 hover:bg-amber-100'
                              }`}
                          >
                              <div className="bg-white p-3 rounded-full mb-2 shadow-sm group-hover:scale-110 transition-transform">
                                  <FileCheck className="w-6 h-6 text-amber-600" />
                              </div>
                              <span className="font-bold text-sm text-amber-800">{t('check')}</span>
                          </button>

                          <button
                              onClick={() => setSelectedPaymentMethod('Bank Transfer')}
                              disabled={isProcessingPayment}
                              className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all group ${isProcessingPayment ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'} ${
                                selectedPaymentMethod === 'Bank Transfer'
                                  ? 'bg-indigo-100 border-indigo-500'
                                  : 'bg-indigo-50 border-indigo-100 hover:border-indigo-500 hover:bg-indigo-100'
                              }`}
                          >
                              <div className="bg-white p-3 rounded-full mb-2 shadow-sm group-hover:scale-110 transition-transform">
                                  <Landmark className="w-6 h-6 text-indigo-600" />
                              </div>
                              <span className="font-bold text-sm text-indigo-800">{t('virement')}</span>
                          </button>

                          <button
                              onClick={() => setSelectedPaymentMethod('Traite')}
                              disabled={isProcessingPayment}
                              className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all group col-span-2 ${isProcessingPayment ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'} ${
                                selectedPaymentMethod === 'Traite'
                                  ? 'bg-purple-100 border-purple-500'
                                  : 'bg-purple-50 border-purple-100 hover:border-purple-500 hover:bg-purple-100'
                              }`}
                          >
                              <div className="bg-white p-3 rounded-full mb-2 shadow-sm group-hover:scale-110 transition-transform">
                                  <FileSignature className="w-6 h-6 text-purple-600" />
                              </div>
                              <span className="font-bold text-sm text-purple-800">{t('traite')}</span>
                          </button>
                      </div>

                      {/* Check/Traite Details Form */}
                      {(selectedPaymentMethod === 'Check' || selectedPaymentMethod === 'Traite') && (
                          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                              <div className="flex items-center text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                                  <FileCheck className="w-4 h-4 mr-1.5" />
                                  <span>Détails du {selectedPaymentMethod === 'Check' ? 'chèque' : 'traite'}</span>
                              </div>

                              <div>
                                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                      Numéro de {selectedPaymentMethod === 'Check' ? 'chèque' : 'traite'} <span className="text-rose-600">*</span>
                                  </label>
                                  <input
                                      type="text"
                                      value={checkNumber}
                                      onChange={(e) => setCheckNumber(e.target.value)}
                                      placeholder="Ex: 1234567"
                                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                                  />
                              </div>

                              <div>
                                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                      Banque <span className="text-rose-600">*</span>
                                  </label>
                                  <input
                                      type="text"
                                      required
                                      value={bankName}
                                      onChange={(e) => setBankName(e.target.value)}
                                      placeholder="Ex: Attijariwafa, BMCE, CIH..."
                                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                                  />
                              </div>

                              <div>
                                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                      Date d'échéance <span className="text-rose-600">*</span>
                                  </label>
                                  <input
                                      type="date"
                                      value={dueDate}
                                      onChange={(e) => setDueDate(e.target.value)}
                                      min={new Date().toISOString().split('T')[0]}
                                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                                  />
                              </div>

                              <button
                                  onClick={() => handleFinalizeSale(selectedPaymentMethod as PaymentMethod)}
                                  disabled={!checkNumber.trim() || !dueDate || !bankName.trim() || isProcessingPayment}
                                  className={`w-full py-3 font-bold rounded-xl transition-all ${
                                      !checkNumber.trim() || !dueDate || isProcessingPayment
                                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                          : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 active:scale-95 shadow-lg'
                                  }`}
                              >
                                  Confirmer le paiement
                              </button>
                          </div>
                      )}

                      {/* Bank Transfer Details Form */}
                      {selectedPaymentMethod === 'Bank Transfer' && (
                          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                              <div className="flex items-center text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                                  <Landmark className="w-4 h-4 mr-1.5" />
                                  <span>Détails du virement</span>
                              </div>

                              <div>
                                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                      Banque
                                  </label>
                                  <input
                                      type="text"
                                      value={bankName}
                                      onChange={(e) => setBankName(e.target.value)}
                                      placeholder="Ex: Attijariwafa, BMCE, CIH..."
                                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                  />
                              </div>

                              <button
                                  onClick={() => handleFinalizeSale('Bank Transfer')}
                                  disabled={isProcessingPayment}
                                  className={`w-full py-3 font-bold rounded-xl transition-all ${
                                      isProcessingPayment
                                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                          : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 active:scale-95 shadow-lg'
                                  }`}
                              >
                                  Confirmer le virement
                              </button>
                          </div>
                      )}
                  </div>
                  <div className="bg-slate-50 p-4 border-t border-slate-200">
                      <button 
                          onClick={() => setShowCheckout(false)}
                          className="w-full py-3 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors"
                      >
                          {t('cancel')}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- RECEIPT PREVIEW --- */}
      {completedSale && (
          <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="text-white text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>Chargement du reçu...</div></div>}>
            <PrintableDocument
                sale={completedSale}
                type={completedSale.documentType === 'TICKET' ? 'INVOICE' : completedSale.documentType}
                format={completedSale.documentType === 'TICKET' ? 'TICKET' : 'A4'}
                customer={customers.find(c => c.id === completedSale.customerId)}
                warehouse={warehouses.find(w => w.id === completedSale.warehouseId)}
                companySettings={effectiveCompanySettings}
                products={products}
                onClose={() => setCompletedSale(null)}
            />
          </Suspense>
      )}

      {/* --- CAMERA SCANNER --- */}
      <CameraModal 
        isOpen={isCameraOpen}
        videoRef={videoRef}
        onClose={stopCamera}
        onSimulateScan={handleSimulatedScan}
      />
    </div>
  );
};

export default POS;
