import React, { useState, useMemo, useEffect } from 'react';
import { Sale, Product } from '../types';
import { useLanguage } from '../services/i18n';
import { Calendar, FileSpreadsheet, ChevronUp, ChevronDown } from 'lucide-react';
import { CURRENCY } from '../constants';
import { exportToCSV } from '../utils/helpers';
import { calculateHT } from '../utils/pricing';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface ProductProfitReportProps {
  sales: Sale[];
  products: Product[];
}

interface ProductRow {
  productId: string;
  name: string;
  category: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  unitsSold: number;
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const ProductProfitReport: React.FC<ProductProfitReportProps> = ({ sales, products }) => {
  const { t } = useLanguage();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortField, setSortField] = useState<keyof ProductRow>('profit');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Default to current month
  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    setStartDate(fmt(start));
    setEndDate(fmt(end));
  }, []);

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  const rows = useMemo(() => {
    const filtered = sales.filter(s => {
      if (s.status === 'Cancelled') return false;
      if (s.returnStatus === 'full') return false;
      if (s.documentType === 'QUOTE') return false;
      const d = new Date(s.date);
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date(8640000000000000);
      end.setHours(23, 59, 59, 999);
      return d >= start && d <= end;
    });

    const agg = new Map<string, { revenue: number; cost: number; units: number }>();

    filtered.forEach(sale => {
      // Proportional adjustment for returned items: if part of this sale was returned,
      // scale down revenue/cost/units by the return fraction to avoid overstating profit.
      const returnFraction = sale.totalAmount > 0 && (sale.creditedAmount || 0) > 0
        ? Math.min(1, (sale.creditedAmount || 0) / sale.totalAmount)
        : 0;
      const kept = 1 - returnFraction;

      sale.items.forEach(item => {
        const existing = agg.get(item.productId) || { revenue: 0, cost: 0, units: 0 };
        // Revenue in HT, adjusted for returns
        existing.revenue += calculateHT(item.total, sale.taxRate ?? 0.20) * kept;
        const product = productMap.get(item.productId);
        // Units sold: for box mode multiply by unitsPerBox to get actual units
        const unitsSold = item.sellMode === 'box'
          ? item.quantity * (item.unitsPerBox || 1)
          : item.quantity;
        // product.cost is stored TTC — convert to HT for consistent comparison
        const costTaxRate = product?.customTaxRate ?? (sale.taxRate ?? 0.20);
        const costHT = product?.cost ? product.cost / (1 + costTaxRate) : 0;
        existing.cost += costHT * unitsSold * kept;
        existing.units += unitsSold * kept;
        agg.set(item.productId, existing);
      });
    });

    const result: ProductRow[] = [];
    agg.forEach((data, productId) => {
      const product = productMap.get(productId);
      const profit = data.revenue - data.cost;
      result.push({
        productId,
        name: product?.name || productId.slice(0, 8),
        category: product?.category || '-',
        revenue: data.revenue,
        cost: data.cost,
        profit,
        margin: data.revenue > 0 ? (profit / data.revenue) * 100 : 0,
        unitsSold: Math.round(data.units),
      });
    });

    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });

    return result;
  }, [sales, startDate, endDate, productMap, sortField, sortDir]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        revenue: acc.revenue + r.revenue,
        cost: acc.cost + r.cost,
        profit: acc.profit + r.profit,
        units: acc.units + r.unitsSold,
      }),
      { revenue: 0, cost: 0, profit: 0, units: 0 }
    );
  }, [rows]);

  const top10 = useMemo(() => rows.slice(0, 10).map(r => ({
    name: r.name.length > 20 ? r.name.slice(0, 18) + '...' : r.name,
    profit: Math.round(r.profit),
  })), [rows]);

  const categoryData = useMemo(() => {
    const catMap = new Map<string, number>();
    rows.forEach(r => {
      catMap.set(r.category, (catMap.get(r.category) || 0) + r.revenue);
    });
    return Array.from(catMap.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const toggleSort = (field: keyof ProductRow) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: keyof ProductRow }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 ml-0.5 inline" />
      : <ChevronDown className="w-3 h-3 ml-0.5 inline" />;
  };

  const handleExport = () => {
    const headers = [t('product'), t('category'), t('revenue'), t('cost'), t('profit'), t('margin') + ' %', t('units_sold')];
    const csvRows = rows.map(r =>
      [
        `"${r.name}"`,
        `"${r.category}"`,
        r.revenue.toFixed(2),
        r.cost.toFixed(2),
        r.profit.toFixed(2),
        r.margin.toFixed(1),
        r.unitsSold.toString(),
      ].join(',')
    );
    csvRows.push(
      `"TOTAL","",${ totals.revenue.toFixed(2)},${totals.cost.toFixed(2)},${totals.profit.toFixed(2)},,${totals.units}`
    );
    exportToCSV(`PROFIT_REPORT_${startDate}_${endDate}.csv`, headers, csvRows);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('date_start')}</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('date_end')}</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm font-medium"
        >
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          {t('export_csv')}
        </button>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">{t('revenue')}</p>
          <p className="text-xl font-bold text-slate-900">{totals.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-sm text-slate-400">{CURRENCY}</span></p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">{t('cost')}</p>
          <p className="text-xl font-bold text-slate-900">{totals.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-sm text-slate-400">{CURRENCY}</span></p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">{t('profit')}</p>
          <p className={`text-xl font-bold ${totals.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{totals.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-sm text-slate-400">{CURRENCY}</span></p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">{t('units_sold')}</p>
          <p className="text-xl font-bold text-slate-900">{totals.units.toLocaleString()}</p>
        </div>
      </div>

      {/* Charts */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 10 Profit Bar Chart */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="font-bold text-slate-900 text-sm mb-4">{t('top_10_profit')}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={top10} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => `${v.toLocaleString()} ${CURRENCY}`} />
                <Bar dataKey="profit" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue by Category Pie */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="font-bold text-slate-900 text-sm mb-4">{t('revenue_by_category')}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={{ strokeWidth: 1 }}
                >
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${v.toLocaleString()} ${CURRENCY}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('name')}>
                  {t('product')} <SortIcon field="name" />
                </th>
                <th className="px-4 py-3 text-left cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('category')}>
                  {t('category')} <SortIcon field="category" />
                </th>
                <th className="px-4 py-3 text-right cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('revenue')}>
                  {t('revenue')} <SortIcon field="revenue" />
                </th>
                <th className="px-4 py-3 text-right cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('cost')}>
                  {t('cost')} <SortIcon field="cost" />
                </th>
                <th className="px-4 py-3 text-right cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('profit')}>
                  {t('profit')} <SortIcon field="profit" />
                </th>
                <th className="px-4 py-3 text-right cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('margin')}>
                  {t('margin')} % <SortIcon field="margin" />
                </th>
                <th className="px-4 py-3 text-right cursor-pointer select-none hover:text-slate-700" onClick={() => toggleSort('unitsSold')}>
                  {t('units_sold')} <SortIcon field="unitsSold" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(r => (
                <tr key={r.productId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{r.category}</td>
                  <td className="px-4 py-3 text-right">{r.revenue.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{r.cost.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${r.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {r.profit.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.margin >= 30 ? 'bg-emerald-100 text-emerald-700' : r.margin >= 15 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                      {r.margin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{r.unitsSold}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">{t('no_sales_found')}</td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-sm">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-right uppercase text-slate-500 text-xs">Total</td>
                <td className="px-4 py-3 text-right">{totals.revenue.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-slate-500">{totals.cost.toFixed(2)}</td>
                <td className={`px-4 py-3 text-right ${totals.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{totals.profit.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  {totals.revenue > 0 ? ((totals.profit / totals.revenue) * 100).toFixed(1) : '0.0'}%
                </td>
                <td className="px-4 py-3 text-right">{totals.units}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProductProfitReport;
