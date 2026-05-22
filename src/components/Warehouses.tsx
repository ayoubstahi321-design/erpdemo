
import React, { useState } from 'react';
import { Warehouse, Product } from '../types';
import { Search, Plus, MapPin, Building, Pencil, Trash2, X, AlertCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { useWarehouses, useProducts } from '../hooks/useSupabaseData';

// Fallback props for when Supabase is disabled
interface WarehousesProps {
  warehouses?: Warehouse[];
  products?: Product[];
  onAddWarehouse?: (warehouse: Warehouse) => void;
  onUpdateWarehouse?: (warehouse: Warehouse) => void;
  onDeleteWarehouse?: (id: string) => void;
}

const Warehouses: React.FC<WarehousesProps> = (props) => {
  const { t } = useLanguage();

  // ALWAYS call hooks (React rules - hooks must be called unconditionally)
  const supabaseWarehouses = useWarehouses();
  const supabaseProducts = useProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Warehouse>>({
    name: '',
    location: '',
    type: 'Branch'
  });

  // Use Supabase hook data directly
  const warehouses = supabaseWarehouses.warehouses;
  const loading = supabaseWarehouses.loading;
  const error = supabaseWarehouses.error;

  // Products - USE SUPABASE HOOK DIRECTLY for real-time stock calculation
  // This ensures all warehouses (including new ones) show correct stock
  const products = supabaseProducts.products;

  const filteredWarehouses = warehouses.filter(w => 
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData({
        name: '',
        location: '',
        type: 'Branch'
    });
    setShowModal(true);
  };

  const handleOpenEdit = (warehouse: Warehouse) => {
      setIsEditing(true);
      setFormData({...warehouse});
      setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.location) {
        alert(t('required_fields'));
        return;
    }

    const warehouseData = {
        ...formData,
        id: formData.id || crypto.randomUUID(),
        name: formData.name!,
        location: formData.location!,
        type: formData.type || 'Branch'
    } as Warehouse;

    try {
      if (isEditing) {
        if (supabaseWarehouses) {
          await supabaseWarehouses.updateWarehouse(warehouseData.id, warehouseData);
        } else if (props.onUpdateWarehouse) {
          props.onUpdateWarehouse(warehouseData);
        }
      } else {
        if (supabaseWarehouses) {
          await supabaseWarehouses.addWarehouse(warehouseData);
        } else if (props.onAddWarehouse) {
          props.onAddWarehouse(warehouseData);
        }
      }
      setShowModal(false);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleDelete = async (id: string) => {
      // Security check: Does this warehouse have stock?
      const hasStock = products.some(p => (p.stockLevels[id] || 0) > 0);

      if (hasStock) {
          alert(t('cant_delete_stock'));
          return;
      }

      if (confirm(t('confirm_delete_user'))) { // Reusing confirmation message generic or specific
        try {
          if (supabaseWarehouses) {
            await supabaseWarehouses.deleteWarehouse(id);
          } else if (props.onDeleteWarehouse) {
            props.onDeleteWarehouse(id);
          }
        } catch (error: any) {
          alert(`Error: ${error.message}`);
        }
      }
  };

  const getTypeColor = (type: string) => {
      switch(type) {
          case 'Central': return 'bg-indigo-100 text-indigo-700';
          case 'Transit': return 'bg-amber-100 text-amber-700';
          default: return 'bg-blue-100 text-blue-700';
      }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-slate-600">Loading warehouses...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-rose-600 mr-3 mt-0.5" />
          <div>
            <h3 className="font-semibold text-rose-900 mb-1">Error loading warehouses</h3>
            <p className="text-sm text-rose-700">{error.message}</p>
            {supabaseWarehouses && (
              <button
                onClick={() => supabaseWarehouses.refresh()}
                className="mt-3 px-3 py-1 bg-rose-600 text-white rounded text-sm hover:bg-rose-700"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('manage_warehouses')}</h1>
            <p className="text-sm text-slate-500">{t('manage_warehouses')}</p>
         </div>
         <button 
            onClick={handleOpenAdd}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm font-medium"
         >
             <Plus className="w-4 h-4 mr-2" />
             {t('add_warehouse')}
         </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
                type="text"
                placeholder={t('search_placeholder')}
                className="pl-10 pr-4 py-2 w-full md:w-96 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWarehouses.map(warehouse => {
             // Calculate total stock in this warehouse
             const totalStock = products.reduce((acc, p) => acc + (p.stockLevels[warehouse.id] || 0), 0);
             const productsCount = products.filter(p => (p.stockLevels[warehouse.id] || 0) > 0).length;

             return (
              <div key={warehouse.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow relative group">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-start bg-slate-50">
                      <div className="flex items-center">
                          <div className="bg-white p-2 rounded-lg border border-slate-200 mr-3">
                              <Building className="w-5 h-5 text-slate-500" />
                          </div>
                          <div>
                              <h3 className="font-bold text-slate-900">{warehouse.name}</h3>
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase mt-1 ${getTypeColor(warehouse.type)}`}>
                                  {warehouse.type}
                              </span>
                          </div>
                      </div>
                  </div>
                  <div className="p-4 space-y-3">
                      <div className="flex items-start text-sm text-slate-600">
                          <MapPin className="w-4 h-4 mr-2 text-slate-400 mt-0.5" />
                          {warehouse.location}
                      </div>
                      
                      <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-4">
                          <div className="text-center p-2 bg-slate-50 rounded-lg">
                              <span className="block text-xs text-slate-500 font-bold uppercase">{t('stock')}</span>
                              <span className="block text-lg font-bold text-blue-600">{totalStock}</span>
                          </div>
                          <div className="text-center p-2 bg-slate-50 rounded-lg">
                              <span className="block text-xs text-slate-500 font-bold uppercase">Refs</span>
                              <span className="block text-lg font-bold text-slate-700">{productsCount}</span>
                          </div>
                      </div>
                  </div>
                  
                  {/* Actions Footer */}
                  <div className="bg-slate-50 p-2 border-t border-slate-100 flex justify-end space-x-2">
                      <button 
                        onClick={() => handleOpenEdit(warehouse)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title={t('edit')}
                      >
                          <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(warehouse.id)}
                        className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                        title={t('remove')}
                      >
                          <Trash2 className="w-4 h-4" />
                      </button>
                  </div>
              </div>
          )})}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900 bg-opacity-60 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                  <div className="flex justify-between items-center p-4 border-b border-slate-200">
                      <h3 className="text-lg font-bold text-slate-900">{isEditing ? t('edit_warehouse') : t('add_warehouse')}</h3>
                      <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="p-6 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('warehouse')} {t('name')}</label>
                          <input 
                              required
                              type="text" 
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              value={formData.name || ''}
                              onChange={(e) => setFormData({...formData, name: e.target.value})}
                          />
                      </div>
                      
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('location')}</label>
                          <input 
                              required
                              type="text" 
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              value={formData.location || ''}
                              onChange={(e) => setFormData({...formData, location: e.target.value})}
                          />
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('warehouse_type')}</label>
                          <select 
                             className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                             value={formData.type}
                             onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                          >
                              <option value="Central">Central (Hub)</option>
                              <option value="Branch">Branch (Agence)</option>
                              <option value="Transit">Transit (Logistics)</option>
                          </select>
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
                              {t('save')}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default Warehouses;
