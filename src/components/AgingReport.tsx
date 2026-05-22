import React, { useMemo, useState } from 'react';
import { Sale, Customer } from '../types';
import { CURRENCY } from '../constants';
import { useLanguage } from '../services/i18n';
import { AlertTriangle, ChevronDown, ChevronRight, Clock, AlertCircle, CheckCircle, FileText } from 'lucide-react';

interface AgingReportProps {
  sales: Sale[];
  customers: Customer[];
}

interface AgingBuckets {
  b0_30: number;
  b31_60: number;
  b61_90: number;
  b90plus: number;
  total: number;
}

interface CustomerAging extends AgingBuckets {
  customerId: string;
  customerName: string;
  lastSaleDate: string;
  invoices: InvoiceAging[];
}

interface InvoiceAging extends AgingBuckets {
  id: string;
  invoiceNumber: string;
  date: string;
  daysOverdue: number;
  paymentStatus: string;
}

const BUCKET_COLORS = {
  b0_30:   { bg: 'bg-emerald-50', text: 'text-emerald-700', label: '0–30j',  badge: 'bg-emerald-100 text-emerald-700' },
  b31_60:  { bg: 'bg-amber-50',   text: 'text-amber-700',   label: '31–60j', badge: 'bg-amber-100 text-amber-700' },
  b61_90:  { bg: 'bg-orange-50',  text: 'text-orange-700',  label: '61–90j', badge: 'bg-orange-100 text-orange-700' },
  b90plus: { bg: 'bg-rose-50',    text: 'text-rose-700',    label: '+90j',   badge: 'bg-rose-100 text-rose-700' },
};

function getBucket(daysOverdue: number): keyof AgingBuckets {
  if (daysOverdue <= 30)  return 'b0_30';
  if (daysOverdue <= 60)  return 'b31_60';
  if (daysOverdue <= 90)  return 'b61_90';
  return 'b90plus';
}

function emptyBuckets(): AgingBuckets {
  return { b0_30: 0, b31_60: 0, b61_90: 0, b90plus: 0, total: 0 };
}

function fmt(n: number) {
  return n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const AgingReport: React.FC<AgingReportProps> = ({ sales, customers }) => {
  const { t } = useLanguage();
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const customerMap = useMemo(() => {
    const m: Record<string, string> = {};
    customers.forEach(c => { m[c.id] = c.name; });
    return m;
  }, [customers]);

  const { customerRows, totals } = useMemo(() => {
    const byCustomer: Record<string, CustomerAging> = {};

    sales.forEach(s => {
      if (s.paymentStatus === 'Paid' || s.status === 'Cancelled') return;
      if (s.returnStatus === 'full' || s.documentType === 'QUOTE') return;
      const remaining = s.totalAmount - s.amountPaid - (s.creditedAmount || 0);
      if (remaining <= 0) return;

      // Use the latest pending check/traite due date as the reference date.
      // If the client paid with a check due in 30 days, the debt is not yet overdue.
      // Only fall back to invoice date when there are no pending deferred payments.
      const pendingDeferred = (s.payments || []).filter(
        p => p.paymentStatus === 'Pending' && p.dueDate
      );
      const refDateStr = pendingDeferred.length > 0
        ? pendingDeferred.reduce((latest, p) =>
            (p.dueDate! > latest ? p.dueDate! : latest), pendingDeferred[0].dueDate!)
        : s.date;

      const refDate = new Date(refDateStr);
      refDate.setHours(0, 0, 0, 0);
      const daysOverdue = Math.ceil((today.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
      const bucket = getBucket(daysOverdue);

      if (!byCustomer[s.customerId]) {
        byCustomer[s.customerId] = {
          customerId: s.customerId,
          customerName: s.customerName || customerMap[s.customerId] || s.customerId,
          lastSaleDate: s.date,
          invoices: [],
          ...emptyBuckets(),
        };
      }

      const c = byCustomer[s.customerId];
      const inv: InvoiceAging = { ...emptyBuckets(), id: s.id, invoiceNumber: s.invoiceNumber || s.id.slice(0,8), date: s.date, daysOverdue, paymentStatus: s.paymentStatus };
      inv[bucket] = remaining;
      inv.total = remaining;

      c[bucket] += remaining;
      c.total += remaining;
      if (new Date(s.date) > new Date(c.lastSaleDate)) c.lastSaleDate = s.date;
      c.invoices.push(inv);
    });

    const rows = Object.values(byCustomer).sort((a, b) => b.total - a.total);

    const totals = rows.reduce((acc, r) => {
      acc.b0_30   += r.b0_30;
      acc.b31_60  += r.b31_60;
      acc.b61_90  += r.b61_90;
      acc.b90plus += r.b90plus;
      acc.total   += r.total;
      return acc;
    }, emptyBuckets());

    return { customerRows: rows, totals };
  }, [sales, today, customerMap]);

  const toggleCustomer = (id: string) => {
    setExpandedCustomers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const kpiCards = [
    { key: 'total',   label: 'Total Créances', value: totals.total,   icon: <FileText className="w-5 h-5" />,       color: 'text-slate-700',  bg: 'bg-slate-100' },
    { key: 'b0_30',   label: '0 – 30 jours',   value: totals.b0_30,   icon: <CheckCircle className="w-5 h-5" />,    color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { key: 'b31_60',  label: '31 – 60 jours',  value: totals.b31_60,  icon: <Clock className="w-5 h-5" />,          color: 'text-amber-600',   bg: 'bg-amber-100' },
    { key: 'b61_90',  label: '61 – 90 jours',  value: totals.b61_90,  icon: <AlertCircle className="w-5 h-5" />,   color: 'text-orange-600',  bg: 'bg-orange-100' },
    { key: 'b90plus', label: '+90 jours',       value: totals.b90plus, icon: <AlertTriangle className="w-5 h-5" />, color: 'text-rose-600',    bg: 'bg-rose-100' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpiCards.map(card => (
          <div key={card.key} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${card.bg} ${card.color} shrink-0`}>
              {card.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase truncate">{card.label}</p>
              <p className={`text-base font-bold truncate ${card.color}`}>{fmt(card.value)}</p>
              <p className="text-[10px] text-slate-400">{CURRENCY}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      {customerRows.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
          <p className="font-semibold">Aucune créance en cours</p>
          <p className="text-sm mt-1">Tous les clients sont à jour.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase">Client</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase text-emerald-600 text-right">0–30j</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase text-amber-600 text-right">31–60j</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase text-orange-600 text-right">61–90j</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase text-rose-600 text-right">+90j</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 text-xs uppercase text-right">Total</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase text-right">Dernière facture</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customerRows.map(row => {
                  const isExpanded = expandedCustomers.has(row.customerId);
                  return (
                    <React.Fragment key={row.customerId}>
                      {/* Customer summary row */}
                      <tr
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => toggleCustomer(row.customerId)}
                      >
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          <div className="flex items-center gap-2">
                            {isExpanded
                              ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                              : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                            }
                            {row.customerName}
                            <span className="ml-1 text-xs text-slate-400 font-normal">({row.invoices.length} fact.)</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-700">{row.b0_30 > 0 ? fmt(row.b0_30) : <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-3 text-right font-medium text-amber-700">{row.b31_60 > 0 ? fmt(row.b31_60) : <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-3 text-right font-medium text-orange-700">{row.b61_90 > 0 ? fmt(row.b61_90) : <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-3 text-right font-medium text-rose-700">{row.b90plus > 0 ? fmt(row.b90plus) : <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">{fmt(row.total)}</td>
                        <td className="px-4 py-3 text-right text-slate-500 text-xs">{new Date(row.lastSaleDate).toLocaleDateString('fr-MA')}</td>
                      </tr>

                      {/* Expanded: individual invoices */}
                      {isExpanded && row.invoices.map(inv => {
                        const bucket = getBucket(inv.daysOverdue);
                        const col = BUCKET_COLORS[bucket as keyof typeof BUCKET_COLORS];
                        return (
                          <tr key={inv.id} className="bg-slate-50/60 border-l-4 border-l-slate-200">
                            <td className="px-4 py-2 pl-10">
                              <div className="flex items-center gap-2">
                                <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="text-slate-700 font-medium">{inv.invoiceNumber}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${col.badge}`}>
                                  {inv.daysOverdue}j
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right text-xs text-emerald-600">{inv.b0_30 > 0 ? fmt(inv.b0_30) : <span className="text-slate-300">—</span>}</td>
                            <td className="px-4 py-2 text-right text-xs text-amber-600">{inv.b31_60 > 0 ? fmt(inv.b31_60) : <span className="text-slate-300">—</span>}</td>
                            <td className="px-4 py-2 text-right text-xs text-orange-600">{inv.b61_90 > 0 ? fmt(inv.b61_90) : <span className="text-slate-300">—</span>}</td>
                            <td className="px-4 py-2 text-right text-xs text-rose-600">{inv.b90plus > 0 ? fmt(inv.b90plus) : <span className="text-slate-300">—</span>}</td>
                            <td className="px-4 py-2 text-right text-xs font-semibold text-slate-700">{fmt(inv.total)}</td>
                            <td className="px-4 py-2 text-right text-xs text-slate-400">{new Date(inv.date).toLocaleDateString('fr-MA')}</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                <tr>
                  <td className="px-4 py-3 font-bold text-slate-700 uppercase text-xs">TOTAL</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700">{totals.b0_30 > 0 ? fmt(totals.b0_30) : '—'}</td>
                  <td className="px-4 py-3 text-right font-bold text-amber-700">{totals.b31_60 > 0 ? fmt(totals.b31_60) : '—'}</td>
                  <td className="px-4 py-3 text-right font-bold text-orange-700">{totals.b61_90 > 0 ? fmt(totals.b61_90) : '—'}</td>
                  <td className="px-4 py-3 text-right font-bold text-rose-700">{totals.b90plus > 0 ? fmt(totals.b90plus) : '—'}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 text-base">{fmt(totals.total)} {CURRENCY}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgingReport;
