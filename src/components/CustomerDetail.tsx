import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Customer, Product, Sale } from '../types';
import {
  ArrowLeft, Phone, Mail, MapPin, Building2, User, Briefcase,
  ShoppingCart, DollarSign, TrendingUp, Receipt, Calendar,
  ChevronDown, ChevronUp, Tag, FileText, CreditCard, Undo2,
  AlertTriangle, Package, Loader2, RefreshCw, StickyNote, Hash
} from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { supabase } from '../services/supabaseClient';
import { useStore } from '../store/useStore';
import { applyCompanyFilter, getCurrentUserCompanyId } from '../hooks/useSupabaseData';
import CustomerPriceList from './CustomerPriceList';

interface CustomerDetailProps {
  customer: Customer;
  /** Legacy prop — kept for backward compatibility but no longer used for history */
  sales?: Sale[];
  products?: Product[];
  onBack: () => void;
}

// ── Inline sale transform (mirrors usePaginatedSales.transformSale) ───────────
function transformSale(s: any): Sale {
  return {
    id: s.id,
    invoiceNumber: s.invoice_number || undefined,
    deliveryNoteNumber: s.delivery_note_number || undefined,
    date: s.date,
    warehouseId: s.warehouse_id,
    customerId: s.customer_id,
    customerName: s.customer_name,
    customerType: s.customer_type,
    items: (s.sale_items || []).map((item: any) => ({
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      discount: item.discount,
      discountType: item.discount_type || 'percentage',
      total: item.total,
      sellMode: item.sell_mode || 'unit',
      unitsPerBox: item.units_per_box || 1,
    })),
    source: s.source || 'B2B',
    documentType: s.document_type || 'INVOICE',
    isFastSale: s.is_fast_sale || false,
    globalDiscountType: s.global_discount_type || undefined,
    globalDiscountValue: s.global_discount_value || undefined,
    globalDiscountAmount: s.global_discount_amount || undefined,
    itemsSubtotal: s.items_subtotal,
    subtotalAmount: s.subtotal_amount,
    taxRate: s.tax_rate,
    taxAmount: s.tax_amount,
    totalAmount: s.total_amount,
    amountPaid: s.amount_paid,
    paymentStatus: s.payment_status,
    payments: (s.payments || []).map((p: any) => ({
      id: p.id,
      date: p.date,
      amount: p.amount,
      method: p.method,
      reference: p.reference || undefined,
      checkNumber: p.check_number || undefined,
      dueDate: p.due_date || undefined,
      paymentStatus: p.payment_status || undefined,
      recordedBy: p.recorded_by,
      bankName: p.bank_name || undefined,
    })),
    creditedAmount: s.credited_amount || 0,
    returnStatus: s.return_status || undefined,
    status: s.status,
    companyId: s.company_id || null,
  };
}

// ── Hook: fetch ALL sales for a specific customer ─────────────────────────────
function useCustomerSales(customerId: string) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const activeCompanyId = useStore(s => s.activeCompanyId);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const companyId = await getCurrentUserCompanyId();
      let query = supabase
        .from('sales')
        .select(`
          *,
          sale_items (id, product_id, product_name, quantity, unit_price,
            discount, discount_type, total, sell_mode, units_per_box),
          payments (id, date, amount, method, reference, check_number,
            due_date, payment_status, recorded_by, bank_name)
        `)
        .eq('customer_id', customerId)
        .neq('document_type', 'QUOTE')
        .order('date', { ascending: false });

      query = applyCompanyFilter(query, companyId);

      const { data, error: err } = await query;
      if (err) throw err;
      setSales((data || []).map(transformSale));
      setError(null);
    } catch (e: any) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [customerId, activeCompanyId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { sales, loading, error, refresh: fetch };
}

// ── Main component ────────────────────────────────────────────────────────────
const CustomerDetail: React.FC<CustomerDetailProps> = ({ customer, products, onBack }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'history' | 'prices'>('history');
  const [sortField, setSortField] = useState<'date' | 'total' | 'status'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  const { sales: customerSales, loading, error, refresh } = useCustomerSales(customer.id);

  const sortedSales = useMemo(() => {
    return [...customerSales]
      .filter(s => s.status !== 'Cancelled')
      .sort((a, b) => {
        if (sortField === 'date') {
          const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
          return sortDir === 'asc' ? diff : -diff;
        }
        if (sortField === 'total') {
          const diff = a.totalAmount - b.totalAmount;
          return sortDir === 'asc' ? diff : -diff;
        }
        const order: Record<string, number> = { Paid: 0, Partial: 1, Unpaid: 2 };
        const diff = (order[a.paymentStatus] ?? 3) - (order[b.paymentStatus] ?? 3);
        return sortDir === 'asc' ? diff : -diff;
      });
  }, [customerSales, sortField, sortDir]);

  const kpis = useMemo(() => {
    const active = sortedSales.filter(s => s.returnStatus !== 'full');
    const totalRevenue = active.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalPaid   = active.reduce((sum, s) => sum + s.amountPaid + (s.creditedAmount || 0), 0);
    const pendingBalance = totalRevenue - totalPaid;
    const orderCount = active.length;
    const avgOrder = orderCount > 0 ? totalRevenue / orderCount : 0;
    const returnCount = customerSales.filter(s => s.returnStatus === 'full' || s.returnStatus === 'partial').length;
    return { totalRevenue, pendingBalance, orderCount, avgOrder, returnCount };
  }, [sortedSales, customerSales]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 ml-1 inline" />
      : <ChevronDown className="w-3 h-3 ml-1 inline" />;
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'Paid':    return 'bg-emerald-100 text-emerald-700';
      case 'Partial': return 'bg-amber-100 text-amber-700';
      case 'Unpaid':  return 'bg-rose-100 text-rose-700';
      default:        return 'bg-slate-100 text-slate-700';
    }
  };

  const paymentMethodIcon = (method: string) => {
    if (method === 'Check' || method === 'Traite') return '🏦';
    if (method === 'Transfer') return '↗️';
    if (method === 'Credit') return '📋';
    return '💵';
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 truncate">{customer.name}</h1>
          <p className="text-sm text-slate-500">{t('customer_detail')}</p>
        </div>
        <button
          onClick={refresh}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          title={t('refresh')}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Customer info card ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className={`p-4 border-b border-slate-100 flex items-center gap-2 ${customer.type === 'Professional' ? 'bg-indigo-50' : 'bg-blue-50'}`}>
          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide flex items-center ${customer.type === 'Professional' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
            {customer.type === 'Professional' ? <Briefcase className="w-3 h-3 mr-1" /> : <User className="w-3 h-3 mr-1" />}
            {t(customer.type === 'Professional' ? 'professional' : 'individual')}
          </span>
          {customer.contactPerson && (
            <span className="text-xs text-slate-500">{t('contact_person')}: <strong>{customer.contactPerson}</strong></span>
          )}
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center text-slate-600 gap-2">
            <Phone className="w-4 h-4 text-slate-400 shrink-0" />
            <a href={`tel:${customer.phone}`} className="hover:text-blue-600 hover:underline">{customer.phone || 'N/A'}</a>
          </div>
          <div className="flex items-center text-slate-600 gap-2">
            <Mail className="w-4 h-4 text-slate-400 shrink-0" />
            {customer.email
              ? <a href={`mailto:${customer.email}`} className="hover:text-blue-600 hover:underline truncate">{customer.email}</a>
              : <span>N/A</span>}
          </div>
          <div className="flex items-start text-slate-600 gap-2">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>{[customer.address, customer.city].filter(Boolean).join(', ') || 'N/A'}</span>
          </div>
          {customer.type === 'Professional' && customer.ice && (
            <div className="flex items-center text-slate-600 gap-2">
              <Hash className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="font-mono text-xs">ICE: {customer.ice}</span>
            </div>
          )}
          {customer.type === 'Professional' && customer.taxId && (
            <div className="flex items-center text-slate-600 gap-2">
              <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="font-mono text-xs">Tax ID: {customer.taxId}</span>
            </div>
          )}
          {(customer.creditLimit ?? 0) > 0 && (
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xs">
                {t('credit_limit')}: <strong className={kpis.pendingBalance > (customer.creditLimit || 0) ? 'text-rose-600' : 'text-slate-800'}>
                  {customer.creditLimit?.toLocaleString()} MAD
                </strong>
                {kpis.pendingBalance > (customer.creditLimit || 0) && (
                  <span className="ml-2 inline-flex items-center gap-1 text-rose-600 font-bold">
                    <AlertTriangle className="w-3 h-3" /> {t('credit_exceeded')}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Notes */}
        {customer.notes && (
          <div className="px-4 pb-4 flex items-start gap-2 text-sm text-slate-600 border-t border-slate-100 pt-3">
            <StickyNote className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="italic text-slate-500">{customer.notes}</p>
          </div>
        )}
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase">{t('total_revenue')}</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{kpis.totalRevenue.toFixed(2)} <span className="text-sm font-normal text-slate-400">MAD</span></p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase">{t('pending_balance')}</span>
          </div>
          <p className={`text-xl font-bold ${kpis.pendingBalance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {kpis.pendingBalance.toFixed(2)} <span className="text-sm font-normal text-slate-400">MAD</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase">{t('total_orders')}</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{kpis.orderCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <Receipt className="w-4 h-4 text-violet-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase">{t('avg_order_value')}</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{kpis.avgOrder.toFixed(2)} <span className="text-sm font-normal text-slate-400">MAD</span></p>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          {t('purchase_history')}
          {kpis.orderCount > 0 && (
            <span className="ml-2 bg-blue-100 text-blue-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{kpis.orderCount}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('prices')}
          className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'prices' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Tag className="w-4 h-4 mr-2" />
          {t('special_prices')}
        </button>
      </div>

      {/* ── Special prices tab ─────────────────────────────────────────────── */}
      {activeTab === 'prices' && (
        products ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <CustomerPriceList customerId={customer.id} products={products} />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center text-slate-400 text-sm">
            {t('loading')}...
          </div>
        )
      )}

      {/* ── History tab ────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900">{t('purchase_history')}</h2>
              <p className="text-xs text-slate-500">
                {sortedSales.length} {t('invoices')}
                {kpis.returnCount > 0 && ` · ${kpis.returnCount} ${t('returns')}`}
              </p>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">{t('loading')}...</span>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="p-6 text-center">
              <p className="text-sm text-rose-600 mb-3">{error.message}</p>
              <button onClick={refresh} className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm hover:bg-rose-700">
                {t('retry')}
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && sortedSales.length === 0 && (
            <div className="p-8 text-center text-slate-400">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('no_sales_found')}</p>
            </div>
          )}

          {/* Sales list */}
          {!loading && !error && sortedSales.length > 0 && (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">{t('invoice')}</th>
                      <th className="px-4 py-3 text-left cursor-pointer hover:text-slate-700 select-none" onClick={() => toggleSort('date')}>
                        {t('date')} <SortIcon field="date" />
                      </th>
                      <th className="px-4 py-3 text-left">{t('items')}</th>
                      <th className="px-4 py-3 text-right cursor-pointer hover:text-slate-700 select-none" onClick={() => toggleSort('total')}>
                        {t('total')} <SortIcon field="total" />
                      </th>
                      <th className="px-4 py-3 text-right">{t('paid')}</th>
                      <th className="px-4 py-3 text-right">{t('balance')}</th>
                      <th className="px-4 py-3 text-center cursor-pointer hover:text-slate-700 select-none" onClick={() => toggleSort('status')}>
                        {t('status')} <SortIcon field="status" />
                      </th>
                      <th className="px-4 py-3 text-center w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSales.map(sale => {
                      const isExpanded = expandedSaleId === sale.id;
                      const balance = sale.totalAmount - sale.amountPaid - (sale.creditedAmount || 0);
                      const ref = sale.invoiceNumber || sale.deliveryNoteNumber || `#${sale.id.slice(0, 8)}`;
                      return (
                        <React.Fragment key={sale.id}>
                          {/* Main row */}
                          <tr
                            className={`border-t border-slate-100 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                            onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                          >
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs font-semibold text-blue-700">{ref}</span>
                              {sale.returnStatus && (
                                <span className="ml-2 text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">
                                  <Undo2 className="w-2.5 h-2.5 inline mr-0.5" />{sale.returnStatus}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-xs">
                              {new Date(sale.date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{sale.items.length}</td>
                            <td className="px-4 py-3 text-right font-medium text-slate-900">{sale.totalAmount.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-emerald-700">{sale.amountPaid.toFixed(2)}</td>
                            <td className={`px-4 py-3 text-right font-bold ${balance > 0.01 ? 'text-rose-600' : 'text-slate-400'}`}>
                              {balance > 0.01 ? balance.toFixed(2) : '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColor(sale.paymentStatus)}`}>
                                {t(sale.paymentStatus.toLowerCase())}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-slate-400">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </td>
                          </tr>

                          {/* Expanded detail */}
                          {isExpanded && (
                            <tr className="bg-blue-50/60 border-t border-blue-100">
                              <td colSpan={8} className="px-4 pb-4 pt-2">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                                  {/* Items */}
                                  <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                      <Package className="w-3 h-3" /> {t('items')} ({sale.items.length})
                                    </p>
                                    <div className="bg-white rounded-lg border border-blue-100 overflow-hidden">
                                      <table className="w-full text-xs">
                                        <thead className="bg-slate-50 text-slate-500">
                                          <tr>
                                            <th className="px-3 py-2 text-left font-semibold">{t('product_name')}</th>
                                            <th className="px-3 py-2 text-center font-semibold">{t('quantity')}</th>
                                            <th className="px-3 py-2 text-right font-semibold">{t('unit_price')}</th>
                                            <th className="px-3 py-2 text-right font-semibold">{t('total')}</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                          {sale.items.map((item, i) => (
                                            <tr key={i} className="hover:bg-slate-50">
                                              <td className="px-3 py-2 font-medium text-slate-800">{item.productName}</td>
                                              <td className="px-3 py-2 text-center text-slate-600">{item.quantity}</td>
                                              <td className="px-3 py-2 text-right text-slate-600">{item.unitPrice.toFixed(2)}</td>
                                              <td className="px-3 py-2 text-right font-bold text-slate-800">{item.total.toFixed(2)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                        <tfoot>
                                          <tr className="border-t border-slate-200 bg-slate-50">
                                            <td colSpan={3} className="px-3 py-2 text-right font-bold text-slate-700 text-xs">{t('total')} TTC</td>
                                            <td className="px-3 py-2 text-right font-bold text-slate-900">{sale.totalAmount.toFixed(2)} MAD</td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  </div>

                                  {/* Payments */}
                                  <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                      <CreditCard className="w-3 h-3" /> {t('payments')} ({sale.payments.length})
                                    </p>
                                    <div className="bg-white rounded-lg border border-blue-100 overflow-hidden">
                                      {sale.payments.length === 0 ? (
                                        <div className="px-3 py-4 text-center text-xs text-slate-400">{t('no_payments_recorded')}</div>
                                      ) : (
                                        <table className="w-full text-xs">
                                          <thead className="bg-slate-50 text-slate-500">
                                            <tr>
                                              <th className="px-3 py-2 text-left font-semibold">{t('date')}</th>
                                              <th className="px-3 py-2 text-left font-semibold">{t('method')}</th>
                                              <th className="px-3 py-2 text-right font-semibold">{t('amount')}</th>
                                              <th className="px-3 py-2 text-center font-semibold">{t('status')}</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-50">
                                            {sale.payments.map((p, i) => (
                                              <tr key={i} className="hover:bg-slate-50">
                                                <td className="px-3 py-2 text-slate-500">{new Date(p.date).toLocaleDateString()}</td>
                                                <td className="px-3 py-2 font-medium text-slate-700">
                                                  {paymentMethodIcon(p.method)} {p.method}
                                                  {p.checkNumber && <span className="text-slate-400 ml-1">#{p.checkNumber}</span>}
                                                  {p.dueDate && <span className="text-slate-400 ml-1">· {new Date(p.dueDate).toLocaleDateString()}</span>}
                                                </td>
                                                <td className="px-3 py-2 text-right font-bold text-emerald-700">{p.amount.toFixed(2)}</td>
                                                <td className="px-3 py-2 text-center">
                                                  {p.paymentStatus && (
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                      p.paymentStatus === 'Cashed' ? 'bg-emerald-100 text-emerald-700' :
                                                      p.paymentStatus === 'Bounced' ? 'bg-rose-100 text-rose-700' :
                                                      'bg-amber-100 text-amber-700'
                                                    }`}>
                                                      {p.paymentStatus}
                                                    </span>
                                                  )}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      )}

                                      {/* Balance row */}
                                      <div className={`px-3 py-2 border-t flex justify-between text-xs font-bold ${balance > 0.01 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                        <span>{balance > 0.01 ? t('pending_balance') : '✅ ' + t('paid')}</span>
                                        <span>{balance > 0.01 ? `${balance.toFixed(2)} MAD` : sale.totalAmount.toFixed(2) + ' MAD'}</span>
                                      </div>
                                    </div>
                                  </div>

                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {sortedSales.map(sale => {
                  const isExpanded = expandedSaleId === sale.id;
                  const balance = sale.totalAmount - sale.amountPaid - (sale.creditedAmount || 0);
                  const ref = sale.invoiceNumber || sale.deliveryNoteNumber || `#${sale.id.slice(0, 8)}`;
                  return (
                    <div key={sale.id}>
                      <div
                        className={`p-4 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                        onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-mono text-xs font-semibold text-blue-700">{ref}</span>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColor(sale.paymentStatus)}`}>
                              {t(sale.paymentStatus.toLowerCase())}
                            </span>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 mb-1">{new Date(sale.date).toLocaleDateString()} · {sale.items.length} {t('items')}</div>
                        <div className="flex justify-between text-sm">
                          <span>{t('total')}: <strong className="text-slate-900">{sale.totalAmount.toFixed(2)} MAD</strong></span>
                          {balance > 0.01 && <span className="text-rose-600 font-bold">{t('balance')}: {balance.toFixed(2)}</span>}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-4 bg-blue-50/60 border-t border-blue-100 space-y-3">
                          {/* Items */}
                          <div>
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">{t('items')}</p>
                            <div className="space-y-1">
                              {sale.items.map((item, i) => (
                                <div key={i} className="flex justify-between text-xs bg-white rounded px-2 py-1.5 border border-slate-100">
                                  <span className="font-medium text-slate-700">{item.productName} <span className="text-slate-400">×{item.quantity}</span></span>
                                  <span className="font-bold text-slate-800">{item.total.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* Payments */}
                          {sale.payments.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-slate-500 uppercase mb-2">{t('payments')}</p>
                              <div className="space-y-1">
                                {sale.payments.map((p, i) => (
                                  <div key={i} className="flex justify-between text-xs bg-white rounded px-2 py-1.5 border border-slate-100">
                                    <span className="text-slate-600">{paymentMethodIcon(p.method)} {p.method} {p.checkNumber ? `#${p.checkNumber}` : ''}</span>
                                    <span className="font-bold text-emerald-700">{p.amount.toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerDetail;
