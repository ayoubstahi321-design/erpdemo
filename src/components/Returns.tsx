
import React, { useState, useMemo } from 'react';
import { Return, Sale, Customer, Warehouse } from '../types';
import { Undo2, Calendar, FileText, User, Package, Hash, Loader2, AlertCircle, Trash2, Search, X } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { useReturns, useSales, useCustomers, useWarehouses } from '../hooks/useSupabaseData';

// Fallback props for when Supabase is disabled
interface ReturnsProps {
  returns?: Return[];
  sales?: Sale[];
  customers?: Customer[];
  warehouses?: Warehouse[];
}

const Returns: React.FC<ReturnsProps> = (props) => {
  const { t } = useLanguage();
  const [deletingReturnId, setDeletingReturnId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // ALWAYS call hooks (React rules - hooks must be called unconditionally)
  const returnsHook = useReturns();
  const salesHook = useSales();
  const customersHook = useCustomers();
  const warehousesHook = useWarehouses();

  // Use Supabase hook data directly
  const returns = returnsHook.returns;
  const sales = salesHook.sales;
  const customers = customersHook.customers;
  const warehouses = warehousesHook.warehouses;

  const loading = returnsHook.loading ||
                  salesHook.loading ||
                  customersHook.loading ||
                  warehousesHook.loading;
  const error = returnsHook.error ||
                salesHook.error ||
                customersHook.error ||
                warehousesHook.error;

  const handleDeleteReturn = async (returnId: string) => {
    try {
      setDeletingReturnId(returnId);
      setDeleteError(null);
      
      if (!returnsHook.deleteReturn) {
        throw new Error('Delete function not available');
      }
      
      await returnsHook.deleteReturn(returnId);
      setShowDeleteConfirm(null);
      returnsHook.refresh();
      salesHook.refresh();
    } catch (err: any) {
      setDeleteError(err.message || 'Error deleting return');
    } finally {
      setDeletingReturnId(null);
    }
  };

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
        {(returnsHook || salesHook || customersHook || warehousesHook) && (
          <button
            onClick={() => {
              returnsHook?.refresh();
              salesHook?.refresh();
              customersHook?.refresh();
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

  const filteredReturns = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return returns;
    return returns.filter(ret => {
      const saleRef = sales.find(s => s.id === ret.originalSaleId);
      const invoiceRef = saleRef?.invoiceNumber || saleRef?.deliveryNoteNumber || '';
      return (
        ret.customerName.toLowerCase().includes(q) ||
        (ret.reason || '').toLowerCase().includes(q) ||
        invoiceRef.toLowerCase().includes(q) ||
        ret.items.some(i => i.productName.toLowerCase().includes(q))
      );
    });
  }, [returns, searchTerm, sales]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
         <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('returns')}</h1>
            <p className="text-sm text-slate-500">{t('return_history')}</p>
         </div>
         {/* Search bar */}
         <div className="relative">
           <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
           <input
             type="text"
             value={searchTerm}
             onChange={e => setSearchTerm(e.target.value)}
             placeholder={t('search')}
             className="pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-56 bg-white"
           />
           {searchTerm && (
             <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
               <X className="w-4 h-4" />
             </button>
           )}
         </div>
      </div>

      {deleteError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-rose-600 mr-2 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-rose-900">{t('error')}</h4>
              <p className="text-sm text-rose-700 mt-1">{deleteError}</p>
            </div>
            <button
              onClick={() => setDeleteError(null)}
              className="text-rose-600 hover:text-rose-700 font-semibold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {returns.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
            {t('no_operations_recorded')}
          </div>
        ) : filteredReturns.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
            {t('global_search_no_results')}
          </div>
        ) : (
          filteredReturns.map(ret => {
            const warehouse = warehouses.find(w => w.id === ret.warehouseId);
            const originalSale = sales.find(s => s.id === ret.originalSaleId);
            const saleRef = originalSale?.invoiceNumber || originalSale?.deliveryNoteNumber || `#${ret.originalSaleId.slice(0, 8)}`;
            return (
              <div key={ret.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-start justify-between mb-4 pb-4 border-b border-slate-100">
                  <div className="flex items-start space-x-4 mb-4 md:mb-0 flex-1">
                    <div className="p-3 bg-rose-50 rounded-lg text-rose-600 shrink-0">
                      <Undo2 className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-slate-900">{t('returns')} — {ret.customerName}</h3>
                      <div className="flex flex-wrap items-center text-sm text-slate-500 gap-3 mt-1">
                        <span className="flex items-center"><Calendar className="w-3 h-3 mr-1"/> {new Date(ret.date).toLocaleString()}</span>
                        <span className="flex items-center font-medium text-slate-700">
                          <User className="w-3 h-3 mr-1" /> {ret.customerName}
                        </span>
                        <span className="flex items-center font-mono text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                           <FileText className="w-3 h-3 mr-1" />{t('original_sale')}: {saleRef}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                    <div className="text-left md:text-right flex-1">
                      <p className="text-sm font-bold text-slate-800">{t('return_reason')}: {ret.reason}</p>
                      <p className="text-xs text-slate-500 mt-1">{t('stock_returned_to')}: {warehouse?.name}</p>
                    </div>
                    {showDeleteConfirm === ret.id ? (
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => setShowDeleteConfirm(null)}
                          disabled={deletingReturnId === ret.id}
                          className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium disabled:opacity-50"
                        >
                          {t('cancel')}
                        </button>
                        <button
                          onClick={() => handleDeleteReturn(ret.id)}
                          disabled={deletingReturnId === ret.id}
                          className="px-3 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                        >
                          {deletingReturnId === ret.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {t('info_deleting')}
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4" />
                              {t('delete')}
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowDeleteConfirm(ret.id)}
                        className="px-3 py-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 text-sm font-medium flex items-center gap-2 flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                        {t('delete')}
                      </button>
                    )}
                  </div>
                </div>

                {showDeleteConfirm === ret.id && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      ⚠️ {t('delete_return_warning')}
                    </p>
                  </div>
                )}

                <div className="bg-slate-50 rounded-lg p-3">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('items_to_return')}</h4>
                  <ul className="space-y-2">
                    {ret.items.map((item, idx) => (
                      <li key={idx} className="flex justify-between text-sm border-b border-slate-200 last:border-0 pb-1 last:pb-0">
                        <span className="text-slate-700 flex items-center">
                            <Package className="w-3 h-3 mr-2 text-slate-400" />
                            <span className="font-bold mr-2">{item.quantity}x</span> {item.productName}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Returns;