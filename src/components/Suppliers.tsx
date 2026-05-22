import React, { useState } from 'react';
import { Supplier } from '../types';
import { Search, Plus, Phone, Mail, MapPin, X, Pencil, Trash2, Truck, Loader2, AlertCircle } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { useSuppliers } from '../hooks/useSupabaseData';
import { usePagination } from '../hooks/usePagination';
import { Pagination } from './Pagination';
import ConfirmDialog from './ConfirmDialog';

const Suppliers: React.FC = () => {
  const { t } = useLanguage();
  const { suppliers, loading, error, addSupplier, updateSupplier, deleteSupplier, refresh } = useSuppliers();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Supplier>>({
    name: '', status: 'Active', phone: '', email: '', address: '', city: '', ice: '', taxId: '', contactPerson: '', notes: ''
  });

  // Compute filtered data and pagination BEFORE early returns (React hooks rules)
  const filtered = (suppliers || []).filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.phone?.includes(searchTerm) ?? false) ||
    (s.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  const { currentPage, totalPages, paginatedData, goToPage, startIndex, endIndex, totalItems } = usePagination({ data: filtered, itemsPerPage: 24 });

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

  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData({ name: '', status: 'Active', phone: '', email: '', address: '', city: '', ice: '', taxId: '', contactPerson: '', notes: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setIsEditing(true);
    setFormData({ ...s });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) { alert(t('required_fields')); return; }
    try {
      if (isEditing && formData.id) {
        await updateSupplier(formData.id, formData);
      } else {
        await addSupplier({ ...formData, name: formData.name!, status: formData.status || 'Active' } as Omit<Supplier, 'id'>);
      }
      setShowModal(false);
    } catch (err: any) {
      alert(`${t('error')}: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    try { await deleteSupplier(id); } catch (err: any) { alert(`${t('error')}: ${err.message}`); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('suppliers')}</h1>
          <p className="text-sm text-slate-500">{t('manage_suppliers_desc')}</p>
        </div>
        <button onClick={handleOpenAdd} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm font-medium">
          <Plus className="w-4 h-4 mr-2" /> {t('add_supplier')}
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t('search_placeholder')}
            className="pl-10 pr-4 py-2 w-full md:w-96 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedData.map(supplier => (
          <div key={supplier.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-4 border-b border-slate-100 bg-violet-50 flex justify-between items-start">
              <div>
                <h3 className="font-bold text-slate-900">{supplier.name}</h3>
                {supplier.contactPerson && <p className="text-xs text-slate-500 mt-1">{supplier.contactPerson}</p>}
              </div>
              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${supplier.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {supplier.status}
              </span>
            </div>
            <div className="p-4 space-y-2 text-sm">
              <div className="flex items-center text-slate-600"><Phone className="w-4 h-4 mr-2 text-slate-400" />{supplier.phone || 'N/A'}</div>
              <div className="flex items-center text-slate-600"><Mail className="w-4 h-4 mr-2 text-slate-400" />{supplier.email || 'N/A'}</div>
              <div className="flex items-center text-slate-600"><MapPin className="w-4 h-4 mr-2 text-slate-400" />{supplier.address}{supplier.city ? `, ${supplier.city}` : ''}</div>
            </div>
            <div className="bg-slate-50 p-2 border-t border-slate-100 flex justify-end space-x-2">
              <button onClick={() => handleOpenEdit(supplier)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg" title={t('edit')}>
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => setSupplierToDelete(supplier)} className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg" title={t('remove')}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Truck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-500">{t('no_suppliers')}</p>
        </div>
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900 bg-opacity-60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">{isEditing ? t('edit_supplier') : t('add_supplier')}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('company_name')}</label>
                <input required type="text" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('contact_person')}</label>
                <input type="text" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={formData.contactPerson || ''} onChange={e => setFormData({ ...formData, contactPerson: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('phone')}</label>
                  <input type="tel" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('email')}</label>
                  <input type="email" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('address')}</label>
                <input type="text" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={formData.address || ''} onChange={e => setFormData({ ...formData, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('city')}</label>
                  <input type="text" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={formData.city || ''} onChange={e => setFormData({ ...formData, city: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('status')}</label>
                  <select className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                    value={formData.status || 'Active'} onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
                    <option value="Active">{t('active')}</option>
                    <option value="Inactive">{t('inactive')}</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ICE</label>
                  <input type="text" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                    value={formData.ice || ''} onChange={e => setFormData({ ...formData, ice: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tax ID</label>
                  <input type="text" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                    value={formData.taxId || ''} onChange={e => setFormData({ ...formData, taxId: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('notes')}</label>
                <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" rows={2}
                  value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
              </div>
              <div className="pt-4 flex space-x-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-50">{t('cancel')}</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-700 shadow-md">{t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!supplierToDelete}
        title={t('confirm_delete')}
        message={supplierToDelete?.name || ''}
        confirmLabel={t('remove')}
        cancelLabel={t('cancel')}
        onConfirm={() => {
          if (supplierToDelete) handleDelete(supplierToDelete.id);
          setSupplierToDelete(null);
        }}
        onCancel={() => setSupplierToDelete(null)}
      />
    </div>
  );
};

export default Suppliers;
