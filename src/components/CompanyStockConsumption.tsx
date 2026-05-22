/**
 * CompanyStockConsumption — shows stock consumed per company per product.
 * Admin / Manager only.
 *
 * Data source: sale_items JOIN sales (inner), grouped client-side.
 * Allows filtering by warehouse and date range.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { User, Warehouse } from '../types';
import { useStore } from '../store/useStore';
import { useLanguage } from '../services/i18n';
import { Loader2, BarChart2, RefreshCw } from 'lucide-react';

interface Props {
  currentUser: User;
  warehouses: Warehouse[];
}

interface ConsumptionRow {
  productId: string;
  productName: string;
  sku: string;
  byCompany: Record<string, number>; // companyId → total boxes/units sold
  totalConsumed: number;
  currentStock: number;              // sum of stock_levels for selected warehouse(s)
}

export default function CompanyStockConsumption({ currentUser: _currentUser, warehouses }: Props) {
  const { companyProfiles } = useStore();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ConsumptionRow[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // ── 1. Sale items with sale header (inner join) ─────────────────────────
      let siQuery = supabase
        .from('sale_items')
        .select('product_id, quantity, sales!inner(company_id, warehouse_id, date, status)')
        .neq('sales.status', 'Cancelled');

      if (selectedWarehouseId) siQuery = siQuery.eq('sales.warehouse_id', selectedWarehouseId);
      if (dateFrom)            siQuery = siQuery.gte('sales.date', dateFrom);
      if (dateTo)              siQuery = siQuery.lte('sales.date', dateTo);

      const { data: saleItems, error: siError } = await siQuery;
      if (siError) throw siError;

      // ── 2. Current stock levels ─────────────────────────────────────────────
      let slQuery = supabase.from('stock_levels').select('product_id, warehouse_id, quantity');
      if (selectedWarehouseId) slQuery = slQuery.eq('warehouse_id', selectedWarehouseId);

      const { data: stockLevels, error: slError } = await slQuery;
      if (slError) throw slError;

      // ── 3. Product catalogue ────────────────────────────────────────────────
      const { data: products, error: pError } = await supabase
        .from('products')
        .select('id, name, sku')
        .order('name');
      if (pError) throw pError;

      // ── 4. Aggregate consumption: productId → companyId → qty ──────────────
      const consumptionMap: Record<string, Record<string, number>> = {};
      for (const item of saleItems ?? []) {
        const sale = (item as any).sales;
        if (!sale) continue;
        const companyId: string = sale.company_id ?? 'no_company';
        const pid: string = (item as any).product_id;
        if (!consumptionMap[pid]) consumptionMap[pid] = {};
        consumptionMap[pid][companyId] = (consumptionMap[pid][companyId] ?? 0) + (item as any).quantity;
      }

      // ── 5. Aggregate stock: productId → total qty ──────────────────────────
      const stockMap: Record<string, number> = {};
      for (const sl of stockLevels ?? []) {
        const s = sl as any;
        stockMap[s.product_id] = (stockMap[s.product_id] ?? 0) + s.quantity;
      }

      // ── 6. Build result rows ────────────────────────────────────────────────
      const resultRows: ConsumptionRow[] = [];
      for (const product of products ?? []) {
        const p = product as any;
        const byCompany = consumptionMap[p.id] ?? {};
        const totalConsumed = Object.values(byCompany).reduce((a: number, b: number) => a + b, 0);
        const currentStock = stockMap[p.id] ?? 0;

        // Only show products that have some activity or some stock
        if (totalConsumed === 0 && currentStock === 0) continue;

        resultRows.push({
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          byCompany,
          totalConsumed,
          currentStock,
        });
      }

      // Sort by total consumed descending
      resultRows.sort((a, b) => b.totalConsumed - a.totalConsumed);
      setRows(resultRows);
    } catch (err) {
      console.error('[CompanyStockConsumption] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouseId, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Unique company IDs present in the current data set
  const companyIds = useMemo(() => {
    const ids = new Set<string>();
    rows.forEach(row => Object.keys(row.byCompany).forEach(id => ids.add(id)));
    // Put known companies first (in profile order), then unknowns
    const profileOrder = companyProfiles.map(p => p.id);
    return [
      ...profileOrder.filter(id => ids.has(id)),
      ...Array.from(ids).filter(id => !profileOrder.includes(id)),
    ];
  }, [rows, companyProfiles]);

  const getCompanyName = (id: string) => {
    if (id === 'no_company') return t('no_company');
    const profile = companyProfiles.find(p => p.id === id);
    return profile?.profileName ?? id.slice(0, 8) + '…';
  };

  // Column totals
  const totalByCompany = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const row of rows) {
      for (const [cid, qty] of Object.entries(row.byCompany)) {
        totals[cid] = (totals[cid] ?? 0) + qty;
      }
    }
    return totals;
  }, [rows]);

  const grandTotalConsumed = rows.reduce((s, r) => s + r.totalConsumed, 0);
  const grandTotalStock    = rows.reduce((s, r) => s + r.currentStock, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-primary-600" />
            {t('company_consumption')}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {t('manage_customers_desc')}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">{t('warehouse')}</label>
          <select
            value={selectedWarehouseId}
            onChange={e => setSelectedWarehouseId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[180px]"
          >
            <option value="">{t('all_warehouses')}</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">{t('date_start')}</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">{t('date_end')}</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {(selectedWarehouseId || dateFrom || dateTo) && (
          <div className="flex flex-col gap-1 justify-end">
            <button
              onClick={() => { setSelectedWarehouseId(''); setDateFrom(''); setDateTo(''); }}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
            >
              {t('reset')}
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
          <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t('no_data_available')}</p>
          <p className="text-sm mt-1">{t('try_modify_filters')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left font-semibold sticky left-0 bg-slate-50">{t('product_name')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('ref_short')}</th>
                {companyIds.map(id => (
                  <th key={id} className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                    {getCompanyName(id)}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                  {t('total_sold')}
                </th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                  {t('current_stock_label')}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {rows.map(row => (
                <tr key={row.productId} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800 sticky left-0 bg-white">
                    {row.productName}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">
                    {row.sku}
                  </td>
                  {companyIds.map(id => (
                    <td key={id} className="px-4 py-3 text-right text-slate-700">
                      {row.byCompany[id]
                        ? <span className="font-medium">{row.byCompany[id].toLocaleString('fr-MA')}</span>
                        : <span className="text-slate-300">—</span>
                      }
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">
                    {row.totalConsumed.toLocaleString('fr-MA')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${
                      row.currentStock <= 0 ? 'text-red-600' :
                      row.currentStock <= 20 ? 'text-amber-600' :
                      'text-emerald-600'
                    }`}>
                      {row.currentStock.toLocaleString('fr-MA')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot className="bg-slate-100 text-slate-700 font-semibold text-sm border-t-2 border-slate-200">
              <tr>
                <td className="px-4 py-3 sticky left-0 bg-slate-100" colSpan={2}>
                  {t('total_n_products').replace('{n}', String(rows.length))}
                </td>
                {companyIds.map(id => (
                  <td key={id} className="px-4 py-3 text-right">
                    {(totalByCompany[id] ?? 0).toLocaleString('fr-MA')}
                  </td>
                ))}
                <td className="px-4 py-3 text-right text-slate-900">
                  {grandTotalConsumed.toLocaleString('fr-MA')}
                </td>
                <td className="px-4 py-3 text-right text-emerald-700">
                  {grandTotalStock.toLocaleString('fr-MA')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
