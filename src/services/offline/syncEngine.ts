/**
 * Sync Engine - Main Orchestrator for Offline Synchronization
 * Handles automatic sync when online, conflict resolution, and event emission
 */

import { supabase } from '../supabaseClient';
import {
  SyncQueueItem,
  SyncState,
  SyncEvent,
  SyncEventListener,
  SyncEventType,
  ConflictInfo,
  StockConflict,
} from '../../types/offline';
import {
  getPendingItems,
  getRetryableItems,
  markAsProcessing,
  markAsCompleted,
  markAsFailed,
  markAsConflict,
  getQueueStats,
} from './syncQueue';
import {
  getLastSyncTime,
  setLastSyncTime,
  cacheProducts,
  cacheCustomers,
  cacheWarehouses,
  cacheSales,
  removeOfflineSale,
  getById,
  put,
} from './offlineDb';
import { OFFLINE_STORES } from '../../types/offline';
import {
  getNetworkStatusService,
  isOnline,
  onNetworkStatusChange,
} from './networkStatus';
import { logger } from '../../utils/logger';

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
  // Minimum time between sync attempts (ms)
  MIN_SYNC_INTERVAL: 5000,
  // Maximum concurrent sync operations
  MAX_CONCURRENT_SYNCS: 3,
  // Timeout for individual sync operations (ms)
  SYNC_OPERATION_TIMEOUT: 30000,
  // Auto-refresh cache interval when online (ms)
  CACHE_REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutes
};

// ============================================================
// SYNC ENGINE CLASS
// ============================================================

class SyncEngine {
  private _state: SyncState = {
    isOnline: navigator.onLine,
    isChecking: false,
    isSyncing: false,
    pendingCount: 0,
    failedCount: 0,
    lastSyncAt: null,
    lastCheckAt: null,
    conflicts: [],
  };

  private listeners: Set<SyncEventListener> = new Set();
  private networkUnsubscribe: (() => void) | null = null;
  private syncInProgress: boolean = false;
  private cacheRefreshInterval: NodeJS.Timeout | null = null;
  private initialized: boolean = false;

  get state(): SyncState {
    return { ...this._state };
  }

  /**
   * Initialize the sync engine
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.debug('[SyncEngine] Initializing...');

    // Subscribe to network status changes
    this.networkUnsubscribe = onNetworkStatusChange((online) => {
      this.handleNetworkChange(online);
    });

    // Load initial state
    await this.refreshState();

    // If online, start cache refresh and trigger initial sync
    if (isOnline()) {
      this.startCacheRefresh();
      // Delay initial sync slightly to let app load
      setTimeout(() => this.triggerSync(), 2000);
    }

    this.initialized = true;
    logger.debug('[SyncEngine] Initialized');
  }

  /**
   * Shutdown the sync engine
   */
  destroy(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
    }
    if (this.cacheRefreshInterval) {
      clearInterval(this.cacheRefreshInterval);
    }
    this.listeners.clear();
    this.initialized = false;
    logger.debug('[SyncEngine] Destroyed');
  }

  /**
   * Handle network status changes
   */
  private async handleNetworkChange(online: boolean): Promise<void> {
    const wasOnline = this._state.isOnline;
    this._state.isOnline = online;

    if (online && !wasOnline) {
      // Just came online
      logger.debug('[SyncEngine] Connection restored');
      this.emit('online', {});
      this.startCacheRefresh();
      // Trigger sync when we come back online
      await this.triggerSync();
    } else if (!online && wasOnline) {
      // Just went offline
      logger.debug('[SyncEngine] Connection lost');
      this.emit('offline', {});
      this.stopCacheRefresh();
    }
  }

  /**
   * Refresh sync state from queue
   */
  async refreshState(): Promise<void> {
    const stats = await getQueueStats();
    const lastSync = await getLastSyncTime();

    this._state.pendingCount = stats.pending;
    this._state.failedCount = stats.failed;
    this._state.lastSyncAt = lastSync;
    this._state.lastCheckAt = new Date().toISOString();

    this.emit('queue_updated', {
      pendingCount: stats.pending,
      failedCount: stats.failed,
    });
  }

  /**
   * Trigger a sync operation
   */
  async triggerSync(): Promise<boolean> {
    if (this.syncInProgress) {
      logger.debug('[SyncEngine] Sync already in progress');
      return false;
    }

    if (!isOnline()) {
      logger.debug('[SyncEngine] Cannot sync - offline');
      return false;
    }

    this.syncInProgress = true;
    this._state.isSyncing = true;
    this.emit('sync_started', {});

    try {
      // Get items ready for sync (pending + retryable)
      const pendingItems = await getPendingItems();
      const retryableItems = await getRetryableItems();

      // Combine and deduplicate
      const allItems = [...pendingItems];
      for (const item of retryableItems) {
        if (!allItems.find(i => i.id === item.id)) {
          allItems.push(item);
        }
      }

      if (allItems.length === 0) {
        logger.debug('[SyncEngine] No items to sync');
        this._state.isSyncing = false;
        this.syncInProgress = false;
        this.emit('sync_completed', { synced: 0 });
        return true;
      }

      logger.debug(`[SyncEngine] Syncing ${allItems.length} items`);

      let successCount = 0;
      let failCount = 0;

      // Process items sequentially to maintain order
      for (const item of allItems) {
        if (!isOnline()) {
          logger.debug('[SyncEngine] Lost connection during sync');
          break;
        }

        const success = await this.syncItem(item);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      // Update last sync time
      await setLastSyncTime(new Date().toISOString());
      await this.refreshState();

      this.emit('sync_completed', {
        synced: successCount,
        failed: failCount,
      });

      logger.debug(`[SyncEngine] Sync completed: ${successCount} success, ${failCount} failed`);
      return failCount === 0;
    } catch (error) {
      logger.error('[SyncEngine] Sync error:', error);
      this.emit('sync_failed', { error: (error as Error).message });
      return false;
    } finally {
      this._state.isSyncing = false;
      this.syncInProgress = false;
    }
  }

  /**
   * Sync a single queue item
   */
  private async syncItem(item: SyncQueueItem): Promise<boolean> {
    try {
      await markAsProcessing(item.id);

      switch (item.type) {
        case 'CREATE_SALE':
          await this.syncSale(item);
          break;
        case 'CREATE_PAYMENT':
          await this.syncPayment(item);
          break;
        case 'UPDATE_STOCK':
          await this.syncStockUpdate(item);
          break;
        case 'CREATE_RETURN':
          await this.syncReturn(item);
          break;
        case 'CREATE_TRANSFER':
          await this.syncTransfer(item);
          break;
        default:
          throw new Error(`Unknown operation type: ${item.type}`);
      }

      await markAsCompleted(item.id);
      this.emit('item_synced', { id: item.id, type: item.type });
      return true;
    } catch (error) {
      const errorMessage = (error as Error).message;

      // Check if it's a conflict error
      if (this.isConflictError(error)) {
        await this.handleConflict(item, error as Error);
        return false;
      }

      await markAsFailed(item.id, errorMessage);
      this.emit('item_failed', { id: item.id, type: item.type, error: errorMessage });
      return false;
    }
  }

  /**
   * Sync a sale operation
   * Mirrors the createSale flow in useSupabaseData.ts
   */
  private async syncSale(item: SyncQueueItem): Promise<void> {
    const { data, userId } = item.payload;

    // First, check stock availability for all items
    const stockChecks = await this.checkStockAvailability(data.items, data.warehouse_id);

    if (stockChecks.hasConflicts) {
      // Handle stock conflicts - reduce quantities to available stock
      const adjustedData = await this.resolveStockConflicts(data, stockChecks.conflicts);
      if (adjustedData.items.length === 0) {
        throw new Error('CONFLICT: All items out of stock');
      }
      data.items = adjustedData.items;
      data.total_amount = adjustedData.total;
    }

    // Step 1: Insert sale record (snake_case, matching DB schema)
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert([{
        invoice_number: data.invoice_number || null,
        delivery_note_number: data.delivery_note_number || null,
        date: data.date,
        warehouse_id: data.warehouse_id,
        customer_id: data.customer_id,
        customer_name: data.customer_name,
        customer_type: data.customer_type,
        source: data.source || 'POS',
        document_type: data.document_type || 'TICKET',
        is_fast_sale: data.is_fast_sale || false,
        global_discount_type: data.global_discount_type || null,
        global_discount_value: data.global_discount_value || null,
        global_discount_amount: data.global_discount_amount || null,
        items_subtotal: data.items_subtotal,
        subtotal_amount: data.subtotal_amount,
        tax_rate: data.tax_rate,
        tax_amount: data.tax_amount,
        total_amount: data.total_amount,
        amount_paid: data.amount_paid,
        payment_status: data.payment_status,
        credited_amount: data.credited_amount || 0,
        status: data.status,
        company_id: data.company_id || null,
        created_by: userId,
      }])
      .select()
      .single();

    if (saleError) throw saleError;

    // Step 2: Insert sale items
    if (data.items && data.items.length > 0) {
      const saleItemsInserts = data.items.map((saleItem: any) => ({
        sale_id: saleData.id,
        product_id: saleItem.product_id,
        product_name: saleItem.product_name,
        quantity: saleItem.quantity,
        unit_price: saleItem.unit_price,
        discount: saleItem.discount,
        discount_type: saleItem.discount_type || 'percentage',
        total: saleItem.total,
        sell_mode: saleItem.sell_mode || 'unit',
        units_per_box: saleItem.units_per_box || 1,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItemsInserts);

      if (itemsError) throw itemsError;
    }

    // Step 3: Insert payments if any
    if (data.payments && data.payments.length > 0) {
      const paymentsInserts = data.payments.map((payment: any) => ({
        sale_id: saleData.id,
        date: payment.date,
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference || null,
        check_number: payment.check_number || null,
        due_date: payment.due_date || null,
        payment_status: payment.payment_status || null,
        recorded_by: payment.recorded_by || userId,
      }));

      const { error: paymentsError } = await supabase
        .from('payments')
        .insert(paymentsInserts);

      if (paymentsError) throw paymentsError;
    }

    // Step 4: Update stock levels via RPC for each item
    for (const saleItem of data.items) {
      // Calculate actual units based on sell mode
      // If sell_mode is 'box', units = quantity * units_per_box
      // If sell_mode is 'unit' or undefined (legacy), units = quantity
      const actualUnits = saleItem.sell_mode === 'box'
        ? saleItem.quantity * (saleItem.units_per_box || 1)
        : saleItem.quantity;

      const { error: stockError } = await supabase.rpc('update_stock_level', {
        p_product_id: saleItem.product_id,
        p_warehouse_id: data.warehouse_id,
        p_delta: -actualUnits,
        p_reason: `Sale ${saleData.invoice_number || saleData.id}`,
        p_user_id: userId,
      });

      if (stockError) {
        logger.error('[SyncEngine] Stock update error (non-fatal):', stockError);
        // Don't throw - sale already created
      }
    }

    // Step 5: Clean up offline sale from IndexedDB.
    // First mark as 'synced' so even if deletion fails the record is excluded from the UI.
    try {
      const offlineSale = await getById<{ _offline?: { syncStatus?: string; [key: string]: any }; [key: string]: any }>(OFFLINE_STORES.OFFLINE_SALES, item.metadata.localId);
      if (offlineSale?._offline) {
        await put(OFFLINE_STORES.OFFLINE_SALES, {
          ...offlineSale,
          _offline: { ...offlineSale._offline, syncStatus: 'synced' },
        });
      }
      await removeOfflineSale(item.metadata.localId);
    } catch (e) {
      logger.error('[SyncEngine] Error removing offline sale:', e);
    }

    logger.debug('[SyncEngine] Sale synced:', item.metadata.localId);
  }

  /**
   * Sync a payment operation
   */
  private async syncPayment(item: SyncQueueItem): Promise<void> {
    const { data } = item.payload;

    const { error } = await supabase
      .from('payments')
      .insert({
        sale_id: data.sale_id || data.saleId,
        date: data.date,
        amount: data.amount,
        method: data.method,
        reference: data.reference || null,
        check_number: data.check_number || null,
        due_date: data.due_date || null,
        payment_status: data.payment_status || null,
        recorded_by: data.recorded_by || item.payload.userId,
      });

    if (error) throw error;

    logger.debug('[SyncEngine] Payment synced:', item.metadata.localId);
  }

  /**
   * Sync a stock update operation
   */
  private async syncStockUpdate(item: SyncQueueItem): Promise<void> {
    const { productId, warehouseId, delta, reason } = item.payload.data;

    const { error } = await supabase.rpc('update_stock_level', {
      p_product_id: productId,
      p_warehouse_id: warehouseId,
      p_delta: delta,
      p_reason: reason || 'Offline stock update',
      p_user_id: item.payload.userId,
    });

    if (error) throw error;

    logger.debug(`[SyncEngine] Stock update synced: ${productId} delta=${delta}`);
  }

  /**
   * Sync a return operation
   */
  private async syncReturn(item: SyncQueueItem): Promise<void> {
    const { data, userId } = item.payload;

    const { error } = await supabase
      .from('returns')
      .insert({
        ...data,
      });

    if (error) throw error;

    // Restore stock if items are returned to inventory.
    // Fetch original sale_items to get sell_mode and units_per_box so box-mode
    // returns restore the correct number of individual units (same logic as
    // the online createReturn path in useSupabaseData).
    if (data.restore_stock && data.items && data.original_sale_id) {
      const { data: saleItems } = await supabase
        .from('sale_items')
        .select('product_id, sell_mode, units_per_box')
        .eq('sale_id', data.original_sale_id);

      const saleItemMap: Record<string, { sellMode: string; unitsPerBox: number }> = {};
      for (const si of saleItems || []) {
        saleItemMap[si.product_id] = {
          sellMode: si.sell_mode || 'unit',
          unitsPerBox: si.units_per_box || 1,
        };
      }

      for (const returnItem of data.items) {
        const orig = saleItemMap[returnItem.product_id];
        const deltaUnits = orig?.sellMode === 'box'
          ? returnItem.quantity * (orig.unitsPerBox || 1)
          : returnItem.quantity;

        await supabase.rpc('update_stock_level', {
          p_product_id: returnItem.product_id,
          p_warehouse_id: data.warehouse_id,
          p_delta: deltaUnits,
          p_reason: 'Return (offline sync)',
          p_user_id: userId,
        });
      }
    }

    logger.debug('[SyncEngine] Return synced:', item.metadata.localId);
  }

  /**
   * Sync a transfer operation
   */
  private async syncTransfer(item: SyncQueueItem): Promise<void> {
    const { data, userId } = item.payload;

    const { error } = await supabase
      .from('transfers')
      .insert({
        ...data,
      });

    if (error) throw error;

    // Move stock between warehouses via RPC
    for (const transferItem of data.items) {
      await supabase.rpc('update_stock_level', {
        p_product_id: transferItem.product_id,
        p_warehouse_id: data.source_warehouse_id,
        p_delta: -transferItem.quantity,
        p_reason: 'Transfer out (offline sync)',
        p_user_id: userId,
      });
      await supabase.rpc('update_stock_level', {
        p_product_id: transferItem.product_id,
        p_warehouse_id: data.target_warehouse_id,
        p_delta: transferItem.quantity,
        p_reason: 'Transfer in (offline sync)',
        p_user_id: userId,
      });
    }

    logger.debug('[SyncEngine] Transfer synced:', item.metadata.localId);
  }

  // ============================================================
  // STOCK HELPERS
  // ============================================================

  private async checkStockAvailability(
    items: any[],
    warehouseId: string
  ): Promise<{ hasConflicts: boolean; conflicts: StockConflict[] }> {
    const conflicts: StockConflict[] = [];

    for (const item of items) {
      const { data: stock } = await supabase
        .from('stock_levels')
        .select('quantity')
        .eq('product_id', item.product_id)
        .eq('warehouse_id', warehouseId)
        .single();

      const availableQuantity = stock?.quantity || 0;

      if (availableQuantity < item.quantity) {
        conflicts.push({
          id: crypto.randomUUID(),
          queueItemId: '',
          type: 'stock',
          productId: item.product_id,
          productName: item.product_name || item.product_id,
          warehouseId,
          requestedQuantity: item.quantity,
          availableQuantity,
          localValue: item.quantity,
          serverValue: availableQuantity,
          detectedAt: new Date().toISOString(),
          resolved: false,
        });
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
    };
  }

  private async resolveStockConflicts(
    data: any,
    conflicts: StockConflict[]
  ): Promise<{ items: any[]; total: number }> {
    const adjustedItems: any[] = [];
    let newTotal = 0;

    for (const item of data.items) {
      const conflict = conflicts.find(c => c.productId === item.product_id);

      if (conflict) {
        if (conflict.availableQuantity > 0) {
          // Reduce quantity to available stock
          const adjustedItem = {
            ...item,
            quantity: conflict.availableQuantity,
            total: conflict.availableQuantity * item.unit_price,
          };
          adjustedItems.push(adjustedItem);
          newTotal += adjustedItem.total;

          // Mark conflict as resolved
          conflict.resolved = true;
          conflict.resolution = 'reduce_quantity';
          conflict.resolvedAt = new Date().toISOString();

          this.emit('conflict_resolved', { conflict });
        } else {
          // Remove item completely (stock = 0)
          conflict.resolved = true;
          conflict.resolution = 'cancel_item';
          conflict.resolvedAt = new Date().toISOString();

          this.emit('conflict_resolved', { conflict });
        }
      } else {
        // No conflict, keep item as-is
        adjustedItems.push(item);
        newTotal += item.total;
      }
    }

    return {
      items: adjustedItems,
      total: newTotal,
    };
  }

  // Stock operations now use RPC update_stock_level directly in each sync method

  // ============================================================
  // CONFLICT HANDLING
  // ============================================================

  private isConflictError(error: any): boolean {
    if (!error) return false;
    const message = error.message?.toLowerCase() || '';
    return (
      message.includes('conflict') ||
      message.includes('stock') ||
      error.code === '23505' // PostgreSQL unique violation
    );
  }

  private async handleConflict(item: SyncQueueItem, error: Error): Promise<void> {
    const conflict: ConflictInfo = {
      id: crypto.randomUUID(),
      queueItemId: item.id,
      type: 'data',
      localValue: item.payload.data,
      serverValue: null,
      detectedAt: new Date().toISOString(),
      resolved: false,
    };

    this._state.conflicts.push(conflict);
    await markAsConflict(item.id, error.message);
    this.emit('conflict_detected', { conflict, item });
  }

  // ============================================================
  // CACHE MANAGEMENT
  // ============================================================

  private startCacheRefresh(): void {
    if (this.cacheRefreshInterval) {
      return;
    }

    // Initial cache refresh
    this.refreshCache();

    // Schedule periodic refresh
    this.cacheRefreshInterval = setInterval(() => {
      if (isOnline()) {
        this.refreshCache();
      }
    }, CONFIG.CACHE_REFRESH_INTERVAL);
  }

  private stopCacheRefresh(): void {
    if (this.cacheRefreshInterval) {
      clearInterval(this.cacheRefreshInterval);
      this.cacheRefreshInterval = null;
    }
  }

  async refreshCache(): Promise<void> {
    if (!isOnline()) {
      return;
    }

    try {
      logger.debug('[SyncEngine] Refreshing cache...');

      // Fetch and cache products with stock levels
      const { data: products } = await supabase
        .from('products')
        .select('*, stock_levels(warehouse_id, quantity)');

      if (products) {
        await cacheProducts(products);
      }

      // Fetch and cache customers
      const { data: customers } = await supabase
        .from('customers')
        .select('*');

      if (customers) {
        await cacheCustomers(customers);
      }

      // Fetch and cache warehouses
      const { data: warehouses } = await supabase
        .from('warehouses')
        .select('*');

      if (warehouses) {
        await cacheWarehouses(warehouses);
      }

      // Fetch and cache recent sales (last 90 days) for offline viewing
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const { data: sales } = await supabase
        .from('sales')
        .select(`
          *,
          sale_items (id, product_id, product_name, quantity, unit_price, discount, discount_type, total, sell_mode, units_per_box),
          payments (id, date, amount, method, reference, check_number, due_date, payment_status, recorded_by, bank_name)
        `)
        .gte('date', cutoff.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (sales) {
        await cacheSales(sales);
      }

      logger.debug('[SyncEngine] Cache refreshed');
    } catch (error) {
      logger.error('[SyncEngine] Cache refresh error:', error);
    }
  }

  // ============================================================
  // EVENT SYSTEM
  // ============================================================

  subscribe(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(type: SyncEventType, data: any): void {
    const event: SyncEvent = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };

    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        logger.error('[SyncEngine] Event listener error:', error);
      }
    });
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

let syncEngine: SyncEngine | null = null;

export function getSyncEngine(): SyncEngine {
  if (!syncEngine) {
    syncEngine = new SyncEngine();
  }
  return syncEngine;
}

export async function initializeSyncEngine(): Promise<void> {
  await getSyncEngine().initialize();
}

export function destroySyncEngine(): void {
  if (syncEngine) {
    syncEngine.destroy();
    syncEngine = null;
  }
}

// ============================================================
// CONVENIENCE EXPORTS
// ============================================================

export function getSyncState(): SyncState {
  return getSyncEngine().state;
}

export function triggerSync(): Promise<boolean> {
  return getSyncEngine().triggerSync();
}

export function refreshSyncState(): Promise<void> {
  return getSyncEngine().refreshState();
}

export function onSyncEvent(listener: SyncEventListener): () => void {
  return getSyncEngine().subscribe(listener);
}

export function refreshOfflineCache(): Promise<void> {
  return getSyncEngine().refreshCache();
}
