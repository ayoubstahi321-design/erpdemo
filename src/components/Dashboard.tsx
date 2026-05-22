
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, AlertTriangle, Package, DollarSign, Lock, Truck, ArrowRightLeft, Banknote, AlertCircle, Plus, X, Pencil, Save, RotateCcw, Layout, ShoppingCart, Activity, Store, Building2, Clock, Wallet, ArrowRight, ChevronDown, Settings2 } from 'lucide-react';
import { Product, Sale, User, Transfer, DashboardWidget, DashboardWidgetType, DashboardConfig, Warehouse, CompanySettings, VolumeTier, Customer } from '../types';
import { CURRENCY } from '../constants';
import { useLanguage } from '../services/i18n';
import { dataService, KEYS } from '../services/dataService';
import { logger } from '../utils/logger';
import { useProducts, useWarehouses, useSales, useTransfers } from '../hooks/useSupabaseData';
import { supabase } from '../services/supabaseClient';

interface DashboardProps {
  products: Product[];
  sales: Sale[];
  transfers: Transfer[];
  currentUser: User;
  warehouses?: Warehouse[];
  customers?: Customer[];
  companySettings?: CompanySettings;
  onUpdateSettings?: (s: CompanySettings) => void;
}

// Widget Definitions (Metadata)
const WIDGET_DEFINITIONS: Record<DashboardWidgetType, { label: string; icon: any; defaultW: number; role: string[] }> = {
    'kpi_revenue': { label: 'total_revenue', icon: DollarSign, defaultW: 1, role: ['Admin', 'Manager', 'Sales'] },
    'kpi_profit': { label: 'estimated_profit', icon: TrendingUp, defaultW: 1, role: ['Admin', 'Manager'] },
    'kpi_receivables': { label: 'total_receivables', icon: Banknote, defaultW: 1, role: ['Admin', 'Manager', 'Sales'] },
    'kpi_orders': { label: 'total_orders', icon: ShoppingCart, defaultW: 1, role: ['Admin', 'Manager', 'Sales', 'Delivery'] },
    'kpi_inventory_value': { label: 'inventory_value', icon: Package, defaultW: 1, role: ['Admin', 'Manager'] },
    'kpi_low_stock': { label: 'low_stock_alert', icon: AlertTriangle, defaultW: 1, role: ['Admin', 'Manager', 'Sales', 'Delivery'] },
    'chart_finance': { label: 'financial_evolution', icon: Activity, defaultW: 2, role: ['Admin', 'Manager'] },
    'chart_cashflow': { label: 'cash_flow', icon: Banknote, defaultW: 1, role: ['Admin', 'Manager', 'Sales'] },
    'chart_monthly_sales': { label: 'monthly_sales_trend', icon: TrendingUp, defaultW: 2, role: ['Admin', 'Manager'] },
    'chart_pos_vs_b2b': { label: 'pos_vs_b2b_comparison', icon: Activity, defaultW: 2, role: ['Admin', 'Manager'] },
    'chart_top_products': { label: 'top_products_chart', icon: Package, defaultW: 2, role: ['Admin', 'Manager', 'Sales'] },
    'list_payment_alerts': { label: 'payment_alerts', icon: AlertCircle, defaultW: 1, role: ['Admin', 'Manager', 'Sales'] },
    'list_low_stock': { label: 'stock_alerts', icon: AlertTriangle, defaultW: 1, role: ['Admin', 'Manager', 'Sales', 'Delivery'] },
    'list_recent_transfers': { label: 'recent_transfers', icon: ArrowRightLeft, defaultW: 2, role: ['Admin', 'Manager', 'Delivery'] },
    'list_top_products': { label: 'top_products', icon: TrendingUp, defaultW: 1, role: ['Admin', 'Manager', 'Sales'] },
    'list_debtor_customers': { label: 'debtor_customers', icon: AlertCircle, defaultW: 1, role: ['Admin', 'Manager', 'Sales'] },
    'list_warehouse_alerts': { label: 'warehouse_alerts', icon: AlertTriangle, defaultW: 1, role: ['Admin', 'Manager'] },
    'list_daily_sales': { label: 'daily_sales', icon: DollarSign, defaultW: 1, role: ['Admin', 'Manager', 'Sales'] },
    'list_warehouse_margin': { label: 'warehouse_margin', icon: TrendingUp, defaultW: 2, role: ['Admin', 'Manager'] },
    'list_profit_by_commercial': { label: 'profit_by_commercial', icon: TrendingUp, defaultW: 2, role: ['Admin', 'Manager'] },
};

const Dashboard: React.FC<DashboardProps> = ({ products: propsProducts, sales: propsSales, transfers: propsTransfers = [], currentUser, warehouses: propsWarehouses = [], customers = [], companySettings, onUpdateSettings }) => {
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // ─── Volume Discount Settings (Admin only) ───────────────────────────────
  const DEFAULT_VOLUME_TIERS: VolumeTier[] = [
    { id: 'vt_argent',  label: 'Argent',  minAmount: 3000,  discountPerBox: 10 },
    { id: 'vt_or',      label: 'Or',      minAmount: 5000,  discountPerBox: 15 },
    { id: 'vt_platine', label: 'Platine', minAmount: 10000, discountPerBox: 20 },
  ];

  const [editingVolumeTiers, setEditingVolumeTiers] = useState<VolumeTier[]>(
    companySettings?.volumeTiers?.length ? companySettings.volumeTiers : DEFAULT_VOLUME_TIERS
  );
  const [volumeDiscountEnabled, setVolumeDiscountEnabled] = useState(
    companySettings?.volumeDiscountEnabled ?? false
  );
  const [volumeTierSaved, setVolumeTierSaved] = useState(false);

  React.useEffect(() => {
    setEditingVolumeTiers(companySettings?.volumeTiers?.length ? companySettings.volumeTiers : DEFAULT_VOLUME_TIERS);
    setVolumeDiscountEnabled(companySettings?.volumeDiscountEnabled ?? false);
  }, [companySettings]);

  const handleVolumeTierChange = (id: string, field: keyof VolumeTier, value: string) => {
    setEditingVolumeTiers(prev => prev.map(t =>
      t.id === id ? { ...t, [field]: field === 'label' ? value : parseFloat(value) || 0 } : t
    ));
    setVolumeTierSaved(false);
  };

  const handleAddVolumeTier = () => {
    const newTier: VolumeTier = {
      id: `vt_${Date.now()}`,
      label: `Niveau ${editingVolumeTiers.length + 1}`,
      minAmount: 0,
      discountPerBox: 0,
    };
    setEditingVolumeTiers(prev => [...prev, newTier]);
    setVolumeTierSaved(false);
  };

  const handleRemoveVolumeTier = (id: string) => {
    setEditingVolumeTiers(prev => prev.filter(t => t.id !== id));
    setVolumeTierSaved(false);
  };

  const handleSaveVolumeTiers = () => {
    if (!companySettings || !onUpdateSettings) return;
    onUpdateSettings({ ...companySettings, volumeTiers: editingVolumeTiers, volumeDiscountEnabled });
    setVolumeTierSaved(true);
    setTimeout(() => setVolumeTierSaved(false), 2000);
  };
  // ──────────────────────────────────────────────────────────────────────────

  // Profit-by-commercial drill-down state
  const [expandedCommercialId, setExpandedCommercialId] = useState<string | null>(null);
  const [salesRepProfiles, setSalesRepProfiles] = useState<Record<string, string>>({});

  useEffect(() => {
    if (currentUser.role !== 'Admin' && currentUser.role !== 'Manager') return;
    supabase
      .from('profiles')
      .select('id, name')
      .eq('role', 'Sales')
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((p: any) => { map[p.id] = p.name; });
          setSalesRepProfiles(map);
        }
      });
  }, [currentUser.role]);

  // ✅ Use Supabase hooks for real-time data synchronization
  const productsHook = useProducts();
  const warehousesHook = useWarehouses();
  const salesHook = useSales();
  const transfersHook = useTransfers();

  // ✅ Use hook data directly (Supabase)
  const products = productsHook.products;
  const warehouses = warehousesHook.warehouses;
  const sales = salesHook.sales;
  const transfers = transfersHook.transfers;

  // Debug: Log warehouses and products
  useEffect(() => {
    logger.debug('Dashboard data sync', { 
      productsCount: products.length, 
      warehousesCount: warehouses.length,
      salesCount: sales.length,
      transfersCount: transfers.length,
      loading: productsHook.loading || warehousesHook.loading
    });
  }, [products, warehouses, sales, transfers, productsHook.loading, warehousesHook.loading]);

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      logger.debug('Dashboard: Auto-refresh triggered');
      Promise.all([
        productsHook.refresh(),
        warehousesHook.refresh(),
        salesHook.refresh(),
        transfersHook.refresh()
      ]).catch(err => logger.error('Auto-refresh error', err));
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [productsHook, warehousesHook, salesHook, transfersHook]);

  // Warehouse Filter - Prioridad: almacén asignado > localStorage > fallback
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() => {
    // 1. Si el usuario tiene almacén asignado, SIEMPRE usarlo (prioridad absoluta)
    if (currentUser.warehouseId) {
      return currentUser.warehouseId;
    }
    // 2. Solo si NO tiene almacén asignado, usar localStorage
    const saved = localStorage.getItem('dashboard_warehouse_id');
    if (saved && (saved === 'ALL' || warehouses.some(w => w.id === saved))) {
      return saved;
    }
    // 3. Fallback: Admin/Manager ve ALL, otros ven primer almacén
    if (currentUser.role === 'Admin' || currentUser.role === 'Manager') return 'ALL';
    return warehouses.length > 0 ? warehouses[0].id : 'ALL';
  });

  // Forzar almacén asignado cuando el usuario cambie (ej: login de otro usuario)
  useEffect(() => {
    if (currentUser.warehouseId && selectedWarehouseId !== currentUser.warehouseId) {
      setSelectedWarehouseId(currentUser.warehouseId);
    }
  }, [currentUser.warehouseId]);

  // Guardar selección en localStorage (solo si NO tiene almacén asignado)
  useEffect(() => {
    if (selectedWarehouseId && !currentUser.warehouseId) {
      localStorage.setItem('dashboard_warehouse_id', selectedWarehouseId);
      logger.debug('Dashboard warehouse saved to localStorage', { warehouseId: selectedWarehouseId });
    }
  }, [selectedWarehouseId]);

  // Auto-seleccionar primer almacén si el guardado ya no existe
  useEffect(() => {
    if (warehouses.length > 0) {
      const saved = localStorage.getItem('dashboard_warehouse_id');
      if (saved && saved !== 'ALL' && !warehouses.some(w => w.id === saved)) {
        // El almacén guardado ya no existe, seleccionar primero disponible
        const newId = currentUser.role === 'Admin' ? 'ALL' : warehouses[0].id;
        setSelectedWarehouseId(newId);
        logger.debug('Dashboard warehouse reset (saved not found)', { newId });
      }
    }
  }, [warehouses, currentUser.role]);
  
  // Default layouts based on Role
  const getDefaultLayout = (): DashboardWidget[] => {
      if (currentUser.role === 'Admin') {
          return [
              { id: '1', type: 'kpi_revenue', w: 1 },
              { id: '2', type: 'kpi_profit', w: 1 },
              { id: '3', type: 'kpi_receivables', w: 1 },
              { id: '4', type: 'kpi_inventory_value', w: 1 },
              { id: '5', type: 'chart_finance', w: 2 },
              { id: '6', type: 'chart_cashflow', w: 1 },
              { id: '7', type: 'list_payment_alerts', w: 1 },
              { id: '8', type: 'list_warehouse_margin', w: 2 },
              { id: '9', type: 'list_profit_by_commercial', w: 2 },
          ];
      } else if (currentUser.role === 'Manager') {
          return [
              { id: '1', type: 'kpi_revenue', w: 1 },
              { id: '2', type: 'kpi_inventory_value', w: 1 },
              { id: '3', type: 'kpi_receivables', w: 1 },
              { id: '4', type: 'kpi_low_stock', w: 1 },
              { id: '5', type: 'chart_finance', w: 2 },
              { id: '6', type: 'list_recent_transfers', w: 2 },
              { id: '7', type: 'list_warehouse_margin', w: 2 },
              { id: '8', type: 'list_profit_by_commercial', w: 2 },
          ];
      } else if (currentUser.role === 'Sales') {
          return [
              { id: '1', type: 'kpi_orders', w: 1 },
              { id: '2', type: 'kpi_revenue', w: 1 },
              { id: '3', type: 'kpi_low_stock', w: 1 },
              { id: '4', type: 'chart_cashflow', w: 1 },
              { id: '5', type: 'list_payment_alerts', w: 2 }
          ];
      } else {
           return [
              { id: '1', type: 'kpi_orders', w: 1 },
              { id: '2', type: 'list_recent_transfers', w: 2 },
              { id: '3', type: 'list_low_stock', w: 1 }
          ];
      }
  };

  const [layout, setLayout] = useState<DashboardWidget[]>([]);

  // Load layout on mount — auto-inject new widgets if missing from saved layout
  useEffect(() => {
      try {
          const savedConfig = dataService.load<DashboardConfig[]>(KEYS.DASHBOARD_CONFIG, []);
          if (Array.isArray(savedConfig)) {
              const userConfig = savedConfig.find(c => c.userId === currentUser.id);
              if (userConfig && Array.isArray(userConfig.layout)) {
                  let loaded = userConfig.layout;
                  // Inject list_warehouse_margin for Admin/Manager if not already present
                  if (
                      (currentUser.role === 'Admin' || currentUser.role === 'Manager') &&
                      !loaded.some(w => w.type === 'list_warehouse_margin')
                  ) {
                      loaded = [...loaded, { id: 'wm_auto', type: 'list_warehouse_margin', w: 2 }];
                  }
                  // Inject list_profit_by_commercial for Admin/Manager if not already present
                  if (
                      (currentUser.role === 'Admin' || currentUser.role === 'Manager') &&
                      !loaded.some(w => w.type === 'list_profit_by_commercial')
                  ) {
                      loaded = [...loaded, { id: 'pc_auto', type: 'list_profit_by_commercial', w: 2 }];
                  }
                  setLayout(loaded);
              } else {
                  setLayout(getDefaultLayout());
              }
          } else {
              setLayout(getDefaultLayout());
          }
      } catch (e) {
          logger.error("Error loading dashboard config", e);
          setLayout(getDefaultLayout());
      }
  }, [currentUser.id]);

  const saveLayout = (newLayout: DashboardWidget[]) => {
      setLayout(newLayout);
      const allConfigs = dataService.load<DashboardConfig[]>(KEYS.DASHBOARD_CONFIG, []);
      const otherConfigs = allConfigs.filter(c => c.userId !== currentUser.id);
      const newConfig: DashboardConfig = { userId: currentUser.id, layout: newLayout };
      dataService.save(KEYS.DASHBOARD_CONFIG, [...otherConfigs, newConfig]);
  };

  const toggleEdit = () => {
      if (isEditing) {
          // Save when exiting edit mode
          saveLayout(layout);
      }
      setIsEditing(!isEditing);
  };

  const removeWidget = (id: string) => {
      saveLayout(layout.filter(w => w.id !== id));
  };

  const addWidget = (type: DashboardWidgetType) => {
      const def = WIDGET_DEFINITIONS[type];
      if (!def) return; // Guard against unknown types
      const newWidget: DashboardWidget = {
          id: `w-${Date.now()}`,
          type,
          w: def.defaultW
      };
      saveLayout([...layout, newWidget]);
      setShowAddModal(false);
  };

  const resetLayout = () => {
      if (confirm(t('reset_dashboard'))) {
          const def = getDefaultLayout();
          saveLayout(def);
          setIsEditing(false);
      }
  };

  // --- FILTRADO POR ALMACÉN ---
  const filteredSales = useMemo(() => {
    const validSales = (sales || []).filter(s =>
      s.status !== 'Cancelled' &&
      s.returnStatus !== 'full' &&
      s.documentType !== 'QUOTE'
    );
    if (selectedWarehouseId === 'ALL') return validSales;
    return validSales.filter(s => s.warehouseId === selectedWarehouseId);
  }, [sales, selectedWarehouseId]);

  const filteredTransfers = useMemo(() => {
    if (selectedWarehouseId === 'ALL') return transfers || [];
    return (transfers || []).filter(t =>
      t.fromWarehouseId === selectedWarehouseId || t.toWarehouseId === selectedWarehouseId
    );
  }, [transfers, selectedWarehouseId]);

  // --- CALCULATION HELPERS ---
  const totalRevenue = filteredSales.reduce((acc, sale) => acc + (sale.totalAmount || 0), 0);
  const totalOrders = filteredSales.length;

  let estimatedProfit = 0;
  let totalReceivables = 0;
  let totalCollected = 0;

  filteredSales.forEach(sale => {
      const pendingAmount = (sale.totalAmount || 0) - (sale.amountPaid || 0) - (sale.creditedAmount || 0);
      totalReceivables += Math.max(0, pendingAmount);
      totalCollected += (sale.amountPaid || 0);

      if (sale.items) {
          sale.items.forEach(item => {
              const product = products.find(p => p.id === item.productId);
              if (product && product.cost) {
                  // Convert quantity to individual units — when sold by box, quantity = boxes not units
                  const actualUnits = item.sellMode === 'box'
                      ? item.quantity * (item.unitsPerBox || 1)
                      : item.quantity;
                  const cost = product.cost * actualUnits;
                  estimatedProfit += ((item.total ?? 0) - cost);
              }
          });
      }
  });

  // Inventory value: solo del almacén seleccionado
  const inventoryValue = (products || []).reduce((acc, p) => {
      if (!p.stockLevels) return acc;
      if (selectedWarehouseId === 'ALL') {
        const totalStock = (Object.values(p.stockLevels) as number[]).reduce((a, b) => a + b, 0);
        return acc + (totalStock * (p.cost || 0));
      } else {
        const stock = p.stockLevels[selectedWarehouseId] || 0;
        return acc + (stock * (p.cost || 0));
      }
  }, 0);

  // --- ANALYTICAL WIDGETS DATA (moved from render function to fix React Hooks rules) ---
  // Monthly Sales Data (POS vs B2B)
  const monthlySalesData = useMemo(() => {
      const monthlyData: Record<string, { month: string; POS: number; B2B: number }> = {};
      for (let i = 11; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const key = d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' });
          monthlyData[key] = { month: key, POS: 0, B2B: 0 };
      }
      filteredSales.forEach(sale => {
          const saleDate = new Date(sale.date);
          const monthKey = saleDate.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' });
          if (monthlyData[monthKey]) {
              const amount = sale.totalAmount || 0;
              if (sale.source === 'POS') monthlyData[monthKey].POS += amount;
              else monthlyData[monthKey].B2B += amount;
          }
      });
      return Object.values(monthlyData);
  }, [filteredSales]);

  // POS vs B2B Comparison Data
  const posVsB2BData = useMemo(() => {
      const stats = { POS: { revenue: 0, count: 0, avgTicket: 0 }, B2B: { revenue: 0, count: 0, avgTicket: 0 } };
      filteredSales.forEach(sale => {
          const amount = sale.totalAmount || 0;
          if (sale.source === 'POS') {
              stats.POS.revenue += amount;
              stats.POS.count += 1;
          } else {
              stats.B2B.revenue += amount;
              stats.B2B.count += 1;
          }
      });
      stats.POS.avgTicket = stats.POS.count > 0 ? stats.POS.revenue / stats.POS.count : 0;
      stats.B2B.avgTicket = stats.B2B.count > 0 ? stats.B2B.revenue / stats.B2B.count : 0;
      const total = stats.POS.revenue + stats.B2B.revenue;
      const pieData = [
          { name: '🧾 POS', value: stats.POS.revenue, percent: total > 0 ? (stats.POS.revenue / total * 100).toFixed(1) : '0', color: '#3b82f6' },
          { name: '💼 B2B', value: stats.B2B.revenue, percent: total > 0 ? (stats.B2B.revenue / total * 100).toFixed(1) : '0', color: '#10b981' }
      ];
      return { pieData, stats };
  }, [filteredSales]);

  // Top Products Chart Data
  const topProductsChartData = useMemo(() => {
      const productSales: Record<string, { product: string; quantity: number; revenue: number }> = {};
      filteredSales.forEach(sale => {
          if (sale.items) {
              sale.items.forEach(item => {
                  const product = products.find(p => p.id === item.productId);
                  if (product) {
                      if (!productSales[product.id]) productSales[product.id] = { product: product.name, quantity: 0, revenue: 0 };
                      productSales[product.id].quantity += item.quantity;
                      productSales[product.id].revenue += item.total;
                  }
              });
          }
      });
      return Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [filteredSales, products]);

  // Low stock items: solo del almacén seleccionado
  const lowStockItems = (products || []).filter(p => {
    if (!p.stockLevels || typeof p.stockLevels !== 'object') return false;
    try {
      if (selectedWarehouseId === 'ALL') {
        const totalStock = Object.values(p.stockLevels).reduce((a: number, b: number) => a + b, 0);
        return totalStock <= (p.minStock || 0);
      } else {
        const stock = p.stockLevels[selectedWarehouseId] || 0;
        return stock <= (p.minStock || 0);
      }
    } catch (e) {
      logger.error(`Error calculating stock for product ${p.id}`, e);
      return false;
    }
  });

  const recentTransfers = filteredTransfers.slice(0, 5);

  const pendingPayments = filteredSales
    .filter(s => {
      const total = s.totalAmount || 0;
      const paid = s.amountPaid || 0;
      const credited = s.creditedAmount || 0;
      return (total - paid - credited) > 1;
    })
    .sort((a, b) => {
      const aPending = (a.totalAmount || 0) - (a.amountPaid || 0) - (a.creditedAmount || 0);
      const bPending = (b.totalAmount || 0) - (b.amountPaid || 0) - (b.creditedAmount || 0);
      return bPending - aPending;
    })
    .slice(0, 5);

  // Top Products - Most sold products with profit margin
  const topProducts = useMemo(() => {
    const productSales: Record<string, { product: Product; quantity: number; revenue: number; profit: number }> = {};
    filteredSales.forEach(sale => {
      if (sale.items) {
        sale.items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          if (product) {
            if (!productSales[product.id]) {
              productSales[product.id] = { product, quantity: 0, revenue: 0, profit: 0 };
            }
            const actualUnits = item.sellMode === 'box'
              ? item.quantity * (item.unitsPerBox || 1)
              : item.quantity;
            productSales[product.id].quantity += actualUnits;
            productSales[product.id].revenue += item.total;
            if (product.cost) {
              productSales[product.id].profit += (item.total - product.cost * actualUnits);
            }
          }
        });
      }
    });
    return Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [filteredSales, products]);

  // Profit margin breakdown by warehouse (uses all sales, not filtered)
  const profitByWarehouse = useMemo(() => {
    const warehouseData: Record<string, { name: string; revenue: number; profit: number; salesCount: number; inventoryValue: number }> = {};
    // Seed all known warehouses with their inventory value at cost
    warehouses.forEach(w => {
      const invVal = products.reduce((acc, p) => acc + (p.stockLevels?.[w.id] || 0) * (p.cost || 0), 0);
      warehouseData[w.id] = { name: w.name, revenue: 0, profit: 0, salesCount: 0, inventoryValue: invVal };
    });
    (sales || [])
      .filter(s => s.status !== 'Cancelled' && s.returnStatus !== 'full' && s.documentType !== 'QUOTE')
      .forEach(sale => {
      const warehouse = warehouses.find(w => w.id === sale.warehouseId);
      const wName = warehouse?.name || sale.warehouseId || '—';
      const wKey = sale.warehouseId || '__unknown__';
      if (!warehouseData[wKey]) warehouseData[wKey] = { name: wName, revenue: 0, profit: 0, salesCount: 0, inventoryValue: 0 };
      warehouseData[wKey].revenue += sale.totalAmount || 0;
      warehouseData[wKey].salesCount += 1;
      if (sale.items) {
        sale.items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          if (product?.cost) {
            const actualUnits = item.sellMode === 'box' ? item.quantity * (item.unitsPerBox || 1) : item.quantity;
            warehouseData[wKey].profit += (item.total - product.cost * actualUnits);
          }
        });
      }
    });
    return Object.values(warehouseData).sort((a, b) => b.revenue - a.revenue);
  }, [sales, warehouses, products]);

  // Profit breakdown by sales rep — with per-invoice detail
  const profitByCommercial = useMemo(() => {
    if (currentUser.role !== 'Admin' && currentUser.role !== 'Manager') return [];
    const repMap: Record<string, {
      repId: string;
      repName: string;
      salesCount: number;
      revenue: number;
      cost: number;
      profit: number;
      invoices: Array<{ id: string; number: string; customerName: string; date: string; revenue: number; cost: number; profit: number }>;
    }> = {};

    (sales || []).filter(s => s.documentType !== 'QUOTE' && s.status !== 'Cancelled' && s.returnStatus !== 'full').forEach(sale => {
      const customer = customers.find(c => c.id === sale.customerId);
      const repId = customer?.assignedTo || '__unassigned__';
      const repName = salesRepProfiles[repId] || (repId === '__unassigned__' ? 'Sin asignar' : '—');

      if (!repMap[repId]) {
        repMap[repId] = { repId, repName, salesCount: 0, revenue: 0, cost: 0, profit: 0, invoices: [] };
      }
      repMap[repId].repName = repName;

      let saleCost = 0;
      if (sale.items) {
        sale.items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          if (product?.cost) {
            const actualUnits = item.sellMode === 'box' ? item.quantity * (item.unitsPerBox || 1) : item.quantity;
            saleCost += product.cost * actualUnits;
          }
        });
      }

      const saleRevenue = sale.totalAmount || 0;
      const saleProfit = saleRevenue - saleCost;

      repMap[repId].salesCount += 1;
      repMap[repId].revenue += saleRevenue;
      repMap[repId].cost += saleCost;
      repMap[repId].profit += saleProfit;
      repMap[repId].invoices.push({
        id: sale.id,
        number: sale.invoiceNumber || sale.deliveryNoteNumber || `#${sale.id.slice(0, 8)}`,
        customerName: sale.customerName || '—',
        date: sale.date || '',
        revenue: saleRevenue,
        cost: saleCost,
        profit: saleProfit,
      });
    });

    Object.values(repMap).forEach(rep => {
      rep.invoices.sort((a, b) => b.date.localeCompare(a.date));
    });

    return Object.values(repMap).sort((a, b) => b.revenue - a.revenue);
  }, [sales, products, customers, salesRepProfiles, currentUser.role]);

  // Debtor Customers - Customers with pending payments grouped
  const debtorCustomers = useMemo(() => {
    const customerDebts: Record<string, { name: string; debt: number; salesCount: number }> = {};
    filteredSales.forEach(sale => {
      const pending = (sale.totalAmount || 0) - (sale.amountPaid || 0) - (sale.creditedAmount || 0);
      if (pending > 1) {
        const customerName = sale.customerName || 'Unknown';
        if (!customerDebts[customerName]) {
          customerDebts[customerName] = { name: customerName, debt: 0, salesCount: 0 };
        }
        customerDebts[customerName].debt += pending;
        customerDebts[customerName].salesCount += 1;
      }
    });
    return Object.values(customerDebts)
      .sort((a, b) => b.debt - a.debt)
      .slice(0, 5);
  }, [filteredSales]);

  // Warehouse Alerts - Warehouses with low stock alerts
  const warehouseAlerts = useMemo(() => {
    const alerts: Record<string, { warehouseName: string; alertCount: number; products: Product[] }> = {};
    if (selectedWarehouseId === 'ALL') {
      warehouses.forEach(warehouse => {
        const lowStockInWarehouse = products.filter(p => {
          if (!p.stockLevels) return false;
          const stock = p.stockLevels[warehouse.id] || 0;
          return stock <= (p.minStock || 0) && stock > 0;
        });
        if (lowStockInWarehouse.length > 0) {
          alerts[warehouse.id] = {
            warehouseName: warehouse.name,
            alertCount: lowStockInWarehouse.length,
            products: lowStockInWarehouse.slice(0, 3)
          };
        }
      });
    } else {
      const warehouse = warehouses.find(w => w.id === selectedWarehouseId);
      if (warehouse && lowStockItems.length > 0) {
        alerts[warehouse.id] = {
          warehouseName: warehouse.name,
          alertCount: lowStockItems.length,
          products: lowStockItems.slice(0, 3)
        };
      }
    }
    return Object.values(alerts).slice(0, 5);
  }, [products, warehouses, selectedWarehouseId, lowStockItems]);

  // Daily Sales - Sales from today
  const todaySales = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return filteredSales
      .filter(sale => {
        if (!sale.date) return false;
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate.getTime() === today.getTime();
      })
      .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
      .slice(0, 5);
  }, [filteredSales]);

  // Chart Data
  const salesByDate: Record<string, { date: string, revenue: number, profit: number }> = {};
  (sales || []).filter(s => s.status !== 'Cancelled' && s.returnStatus !== 'full' && s.documentType !== 'QUOTE').forEach(s => {
      if (!s.date) return;
      try {
          const date = new Date(s.date);
          if (isNaN(date.getTime())) return; // Skip invalid dates
          const dateKey = date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
          if (!salesByDate[dateKey]) salesByDate[dateKey] = { date: dateKey, revenue: 0, profit: 0 };
          salesByDate[dateKey].revenue += (s.totalAmount || 0);

          // Calculate actual profit based on item costs
          let saleProfit = 0;
          if (s.items) {
              s.items.forEach(item => {
                  const product = products.find(p => p.id === item.productId);
                  if (product && product.cost && item.total) {
                      const actualUnits = item.sellMode === 'box' ? item.quantity * (item.unitsPerBox || 1) : item.quantity;
                      saleProfit += (item.total - product.cost * actualUnits);
                  }
              });
          }
          salesByDate[dateKey].profit += saleProfit;
      } catch (e) {
          logger.error("Error processing sale for chart", e);
      }
  });
  const chartData = Object.values(salesByDate).slice(-7);

  const pieData = [
    { name: t('collected'), value: totalCollected, color: '#10b981' }, 
    { name: t('pending'), value: totalReceivables, color: '#f43f5e' }, 
  ];

  // --- COMPONENT RENDERERS ---

  const renderKPI = (title: string, value: string, icon: any, color: string, subtext?: string) => (
      <div className="h-full bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-xs sm:text-sm font-medium text-slate-500 truncate me-2">{t(title)}</h3>
            <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${color}`}>
              {React.createElement(icon, { className: "w-4 h-4 sm:w-5 sm:h-5" })}
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-lg sm:text-2xl font-bold text-slate-900 truncate">{value}</p>
            {subtext && <p className="text-xs text-slate-400 mt-1 truncate">{subtext}</p>}
          </div>
      </div>
  );

  const renderWidget = (widget: DashboardWidget) => {
      // Safety check for unknown widgets
      if (!WIDGET_DEFINITIONS[widget.type]) return null;

      switch(widget.type) {
          case 'kpi_revenue':
              return renderKPI('total_revenue', `${totalRevenue.toLocaleString()} ${CURRENCY}`, DollarSign, "bg-blue-100 text-blue-600");
          case 'kpi_profit':
              return renderKPI('estimated_profit', `${estimatedProfit.toLocaleString()} ${CURRENCY}`, TrendingUp, "bg-emerald-100 text-emerald-600");
          case 'kpi_receivables':
              return renderKPI('total_receivables', `${totalReceivables.toLocaleString()} ${CURRENCY}`, Banknote, "bg-rose-100 text-rose-600", t('customer_debt'));
          case 'kpi_orders':
              return renderKPI('total_orders', `${totalOrders}`, ShoppingCart, "bg-indigo-100 text-indigo-600");
          case 'kpi_inventory_value':
              return renderKPI('inventory_value', `${inventoryValue.toLocaleString()} ${CURRENCY}`, Package, "bg-amber-100 text-amber-600");
          case 'kpi_low_stock':
              return renderKPI('low_stock_alert', `${lowStockItems.length}`, AlertTriangle, "bg-orange-100 text-orange-600", t('items'));
          
          case 'chart_finance':
              return (
                <div className="h-full bg-white p-6 rounded-xl border border-secondary-200 shadow-soft flex flex-col hover:shadow-medium transition-all duration-200">
                  <h3 className="text-lg font-bold text-secondary-900 mb-4">{t('financial_evolution')}</h3>
                  <div className="flex-1 min-h-50 w-full">
                    <ResponsiveContainer width="100%" height={200} minWidth={0} minHeight={0}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} stroke="#64748b" />
                        <Tooltip />
                        <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
          
          case 'chart_cashflow':
               return (
                <div className="h-full bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{t('cash_flow')}</h3>
                  <div className="flex-1 min-h-50">
                     <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                             <Pie data={pieData} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                                {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                             </Pie>
                             <Tooltip />
                             <Legend verticalAlign="bottom" height={36}/>
                         </PieChart>
                     </ResponsiveContainer>
                  </div>
                </div>
               );

          // NUEVO WIDGET: Gráfico de Ventas Mensuales (POS vs B2B)
          case 'chart_monthly_sales':
              return (
                  <div className="h-full bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
                          <TrendingUp className="w-5 h-5 mr-2 text-blue-500" />
                          {t('monthly_sales_trend')}
                      </h3>
                      <div className="flex-1 min-h-[200px] sm:min-h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={monthlySalesData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                  <XAxis dataKey="month" fontSize={10} angle={-45} textAnchor="end" height={60} />
                                  <YAxis fontSize={11} width={50} />
                                  <Tooltip formatter={(value: number) => `${value.toFixed(0)} ${CURRENCY}`} />
                                  <Legend />
                                  <Line type="monotone" dataKey="POS" stroke="#3b82f6" strokeWidth={2} name="POS" />
                                  <Line type="monotone" dataKey="B2B" stroke="#10b981" strokeWidth={2} name="B2B" />
                              </LineChart>
                          </ResponsiveContainer>
                      </div>
                  </div>
              );

          // NUEVO WIDGET: Comparativa POS vs B2B
          case 'chart_pos_vs_b2b':
              return (
                  <div className="h-full bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                      <h3 className="text-lg font-bold text-slate-900 mb-4">{t('pos_vs_b2b_comparison')}</h3>
                      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                          <div className="flex-1 min-h-[160px] sm:min-h-[200px]">
                              <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                      <Pie data={posVsB2BData.pieData} innerRadius={40} outerRadius={65} paddingAngle={5} dataKey="value" label={({ percent }) => `${percent}%`}>
                                          {posVsB2BData.pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                                      </Pie>
                                      <Tooltip formatter={(value: number) => `${value.toFixed(0)} ${CURRENCY}`} />
                                      <Legend />
                                  </PieChart>
                              </ResponsiveContainer>
                          </div>
                          <div className="flex-1 space-y-3">
                              <div className="bg-blue-50 p-3 sm:p-4 rounded-lg border border-blue-100">
                                  <div className="flex items-center justify-between mb-1">
                                      <span className="text-sm font-bold text-blue-900">POS</span>
                                      <span className="text-xs text-blue-600">{posVsB2BData.stats.POS.count} {t('sales_count')}</span>
                                  </div>
                                  <div className="text-xl sm:text-2xl font-black text-blue-600">{posVsB2BData.stats.POS.revenue.toFixed(0)} {CURRENCY}</div>
                                  <div className="text-xs text-blue-600 mt-1">{t('average')}: {posVsB2BData.stats.POS.avgTicket.toFixed(0)} {CURRENCY}</div>
                              </div>
                              <div className="bg-emerald-50 p-3 sm:p-4 rounded-lg border border-emerald-100">
                                  <div className="flex items-center justify-between mb-1">
                                      <span className="text-sm font-bold text-emerald-900">B2B</span>
                                      <span className="text-xs text-emerald-600">{posVsB2BData.stats.B2B.count} {t('sales_count')}</span>
                                  </div>
                                  <div className="text-xl sm:text-2xl font-black text-emerald-600">{posVsB2BData.stats.B2B.revenue.toFixed(0)} {CURRENCY}</div>
                                  <div className="text-xs text-emerald-600 mt-1">{t('average')}: {posVsB2BData.stats.B2B.avgTicket.toFixed(0)} {CURRENCY}</div>
                              </div>
                          </div>
                      </div>
                  </div>
              );

          // NUEVO WIDGET: Top Productos (Gráfico de Barras)
          case 'chart_top_products':
              return (
                  <div className="h-full bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
                          <Package className="w-5 h-5 mr-2 text-amber-500" />
                          {t('top_products_chart')}
                      </h3>
                      <div className="flex-1 min-h-[220px] sm:min-h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={topProductsChartData} layout="vertical" margin={{ left: 10 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                  <XAxis type="number" fontSize={11} />
                                  <YAxis type="category" dataKey="product" fontSize={10} width={90} tick={{ fill: '#475569' }} />
                                  <Tooltip formatter={(value: number, name: string) => name === 'revenue' ? [`${value.toFixed(0)} ${CURRENCY}`, t('revenue')] : [`${value}`, t('quantity')]} />
                                  <Legend />
                                  <Bar dataKey="revenue" fill="#f59e0b" name={t('revenue')} radius={[0, 4, 4, 0]} />
                              </BarChart>
                          </ResponsiveContainer>
                      </div>
                  </div>
              );

          case 'list_payment_alerts':
              return (
                  <div className="h-full bg-white p-6 rounded-xl border border-secondary-200 shadow-soft overflow-hidden flex flex-col hover:shadow-medium transition-all duration-200">
                      <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-secondary-900 flex items-center">
                              <AlertCircle className="w-5 h-5 mr-2 text-rose-500" /> {t('payment_alerts')}
                          </h3>
                      </div>
                      <div className="space-y-3 overflow-y-auto flex-1">
                          {pendingPayments.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-secondary-400 text-xs italic">
                                  {t('all_caught_up')}
                              </div>
                          ) : (
                              pendingPayments.map(s => (
                                  <div key={s.id} className="flex justify-between items-center p-3 bg-rose-50 border border-rose-100 rounded-lg text-sm hover:bg-rose-100 transition-colors duration-200">
                                      <div>
                                          <p className="font-bold text-secondary-800">{s.customerName}</p>
                                          <p className="text-xs text-secondary-500">{s.invoiceNumber || s.deliveryNoteNumber || `#${s.id.slice(0, 8)}...`}</p>
                                      </div>
                                      <div className="text-right">
                                          <p className="font-bold text-rose-600">{Math.max(0, (s.totalAmount || 0) - (s.amountPaid || 0) - (s.creditedAmount || 0)).toFixed(0)}</p>
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                  </div>
              );

           case 'list_recent_transfers':
               return (
                   <div className="h-full bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">{t('recent_transfers')}</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50">
                                    <tr><th className="p-2">{t('reference')}</th><th className="p-2">{t('from')}</th><th className="p-2">{t('to')}</th></tr>
                                </thead>
                                <tbody>
                                    {recentTransfers.length === 0 ? (
                                        <tr><td colSpan={3} className="p-4 text-center text-slate-400 text-xs italic">{t('no_operations_recorded')}</td></tr>
                                    ) : (
                                        recentTransfers.map(transfer => (
                                            <tr key={transfer.id} className="border-b border-slate-50">
                                                <td className="p-2 text-xs font-mono">{transfer.reference}</td>
                                                <td className="p-2">{transfer.fromWarehouseId}</td>
                                                <td className="p-2">{transfer.toWarehouseId}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                   </div>
               );

          case 'list_low_stock':
              return (
                  <div className="h-full bg-white p-6 rounded-xl border border-secondary-200 shadow-soft overflow-hidden flex flex-col hover:shadow-medium transition-all duration-200">
                      <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-secondary-900 flex items-center">
                              <AlertTriangle className="w-5 h-5 mr-2 text-orange-500" /> {t('stock_alerts')}
                          </h3>
                      </div>
                      <div className="space-y-3 overflow-y-auto flex-1">
                          {lowStockItems.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-secondary-400 text-xs italic">
                                  {t('all_caught_up')}
                              </div>
                          ) : (
                              lowStockItems.map(product => {
                                  const currentStock = selectedWarehouseId === 'ALL'
                                    ? Object.values(product.stockLevels || {}).reduce((a: number, b: number) => a + b, 0)
                                    : (product.stockLevels?.[selectedWarehouseId] || 0);
                                  return (
                                      <div key={product.id} className="flex justify-between items-center p-3 bg-orange-50 border border-orange-100 rounded-lg text-sm hover:bg-orange-100 transition-colors duration-200">
                                          <div className="flex-1">
                                              <p className="font-bold text-secondary-800">{product.name}</p>
                                              <p className="text-xs text-secondary-500">{product.sku}</p>
                                          </div>
                                          <div className="text-right">
                                              <p className="font-bold text-orange-600">{currentStock}</p>
                                              <p className="text-xs text-secondary-400">Min: {product.minStock || 0}</p>
                                          </div>
                                      </div>
                                  );
                              })
                          )}
                      </div>
                  </div>
              );

          case 'list_top_products':
              return (
                  <div className="h-full bg-white p-6 rounded-xl border border-secondary-200 shadow-soft overflow-hidden flex flex-col hover:shadow-medium transition-all duration-200">
                      <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-secondary-900 flex items-center">
                              <TrendingUp className="w-5 h-5 mr-2 text-emerald-500" /> {t('top_products')}
                          </h3>
                      </div>
                      <div className="space-y-3 overflow-y-auto flex-1">
                          {topProducts.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-secondary-400 text-xs italic">
                                  {t('no_sales_data')}
                              </div>
                          ) : (
                              topProducts.map((item, index) => {
                                  const marginPct = item.revenue > 0 ? (item.profit / item.revenue) * 100 : null;
                                  return (
                                  <div key={item.product.id} className="flex justify-between items-center p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-sm hover:bg-emerald-100 transition-colors duration-200">
                                      <div className="flex items-center gap-3 flex-1">
                                          <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                                              {index + 1}
                                          </div>
                                          <div>
                                              <p className="font-bold text-secondary-800">{item.product.name}</p>
                                              <p className="text-xs text-secondary-500">{item.quantity} {t('units_sold')}</p>
                                          </div>
                                      </div>
                                      <div className="text-right">
                                          <p className="font-bold text-emerald-600">{item.revenue.toFixed(0)} {CURRENCY}</p>
                                          {marginPct !== null && (
                                              <p className={`text-xs font-bold ${marginPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                  {marginPct >= 0 ? '+' : ''}{marginPct.toFixed(1)}% margen
                                              </p>
                                          )}
                                      </div>
                                  </div>
                                  );
                              })
                          )}
                      </div>
                  </div>
              );

          case 'list_debtor_customers':
              return (
                  <div className="h-full bg-white p-6 rounded-xl border border-secondary-200 shadow-soft overflow-hidden flex flex-col hover:shadow-medium transition-all duration-200">
                      <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-secondary-900 flex items-center">
                              <AlertCircle className="w-5 h-5 mr-2 text-rose-500" /> {t('debtor_customers')}
                          </h3>
                      </div>
                      <div className="space-y-3 overflow-y-auto flex-1">
                          {debtorCustomers.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-secondary-400 text-xs italic">
                                  {t('all_caught_up')}
                              </div>
                          ) : (
                              debtorCustomers.map(customer => (
                                  <div key={customer.name} className="flex justify-between items-center p-3 bg-rose-50 border border-rose-100 rounded-lg text-sm hover:bg-rose-100 transition-colors duration-200">
                                      <div className="flex-1">
                                          <p className="font-bold text-secondary-800">{customer.name}</p>
                                          <p className="text-xs text-secondary-500">{customer.salesCount} {t('pending_sales')}</p>
                                      </div>
                                      <div className="text-right">
                                          <p className="font-bold text-rose-600">{customer.debt.toFixed(0)} {CURRENCY}</p>
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                  </div>
              );

          case 'list_warehouse_alerts':
              return (
                  <div className="h-full bg-white p-6 rounded-xl border border-secondary-200 shadow-soft overflow-hidden flex flex-col hover:shadow-medium transition-all duration-200">
                      <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-secondary-900 flex items-center">
                              <Building2 className="w-5 h-5 mr-2 text-amber-500" /> {t('warehouse_alerts')}
                          </h3>
                      </div>
                      <div className="space-y-3 overflow-y-auto flex-1">
                          {warehouseAlerts.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-secondary-400 text-xs italic">
                                  {t('no_warehouse_alerts')}
                              </div>
                          ) : (
                              warehouseAlerts.map(alert => (
                                  <div key={alert.warehouseName} className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm hover:bg-amber-100 transition-colors duration-200">
                                      <div className="flex justify-between items-center mb-2">
                                          <p className="font-bold text-secondary-800">{alert.warehouseName}</p>
                                          <span className="px-2 py-1 bg-amber-500 text-white text-xs rounded-full font-bold">
                                              {alert.alertCount}
                                          </span>
                                      </div>
                                      <div className="space-y-1">
                                          {alert.products.map(p => (
                                              <p key={p.id} className="text-xs text-secondary-600">• {p.name}</p>
                                          ))}
                                          {alert.alertCount > 3 && (
                                              <p className="text-xs text-secondary-500 italic">+{alert.alertCount - 3} {t('more')}</p>
                                          )}
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                  </div>
              );

          case 'list_daily_sales':
              return (
                  <div className="h-full bg-white p-6 rounded-xl border border-secondary-200 shadow-soft overflow-hidden flex flex-col hover:shadow-medium transition-all duration-200">
                      <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-secondary-900 flex items-center">
                              <DollarSign className="w-5 h-5 mr-2 text-blue-500" /> {t('daily_sales')}
                          </h3>
                      </div>
                      <div className="space-y-3 overflow-y-auto flex-1">
                          {todaySales.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-secondary-400 text-xs italic">
                                  {t('no_sales_today')}
                              </div>
                          ) : (
                              todaySales.map(sale => (
                                  <div key={sale.id} className="flex justify-between items-center p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm hover:bg-blue-100 transition-colors duration-200">
                                      <div className="flex-1">
                                          <p className="font-bold text-secondary-800">{sale.customerName}</p>
                                          <p className="text-xs text-secondary-500">{sale.invoiceNumber || sale.deliveryNoteNumber || `#${sale.id.slice(0, 8)}...`}</p>
                                      </div>
                                      <div className="text-right">
                                          <p className="font-bold text-blue-600">{(sale.totalAmount || 0).toFixed(0)} {CURRENCY}</p>
                                          <p className="text-xs text-secondary-400">
                                              {new Date(sale.date!).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                          </p>
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                  </div>
              );

          case 'list_warehouse_margin':
              return (
                  <div className="h-full bg-white p-6 rounded-xl border border-secondary-200 shadow-soft overflow-hidden flex flex-col hover:shadow-medium transition-all duration-200">
                      <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-secondary-900 flex items-center">
                              <TrendingUp className="w-5 h-5 mr-2 text-violet-500" /> Marge par Entrepôt
                          </h3>
                      </div>
                      {profitByWarehouse.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-secondary-400 text-xs italic">{t('no_sales_data')}</div>
                      ) : (
                          <div className="overflow-x-auto flex-1">
                              <table className="w-full text-sm">
                                  <thead>
                                      <tr className="text-xs text-slate-500 uppercase border-b border-slate-100">
                                          <th className="text-left pb-2 font-semibold">Entrepôt</th>
                                          <th className="text-right pb-2 font-semibold">Ventes</th>
                                          <th className="text-right pb-2 font-semibold">Revenus</th>
                                          <th className="text-right pb-2 font-semibold">Stock (coût)</th>
                                          <th className="text-right pb-2 font-semibold">Bénéfice</th>
                                          <th className="text-right pb-2 font-semibold">Marge</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                      {profitByWarehouse.map(row => {
                                          const marginPct = row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0;
                                          const isPositive = row.profit >= 0;
                                          return (
                                              <tr key={row.name} className="hover:bg-slate-50 transition-colors">
                                                  <td className="py-2 font-medium text-slate-800">{row.name}</td>
                                                  <td className="py-2 text-right text-slate-500">{row.salesCount}</td>
                                                  <td className="py-2 text-right font-semibold text-slate-700">{row.revenue.toFixed(0)} {CURRENCY}</td>
                                                  <td className="py-2 text-right text-amber-600 font-medium">{row.inventoryValue.toFixed(0)} {CURRENCY}</td>
                                                  <td className={`py-2 text-right font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                      {isPositive ? '+' : ''}{row.profit.toFixed(0)} {CURRENCY}
                                                  </td>
                                                  <td className="py-2 text-right">
                                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                          {isPositive ? '+' : ''}{marginPct.toFixed(1)}%
                                                      </span>
                                                  </td>
                                              </tr>
                                          );
                                      })}
                                  </tbody>
                                  <tfoot>
                                      <tr className="border-t-2 border-slate-200 font-bold text-sm">
                                          <td className="pt-2 text-slate-700">Total</td>
                                          <td className="pt-2 text-right text-slate-500">{profitByWarehouse.reduce((s, r) => s + r.salesCount, 0)}</td>
                                          <td className="pt-2 text-right text-slate-700">{profitByWarehouse.reduce((s, r) => s + r.revenue, 0).toFixed(0)} {CURRENCY}</td>
                                          <td className="pt-2 text-right text-amber-600">{profitByWarehouse.reduce((s, r) => s + r.inventoryValue, 0).toFixed(0)} {CURRENCY}</td>
                                          <td className={`pt-2 text-right ${profitByWarehouse.reduce((s, r) => s + r.profit, 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                              {profitByWarehouse.reduce((s, r) => s + r.profit, 0) >= 0 ? '+' : ''}{profitByWarehouse.reduce((s, r) => s + r.profit, 0).toFixed(0)} {CURRENCY}
                                          </td>
                                          <td className="pt-2 text-right">
                                              {(() => {
                                                  const totalRev = profitByWarehouse.reduce((s, r) => s + r.revenue, 0);
                                                  const totalProfit = profitByWarehouse.reduce((s, r) => s + r.profit, 0);
                                                  const pct = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;
                                                  return (
                                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pct >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                          {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                                                      </span>
                                                  );
                                              })()}
                                          </td>
                                      </tr>
                                  </tfoot>
                              </table>
                          </div>
                      )}
                  </div>
              );

          case 'list_profit_by_commercial':
              return (
                  <div className="h-full bg-white p-6 rounded-xl border border-secondary-200 shadow-soft overflow-hidden flex flex-col hover:shadow-medium transition-all duration-200">
                      <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-secondary-900 flex items-center">
                              <TrendingUp className="w-5 h-5 mr-2 text-violet-500" /> Bénéfice par Commercial
                          </h3>
                      </div>
                      {profitByCommercial.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-secondary-400 text-xs italic">{t('no_sales_data')}</div>
                      ) : (
                          <div className="overflow-x-auto overflow-y-auto flex-1">
                              <table className="w-full text-sm">
                                  <thead className="sticky top-0 bg-white z-10">
                                      <tr className="text-xs text-slate-500 uppercase border-b border-slate-200">
                                          <th className="text-left pb-2 font-semibold">Commercial</th>
                                          <th className="text-right pb-2 font-semibold">Ventes</th>
                                          <th className="text-right pb-2 font-semibold">Revenus</th>
                                          <th className="text-right pb-2 font-semibold">Coût</th>
                                          <th className="text-right pb-2 font-semibold">Bénéfice</th>
                                          <th className="text-right pb-2 font-semibold">Marge</th>
                                          <th className="w-6"></th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {profitByCommercial.map(rep => {
                                          const marginPct = rep.revenue > 0 ? (rep.profit / rep.revenue) * 100 : 0;
                                          const isExpanded = expandedCommercialId === rep.repId;
                                          return (
                                              <React.Fragment key={rep.repId}>
                                                  <tr
                                                      className="border-b border-slate-100 hover:bg-violet-50 cursor-pointer transition-colors"
                                                      onClick={() => setExpandedCommercialId(isExpanded ? null : rep.repId)}
                                                  >
                                                      <td className="py-2.5 font-semibold text-slate-800">{rep.repName}</td>
                                                      <td className="py-2.5 text-right text-slate-500">{rep.salesCount}</td>
                                                      <td className="py-2.5 text-right font-semibold text-slate-700">{rep.revenue.toFixed(0)} {CURRENCY}</td>
                                                      <td className="py-2.5 text-right text-slate-500">{rep.cost.toFixed(0)} {CURRENCY}</td>
                                                      <td className={`py-2.5 text-right font-bold ${rep.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                          {rep.profit >= 0 ? '+' : ''}{rep.profit.toFixed(0)} {CURRENCY}
                                                      </td>
                                                      <td className="py-2.5 text-right">
                                                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${marginPct >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                              {marginPct >= 0 ? '+' : ''}{marginPct.toFixed(1)}%
                                                          </span>
                                                      </td>
                                                      <td className="py-2.5 text-right">
                                                          <ChevronDown className={`w-4 h-4 text-slate-400 inline transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                                      </td>
                                                  </tr>
                                                  {isExpanded && rep.invoices.map(inv => {
                                                      const invMarginPct = inv.revenue > 0 ? (inv.profit / inv.revenue) * 100 : 0;
                                                      return (
                                                          <tr key={inv.id} className="bg-slate-50 text-xs border-b border-slate-100 hover:bg-slate-100 transition-colors">
                                                              <td className="py-1.5 pl-5 font-mono text-violet-700 font-semibold">{inv.number}</td>
                                                              <td className="py-1.5 text-right text-slate-500 truncate max-w-[80px]">{inv.customerName}</td>
                                                              <td className="py-1.5 text-right text-slate-600">{inv.revenue.toFixed(0)}</td>
                                                              <td className="py-1.5 text-right text-slate-400">{inv.cost.toFixed(0)}</td>
                                                              <td className={`py-1.5 text-right font-semibold ${inv.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                  {inv.profit >= 0 ? '+' : ''}{inv.profit.toFixed(0)}
                                                              </td>
                                                              <td className="py-1.5 text-right">
                                                                  <span className={`font-bold ${invMarginPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                      {invMarginPct.toFixed(1)}%
                                                                  </span>
                                                              </td>
                                                              <td></td>
                                                          </tr>
                                                      );
                                                  })}
                                              </React.Fragment>
                                          );
                                      })}
                                  </tbody>
                                  <tfoot>
                                      <tr className="border-t-2 border-slate-200 font-bold text-sm">
                                          <td className="pt-2 text-slate-700">Total</td>
                                          <td className="pt-2 text-right text-slate-500">{profitByCommercial.reduce((s, r) => s + r.salesCount, 0)}</td>
                                          <td className="pt-2 text-right text-slate-700">{profitByCommercial.reduce((s, r) => s + r.revenue, 0).toFixed(0)} {CURRENCY}</td>
                                          <td className="pt-2 text-right text-slate-500">{profitByCommercial.reduce((s, r) => s + r.cost, 0).toFixed(0)} {CURRENCY}</td>
                                          <td className={`pt-2 text-right ${profitByCommercial.reduce((s, r) => s + r.profit, 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                              {(() => {
                                                  const tot = profitByCommercial.reduce((s, r) => s + r.profit, 0);
                                                  return `${tot >= 0 ? '+' : ''}${tot.toFixed(0)} ${CURRENCY}`;
                                              })()}
                                          </td>
                                          <td className="pt-2 text-right">
                                              {(() => {
                                                  const totalRev = profitByCommercial.reduce((s, r) => s + r.revenue, 0);
                                                  const totalProfit = profitByCommercial.reduce((s, r) => s + r.profit, 0);
                                                  const pct = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;
                                                  return (
                                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pct >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                          {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                                                      </span>
                                                  );
                                              })()}
                                          </td>
                                          <td></td>
                                      </tr>
                                  </tfoot>
                              </table>
                          </div>
                      )}
                  </div>
              );

          default: return null;
      }
  };

  const [showDashboardMenu, setShowDashboardMenu] = useState(false);
  const dashboardMenuRef = useRef<HTMLDivElement>(null);

  // Close dashboard menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dashboardMenuRef.current && !dashboardMenuRef.current.contains(event.target as Node)) {
        setShowDashboardMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-secondary-900 truncate">{t('dashboard')}</h1>
            <p className="text-sm text-secondary-500 mt-1 truncate">{t('welcome')}, {currentUser.name}</p>
        </div>
        <div className="relative ms-3 shrink-0" ref={dashboardMenuRef}>
            <button
              onClick={() => setShowDashboardMenu(!showDashboardMenu)}
              className={`flex items-center px-3 sm:px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 shadow-soft hover:shadow-medium ${
                isEditing
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-white border border-secondary-300 text-secondary-700 hover:bg-secondary-50'
              }`}
            >
                <Settings2 className="w-4 h-4 sm:me-2" />
                <span className="hidden sm:inline">{t('customize')}</span>
                <ChevronDown className={`w-3.5 h-3.5 ms-1.5 transition-transform duration-200 ${showDashboardMenu ? 'rotate-180' : ''}`} />
            </button>

            {showDashboardMenu && (
              <div className="absolute end-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                {!isEditing ? (
                  <button
                    onClick={() => { toggleEdit(); setShowDashboardMenu(false); }}
                    className="w-full text-start px-4 py-3 hover:bg-blue-50 text-slate-700 flex items-center transition-colors"
                  >
                    <Pencil className="w-4 h-4 me-3 text-blue-500" />
                    <span className="text-sm font-medium">{t('customize')}</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => { setShowAddModal(true); setShowDashboardMenu(false); }}
                      className="w-full text-start px-4 py-3 hover:bg-blue-50 text-slate-700 flex items-center transition-colors border-b border-slate-100"
                    >
                      <Plus className="w-4 h-4 me-3 text-blue-500" />
                      <span className="text-sm font-medium">{t('add_widget')}</span>
                    </button>
                    <button
                      onClick={() => { resetLayout(); setShowDashboardMenu(false); }}
                      className="w-full text-start px-4 py-3 hover:bg-amber-50 text-slate-700 flex items-center transition-colors border-b border-slate-100"
                    >
                      <RotateCcw className="w-4 h-4 me-3 text-amber-500" />
                      <span className="text-sm font-medium">{t('reset')}</span>
                    </button>
                    <button
                      onClick={() => { toggleEdit(); setShowDashboardMenu(false); }}
                      className="w-full text-start px-4 py-3 hover:bg-emerald-50 text-emerald-700 flex items-center transition-colors"
                    >
                      <Save className="w-4 h-4 me-3 text-emerald-500" />
                      <span className="text-sm font-medium">{t('save_layout')}</span>
                    </button>
                  </>
                )}
              </div>
            )}
        </div>
      </div>

      {/* Warehouse Filter */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col gap-2 sm:gap-3">
          <label className="text-xs sm:text-sm font-semibold text-slate-700">
            {t('filter_by_warehouse')} ({currentUser.role}):
            <span className="ms-2 text-blue-600 font-bold">{selectedWarehouseId === 'ALL' ? t('all_warehouses') : warehouses.find(w => w.id === selectedWarehouseId)?.name || t('select_warehouse')}</span>
          </label>
          {(currentUser.role === 'Admin' || currentUser.role === 'Manager') ? (
            <div>
              <select
                value={selectedWarehouseId}
                onChange={(e) => {
                  setSelectedWarehouseId(e.target.value);
                }}
                className="w-full sm:w-80 px-3 py-2.5 border-2 border-slate-300 rounded-lg text-sm font-medium bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer hover:border-blue-400 transition-all"
              >
                <option value="ALL">{t('all_warehouses')} ({warehouses.length})</option>
                {warehouses.length === 0 && <option disabled>{t('loading_warehouses')}</option>}
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              {warehouses.length === 0 && !warehousesHook.loading && (
                <p className="mt-2 text-xs text-orange-600 font-medium">{t('no_warehouses_check_connection')}</p>
              )}
            </div>
          ) : (
            <div className="flex items-center px-3 py-2.5 border-2 border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-700 font-medium">
              <Store className="w-5 h-5 mr-2 text-emerald-500" />
              {warehouses.find(w => w.id === currentUser.warehouseId)?.name || t('no_warehouse_assigned')}
            </div>
          )}
        </div>
      </div>

      {/* Treasury Alerts Widget - Only for Admin & Accountant */}
      {(currentUser.role === 'Admin' || currentUser.role === 'Accountant') && (() => {
        // Calculate check payment alerts
        const checkPayments = sales.flatMap(sale =>
          (sale.payments || [])
            .filter(p => (p.method === 'Check' || p.method === 'Traite') && p.checkNumber && p.dueDate && p.paymentStatus === 'Pending')
            .map(p => ({
              invoiceNumber: sale.invoiceNumber || sale.deliveryNoteNumber || `#${sale.id.slice(0,8)}`,
              customerName: sale.customerName,
              checkNumber: p.checkNumber!,
              amount: p.amount,
              dueDate: p.dueDate!,
              daysUntil: Math.ceil((new Date(p.dueDate!).getTime() - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24))
            }))
        );

        const overdue = checkPayments.filter(c => c.daysUntil < 0);
        const thisWeek = checkPayments.filter(c => c.daysUntil >= 0 && c.daysUntil <= 7);

        if (overdue.length === 0 && thisWeek.length === 0) return null;

        return (
          <div className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <Wallet className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">{t('treasury_alerts_title')}</h3>
                  <p className="text-xs sm:text-sm text-slate-600">{t('treasury_alerts_desc')}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  const event = new CustomEvent('changeTab', { detail: 'treasury' });
                  window.dispatchEvent(event);
                }}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium text-xs sm:text-sm shrink-0"
              >
                <span className="hidden sm:inline">{t('view_treasury')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Overdue Checks */}
              {overdue.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-red-200">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <h4 className="font-bold text-red-700">{t('overdue_checks')} ({overdue.length})</h4>
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {overdue.slice(0, 3).map((check, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm bg-red-50 p-2 rounded">
                        <div>
                          <p className="font-mono font-bold text-red-900">{check.checkNumber}</p>
                          <p className="text-xs text-slate-600">{check.customerName}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-red-700">{check.amount.toFixed(2)} MAD</p>
                          <p className="text-xs text-red-600">{Math.abs(check.daysUntil)}{t('days_short')} {t('overdue')}</p>
                        </div>
                      </div>
                    ))}
                    {overdue.length > 3 && (
                      <p className="text-xs text-center text-slate-500 mt-2">
                        +{overdue.length - 3} {t('more')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* This Week Checks */}
              {thisWeek.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-yellow-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    <h4 className="font-bold text-yellow-700">{t('due_this_week')} ({thisWeek.length})</h4>
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {thisWeek.slice(0, 3).map((check, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm bg-yellow-50 p-2 rounded">
                        <div>
                          <p className="font-mono font-bold text-yellow-900">{check.checkNumber}</p>
                          <p className="text-xs text-slate-600">{check.customerName}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-yellow-700">{check.amount.toFixed(2)} MAD</p>
                          <p className="text-xs text-yellow-600">
                            {check.daysUntil === 0 ? t('today') : `${check.daysUntil}${t('days_short')}`}
                          </p>
                        </div>
                      </div>
                    ))}
                    {thisWeek.length > 3 && (
                      <p className="text-xs text-center text-slate-500 mt-2">
                        +{thisWeek.length - 3} {t('more')}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ─── Admin: Volume Discount Configuration ─────────────────────────── */}
      {currentUser.role === 'Admin' && companySettings && onUpdateSettings && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 bg-slate-50">
            <Settings2 className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-slate-800 text-sm">Remises par Volume Mensuel</h3>
            <div className="ml-auto flex items-center gap-3">
              <span className={`text-xs font-semibold ${volumeDiscountEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                {volumeDiscountEnabled ? 'Activé' : 'Désactivé'}
              </span>
              <button
                onClick={() => { setVolumeDiscountEnabled(v => !v); setVolumeTierSaved(false); }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${volumeDiscountEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${volumeDiscountEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
          <div className={`p-5 ${!volumeDiscountEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <p className="text-xs text-slate-500 mb-4">
              Dès que le total de la facture dépasse le seuil, le niveau se débloque automatiquement et la remise est appliquée sur tous les colis.
            </p>
            {editingVolumeTiers.length === 0 ? (
              <p className="text-sm text-slate-400 italic mb-4">Aucun niveau configuré.</p>
            ) : (
              <table className="w-full text-sm mb-3">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-100">
                    <th className="text-left pb-2 font-medium">Nom du Niveau</th>
                    <th className="text-left pb-2 font-medium w-44">Montant min. facture (DH)</th>
                    <th className="text-left pb-2 font-medium w-40">Remise par colis (DH)</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {editingVolumeTiers.map((vt) => (
                    <tr key={vt.id} className="group">
                      <td className="py-2 pr-3">
                        <input
                          type="text"
                          value={vt.label}
                          onChange={e => handleVolumeTierChange(vt.id, 'label', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none"
                          placeholder="ex: Argent, Or, VIP"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            step={100}
                            value={vt.minAmount}
                            onChange={e => handleVolumeTierChange(vt.id, 'minAmount', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none"
                          />
                          <span className="text-slate-400 text-xs shrink-0">DH</span>
                        </div>
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={vt.discountPerBox}
                            onChange={e => handleVolumeTierChange(vt.id, 'discountPerBox', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none"
                          />
                          <span className="text-slate-400 text-xs shrink-0">DH</span>
                        </div>
                      </td>
                      <td className="py-2 pl-2">
                        <button
                          onClick={() => handleRemoveVolumeTier(vt.id)}
                          className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
                          title="Supprimer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleAddVolumeTier}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-lg transition-colors border border-slate-200"
              >
                <Plus className="w-4 h-4" />
                Ajouter un Niveau
              </button>
              <button
                onClick={handleSaveVolumeTiers}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Save className="w-4 h-4" />
                Enregistrer
              </button>
              {volumeTierSaved && <span className="text-green-600 text-sm font-medium">Enregistré ✓</span>}
            </div>
          </div>
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {layout.map((widget, index) => {
              // Safety: Ensure widget definition exists, otherwise render placeholder or null
              const def = WIDGET_DEFINITIONS[widget.type];
              if (!def) return null; // Skip unknown widgets

              return (
                  <div
                    key={widget.id}
                    className={`relative ${widget.w === 2 ? 'md:col-span-2' : 'md:col-span-1'} ${isEditing ? 'ring-2 ring-blue-400 ring-dashed rounded-xl cursor-move bg-slate-50/50' : ''}`}
                    style={{ minHeight: '120px' }}
                  >
                      {isEditing && (
                          <div className="absolute -top-2 -right-2 z-10">
                              <button 
                                onClick={() => removeWidget(widget.id)}
                                className="bg-rose-500 text-white p-1 rounded-full shadow-md hover:bg-rose-600 transition-colors"
                              >
                                  <X className="w-4 h-4" />
                              </button>
                          </div>
                      )}
                      {renderWidget(widget)}
                  </div>
              );
          })}
          
          {isEditing && layout.length === 0 && (
              <div className="col-span-4 p-12 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400">
                  <Layout className="w-12 h-12 mb-2 opacity-50" />
                  <p>{t('dashboard_empty')}</p>
                  <button onClick={() => setShowAddModal(true)} className="mt-4 text-blue-600 font-bold hover:underline">
                      {t('add_first_widget')}
                  </button>
              </div>
          )}
      </div>

      {/* Add Widget Modal */}
      {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-secondary-900 bg-opacity-60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-large w-full max-w-2xl overflow-hidden max-h-[80vh] flex flex-col animate-scale-in">
                  <div className="p-6 border-b border-secondary-200 flex justify-between items-center bg-gradient-secondary">
                      <h3 className="font-bold text-xl text-secondary-900">{t('add_widget')}</h3>
                      <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-secondary-100 rounded-lg transition-colors duration-200">
                          <X className="w-6 h-6 text-secondary-400 hover:text-secondary-600" />
                      </button>
                  </div>
                  <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {(Object.keys(WIDGET_DEFINITIONS) as DashboardWidgetType[]).map(type => {
                          const def = WIDGET_DEFINITIONS[type];
                          if (!def.role.includes(currentUser.role)) return null;

                          return (
                              <button
                                key={type}
                                onClick={() => addWidget(type)}
                                className="flex items-start p-5 border border-secondary-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all duration-200 text-left group hover:shadow-soft"
                              >
                                  <div className="p-3 bg-white rounded-lg border border-secondary-200 text-secondary-500 mr-4 group-hover:text-primary-600 group-hover:border-primary-200 shadow-soft">
                                      {React.createElement(def.icon, { className: "w-6 h-6" })}
                                  </div>
                                  <div>
                                      <span className="font-bold text-secondary-900 group-hover:text-primary-700 block mb-1">{t(def.label)}</span>
                                      <span className="text-xs text-secondary-500">{t('size')}: {def.defaultW === 2 ? t('wide') : t('standard')}</span>
                                  </div>
                              </button>
                          );
                      })}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Dashboard;
