import React, { useState, useMemo } from 'react';
import { Product, Warehouse, Supplier, PurchaseOrder, PurchaseOrderItem } from '../types';
import { Plus, Search, X, Trash2, Eye, ClipboardList, Calendar, Loader2, AlertCircle, Package } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { useSuppliers, usePurchaseOrders } from '../hooks/useSupabaseData';
import { usePagination } from '../hooks/usePagination';
import { Pagination } from './Pagination';
import { usePersistedString } from '../hooks/usePersistedState';
import { CURRENCY } from '../constants';
import ConfirmDialog from './ConfirmDialog';

interface PurchaseOrdersProps {
  products: Product[];
  warehouses: Warehouse[];
}

const PurchaseOrders: React.FC<PurchaseOrdersProps> = ({ products, warehouses }) => {
  const { t } = useLanguage();
  const { suppliers } = useSuppliers();
  const { orders, loading, error, addOrder, updateOrderStatus, deleteOrder, refresh } = usePurchaseOrders();
  // Persisted filters
  const [searchTerm, setSearchTerm] = usePersistedString('orders_search', '');
  const [statusFilter, setStatusFilter] = usePersistedString('orders_status', 'ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [viewOrder, setViewOrder] = useState<PurchaseOrder | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<PurchaseOrder | null>(null);

  // Create form state
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formWarehouseId, setFormWarehouseId] = useState(warehouses[0]?.id || '');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formExpectedDate, setFormExpectedDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formItems, setFormItems] = useState<PurchaseOrderItem[]>([]);
  const [addProductSearch, setAddProductSearch] = useState('');

  // Compute filtered data and pagination BEFORE early returns (React hooks rules)
  const filtered = (orders || []).filter(o => {
    const matchSearch = o.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const { currentPage, totalPages, paginatedData, goToPage, startIndex, endIndex, totalItems } = usePagination({ data: filtered, itemsPerPage: 25 });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
        <p className="text-slate-600">{t('loading')}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 m-6">
        <div className="flex items-center mb-2">
          <AlertCircle className="w-5 h-5 text-rose-600 mr-2" />
          <h3 className="font-semibold text-rose-900">{t('error')}</h3>
        </div>
        <p className="text-sm text-rose-700 mb-4">{error.message}</p>
        <button onClick={refresh} className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700">{t('retry')}</button>
      </div>
    );
  }

  const statusColor = (s: string) => {
    switch (s) {
      case 'Draft': return 'bg-slate-100 text-slate-700';
      case 'Sent': return 'bg-blue-100 text-blue-700';
      case 'Received': return 'bg-emerald-100 text-emerald-700';
      case 'Cancelled': return 'bg-rose-100 text-rose-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const matchingProducts = addProductSearch
    ? products.filter(p =>
        p.name.toLowerCase().includes(addProductSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(addProductSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  const addItemToForm = (product: Product) => {
    if (formItems.some(i => i.productId === product.id)) return;
    setFormItems([...formItems, {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      unitCost: product.cost || 0,
      total: product.cost || 0,
    }]);
    setAddProductSearch('');
  };

  const updateFormItem = (idx: number, field: 'quantity' | 'unitCost', value: number) => {
    const updated = [...formItems];
    updated[idx] = { ...updated[idx], [field]: value, total: field === 'quantity' ? value * updated[idx].unitCost : updated[idx].quantity * value };
    setFormItems(updated);
  };

  const removeFormItem = (idx: number) => {
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  const formTotal = formItems.reduce((s, i) => s + i.total, 0);

  const handleCreate = async () => {
    if (!formSupplierId || formItems.length === 0) {
      alert(t('required_fields'));
      return;
    }
    const supplier = suppliers.find(s => s.id === formSupplierId);
    const reference = `PO-${Date.now().toString(36).toUpperCase()}`;
    try {
      await addOrder({
        reference,
        supplierId: formSupplierId,
        supplierName: supplier?.name || '',
        warehouseId: formWarehouseId,
        date: formDate,
        expectedDate: formExpectedDate || undefined,
        status: 'Draft',
        items: formItems,
        totalAmount: formTotal,
        notes: formNotes || undefined,
      });
      setShowCreate(false);
      resetForm();
    } catch (err: any) {
      alert(`${t('error')}: ${err.message}`);
    }
  };

  const resetForm = () => {
    setFormSupplierId('');
    setFormWarehouseId(warehouses[0]?.id || '');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormExpectedDate('');
    setFormNotes('');
    setFormItems([]);
    setAddProductSearch('');
  };

  const handleStatusChange = async (id: string, status: PurchaseOrder['status']) => {
    try { await updateOrderStatus(id, status); } catch (err: any) { alert(`${t('error')}: ${err.message}`); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('purchase_orders')}</h1>
          <p className="text-sm text-slate-500">{t('manage_po_desc')}</p>
        </div>
        <button onClick={() => { resetForm(); setShowCreate(true); }} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm font-medium">
          <Plus className="w-4 h-4 mr-2" /> {t('new_po')}
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input type="text" placeholder={t('search_placeholder')} className="pl-10 pr-4 py-2 w-full border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="ALL">{t('all')}</option>
          <option value="Draft">{t('draft')}</option>
          <option value="Sent">{t('sent')}</option>
          <option value="Received">{t('received')}</option>
          <option value="Cancelled">{t('cancelled')}</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left">{t('reference')}</th>
                <th className="px-4 py-3 text-left">{t('supplier')}</th>
                <th className="px-4 py-3 text-left">{t('date')}</th>
                <th className="px-4 py-3 text-right">{t('total')}</th>
                <th className="px-4 py-3 text-center">{t('status')}</th>
                <th className="px-4 py-3 text-center">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.map(order => (
                <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">{order.reference}</td>
                  <td className="px-4 py-3 text-slate-900">{order.supplierName}</td>
                  <td className="px-4 py-3 text-slate-600 flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(order.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right font-medium">{order.totalAmount.toFixed(2)} {CURRENCY}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColor(order.status)}`}>
                      {t(order.status.toLowerCase())}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setViewOrder(order)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Eye className="w-4 h-4" /></button>
                      {order.status === 'Draft' && (
                        <button onClick={() => handleStatusChange(order.id, 'Sent')} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 font-medium">{t('send')}</button>
                      )}
                      {order.status === 'Sent' && (
                        <button onClick={() => handleStatusChange(order.id, 'Received')} className="px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 font-medium">{t('receive')}</button>
                      )}
                      {(order.status === 'Draft') && (
                        <button onClick={() => setOrderToDelete(order)} className="p-1 text-rose-500 hover:bg-rose-50 rounded"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t('no_purchase_orders')}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />

      {/* View Order Detail */}
      {viewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900 bg-opacity-60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900">{viewOrder.reference}</h3>
                <p className="text-xs text-slate-500">{viewOrder.supplierName} · {new Date(viewOrder.date).toLocaleDateString()}</p>
              </div>
              <button onClick={() => setViewOrder(null)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-4">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 uppercase border-b">
                  <tr>
                    <th className="pb-2 text-left">{t('product')}</th>
                    <th className="pb-2 text-right">{t('quantity')}</th>
                    <th className="pb-2 text-right">{t('unit_cost')}</th>
                    <th className="pb-2 text-right">{t('total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewOrder.items.map((item, i) => (
                    <tr key={i}>
                      <td className="py-2 text-slate-900">{item.productName}</td>
                      <td className="py-2 text-right">{item.quantity}</td>
                      <td className="py-2 text-right text-slate-500">{item.unitCost.toFixed(2)}</td>
                      <td className="py-2 text-right font-medium">{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-200 font-bold">
                  <tr>
                    <td colSpan={3} className="py-2 text-right text-slate-500 uppercase text-xs">Total</td>
                    <td className="py-2 text-right">{viewOrder.totalAmount.toFixed(2)} {CURRENCY}</td>
                  </tr>
                </tfoot>
              </table>
              {viewOrder.notes && <p className="mt-4 text-xs text-slate-500 bg-slate-50 p-3 rounded">{viewOrder.notes}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Create PO Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900 bg-opacity-60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">{t('new_po')}</h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('supplier')}</label>
                  <select value={formSupplierId} onChange={e => setFormSupplierId(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">{t('select')}...</option>
                    {suppliers.filter(s => s.status === 'Active').map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('warehouse')}</label>
                  <select value={formWarehouseId} onChange={e => setFormWarehouseId(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('date')}</label>
                  <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('expected_date')}</label>
                  <input type="date" value={formExpectedDate} onChange={e => setFormExpectedDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              {/* Add Products */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('products')}</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder={t('search_placeholder')}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={addProductSearch} onChange={e => setAddProductSearch(e.target.value)} />
                </div>
                {matchingProducts.length > 0 && (
                  <div className="mt-1 border border-slate-200 rounded-lg max-h-32 overflow-y-auto">
                    {matchingProducts.map(p => (
                      <button key={p.id} onClick={() => addItemToForm(p)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm flex justify-between">
                        <span>{p.name}</span>
                        <span className="text-slate-400">{(p.cost || 0).toFixed(2)} {CURRENCY}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Items Table */}
              {formItems.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">{t('product')}</th>
                        <th className="px-3 py-2 text-right w-20">{t('quantity')}</th>
                        <th className="px-3 py-2 text-right w-28">{t('unit_cost')}</th>
                        <th className="px-3 py-2 text-right w-28">{t('total')}</th>
                        <th className="px-3 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formItems.map((item, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-slate-900">{item.productName}</td>
                          <td className="px-3 py-2">
                            <input type="number" min="1" value={item.quantity}
                              onChange={e => updateFormItem(i, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-full text-right border border-slate-200 rounded px-2 py-1 text-sm" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" step="0.01" min="0" value={item.unitCost}
                              onChange={e => updateFormItem(i, 'unitCost', parseFloat(e.target.value) || 0)}
                              className="w-full text-right border border-slate-200 rounded px-2 py-1 text-sm" />
                          </td>
                          <td className="px-3 py-2 text-right font-medium">{item.total.toFixed(2)}</td>
                          <td className="px-3 py-2">
                            <button onClick={() => removeFormItem(i)} className="text-rose-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t">
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-right text-xs text-slate-500 uppercase">Total</td>
                        <td className="px-3 py-2 text-right">{formTotal.toFixed(2)} {CURRENCY}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('notes')}</label>
                <textarea rows={2} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formNotes} onChange={e => setFormNotes(e.target.value)} />
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex space-x-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-50">{t('cancel')}</button>
              <button onClick={handleCreate} disabled={!formSupplierId || formItems.length === 0}
                className="flex-1 py-2 bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md">
                {t('create')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!orderToDelete}
        title={t('confirm_delete')}
        message={orderToDelete?.reference || ''}
        confirmLabel={t('remove')}
        cancelLabel={t('cancel')}
        onConfirm={async () => {
          if (orderToDelete) await deleteOrder(orderToDelete.id);
          setOrderToDelete(null);
        }}
        onCancel={() => setOrderToDelete(null)}
      />
    </div>
  );
};

export default PurchaseOrders;
