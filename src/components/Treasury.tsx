/**
 * Treasury Management Module
 * Professional check and deferred payment tracking system
 */

import { useState, useMemo } from 'react';
import {
  Calendar,
  Filter,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  FileText,
  Wallet,
  Edit3,
  X
} from 'lucide-react';
import { Sale, Customer, Payment, CheckPaymentStatus, User } from '../types';
import { useSales } from '../hooks/useSupabaseData';
import { useLanguage } from '../services/i18n';
import { logger } from '../utils/logger';

interface TreasuryProps {
  sales: Sale[];
  customers: Customer[];
  currentUser: User;
}

type CheckStatusFilter = 'ALL' | 'PENDING' | 'CASHED' | 'BOUNCED';
type DueDateFilter = 'ALL' | 'OVERDUE' | 'THIS_WEEK' | 'THIS_MONTH';

// Helper to get all check payments from sales
interface CheckPayment {
  paymentId: string;
  saleId: string;
  invoiceNumber?: string;
  customerName: string;
  customerId: string;
  checkNumber: string;
  amount: number;
  dueDate: string;
  paymentDate: string;
  status: CheckPaymentStatus;
  recordedBy: string;
  reference?: string;
}

const getCheckPayments = (sales: Sale[]): CheckPayment[] => {
  const checks: CheckPayment[] = [];

  sales.forEach(sale => {
    if (!sale.payments) return;

    sale.payments.forEach(payment => {
      if ((payment.method === 'Check' || payment.method === 'Traite') && payment.checkNumber && payment.dueDate) {
        const checkStatus = payment.paymentStatus || 'Pending';
        // Hide Pending/Bounced checks from cancelled invoices (irrelevant, no money expected)
        // but always keep Cashed checks for audit (money was actually received)
        if (sale.status === 'Cancelled' && checkStatus !== 'Cashed') return;
        checks.push({
          paymentId: payment.id,
          saleId: sale.id,
          invoiceNumber: sale.invoiceNumber || sale.deliveryNoteNumber,
          customerName: sale.customerName,
          customerId: sale.customerId,
          checkNumber: payment.checkNumber,
          amount: payment.amount,
          dueDate: payment.dueDate,
          paymentDate: payment.date,
          status: payment.paymentStatus || 'Pending',
          recordedBy: payment.recordedBy,
          reference: payment.reference
        });
      }
    });
  });

  return checks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
};

// Helper to get days until due date
const getDaysUntilDue = (dueDate: string): number => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

// Helper to get customer risk (% of bounced checks)
const getCustomerRisk = (customerId: string, checks: CheckPayment[]): { total: number; bounced: number; risk: number } => {
  const customerChecks = checks.filter(c => c.customerId === customerId);
  const total = customerChecks.length;
  const bounced = customerChecks.filter(c => c.status === 'Bounced').length;
  const risk = total > 0 ? (bounced / total) * 100 : 0;
  return { total, bounced, risk };
};

const Treasury: React.FC<TreasuryProps> = ({ sales: salesProp, customers, currentUser }) => {
  const { t } = useLanguage();
  const salesHook = useSales();

  // Use Supabase data if available, fallback to props
  const sales = salesHook.sales.length > 0 ? salesHook.sales : salesProp;

  // State
  const [statusFilter, setStatusFilter] = useState<CheckStatusFilter>('ALL');
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('ALL');
  const [viewingCheck, setViewingCheck] = useState<CheckPayment | null>(null);
  const [editingDueDate, setEditingDueDate] = useState<{ check: CheckPayment; newDate: string } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Get all checks
  const allChecks = useMemo(() => getCheckPayments(sales), [sales]);

  // Filter checks
  const filteredChecks = useMemo(() => {
    return allChecks.filter(check => {
      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'PENDING' && check.status !== 'Pending') return false;
        if (statusFilter === 'CASHED' && check.status !== 'Cashed') return false;
        if (statusFilter === 'BOUNCED' && check.status !== 'Bounced') return false;
      }

      // Due date filter
      if (dueDateFilter !== 'ALL') {
        const daysUntil = getDaysUntilDue(check.dueDate);
        if (dueDateFilter === 'OVERDUE' && daysUntil >= 0) return false;
        if (dueDateFilter === 'THIS_WEEK' && (daysUntil < 0 || daysUntil > 7)) return false;
        if (dueDateFilter === 'THIS_MONTH' && (daysUntil < 0 || daysUntil > 30)) return false;
      }

      // Customer filter
      if (selectedCustomer !== 'ALL' && check.customerId !== selectedCustomer) return false;

      return true;
    });
  }, [allChecks, statusFilter, dueDateFilter, selectedCustomer]);

  // KPIs
  const kpis = useMemo(() => {
    const pending = allChecks.filter(c => c.status === 'Pending');
    const overdue = pending.filter(c => getDaysUntilDue(c.dueDate) < 0);
    const thisWeek = pending.filter(c => {
      const days = getDaysUntilDue(c.dueDate);
      return days >= 0 && days <= 7;
    });
    const cashed = allChecks.filter(c => c.status === 'Cashed');
    const cashedThisMonth = cashed.filter(c => {
      const paymentDate = new Date(c.paymentDate);
      const now = new Date();
      return paymentDate.getMonth() === now.getMonth() && paymentDate.getFullYear() === now.getFullYear();
    });

    return {
      pendingTotal: pending.reduce((sum, c) => sum + c.amount, 0),
      pendingCount: pending.length,
      overdueTotal: overdue.reduce((sum, c) => sum + c.amount, 0),
      overdueCount: overdue.length,
      thisWeekTotal: thisWeek.reduce((sum, c) => sum + c.amount, 0),
      thisWeekCount: thisWeek.length,
      cashedThisMonthTotal: cashedThisMonth.reduce((sum, c) => sum + c.amount, 0),
      cashedThisMonthCount: cashedThisMonth.length
    };
  }, [allChecks]);

  // Handlers
  const handleUpdateStatus = async (check: CheckPayment, newStatus: CheckPaymentStatus) => {
    // Validation: Cannot mark as Cashed before due date
    if (newStatus === 'Cashed' && getDaysUntilDue(check.dueDate) > 0) {
      const confirm = window.confirm(
        `⚠️ Advertencia:\n\nEste cheque vence el ${new Date(check.dueDate).toLocaleDateString()}.\n` +
        t('confirm_early_collection')
      );
      if (!confirm) return;
    }

    // Permission check: Admin, Manager & Accountant can update
    if (!['Admin', 'Manager', 'Accountant'].includes(currentUser.role)) {
      alert('⛔ Permiso denegado: Solo Administradores, Managers y Contadores pueden actualizar el estado de los cheques.');
      return;
    }

    // Alert if customer has bounced checks
    if (newStatus === 'Bounced') {
      const risk = getCustomerRisk(check.customerId, allChecks);
      if (risk.total > 0) {
        alert(
          `⚠️ Informations Client :\n\n` +
          `Total chèques : ${risk.total}\n` +
          `Chèques rejetés : ${risk.bounced + 1} (${((risk.bounced + 1) / (risk.total + 1) * 100).toFixed(1)}%)\n\n` +
          `Ce client aura un historique de chèques problématiques.`
        );
      }
    }

    try {
      setIsUpdating(true);
      await salesHook.updatePaymentStatus(check.paymentId, newStatus);
      setViewingCheck(null);
    } catch (error) {
      logger.error('Error updating check status', error);
      alert(t('error_updating_status'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateDueDate = async () => {
    if (!editingDueDate) return;

    // Permission check
    if (!['Admin', 'Manager', 'Accountant'].includes(currentUser.role)) {
      alert('⛔ Accès refusé : seuls les Administrateurs, Managers et Comptables peuvent modifier les dates.');
      return;
    }

    try {
      setIsUpdating(true);
      await salesHook.updatePaymentDueDate(editingDueDate.check.paymentId, editingDueDate.newDate);
      setEditingDueDate(null);
      setViewingCheck(null);
    } catch (error) {
      logger.error('Error updating due date', error);
      alert('Erreur lors de la mise à jour de la date d\'échéance.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExportToExcel = () => {
    const headers = ['Date Échéance', 'N° Chèque', 'Facture', 'Client', 'Montant (MAD)', 'Statut', 'Jours Restants'];
    const rows = filteredChecks.map(check => [
      new Date(check.dueDate).toLocaleDateString(),
      check.checkNumber,
      check.invoiceNumber || 'N/A',
      check.customerName,
      check.amount.toFixed(2),
      check.status,
      getDaysUntilDue(check.dueDate).toString()
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `treasury_checks_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Get row color based on urgency
  const getRowColor = (check: CheckPayment) => {
    if (check.status === 'Cashed') return 'bg-green-50';
    if (check.status === 'Bounced') return 'bg-red-50';

    const days = getDaysUntilDue(check.dueDate);
    if (days < 0) return 'bg-red-100'; // Overdue
    if (days <= 7) return 'bg-yellow-50'; // This week
    return 'bg-white';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t('treasury')}</h1>
          <p className="text-slate-500 mt-1">Gestion Professionnelle des Chèques et Encaissements</p>
        </div>
        <button
          onClick={handleExportToExcel}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Exporter en Excel
        </button>
      </div>

      {/* KPIs Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Pending Checks */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-8 h-8 text-blue-600" />
            <span className="text-sm font-semibold text-blue-700 bg-blue-200 px-2 py-1 rounded">
              {kpis.pendingCount}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-600 uppercase mb-1">Chèques en Attente</h3>
          <p className="text-2xl font-bold text-blue-700">{kpis.pendingTotal.toFixed(2)} MAD</p>
        </div>

        {/* Overdue */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-8 h-8 text-red-600" />
            <span className="text-sm font-semibold text-red-700 bg-red-200 px-2 py-1 rounded">
              {kpis.overdueCount}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-600 uppercase mb-1">Échus</h3>
          <p className="text-2xl font-bold text-red-700">{kpis.overdueTotal.toFixed(2)} MAD</p>
        </div>

        {/* This Week */}
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border border-yellow-200">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-8 h-8 text-yellow-600" />
            <span className="text-sm font-semibold text-yellow-700 bg-yellow-200 px-2 py-1 rounded">
              {kpis.thisWeekCount}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-600 uppercase mb-1">Échéance Cette Semaine</h3>
          <p className="text-2xl font-bold text-yellow-700">{kpis.thisWeekTotal.toFixed(2)} MAD</p>
        </div>

        {/* Cashed This Month */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
            <span className="text-sm font-semibold text-green-700 bg-green-200 px-2 py-1 rounded">
              {kpis.cashedThisMonthCount}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-600 uppercase mb-1">Encaissé Ce Mois</h3>
          <p className="text-2xl font-bold text-green-700">{kpis.cashedThisMonthTotal.toFixed(2)} MAD</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Status Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Statut</label>
            <div className="relative">
              <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as CheckStatusFilter)}
                className="pl-10 w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Tous</option>
                <option value="PENDING">En attente</option>
                <option value="CASHED">Encaissés</option>
                <option value="BOUNCED">Rejetés</option>
              </select>
            </div>
          </div>

          {/* Due Date Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Échéance</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <select
                value={dueDateFilter}
                onChange={(e) => setDueDateFilter(e.target.value as DueDateFilter)}
                className="pl-10 w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Tous</option>
                <option value="OVERDUE">Échus</option>
                <option value="THIS_WEEK">Cette Semaine</option>
                <option value="THIS_MONTH">Ce Mois</option>
              </select>
            </div>
          </div>

          {/* Customer Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Client</label>
            <div className="relative">
              <Wallet className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="pl-10 w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">{t('all_customers_filter')}</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Checks Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4 text-left">Échéance</th>
                <th className="p-4 text-left">N° Chèque</th>
                <th className="p-4 text-left">Facture</th>
                <th className="p-4 text-left">Client</th>
                <th className="p-4 text-right">Montant</th>
                <th className="p-4 text-center">Jours</th>
                <th className="p-4 text-center">Statut</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredChecks.map(check => {
                const daysUntil = getDaysUntilDue(check.dueDate);
                const risk = getCustomerRisk(check.customerId, allChecks);

                return (
                  <tr key={check.paymentId} className={`${getRowColor(check)} hover:bg-slate-50 transition-colors`}>
                    <td className="p-4 whitespace-nowrap font-medium">
                      {new Date(check.dueDate).toLocaleDateString()}
                    </td>
                    <td className="p-4 font-mono text-xs font-bold text-slate-700">
                      {check.checkNumber}
                    </td>
                    <td className="p-4 font-mono text-xs">
                      {check.invoiceNumber || 'N/A'}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span>{check.customerName}</span>
                        {risk.bounced > 0 && (
                          <span
                            className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold"
                            title={`${risk.bounced} de ${risk.total} cheques rebotados (${risk.risk.toFixed(1)}%)`}
                          >
                            ⚠️ Riesgo
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right font-bold text-slate-900">
                      {check.amount.toFixed(2)} MAD
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${
                        daysUntil < 0 ? 'bg-red-100 text-red-700' :
                        daysUntil <= 7 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {daysUntil < 0 ? `${Math.abs(daysUntil)}d vencido` :
                         daysUntil === 0 ? 'Hoy' :
                         `${daysUntil}d`}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {check.status === 'Pending' && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                          <Clock className="w-3 h-3 mr-1" />
                          En attente
                        </span>
                      )}
                      {check.status === 'Cashed' && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Encaissé
                        </span>
                      )}
                      {check.status === 'Bounced' && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                          <XCircle className="w-3 h-3 mr-1" />
                          Rejeté
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => setViewingCheck(check)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title={t('view_change_status')}
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredChecks.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No se encontraron cheques con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Check Details Modal */}
      {viewingCheck && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">{t('check_details_title')}</h2>
              <button
                onClick={() => setViewingCheck(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Check Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Número de Cheque
                  </label>
                  <p className="text-lg font-mono font-bold text-slate-900">{viewingCheck.checkNumber}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Montant
                  </label>
                  <p className="text-lg font-bold text-slate-900">{viewingCheck.amount.toFixed(2)} MAD</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Facture
                  </label>
                  <p className="text-lg font-mono text-slate-700">{viewingCheck.invoiceNumber || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Client
                  </label>
                  <p className="text-lg text-slate-900">{viewingCheck.customerName}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Date d'Échéance
                  </label>
                  <div className="flex items-center gap-2">
                    <p className="text-lg text-slate-900">{new Date(viewingCheck.dueDate).toLocaleDateString()}</p>
                    <button
                      onClick={() => setEditingDueDate({ check: viewingCheck, newDate: viewingCheck.dueDate })}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      title="Modifier la date"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Jours Restants
                  </label>
                  <p className={`text-lg font-bold ${
                    getDaysUntilDue(viewingCheck.dueDate) < 0 ? 'text-red-600' :
                    getDaysUntilDue(viewingCheck.dueDate) <= 7 ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {getDaysUntilDue(viewingCheck.dueDate) < 0
                      ? `${Math.abs(getDaysUntilDue(viewingCheck.dueDate))} jours échu`
                      : getDaysUntilDue(viewingCheck.dueDate) === 0
                      ? 'Échéance aujourd\'hui'
                      : `${getDaysUntilDue(viewingCheck.dueDate)} jours`}
                  </p>
                </div>
              </div>

              {/* Reference (if available) */}
              {viewingCheck.reference && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                  <label className="block text-xs font-bold text-blue-700 uppercase mb-1">
                    Référence
                  </label>
                  <p className="text-sm text-blue-900 font-mono">{viewingCheck.reference}</p>
                </div>
              )}

              {/* Customer Risk */}
              {(() => {
                const risk = getCustomerRisk(viewingCheck.customerId, allChecks);
                if (risk.total > 1) {
                  return (
                    <div className={`p-4 rounded-lg ${
                      risk.risk > 20 ? 'bg-red-50 border border-red-200' :
                      risk.risk > 0 ? 'bg-yellow-50 border border-yellow-200' :
                      'bg-green-50 border border-green-200'
                    }`}>
                      <h3 className="font-bold text-sm uppercase mb-2 text-slate-700">Historique du Client</h3>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500">Total chèques :</span>
                          <span className="font-bold ml-2">{risk.total}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Rejetés :</span>
                          <span className="font-bold ml-2 text-red-600">{risk.bounced}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Indice de risque :</span>
                          <span className={`font-bold ml-2 ${
                            risk.risk > 20 ? 'text-red-600' :
                            risk.risk > 0 ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {risk.risk.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Status Update Actions */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  Changer le Statut
                </label>
                {/* Valid state transitions:
                    Pending → Cashed (collected)
                    Pending → Bounced (bounced)
                    Bounced → Pending (re-deposit attempt)
                    Cashed → NOTHING (irreversible - already collected) */}
                <div className="flex gap-2">
                  {viewingCheck.status === 'Pending' && (
                    <button
                      onClick={() => handleUpdateStatus(viewingCheck, 'Cashed')}
                      disabled={isUpdating || !['Admin', 'Manager', 'Accountant'].includes(currentUser.role)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      Marquer comme Encaissé
                    </button>
                  )}
                  {viewingCheck.status === 'Pending' && (
                    <button
                      onClick={() => handleUpdateStatus(viewingCheck, 'Bounced')}
                      disabled={isUpdating || !['Admin', 'Manager', 'Accountant'].includes(currentUser.role)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <XCircle className="w-5 h-5" />
                      Marquer comme Rejeté
                    </button>
                  )}
                  {viewingCheck.status === 'Bounced' && (
                    <button
                      onClick={() => handleUpdateStatus(viewingCheck, 'Pending')}
                      disabled={isUpdating || !['Admin', 'Manager', 'Accountant'].includes(currentUser.role)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Clock className="w-5 h-5" />
                      Remettre en Attente
                    </button>
                  )}
                  {viewingCheck.status === 'Cashed' && (
                    <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3 w-full text-center font-medium">
                      Ce paiement a déjà été encaissé et ne peut plus être modifié.
                    </p>
                  )}
                </div>
                {!['Admin', 'Manager', 'Accountant'].includes(currentUser.role) && (
                  <p className="text-xs text-red-600 mt-2">
                    ⛔ Seuls les Administrateurs, Managers et Comptables peuvent modifier le statut des chèques.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Due Date Modal */}
      {editingDueDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">Modifier la Date d'Échéance</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Nouvelle Date d'Échéance
                </label>
                <input
                  type="date"
                  value={editingDueDate.newDate}
                  onChange={(e) => setEditingDueDate({ ...editingDueDate, newDate: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleUpdateDueDate}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {t('save')}
                </button>
                <button
                  onClick={() => setEditingDueDate(null)}
                  className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Treasury;
