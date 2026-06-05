
import React, { useState, useEffect } from 'react';
import { Transfer, Product, Warehouse, TransferType, User } from '../types';
import { ArrowRightLeft, Calendar, Truck, CheckCircle2, ArrowRight, Container, Plus, Minus, AlertTriangle, Package, Trash2, List, Loader2, AlertCircle, Search, X } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { sortProducts, formatStock } from '../utils/helpers';
import { useTransfers, useProducts, useWarehouses, useAppSetting, StockRecalibratePreviewRow } from '../hooks/useSupabaseData';

// Fallback props for when Supabase is disabled
interface TransfersProps {
  transfers?: Transfer[];
  products?: Product[];
  warehouses?: Warehouse[];
  onTransfer?: (transfer: Transfer) => void;
  currentUser?: User;
  // Navigation from notification click
  initialProductId?: string;
  initialSubTab?: TransferType;
  onNavPayloadConsumed?: () => void;
}

const Transfers: React.FC<TransfersProps> = (props) => {
  const { t } = useLanguage();
  const { initialProductId, initialSubTab, onNavPayloadConsumed, currentUser } = props;

  // ALWAYS call hooks (React rules - hooks must be called unconditionally)
  const transfersHook = useTransfers();
  const productsHook = useProducts();
  const warehousesHook = useWarehouses();
  const [activeTab, setActiveTab] = useState<TransferType>(initialSubTab || 'INTERNAL');
  const [boxes, setBoxes] = useState(0);
  const [looseUnits, setLooseUnits] = useState(1);
  const { value: stockMigratedValue } = useAppSetting('stock_migrated');
  const stockMigrated = stockMigratedValue === 'true';
  const [importQueue, setImportQueue] = useState<{productId: string, productName: string, quantity: number, boxesEntered?: number | null, looseEntered?: number | null}[]>([]);
  const [reference, setReference] = useState('');
  const [adjustmentQueue, setAdjustmentQueue] = useState<{productId: string, productName: string, delta: number, reason: string}[]>([]);
  const [reason, setReason] = useState('');
  const [adjType, setAdjType] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
  const [recalibrating, setRecalibrating] = useState(false);
  const [showRecalibrateModal, setShowRecalibrateModal] = useState(false);
  const [recalibratePreview, setRecalibratePreview] = useState<StockRecalibratePreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Use Supabase hook data directly
  const transfers = transfersHook.transfers;
  const products = productsHook.products;
  const warehouses = warehousesHook.warehouses;
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [productId, setProductId] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'ALL' | TransferType>('ALL');

  // Consume navigation payload from notification click (pre-select product + open ADJUSTMENT tab)
  useEffect(() => {
    if (initialProductId && products.length > 0) {
      const exists = products.find(p => p.id === initialProductId);
      if (exists) {
        setProductId(initialProductId);
        if (initialSubTab) setActiveTab(initialSubTab);
        onNavPayloadConsumed?.();
      }
    }
  }, [initialProductId, products.length]);

  // Effective values: use selected state, fall back to first available item.
  // This avoids timing issues where useState initializes before async data arrives.
  const effectiveFromId = fromId || warehouses[0]?.id || '';
  const effectiveToId = toId || (warehouses.length > 1 ? warehouses[1]?.id : warehouses[0]?.id) || '';
  const effectiveProductId = productId || (initialProductId && products.find(p => p.id === initialProductId) ? initialProductId : products[0]?.id) || '';
  const effectiveTargetWarehouseId = targetWarehouseId || warehouses[0]?.id || '';

  // Only block on initial load (no data yet) — background reloads should not hide the UI
  const initialLoading = (transfersHook.loading && transfers.length === 0) ||
                         (productsHook.loading && products.length === 0) ||
                         (warehousesHook.loading && warehouses.length === 0);
  const error = transfersHook.error ||
                productsHook.error ||
                warehousesHook.error;

  // Loading state — only on first load
  if (initialLoading) {
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
        {(transfersHook || productsHook || warehousesHook) && (
          <button
            onClick={() => {
              transfersHook?.refresh();
              productsHook?.refresh();
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

  // SORT PRODUCTS using shared utility
  const sortedProducts = sortProducts(products || []);

  // Format a transfer item quantity for display.
  // New entries (boxesEntered != null): show "X cais. +Y uds" using the values the user typed.
  // Historical entries (boxesEntered == null): show the raw number — user knows it means cajas.
  const fmtTransferQty = (qty: number, boxesEntered?: number | null, looseEntered?: number | null): string => {
    if (boxesEntered == null) return `${qty}`;
    if (boxesEntered > 0 && (looseEntered || 0) > 0) return `${boxesEntered} cais. +${looseEntered} uds`;
    if (boxesEntered > 0) return `${boxesEntered} caj.`;
    return `${looseEntered || 0} uds`;
  };

  const addToImportQueue = () => {
      const product = products.find(p => p.id === productId);
      if (!product) return;
      const ps = product.unitsPerBox || 1;
      const usesDual = ps > 1 && stockMigrated;
      // Always store individual units regardless of migration state
      const effectiveQty = usesDual ? boxes * ps + looseUnits : ps > 1 ? boxes * ps : looseUnits;
      if (effectiveQty <= 0) return;

      const boxesVal = usesDual ? boxes : null;
      const looseVal = usesDual ? looseUnits : null;
      const existingItemIndex = importQueue.findIndex(i => i.productId === productId);
      if (existingItemIndex >= 0) {
          const updated = [...importQueue];
          updated[existingItemIndex].quantity += effectiveQty;
          if (boxesVal != null && updated[existingItemIndex].boxesEntered != null) {
              updated[existingItemIndex].boxesEntered = (updated[existingItemIndex].boxesEntered || 0) + boxesVal;
              updated[existingItemIndex].looseEntered = (updated[existingItemIndex].looseEntered || 0) + (looseVal || 0);
          }
          setImportQueue(updated);
      } else {
          setImportQueue([...importQueue, { productId: product.id, productName: `${product.name} (${product.packSize}${product.unit})`, quantity: effectiveQty, boxesEntered: boxesVal, looseEntered: looseVal }]);
      }
      setBoxes(0);
      setLooseUnits(1);
  };

  const removeFromImportQueue = (idx: number) => {
      setImportQueue(importQueue.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // CONSTRUCT TRANSFER OBJECT BASED ON TYPE

      // 1. IMPORT (Bulk)
      if (activeTab === 'IMPORT') {
          if (importQueue.length === 0) {
              alert(t('error_empty_list'));
              return;
          }
          if (!reference) {
              alert(t('error_missing_ref'));
              return;
          }
          if (!effectiveTargetWarehouseId) {
              alert('Por favor selecciona un almacén de destino');
              return;
          }

          const newTransfer: Omit<Transfer, 'id'> = {
              date: new Date().toISOString(),
              type: 'IMPORT',
              toWarehouseId: effectiveTargetWarehouseId,
              items: importQueue,
              status: 'Completed',
              reference: reference
          };

          if (transfersHook) {
            await transfersHook.createTransfer(newTransfer);
            if (productsHook) {
              await productsHook.refresh();
            }
          } else {
            const transferWithId = { ...newTransfer, id: crypto.randomUUID() } as Transfer;
            props.onTransfer?.(transferWithId);
          }

          setImportQueue([]);
          setReference('');
          alert('✅ Conteneur reçu ! Stock mis à jour.');
          return;
      }

      // 2. INTERNAL & ADJUSTMENT (Single Item Logic)
      const product = products.find(p => p.id === effectiveProductId);
      if (!product) return;

      // Safety check for stock levels
      const productStock = product.stockLevels || {};

      const ps = product.unitsPerBox || 1;
      const usesDual = ps > 1 && stockMigrated;
      const usesBoxes = ps > 1 && !stockMigrated;
      // Always store individual units — usesBoxes path multiplies by ps to stay consistent
      const effectiveQty = usesDual ? boxes * ps + looseUnits : usesBoxes ? boxes * ps : looseUnits;
      if (effectiveQty <= 0) {
          alert('La quantité doit être supérieure à 0');
          return;
      }

      if (activeTab === 'INTERNAL') {
          if (!effectiveFromId || !effectiveToId) {
              alert('Sélectionnez l\'entrepôt source et destination.');
              return;
          }
          if (effectiveFromId === effectiveToId) {
              alert(t('error_same_warehouse'));
              return;
          }
          const currentStock = Math.floor(productStock[effectiveFromId] || 0);
          if (currentStock < effectiveQty) {
              const avail = usesDual
                ? `${Math.floor(currentStock / ps)} cais. +${currentStock % ps} uds`
                : usesBoxes ? `${currentStock} caisses` : `${currentStock}`;
              alert(`${t('error_insufficient_stock')} (Max: ${avail})`);
              return;
          }
      } else if (activeTab === 'ADJUSTMENT' && adjType === 'DECREASE') {
          const currentStock = Math.floor(productStock[effectiveTargetWarehouseId] || 0);
          if (currentStock < effectiveQty) {
              const avail = usesDual
                ? `${Math.floor(currentStock / ps)} cais. +${currentStock % ps} uds`
                : usesBoxes ? `${currentStock} caisses` : `${currentStock}`;
              alert(`${t('error_insufficient_stock')} (Max: ${avail})`);
              return;
          }
      }

      const newTransfer: Omit<Transfer, 'id'> = {
          date: new Date().toISOString(),
          type: activeTab,
          fromWarehouseId: activeTab === 'INTERNAL' ? effectiveFromId : undefined,
          toWarehouseId: activeTab === 'INTERNAL' ? effectiveToId : effectiveTargetWarehouseId,
          items: [{
              productId: product.id,
              productName: `${product.name} (${product.packSize}${product.unit})`,
              quantity: effectiveQty,
              boxesEntered: usesDual ? boxes : null,
              looseEntered: usesDual ? looseUnits : null,
          }],
          status: 'Completed',
          reference: activeTab === 'ADJUSTMENT'
              ? (adjType === 'INCREASE' ? 'ADJ+' : 'ADJ-')
              : `INT-${Math.floor(Math.random() * 1000)}`,
          reason: activeTab === 'ADJUSTMENT' ? reason : undefined
      };

      if (transfersHook) {
        await transfersHook.createTransfer(newTransfer);
        if (productsHook) {
          await productsHook.refresh();
        }
      } else {
        const transferWithId = { ...newTransfer, id: crypto.randomUUID() } as Transfer;
        props.onTransfer?.(transferWithId);
      }

      // Reset fields
      setBoxes(0);
      setLooseUnits(1);
      setReason('');
      alert(t('alert_stock_updated'));
    } catch (error: any) {
      alert(`${t('error')}: ${error.message}`);
    }
  };

  const getTypeBadge = (type: TransferType, ref: string) => {
      switch(type) {
          case 'IMPORT': return <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded border border-blue-200 flex items-center"><Container className="w-3 h-3 mr-1"/> Import</span>;
          case 'ADJUSTMENT': return <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded border border-amber-200 flex items-center"><AlertTriangle className="w-3 h-3 mr-1"/> Adj. {ref}</span>;
          default: return <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded border border-indigo-200 flex items-center"><ArrowRightLeft className="w-3 h-3 mr-1"/> Transfer</span>;
      }
  };

  // Step 1 — open modal and load preview (read-only, safe)
  const handleRecalibratePreview = async () => {
    setShowRecalibrateModal(true);
    setRecalibratePreview([]);
    setLoadingPreview(true);
    try {
      const preview = await transfersHook.previewStockRecalibration();
      setRecalibratePreview(preview);
    } catch (err: any) {
      alert(`❌ Error al calcular preview: ${err.message}`);
      setShowRecalibrateModal(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Step 2 — apply after user confirms in modal
  const handleRecalibrateApply = async () => {
    try {
      setRecalibrating(true);
      const summary = await transfersHook.applyStockRecalibration();
      await productsHook?.refresh();
      setShowRecalibrateModal(false);
      setRecalibratePreview([]);
      alert(`✅ ${summary}`);
    } catch (err: any) {
      alert(`❌ Error al aplicar: ${err.message}`);
    } finally {
      setRecalibrating(false);
    }
  };

  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('logistics')}</h1>
            <p className="text-sm text-slate-500">{t('manage_logistics_desc')}</p>
         </div>
         {currentUser?.role === 'Admin' && (
           <button
             onClick={handleRecalibratePreview}
             disabled={recalibrating || loadingPreview}
             className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
           >
             {(recalibrating || loadingPreview) ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>⚙</span>}
             Recalibrar stock
           </button>
         )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Operation Form */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit lg:col-span-1">
              {/* Tabs */}
              <div className="flex p-1 bg-slate-100 rounded-lg mb-6 overflow-x-auto">
                  <button 
                    onClick={() => setActiveTab('INTERNAL')}
                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all whitespace-nowrap px-2 ${activeTab === 'INTERNAL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      {t('internal_transfer')}
                  </button>
                  <button 
                    onClick={() => setActiveTab('IMPORT')}
                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all whitespace-nowrap px-2 ${activeTab === 'IMPORT' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      {t('container_receipt')}
                  </button>
                  <button 
                    onClick={() => setActiveTab('ADJUSTMENT')}
                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all whitespace-nowrap px-2 ${activeTab === 'ADJUSTMENT' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      {t('stock_adjustment')}
                  </button>
              </div>

              {/* Banner: opened from a stock alert notification */}
              {initialProductId && products.find(p => p.id === initialProductId) && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Alerta stock: {products.find(p => p.id === initialProductId)?.name} — añade stock para resolver
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                  {/* DYNAMIC FIELDS BASED ON TAB */}
                  
                  {activeTab === 'INTERNAL' && (
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('source')}</label>
                              <select className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={effectiveFromId} onChange={(e) => setFromId(e.target.value)}>
                                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('destination')}</label>
                              <select className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={effectiveToId} onChange={(e) => setToId(e.target.value)}>
                                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                              </select>
                          </div>
                      </div>
                  )}

                  {(activeTab === 'IMPORT' || activeTab === 'ADJUSTMENT') && (
                      <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                              {activeTab === 'IMPORT' ? t('destination') : t('warehouse')}
                          </label>
                          <select className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={effectiveTargetWarehouseId} onChange={(e) => setTargetWarehouseId(e.target.value)}>
                              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                      </div>
                  )}

                  {activeTab === 'IMPORT' && (
                      <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('container_ref')}</label>
                          <input 
                            type="text" 
                            className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                            placeholder={t('placeholder_ref')}
                            value={reference} 
                            onChange={(e) => setReference(e.target.value)} 
                          />
                      </div>
                  )}

                  {activeTab === 'ADJUSTMENT' && (
                      <div className="grid grid-cols-2 gap-4">
                          <button type="button" onClick={() => setAdjType('INCREASE')} className={`p-2 rounded-lg border text-sm font-bold flex items-center justify-center ${adjType === 'INCREASE' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'border-slate-200'}`}>
                              <Plus className="w-4 h-4 mr-1"/> {t('add_qty')}
                          </button>
                          <button type="button" onClick={() => setAdjType('DECREASE')} className={`p-2 rounded-lg border text-sm font-bold flex items-center justify-center ${adjType === 'DECREASE' ? 'bg-rose-50 border-rose-500 text-rose-700' : 'border-slate-200'}`}>
                              <Minus className="w-4 h-4 mr-1"/> {t('remove_qty')}
                          </button>
                      </div>
                  )}

                  {/* PRODUCT SELECTION (COMMON) */}
                  <div className="pt-2 border-t border-slate-100">
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('product_name')}</label>
                      <select className="w-full border border-slate-300 rounded-lg p-2 text-sm" value={effectiveProductId} onChange={(e) => setProductId(e.target.value)}>
                          {sortedProducts.map(p => {
                              // Safely access stock levels
                              const pLevels = p.stockLevels || {};
                              const stock = activeTab === 'INTERNAL' ? (pLevels[effectiveFromId] || 0) : (pLevels[effectiveTargetWarehouseId] || 0);
                              const ps = p.unitsPerBox || 1;
                              const stockLabel = stockMigrated && ps > 1 ? formatStock(stock, ps, t('boxes_unit'), t('units_abbr')) : ps > 1 ? `${stock} ${t('boxes_unit')}` : `${stock} ${t('units_abbr')}`;
                              return <option key={p.id} value={p.id}>{p.name} ({p.packSize}{p.unit}) (Stock: {stockLabel})</option>
                          })}
                      </select>
                  </div>

                  <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('quantity')}</label>
                      {(() => {
                        const selProduct = products.find(p => p.id === (effectiveProductId || productId));
                        const ps = selProduct?.unitsPerBox || 1;
                        const usesDual = ps > 1 && stockMigrated;
                        const usesBoxes = ps > 1 && !stockMigrated;
                        const availStock = selProduct
                          ? Math.floor((selProduct.stockLevels || {})[activeTab === 'INTERNAL' ? effectiveFromId : effectiveTargetWarehouseId] || 0)
                          : 0;
                        if (usesDual) {
                          const maxBoxes = activeTab !== 'IMPORT' ? Math.floor(availStock / ps) : undefined;
                          const maxLoose = (activeTab !== 'IMPORT' && activeTab !== 'ADJUSTMENT') || adjType === 'DECREASE'
                            ? Math.max(0, availStock - boxes * ps) : undefined;
                          const total = boxes * ps + looseUnits;
                          return (
                            <>
                              <div className="flex items-end gap-2">
                                <div className="flex-1">
                                  <label className="text-[10px] text-slate-500 font-semibold uppercase mb-1 block">📦 Caisses (×{ps})</label>
                                  <input
                                    type="number" min="0" max={maxBoxes}
                                    className="w-full border border-slate-300 rounded-lg p-2 text-sm font-bold text-center"
                                    value={boxes}
                                    onChange={(e) => {
                                      const b = Math.max(0, parseInt(e.target.value) || 0);
                                      setBoxes(b);
                                      if (maxLoose !== undefined)
                                        setLooseUnits(prev => Math.min(prev, availStock - b * ps));
                                    }}
                                  />
                                </div>
                                <span className="text-slate-400 font-bold pb-2.5">+</span>
                                <div className="flex-1">
                                  <label className="text-[10px] text-slate-500 font-semibold uppercase mb-1 block">Uds sueltas</label>
                                  <input
                                    type="number" min="0" max={maxLoose}
                                    className="w-full border border-slate-300 rounded-lg p-2 text-sm font-bold text-center"
                                    value={looseUnits}
                                    onChange={(e) => setLooseUnits(Math.max(0, parseInt(e.target.value) || 0))}
                                  />
                                </div>
                              </div>
                              <div className="mt-2 p-2 bg-indigo-50 rounded-lg flex justify-between items-center">
                                <span className="text-xs text-indigo-500">Total</span>
                                <span className="text-sm font-bold text-indigo-700">{total} unidades</span>
                              </div>
                              {activeTab !== 'IMPORT' && (
                                <p className="text-xs text-slate-400 mt-1 text-right">
                                  Disponible : {maxBoxes} cais. + {availStock % ps} unités ({availStock} unités)
                                </p>
                              )}
                            </>
                          );
                        }
                        if (usesBoxes) {
                          // availStock is always in units; convert to boxes for the max cap
                          const maxBoxes = activeTab !== 'IMPORT' ? Math.floor(availStock / ps) : undefined;
                          return (
                            <>
                              <div className="flex items-end gap-2">
                                <div className="flex-1">
                                  <label className="text-[10px] text-slate-500 font-semibold uppercase mb-1 block">📦 Caisses (×{ps})</label>
                                  <input
                                    type="number" min="1" max={maxBoxes}
                                    className="w-full border border-slate-300 rounded-lg p-2 text-sm font-bold text-center"
                                    value={boxes}
                                    onChange={(e) => setBoxes(Math.max(1, parseInt(e.target.value) || 1))}
                                  />
                                </div>
                                <span className="text-slate-400 font-bold pb-2.5">+</span>
                                <div className="flex-1" title="Exécutez la migration ⚙️ dans l'Inventaire pour activer les unités libres">
                                  <label className="text-[10px] text-slate-400 font-semibold uppercase mb-1 block">Unités libres</label>
                                  <input
                                    type="number" disabled
                                    className="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold text-center bg-slate-50 text-slate-300 cursor-not-allowed"
                                    value={0}
                                  />
                                </div>
                              </div>
                              {activeTab !== 'IMPORT' && <p className="text-xs text-slate-400 mt-1 text-right">Disponible : {availStock} caisses · Activez la migration ⚙️ pour les unités libres</p>}
                            </>
                          );
                        }
                        return (
                          <input
                            type="number" min="1"
                            className="w-full border border-slate-300 rounded-lg p-2 text-sm font-bold"
                            value={looseUnits}
                            onChange={(e) => setLooseUnits(Math.max(1, parseInt(e.target.value) || 1))}
                          />
                        );
                      })()}
                  </div>

                  {activeTab === 'IMPORT' && (
                      <button 
                        type="button"
                        onClick={addToImportQueue}
                        className="w-full py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-bold text-sm hover:bg-blue-100"
                      >
                          <Plus className="w-4 h-4 inline mr-1"/> {t('add_to_list')}
                      </button>
                  )}

                  {activeTab === 'ADJUSTMENT' && (
                      <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('adjustment_reason')}</label>
                          <input 
                            type="text" 
                            className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                            placeholder={t('placeholder_reason')}
                            value={reason} 
                            onChange={(e) => setReason(e.target.value)} 
                            required
                          />
                      </div>
                  )}

                  {activeTab !== 'IMPORT' && (
                    <button 
                        type="submit" 
                        className={`w-full py-3 text-white rounded-lg font-bold shadow-md transition-colors ${
                            activeTab === 'INTERNAL' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-600 hover:bg-amber-700'
                        }`}
                    >
                        {activeTab === 'INTERNAL' ? t('btn_confirm_transfer') : t('btn_adjust_stock')}
                    </button>
                  )}
              </form>
          </div>

          {/* Right Column: Queue or Recent */}
          <div className="lg:col-span-2 space-y-4">
              {activeTab === 'IMPORT' && (
                  <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm mb-6">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-bold text-slate-900 flex items-center">
                              <List className="w-5 h-5 mr-2 text-blue-600"/> {t('items_in_container')}
                          </h3>
                          <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">
                              {importQueue.length} {t('items_count')}
                          </span>
                      </div>
                      
                      {importQueue.length === 0 ? (
                          <div className="text-center p-8 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-400 text-sm">
                              {t('error_empty_list')}
                          </div>
                      ) : (
                          <div className="overflow-x-auto">
                              <table className="w-full text-sm text-left">
                                  <thead className="bg-blue-50 text-blue-800">
                                      <tr>
                                          <th className="p-2 rounded-tl-lg">{t('product_name')}</th>
                                          <th className="p-2 text-center">{t('quantity')}</th>
                                          <th className="p-2 text-right rounded-tr-lg">{t('actions')}</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-blue-50">
                                      {importQueue.map((item, idx) => (
                                          <tr key={idx}>
                                              <td className="p-2">{item.productName}</td>
                                              <td className="p-2 text-center font-bold">{fmtTransferQty(item.quantity, item.boxesEntered, item.looseEntered)}</td>
                                              <td className="p-2 text-right">
                                                  <button onClick={() => removeFromImportQueue(idx)} className="text-rose-500 hover:text-rose-700 p-1">
                                                      <Trash2 className="w-4 h-4" />
                                                  </button>
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                              <div className="mt-4 pt-4 border-t border-slate-100">
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleSubmit(e as any);
                                    }}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md transition-colors flex items-center justify-center"
                                  >
                                      <Container className="w-5 h-5 mr-2" /> {t('receive_all')}
                                  </button>
                              </div>
                          </div>
                      )}
                  </div>
              )}

              {/* History header + search + filter */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                <h3 className="text-lg font-bold text-slate-900 flex-1">{t('recent_transfers')}</h3>
                <div className="flex items-center gap-2">
                  {/* Type filter */}
                  <select
                    value={historyTypeFilter}
                    onChange={e => setHistoryTypeFilter(e.target.value as any)}
                    className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="ALL">{t('all')}</option>
                    <option value="INTERNAL">{t('internal_transfer')}</option>
                    <option value="IMPORT">{t('container_receipt')}</option>
                    <option value="ADJUSTMENT">{t('stock_adjustment')}</option>
                  </select>
                  {/* Text search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={historySearch}
                      onChange={e => setHistorySearch(e.target.value)}
                      placeholder={t('search')}
                      className="pl-8 pr-7 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-40"
                    />
                    {historySearch && (
                      <button onClick={() => setHistorySearch('')} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {(() => {
                const q = historySearch.toLowerCase().trim();
                const filtered = transfers.slice().reverse().filter(transfer => {
                  if (historyTypeFilter !== 'ALL' && transfer.type !== historyTypeFilter) return false;
                  if (!q) return true;
                  const fromName = warehouses.find(w => w.id === transfer.fromWarehouseId)?.name || '';
                  const toName = warehouses.find(w => w.id === transfer.toWarehouseId)?.name || '';
                  return (
                    (transfer.reference || '').toLowerCase().includes(q) ||
                    fromName.toLowerCase().includes(q) ||
                    toName.toLowerCase().includes(q) ||
                    transfer.items.some(i => i.productName.toLowerCase().includes(q)) ||
                    (transfer.reason || '').toLowerCase().includes(q)
                  );
                });

                if ((transfers || []).length === 0) return (
                  <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
                    {t('no_operations_recorded')}
                  </div>
                );
                if (filtered.length === 0) return (
                  <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
                    {t('global_search_no_results')}
                  </div>
                );
                return filtered.map(transfer => {
                      const fromName = warehouses.find(w => w.id === transfer.fromWarehouseId)?.name;
                      const toName = warehouses.find(w => w.id === transfer.toWarehouseId)?.name;
                      
                      return (
                        <div key={transfer.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between">
                            <div className="mb-3 md:mb-0">
                                <div className="flex items-center space-x-2 mb-1">
                                    <span className="text-sm font-bold text-slate-900 font-mono">#{transfer.reference || transfer.id.slice(-6)}</span>
                                    {getTypeBadge(transfer.type || 'INTERNAL', transfer.reference)}
                                </div>
                                <div className="flex items-center text-sm text-slate-500">
                                    <Calendar className="w-3 h-3 mr-1" /> {new Date(transfer.date).toLocaleDateString()}
                                    
                                    {/* Logic for Displaying Flow */}
                                    {(transfer.type === 'INTERNAL' || !transfer.type) && (
                                        <>
                                            <span className="mx-2 ml-4">{t('source')}:</span>
                                            <span className="font-medium text-slate-700">{fromName || transfer.fromWarehouseId?.slice(0, 8) || '—'}</span>
                                            <ArrowRight className="w-3 h-3 mx-2 text-slate-400" />
                                            <span className="font-medium text-slate-700">{toName || transfer.toWarehouseId?.slice(0, 8) || '—'}</span>
                                        </>
                                    )}
                                    {transfer.type === 'IMPORT' && (
                                        <>
                                            <span className="mx-2 ml-4">{t('into')}</span>
                                            <span className="font-medium text-slate-700">{toName || transfer.toWarehouseId?.slice(0, 8) || '—'}</span>
                                        </>
                                    )}
                                    {transfer.type === 'ADJUSTMENT' && (
                                        <>
                                            <span className="mx-2 ml-4">{t('at')}</span>
                                            <span className="font-medium text-slate-700">{toName || transfer.toWarehouseId?.slice(0, 8) || '—'}</span>
                                            {transfer.reason && <span className="text-xs text-slate-400 ml-2 italic">({transfer.reason})</span>}
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    {(transfer.items || []).map((item, i) => (
                                        <div key={i} className="text-sm flex items-center">
                                            <Package className="w-3 h-3 mr-2 text-slate-400"/>
                                            <span className="font-bold mr-1">{fmtTransferQty(item.quantity, item.boxesEntered, item.looseEntered)}</span> x {item.productName}
                                        </div>
                                    ))}
                                </div>
                                {transfersHook && (
                                    <button
                                        onClick={async () => {
                                            if (confirm('¿Seguro que deseas eliminar esta transferencia?')) {
                                                try {
                                                    await transfersHook.deleteTransfer(transfer.id);
                                                } catch (error: any) {
                                                    alert(`Error: ${error.message}`);
                                                }
                                            }
                                        }}
                                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                        title="Supprimer le transfert"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                      );
                  });
              })()}
          </div>
      </div>
    </div>

    {/* ── Recalibration modal ─────────────────────────────────────────────── */}
    {showRecalibrateModal && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">

          {/* Header */}
          <div className="p-6 border-b border-slate-200 flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Recalibración de Stock</h2>
              <p className="text-sm text-slate-500">
                Compara el stock actual con la suma de todos los movimientos registrados
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto p-6">
            {loadingPreview ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                <p className="text-sm font-medium">Calculando diferencias…</p>
                <p className="text-xs text-slate-400">Revisando transfers, ventas y devoluciones</p>
              </div>

            ) : recalibratePreview.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <CheckCircle2 className="w-14 h-14 text-emerald-500" />
                <p className="text-lg font-bold text-slate-900">Todo el stock está correcto</p>
                <p className="text-sm text-slate-500 text-center max-w-sm">
                  No hay diferencias entre el stock actual y los movimientos registrados. No se necesita ninguna corrección.
                </p>
              </div>

            ) : (
              <>
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-800">
                    <strong>{recalibratePreview.length} registros</strong> tienen diferencias entre
                    el stock actual y la suma de todos los movimientos.
                    Al confirmar se corregirán todos y quedará un registro en el log de auditoría.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                          <th className="p-3 text-left font-semibold">Producto</th>
                          <th className="p-3 text-left font-semibold">Almacén</th>
                          <th className="p-3 text-right font-semibold">Stock actual</th>
                          <th className="p-3 text-right font-semibold">Correcto</th>
                          <th className="p-3 text-right font-semibold">Diferencia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {recalibratePreview.map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-medium text-slate-900">{row.producto}</td>
                            <td className="p-3 text-slate-500">{row.almacen}</td>
                            <td className="p-3 text-right font-mono text-slate-600">{row.stock_actual}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-700">{row.stock_correcto}</td>
                            <td className={`p-3 text-right font-mono font-bold ${row.diferencia < 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {row.diferencia > 0 ? '+' : ''}{row.diferencia}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-200 flex items-center justify-between">
            <button
              onClick={() => { setShowRecalibrateModal(false); setRecalibratePreview([]); }}
              disabled={recalibrating}
              className="px-5 py-2.5 text-slate-600 hover:text-slate-900 font-semibold transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>

            {!loadingPreview && recalibratePreview.length === 0 && (
              <button
                onClick={() => { setShowRecalibrateModal(false); setRecalibratePreview([]); }}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors"
              >
                ✅ Cerrar
              </button>
            )}

            {!loadingPreview && recalibratePreview.length > 0 && (
              <button
                onClick={handleRecalibrateApply}
                disabled={recalibrating}
                className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
              >
                {recalibrating
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Aplicando…</>
                  : <><CheckCircle2 className="w-4 h-4" /> Aplicar {recalibratePreview.length} correcciones</>
                }
              </button>
            )}
          </div>

        </div>
      </div>
    )}
    </>
  );
};

export default Transfers;
