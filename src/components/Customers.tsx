
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Customer, Sale, Product, User as UserType } from '../types';
import { Search, Plus, User, Briefcase, MapPin, Phone, Mail, Building2, X, Pencil, Trash2, Loader2, AlertCircle, Navigation, Map, AlertTriangle, Filter, UserCheck } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { usePaginatedCustomers } from '../hooks/usePaginatedCustomers';
import { useCustomersMutations } from '../hooks/useCustomersMutations';
import { useDebounce } from '../hooks/useDebounce';
import { usePersistedString } from '../hooks/usePersistedState';
import { Pagination } from './Pagination';
import CustomerDetail from './CustomerDetail';
import ConfirmDialog from './ConfirmDialog';
import { useStore } from '../store/useStore';
import { supabase } from '../services/supabaseClient';
import type { ResolvedLocation } from './MapPicker';
const MapPicker = lazy(() => import('./MapPicker'));
const CustomerMapView = lazy(() => import('./CustomerMapView'));

// Fallback props for when Supabase is disabled
interface CustomersProps {
  customers?: Customer[];
  sales?: Sale[];
  products?: Product[];
  currentUser?: import('../types').User | null;
  onAddCustomer?: (customer: Customer) => void;
  onUpdateCustomer?: (customer: Customer) => void;
  onDeleteCustomer?: (id: string) => void;
}

const Customers: React.FC<CustomersProps> = (props) => {
  const { t } = useLanguage();

  // ALWAYS call hooks (React rules - hooks must be called unconditionally)
  const customersMutations = useCustomersMutations(); // lightweight: no data fetch
  const { activeCompanyId, companyProfiles } = useStore();
  // Persisted filter
  const [searchTerm, setSearchTerm] = usePersistedString('customers_search', '');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [cityFilter, setCityFilter] = usePersistedString('customers_city_filter', '');
  const [showCustomerMap, setShowCustomerMap] = useState(false);
  const [formData, setFormData] = useState<Partial<Customer>>({
    type: 'Professional',
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    ice: '',
    taxId: '',
    creditLimit: 0,
    notes: ''
  });

  // Sales rep list — id → name (Admin/Manager only, filtered to Sales role)
  const [salesReps, setSalesReps] = useState<Record<string, string>>({});
  const [salesRepList, setSalesRepList] = useState<{id: string, name: string}[]>([]);
  useEffect(() => {
    const role = props.currentUser?.role;
    if (role !== 'Admin' && role !== 'Manager') return;
    supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        const salesOnly: {id: string, name: string}[] = [];
        data.forEach((p: any) => {
          const name = p.full_name || p.email || p.id;
          map[p.id] = name;
          if (p.role === 'Sales') salesOnly.push({ id: p.id, name });
        });
        setSalesReps(map);
        setSalesRepList(salesOnly);
      });
  }, [props.currentUser?.role]);

  const isSalesRole = props.currentUser?.role === 'Sales';

  // Server-side paginated customers for the listing
  const debouncedCity = useDebounce(cityFilter, 300);
  const { customers: paginatedCustomers, totalCount, loading, error, refresh: refreshCustomers } = usePaginatedCustomers({
    page,
    pageSize: 24,
    search: debouncedSearch,
    cityFilter: debouncedCity,
    assignedToFilter: isSalesRole ? (props.currentUser?.id ?? null) : null,
  });

  // Reset page when search or city filter changes
  useEffect(() => { setPage(1); }, [debouncedSearch, debouncedCity]);

  // Server-side pagination values
  const pageSize = 24;
  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + paginatedCustomers.length, totalCount);

  // Loading state — only block render on initial empty load, not on background refreshes
  if (loading && paginatedCustomers.length === 0) {
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
        {refreshCustomers && (
          <button
            onClick={() => refreshCustomers()}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
          >
            {t('retry')}
          </button>
        )}
      </div>
    );
  }

  // Show customer detail view
  if (selectedCustomer) {
    return (
      <CustomerDetail
        customer={selectedCustomer}
        sales={props.sales || []}
        products={props.products}
        onBack={() => setSelectedCustomer(null)}
      />
    );
  }

  const handleOpenAdd = () => {
    setIsEditing(false);
    const isSales = props.currentUser?.role === 'Sales';
    setFormData({
        type: 'Professional',
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        ice: '',
        taxId: '',
        creditLimit: 0,
        notes: '',
        assignedTo: isSales ? (props.currentUser?.id ?? null) : null,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (customer: Customer) => {
      setIsEditing(true);
      setFormData({...customer});
      setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
        alert(t('required_fields'));
        return;
    }

    const isSalesRole = props.currentUser?.role === 'Sales';
    const customerData = {
        ...formData,
        id: formData.id || crypto.randomUUID(),
        name: formData.name!,
        phone: formData.phone!,
        companyId: isEditing ? formData.companyId : (activeCompanyId || null),
        // Sales rep always owns their customers; preserve assignedTo on edit
        assignedTo: !isEditing && isSalesRole
          ? (props.currentUser?.id ?? null)
          : (formData.assignedTo ?? null),
    } as Customer;

    try {
      if (isEditing) {
        await customersMutations.updateCustomer(customerData.id, customerData);
      } else {
        await customersMutations.addCustomer(customerData);
      }
      await refreshCustomers();
      setShowModal(false);
    } catch (error: any) {
      alert(`${t('error')}: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('customers')}</h1>
            <p className="text-sm text-slate-500">{t('manage_customers_desc')}</p>
         </div>
         <button 
            onClick={handleOpenAdd}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm font-medium"
         >
             <Plus className="w-4 h-4 mr-2" />
             {t('add_customer')}
         </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
                type="text"
                placeholder={t('search_customers')}
                className="pl-10 pr-4 py-2 w-full border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Filter className="h-4 w-4 text-slate-400" />
            </div>
            <input
                type="text"
                placeholder="Filtrer par ville..."
                className={`pl-9 pr-4 py-2 w-44 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${cityFilter ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
            />
            {cityFilter && (
              <button onClick={() => setCityFilter('')} className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowCustomerMap(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50"
          >
            <Map className="w-4 h-4" />
            Mapa
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedCustomers.map(customer => (
              <div key={customer.id} onClick={() => setSelectedCustomer(customer)} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow relative group cursor-pointer">
                  <div className={`p-4 border-b border-slate-100 flex justify-between items-start ${customer.type === 'Professional' ? 'bg-indigo-50' : 'bg-blue-50'}`}>
                      <div>
                          <h3 className="font-bold text-slate-900">{customer.name}</h3>
                          {customer.contactPerson && (
                              <p className="text-xs text-slate-500 mt-1">{t('contact_person')}: {customer.contactPerson}</p>
                          )}
                      </div>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide flex items-center ${customer.type === 'Professional' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                          {customer.type === 'Professional' ? <Briefcase className="w-3 h-3 mr-1" /> : <User className="w-3 h-3 mr-1" />}
                          {t(customer.type === 'Professional' ? 'professional' : 'individual')}
                      </span>
                  </div>
                  <div className="p-4 space-y-2 text-sm">
                      <div className="flex items-center text-slate-600">
                          <Phone className="w-4 h-4 mr-2 text-slate-400" />
                          {customer.phone}
                      </div>
                      <div className="flex items-center text-slate-600">
                          <Mail className="w-4 h-4 mr-2 text-slate-400" />
                          {customer.email || 'N/A'}
                      </div>
                      <div className="flex items-start text-slate-600 gap-2">
                          <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                          <span className="flex-1 text-sm">{[customer.address, customer.city].filter(Boolean).join(', ') || 'N/A'}</span>
                          {customer.latitude != null && customer.longitude != null && (
                            <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                              <a
                                href={`https://www.google.com/maps?q=${customer.latitude},${customer.longitude}`}
                                target="_blank" rel="noopener noreferrer"
                                className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                                title="Abrir en Google Maps"
                              >Maps</a>
                              <a
                                href={`https://waze.com/ul?ll=${customer.latitude},${customer.longitude}&navigate=yes`}
                                target="_blank" rel="noopener noreferrer"
                                className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-cyan-100 text-cyan-700 hover:bg-cyan-200"
                                title="Abrir en Waze"
                              >Waze</a>
                            </div>
                          )}
                      </div>
                      
                      {customer.type === 'Professional' && (
                        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                            <div>
                                <span className="block text-slate-400 font-semibold">ICE</span>
                                <span className="font-mono text-slate-700">{customer.ice || 'N/A'}</span>
                            </div>
                            <div>
                                <span className="block text-slate-400 font-semibold">Tax ID</span>
                                <span className="font-mono text-slate-700">{customer.taxId || 'N/A'}</span>
                            </div>
                        </div>
                      )}

                      {/* Credit Limit + Unpaid Debt Badge */}
                      {(() => {
                        const sales = props.sales || [];
                        const unpaid = sales
                          .filter(s => s.customerId === customer.id && s.status !== 'Cancelled' && s.returnStatus !== 'full' && s.documentType !== 'QUOTE')
                          .reduce((sum, s) => {
                            const paid = (s.payments || []).reduce((p, pay) => p + pay.amount, 0);
                            const rem = s.totalAmount - paid - (s.creditedAmount || 0);
                            return sum + (rem > 0 ? rem : 0);
                          }, 0);
                        const hasLimit = customer.creditLimit && customer.creditLimit > 0;
                        const isOverLimit = hasLimit && unpaid > (customer.creditLimit || 0);
                        return (
                          <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                            {unpaid > 0 && (
                              <span className={`flex items-center gap-1 px-2 py-1 rounded-full font-bold ${isOverLimit ? 'bg-red-100 text-red-700' : 'bg-orange-50 text-orange-700'}`}>
                                {isOverLimit && <AlertTriangle className="w-3 h-3" />}
                                Solde : {unpaid.toFixed(0)} MAD
                              </span>
                            )}
                            {hasLimit && (
                              <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-full font-medium">
                                Limite : {customer.creditLimit!.toLocaleString()} MAD
                              </span>
                            )}
                          </div>
                        );
                      })()}

                      {/* Notes */}
                      {customer.notes && (
                        <div className="mt-2 text-xs text-slate-500 italic line-clamp-2">
                            {customer.notes}
                        </div>
                      )}

                      {/* Company Indicator */}
                      {!activeCompanyId && customer.companyId && (
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
                            <Building2 className="w-3 h-3 mr-1" />
                            {companyProfiles.find(c => c.id === customer.companyId)?.profileName || 'Empresa'}
                          </span>
                        </div>
                      )}

                      {/* Sales rep badge — visible to Admin/Manager */}
                      {(props.currentUser?.role === 'Admin' || props.currentUser?.role === 'Manager') && customer.assignedTo && (
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                            <UserCheck className="w-3 h-3 mr-1" />
                            {salesReps[customer.assignedTo] || 'Comercial'}
                          </span>
                        </div>
                      )}
                  </div>

                  {/* Actions Footer */}
                  <div className="bg-slate-50 p-2 border-t border-slate-100 flex justify-end space-x-2" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenEdit(customer)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title={t('edit')}
                      >
                          <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCustomerToDelete(customer)}
                        className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                        title={t('remove')}
                      >
                          <Trash2 className="w-4 h-4" />
                      </button>
                  </div>
              </div>
          ))}
      </div>

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalCount} />

      {/* Add/Edit Customer Modal */}
      {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900 bg-opacity-60 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center p-4 border-b border-slate-200">
                      <h3 className="text-lg font-bold text-slate-900">{isEditing ? t('edit_customer') : t('add_customer')}</h3>
                      <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="p-4 space-y-4">
                      {/* Type Selection */}
                      <div className="flex space-x-2 mb-4">
                        <button 
                            type="button"
                            onClick={() => setFormData({...formData, type: 'Professional'})}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg border flex items-center justify-center transition-all ${formData.type === 'Professional' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`}
                        >
                            <Building2 className="w-4 h-4 mr-2" /> {t('professional')}
                        </button>
                        <button 
                            type="button"
                            onClick={() => setFormData({...formData, type: 'Individual'})}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg border flex items-center justify-center transition-all ${formData.type === 'Individual' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'}`}
                        >
                            <User className="w-4 h-4 mr-2" /> {t('individual')}
                        </button>
                      </div>

                      <div className="space-y-3">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                  {formData.type === 'Professional' ? t('company_name') : t('full_name')}
                              </label>
                              <input 
                                required
                                type="text" 
                                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={formData.name || ''}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                              />
                          </div>

                          {formData.type === 'Professional' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('contact_person')}</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    value={formData.contactPerson || ''}
                                    onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                                />
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('phone')}</label>
                                  <input 
                                    required
                                    type="tel" 
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    value={formData.phone || ''}
                                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('email')}</label>
                                  <input 
                                    type="email" 
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    value={formData.email || ''}
                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                  />
                              </div>
                          </div>

                          <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('address')}</label>
                                <input
                                    type="text"
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    value={formData.address || ''}
                                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                                />
                          </div>

                          <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('city')}</label>
                                <input
                                    type="text"
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    value={formData.city || ''}
                                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                                />
                          </div>

                          {/* GPS Location */}
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ubicación GPS</label>
                            <button
                              type="button"
                              onClick={() => setShowMapPicker(true)}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                                formData.latitude != null
                                  ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                                  : 'border-slate-300 text-slate-500 hover:bg-slate-50'
                              }`}
                            >
                              <MapPin className="w-4 h-4 shrink-0" />
                              {formData.latitude != null
                                ? `${formData.latitude.toFixed(5)}, ${formData.longitude?.toFixed(5)} — clic para cambiar`
                                : 'Fijar ubicación en el mapa'}
                            </button>
                          </div>

                          {formData.type === 'Professional' && (
                             <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ICE</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                        placeholder="0000000000000"
                                        value={formData.ice || ''}
                                        onChange={(e) => setFormData({...formData, ice: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tax ID</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                        value={formData.taxId || ''}
                                        onChange={(e) => setFormData({...formData, taxId: e.target.value})}
                                    />
                                </div>
                             </div>
                          )}

                          {/* Asignación a comercial — solo Admin/Manager */}
                          {(props.currentUser?.role === 'Admin' || props.currentUser?.role === 'Manager') && (
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Comercial asignado</label>
                              <select
                                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                value={formData.assignedTo || ''}
                                onChange={(e) => setFormData({...formData, assignedTo: e.target.value || null})}
                              >
                                <option value="">Sin asignar (Admin/Manager)</option>
                                {salesRepList.map(rep => (
                                  <option key={rep.id} value={rep.id}>{rep.name}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Credit Limit */}
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                  {t('credit_limit') || 'Limite de crédit'} (MAD)
                              </label>
                              <input
                                  type="number"
                                  min="0"
                                  step="100"
                                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                  value={formData.creditLimit || 0}
                                  onChange={(e) => setFormData({...formData, creditLimit: parseFloat(e.target.value) || 0})}
                                  placeholder="0 = sans limite"
                              />
                              <p className="text-xs text-slate-400 mt-1">0 = {t('no_limit') || 'sans limite'}</p>
                          </div>

                          {/* Notes */}
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                  {t('notes') || 'Notes internes'}
                              </label>
                              <textarea
                                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                                  rows={2}
                                  value={formData.notes || ''}
                                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                                  placeholder={t('customer_notes_placeholder') || 'Notes sur ce client...'}
                              />
                          </div>
                      </div>

                      <div className="pt-4 flex space-x-3">
                          <button 
                             type="button" 
                             onClick={() => setShowModal(false)}
                             className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-50"
                          >
                              {t('cancel')}
                          </button>
                          <button 
                             type="submit" 
                             className="flex-1 py-2 bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-700 shadow-md"
                          >
                              {isEditing ? t('edit_customer') : t('save')}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      <ConfirmDialog
        isOpen={!!customerToDelete}
        title={t('confirm_delete')}
        message={customerToDelete?.name || ''}
        confirmLabel={t('remove')}
        cancelLabel={t('cancel')}
        onConfirm={async () => {
          if (!customerToDelete) return;
          try {
            await customersMutations.deleteCustomer(customerToDelete.id);
            await refreshCustomers();
          } catch (error: any) {
            alert(`${t('error')}: ${error.message}`);
          } finally {
            setCustomerToDelete(null);
          }
        }}
        onCancel={() => setCustomerToDelete(null)}
      />

      {/* Map Picker (edit form) */}
      {showMapPicker && (
        <Suspense fallback={null}>
          <MapPicker
            latitude={formData.latitude}
            longitude={formData.longitude}
            customerName={formData.name || ''}
            onConfirm={(loc: ResolvedLocation) => {
              setFormData(prev => ({
                ...prev,
                latitude: loc.lat,
                longitude: loc.lng,
                address: loc.address || prev.address || '',
                city: loc.city || prev.city || '',
              }));
            }}
            onClear={() => setFormData(prev => ({ ...prev, latitude: null, longitude: null }))}
            onClose={() => setShowMapPicker(false)}
          />
        </Suspense>
      )}

      {/* Customer Map — all customers with GPS */}
      {showCustomerMap && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-3">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Map className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-bold text-slate-800 text-sm">Mapa de clientes</p>
                  <p className="text-xs text-slate-500">
                    {paginatedCustomers.filter(c => c.latitude != null).length} clientes con ubicación GPS
                  </p>
                </div>
              </div>
              <button onClick={() => setShowCustomerMap(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>}>
              <CustomerMapView customers={paginatedCustomers} onClose={() => setShowCustomerMap(false)} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
