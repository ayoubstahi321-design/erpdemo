import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Package, Users, ShoppingCart, X } from 'lucide-react';
import { Product, Customer, Sale } from '../types';
import { fuzzySearch } from '../utils/helpers';
import { useLanguage } from '../services/i18n';
import { CURRENCY } from '../constants';

interface SearchResult {
  id: string;
  type: 'product' | 'customer' | 'sale';
  title: string;
  subtitle: string;
  tab: string;
}

interface GlobalSearchProps {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  onNavigate: (tab: string) => void;
  onClose: () => void;
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({ products, customers, sales, onNavigate, onClose }) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const getResults = useCallback((): SearchResult[] => {
    if (query.length < 2) return [];

    const results: SearchResult[] = [];

    // Search products
    const matchedProducts = products.filter(p =>
      fuzzySearch(p.name, query) || fuzzySearch(p.sku, query) || (p.barcode && fuzzySearch(p.barcode, query))
    ).slice(0, 5);

    matchedProducts.forEach(p => {
      results.push({
        id: p.id,
        type: 'product',
        title: p.name,
        subtitle: `SKU: ${p.sku} · ${p.price.toFixed(2)} ${CURRENCY}`,
        tab: 'inventory',
      });
    });

    // Search customers
    const matchedCustomers = customers.filter(c =>
      fuzzySearch(c.name, query) || (c.phone && fuzzySearch(c.phone, query)) || (c.email && fuzzySearch(c.email, query))
    ).slice(0, 5);

    matchedCustomers.forEach(c => {
      results.push({
        id: c.id,
        type: 'customer',
        title: c.name,
        subtitle: `${c.type === 'Professional' ? '🏢' : '👤'} ${c.phone || c.email || ''}`,
        tab: 'customers',
      });
    });

    // Search sales
    const matchedSales = sales.filter(s =>
      (s.invoiceNumber && fuzzySearch(s.invoiceNumber, query)) ||
      fuzzySearch(s.customerName, query) ||
      (s.deliveryNoteNumber && fuzzySearch(s.deliveryNoteNumber, query))
    ).slice(0, 5);

    matchedSales.forEach(s => {
      results.push({
        id: s.id,
        type: 'sale',
        title: s.invoiceNumber || s.deliveryNoteNumber || `#${s.id.slice(0, 8)}`,
        subtitle: `${s.customerName} · ${s.totalAmount.toFixed(2)} ${CURRENCY} · ${s.paymentStatus}`,
        tab: 'sales',
      });
    });

    return results;
  }, [query, products, customers, sales]);

  const results = getResults();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      onNavigate(results[selectedIndex].tab);
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    const container = resultsRef.current;
    if (!container) return;
    const selected = container.querySelector(`[data-index="${selectedIndex}"]`);
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'product': return <Package className="w-4 h-4 text-blue-500" />;
      case 'customer': return <Users className="w-4 h-4 text-emerald-500" />;
      case 'sale': return <ShoppingCart className="w-4 h-4 text-violet-500" />;
      default: return null;
    }
  };

  const getCategoryLabel = (type: string) => {
    switch (type) {
      case 'product': return t('inventory');
      case 'customer': return t('customers');
      case 'sale': return t('sales');
      default: return '';
    }
  };

  // Group results by type
  const grouped: Record<string, SearchResult[]> = {};
  results.forEach(r => {
    if (!grouped[r.type]) grouped[r.type] = [];
    grouped[r.type].push(r);
  });

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center px-4 border-b border-slate-200">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('global_search_placeholder')}
            className="flex-1 px-3 py-4 text-sm outline-none bg-transparent text-slate-900 placeholder-slate-400"
          />
          <div className="flex items-center gap-2">
            <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs font-mono text-slate-400 bg-slate-100 rounded border border-slate-200">ESC</kbd>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-80 overflow-y-auto">
          {query.length < 2 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>{t('global_search_hint')}</p>
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              <p>{t('global_search_no_results')}</p>
            </div>
          ) : (
            Object.entries(grouped).map(([type, items]) => (
              <div key={type}>
                <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 sticky top-0">
                  {getCategoryLabel(type)}
                </div>
                {items.map(item => {
                  const idx = flatIndex++;
                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        idx === selectedIndex ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                      onClick={() => {
                        onNavigate(item.tab);
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <div className="shrink-0">{getIcon(item.type)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-slate-500 truncate">{item.subtitle}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-400 flex justify-between">
            <span>{results.length} {t('results')}</span>
            <span>↑↓ {t('navigate')} · Enter {t('select')}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalSearch;
