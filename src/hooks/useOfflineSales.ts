/**
 * Offline-aware Sales Hook
 * Wraps useSales with offline support for creating sales when disconnected
 */

import { useState, useEffect, useCallback } from 'react';
import { Sale, Payment } from '../types';
import { useSales } from './useSupabaseData';
import {
  isOnline,
  queueSale,
  queuePayment,
  getOfflineSales,
  saveOfflineSale,
  removeOfflineSale,
  onSyncEvent,
  getCachedProducts,
  getCachedCustomers,
} from '../services/offline';
import { FEATURES } from '../config/features';
import { logger } from '../utils/logger';

// Offline sale with local metadata
interface OfflineSale extends Omit<Sale, 'id'> {
  id: string;
  localId: string; // Required at root level — IDB OFFLINE_SALES store uses keyPath: 'localId'
  _offline: {
    isLocal: boolean;
    localId: string;
    syncStatus: 'pending' | 'synced' | 'failed';
    queueItemId?: string;
  };
}

export function useOfflineSales() {
  const onlineSales = useSales();
  const [offlineSales, setOfflineSales] = useState<OfflineSale[]>([]);
  const [isLoadingOffline, setIsLoadingOffline] = useState(true);

  // Load offline sales from IndexedDB
  const loadOfflineSales = useCallback(async () => {
    if (!FEATURES.OFFLINE_MODE) return;

    try {
      const stored = await getOfflineSales();
      setOfflineSales(stored as OfflineSale[]);
    } catch (error) {
      logger.error('Error loading offline sales:', error);
    } finally {
      setIsLoadingOffline(false);
    }
  }, []);

  useEffect(() => {
    loadOfflineSales();

    // Subscribe to sync events to update offline sales status
    const unsubscribe = onSyncEvent((event) => {
      if (event.type === 'item_synced' && event.data?.type === 'CREATE_SALE') {
        // Remove synced sale from offline list
        loadOfflineSales();
      }
      if (event.type === 'item_failed' && event.data?.type === 'CREATE_SALE') {
        // Update failed status
        loadOfflineSales();
      }
      if (event.type === 'sync_completed') {
        // Refresh both online and offline sales
        loadOfflineSales();
        onlineSales.refresh();
      }
    });

    return unsubscribe;
  }, [loadOfflineSales, onlineSales.refresh]);

  // Combine online and offline sales — exclude any offline sale already marked 'synced'
  // (guards against the edge case where IDB deletion failed after a successful sync)
  const allSales = [
    ...offlineSales
      .filter(s => s._offline.syncStatus !== 'synced')
      .map(s => ({ ...s, _isOffline: true })),
    ...onlineSales.sales.map(s => ({ ...s, _isOffline: false })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Create sale - works both online and offline
  const createSale = async (sale: Omit<Sale, 'id'>, userId: string): Promise<Sale | OfflineSale> => {
    // If offline mode is disabled, always use online
    if (!FEATURES.OFFLINE_MODE) {
      return onlineSales.createSale(sale, userId);
    }

    // Check if online
    if (isOnline()) {
      try {
        return await onlineSales.createSale(sale, userId);
      } catch (error: any) {
        // Only fall back to offline queue for genuine network errors (fetch failed, timeout).
        // Server errors (400, 403, 409, 422, 500…) mean the request REACHED Supabase —
        // queuing offline won't help and silently hides the real problem from the user.
        const isNetworkError =
          error?.message?.toLowerCase().includes('failed to fetch') ||
          error?.message?.toLowerCase().includes('network') ||
          error?.message?.toLowerCase().includes('timeout') ||
          error?.code === 'PGRST000'; // PostgREST network-level code
        if (!isNetworkError) {
          logger.error('POS sale failed with server error (not queuing offline):', error);
          throw error; // Surface the real error so POS can show it to the user
        }
        logger.warn('Online sale failed due to network error, queuing offline:', error);
        return await createOfflineSale(sale, userId);
      }
    }

    // Offline - queue the sale
    return await createOfflineSale(sale, userId);
  };

  // Create an offline sale
  const createOfflineSale = async (sale: Omit<Sale, 'id'>, userId: string): Promise<OfflineSale> => {
    const localId = crypto.randomUUID();

    // Queue the sale for later sync
    const queueItem = await queueSale(
      {
        ...sale,
        warehouse_id: sale.warehouseId,
        customer_id: sale.customerId,
        customer_name: sale.customerName,
        customer_type: sale.customerType,
        items: sale.items.map(item => ({
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount: item.discount,
          discount_type: item.discountType || 'percentage',
          total: item.total,
          sell_mode: item.sellMode || 'unit',
          units_per_box: item.unitsPerBox || 1,
        })),
        global_discount_type: sale.globalDiscountType,
        global_discount_value: sale.globalDiscountValue,
        global_discount_amount: sale.globalDiscountAmount,
        items_subtotal: sale.itemsSubtotal,
        subtotal_amount: sale.subtotalAmount,
        tax_rate: sale.taxRate,
        tax_amount: sale.taxAmount,
        total_amount: sale.totalAmount,
        amount_paid: sale.amountPaid,
        payment_status: sale.paymentStatus,
        credited_amount: sale.creditedAmount,
        status: sale.status,
      },
      userId,
      sale.warehouseId,
      localId  // Propagate so syncEngine can find and remove the right IDB record
    );

    // Create the offline sale record
    // localId must be at root level — IDB OFFLINE_SALES store uses keyPath: 'localId'
    const offlineSale: OfflineSale = {
      ...sale,
      id: localId,
      localId,
      _offline: {
        isLocal: true,
        localId,
        syncStatus: 'pending',
        queueItemId: queueItem.id,
      },
    };

    // Save to IndexedDB
    await saveOfflineSale(offlineSale);

    // Update local state
    setOfflineSales(prev => [...prev, offlineSale]);

    logger.debug('Created offline sale:', localId);
    return offlineSale;
  };

  // Register payment - works both online and offline
  const registerPayment = async (saleId: string, payment: Omit<Payment, 'id'>) => {
    // Check if this is an offline sale
    const offlineSale = offlineSales.find(s => s.id === saleId);

    if (offlineSale) {
      // Queue the payment for later
      await queuePayment(
        {
          sale_id: saleId,
          date: payment.date,
          amount: payment.amount,
          method: payment.method,
          reference: payment.reference,
          recorded_by: payment.recordedBy,
        },
        saleId,
        payment.recordedBy
      );

      // Update offline sale optimistically
      const updatedSale: OfflineSale = {
        ...offlineSale,
        amountPaid: offlineSale.amountPaid + payment.amount,
        paymentStatus:
          offlineSale.amountPaid + payment.amount >= offlineSale.totalAmount
            ? 'Paid'
            : 'Partial',
        payments: [
          ...(offlineSale.payments || []),
          { ...payment, id: crypto.randomUUID() },
        ],
      };

      await saveOfflineSale(updatedSale);
      setOfflineSales(prev =>
        prev.map(s => (s.id === saleId ? updatedSale : s))
      );

      return;
    }

    // Online sale - try to register normally
    if (!FEATURES.OFFLINE_MODE || isOnline()) {
      try {
        return await onlineSales.registerPayment(saleId, payment);
      } catch (error) {
        if (!FEATURES.OFFLINE_MODE) throw error;
        // Queue for later if offline mode is enabled
        logger.warn('Online payment failed, queuing offline:', error);
      }
    }

    // Queue payment for online sale (will sync later)
    await queuePayment(
      {
        sale_id: saleId,
        date: payment.date,
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference,
        recorded_by: payment.recordedBy,
      },
      saleId,
      payment.recordedBy
    );
  };

  // Get cached products for offline use
  const getProductsForOffline = async () => {
    return await getCachedProducts();
  };

  // Get cached customers for offline use
  const getCustomersForOffline = async () => {
    return await getCachedCustomers();
  };

  // Refresh both online and offline data
  const refresh = async () => {
    await Promise.all([onlineSales.refresh(), loadOfflineSales()]);
  };

  // Check if a sale is offline
  const isOfflineSale = (saleId: string): boolean => {
    return offlineSales.some(s => s.id === saleId);
  };

  // Get sync status for a sale
  const getSyncStatus = (saleId: string): 'synced' | 'pending' | 'failed' | null => {
    const offlineSale = offlineSales.find(s => s.id === saleId);
    if (!offlineSale) return 'synced';
    return offlineSale._offline.syncStatus;
  };

  return {
    sales: allSales,
    loading: onlineSales.loading || isLoadingOffline,
    error: onlineSales.error,
    createSale,
    registerPayment,
    refresh,
    isOfflineSale,
    getSyncStatus,
    getProductsForOffline,
    getCustomersForOffline,
    pendingOfflineSales: offlineSales.filter(s => s._offline.syncStatus === 'pending').length,
  };
}

export default useOfflineSales;
