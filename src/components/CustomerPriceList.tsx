import React, { useState } from 'react';
import { Product, CustomerPrice } from '../types';
import { Plus, Trash2, X, Search, Tag, Percent } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { useCustomerPrices } from '../hooks/useSupabaseData';
import { CURRENCY } from '../constants';

interface CustomerPriceListProps {
  customerId: string;
  products: Product[];
}

const CustomerPriceList: React.FC<CustomerPriceListProps> = ({ customerId, products }) => {
  const { t } = useLanguage();
  const { prices, loading, addPrice, deletePrice } = useCustomerPrices(customerId);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [priceType, setPriceType] = useState<'fixed' | 'discount'>('fixed');
  const [value, setValue] = useState('');

  const productMap = new Map(products.map(p => [p.id, p]));

  // Products that don't already have a special price
  const availableProducts = products.filter(
    p => !prices.some(cp => cp.productId === p.id) &&
    (search === '' || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  const handleAdd = async () => {
    if (!selectedProductId || !value) return;
    try {
      await addPrice({
        customerId,
        productId: selectedProductId,
        specialPrice: priceType === 'fixed' ? parseFloat(value) : undefined,
        discountPercentage: priceType === 'discount' ? parseFloat(value) : undefined,
      });
      setShowAdd(false);
      setSelectedProductId('');
      setValue('');
      setSearch('');
    } catch (err: any) {
      alert(`${t('error')}: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('confirm_delete'))) return;
    try {
      await deletePrice(id);
    } catch (err: any) {
      alert(`${t('error')}: ${err.message}`);
    }
  };

  const getEffectivePrice = (cp: CustomerPrice) => {
    const product = productMap.get(cp.productId);
    if (!product) return 0;
    if (cp.specialPrice != null) return cp.specialPrice;
    if (cp.discountPercentage != null) return product.price * (1 - cp.discountPercentage / 100);
    return product.price;
  };

  if (loading) {
    return <div className="p-4 text-center text-slate-400 text-sm">{t('loading')}...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900 text-sm">{t('special_prices')}</h3>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium"
        >
          <Plus className="w-3 h-3 mr-1" />
          {t('add')}
        </button>
      </div>

      {prices.length === 0 && !showAdd ? (
        <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-lg">
          <Tag className="w-6 h-6 mx-auto mb-2 opacity-50" />
          <p className="text-xs">{t('no_special_prices')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {prices.map(cp => {
            const product = productMap.get(cp.productId);
            if (!product) return null;
            const effective = getEffectivePrice(cp);
            return (
              <div key={cp.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-900 truncate">{product.name}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span className="line-through">{product.price.toFixed(2)} {CURRENCY}</span>
                    <span className="font-bold text-emerald-600">{effective.toFixed(2)} {CURRENCY}</span>
                    {cp.discountPercentage != null && (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold">-{cp.discountPercentage}%</span>
                    )}
                  </div>
                </div>
                <button onClick={() => handleDelete(cp.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition-colors ml-2">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Price Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900 bg-opacity-60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-900">{t('add_special_price')}</h3>
              <button onClick={() => { setShowAdd(false); setSearch(''); setSelectedProductId(''); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Product Search */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('product')}</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={t('search_placeholder')}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                {search && availableProducts.length > 0 && !selectedProductId && (
                  <div className="mt-1 border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
                    {availableProducts.slice(0, 10).map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedProductId(p.id); setSearch(p.name); }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm flex justify-between"
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className="text-slate-400">{p.price.toFixed(2)} {CURRENCY}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Price Type */}
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setPriceType('fixed')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border flex items-center justify-center ${priceType === 'fixed' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'}`}
                >
                  <Tag className="w-4 h-4 mr-1" /> {t('fixed_price')}
                </button>
                <button
                  type="button"
                  onClick={() => setPriceType('discount')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border flex items-center justify-center ${priceType === 'discount' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'}`}
                >
                  <Percent className="w-4 h-4 mr-1" /> {t('discount')} %
                </button>
              </div>

              {/* Value Input */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  {priceType === 'fixed' ? `${t('price')} (${CURRENCY})` : `${t('discount')} (%)`}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  placeholder={priceType === 'fixed' ? '0.00' : '10'}
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => { setShowAdd(false); setSearch(''); setSelectedProductId(''); }}
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-50"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!selectedProductId || !value}
                  className="flex-1 py-2 bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerPriceList;
