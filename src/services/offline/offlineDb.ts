/**
 * IndexedDB Wrapper for Offline Storage
 * Provides a simple API for storing and retrieving offline data
 */

import {
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  OFFLINE_STORES,
  SyncQueueItem,
  SyncStatus,
} from '../../types/offline';
import { logger } from '../../utils/logger';

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Initialize and open the IndexedDB database
 */
export async function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

    request.onerror = () => {
      logger.error('[OfflineDB] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      logger.debug('[OfflineDB] Database opened successfully');
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      logger.debug('[OfflineDB] Upgrading database schema...');

      // Sync Queue Store
      if (!db.objectStoreNames.contains(OFFLINE_STORES.SYNC_QUEUE)) {
        const syncStore = db.createObjectStore(OFFLINE_STORES.SYNC_QUEUE, { keyPath: 'id' });
        syncStore.createIndex('status', 'sync.status', { unique: false });
        syncStore.createIndex('timestamp', 'metadata.timestamp', { unique: false });
        syncStore.createIndex('type', 'type', { unique: false });
      }

      // Cached Products Store
      if (!db.objectStoreNames.contains(OFFLINE_STORES.CACHED_PRODUCTS)) {
        const productsStore = db.createObjectStore(OFFLINE_STORES.CACHED_PRODUCTS, { keyPath: 'id' });
        productsStore.createIndex('sku', 'sku', { unique: false });
        productsStore.createIndex('cachedAt', '_cachedAt', { unique: false });
      }

      // Cached Customers Store
      if (!db.objectStoreNames.contains(OFFLINE_STORES.CACHED_CUSTOMERS)) {
        const customersStore = db.createObjectStore(OFFLINE_STORES.CACHED_CUSTOMERS, { keyPath: 'id' });
        customersStore.createIndex('cachedAt', '_cachedAt', { unique: false });
      }

      // Cached Warehouses Store
      if (!db.objectStoreNames.contains(OFFLINE_STORES.CACHED_WAREHOUSES)) {
        const warehousesStore = db.createObjectStore(OFFLINE_STORES.CACHED_WAREHOUSES, { keyPath: 'id' });
        warehousesStore.createIndex('cachedAt', '_cachedAt', { unique: false });
      }

      // Cached Sales Store (recent sales for offline viewing)
      if (!db.objectStoreNames.contains(OFFLINE_STORES.CACHED_SALES)) {
        const cachedSalesStore = db.createObjectStore(OFFLINE_STORES.CACHED_SALES, { keyPath: 'id' });
        cachedSalesStore.createIndex('date', 'date', { unique: false });
        cachedSalesStore.createIndex('cachedAt', '_cachedAt', { unique: false });
      }

      // Offline Sales Store (sales created while offline)
      if (!db.objectStoreNames.contains(OFFLINE_STORES.OFFLINE_SALES)) {
        const salesStore = db.createObjectStore(OFFLINE_STORES.OFFLINE_SALES, { keyPath: 'localId' });
        salesStore.createIndex('syncStatus', '_offline.syncStatus', { unique: false });
        salesStore.createIndex('createdAt', '_offline.createdOfflineAt', { unique: false });
      }

      // Sync Metadata Store (key-value for settings)
      if (!db.objectStoreNames.contains(OFFLINE_STORES.SYNC_METADATA)) {
        db.createObjectStore(OFFLINE_STORES.SYNC_METADATA, { keyPath: 'key' });
      }

      logger.debug('[OfflineDB] Database schema upgraded');
    };
  });

  return dbPromise;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbPromise = null;
    logger.debug('[OfflineDB] Database closed');
  }
}

// ============================================================
// GENERIC CRUD OPERATIONS
// ============================================================

async function getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

export async function getAll<T>(storeName: string): Promise<T[]> {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export async function getById<T>(storeName: string, id: string): Promise<T | null> {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result as T | null);
    request.onerror = () => reject(request.error);
  });
}

export async function add<T>(storeName: string, item: T): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.add(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function put<T>(storeName: string, item: T): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function remove(storeName: string, id: string): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clear(storeName: string): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ============================================================
// SYNC QUEUE OPERATIONS
// ============================================================

export async function addToSyncQueue(item: SyncQueueItem): Promise<void> {
  await add(OFFLINE_STORES.SYNC_QUEUE, item);
  logger.debug('[OfflineDB] Added item to sync queue:', item.id);
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const items = await getAll<SyncQueueItem>(OFFLINE_STORES.SYNC_QUEUE);
  // Sort by timestamp (oldest first)
  return items.sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const items = await getSyncQueue();
  return items.filter(item => item.sync.status === 'pending' || item.sync.status === 'failed');
}

export async function updateSyncItemStatus(
  id: string,
  status: SyncStatus,
  error?: string
): Promise<void> {
  const item = await getById<SyncQueueItem>(OFFLINE_STORES.SYNC_QUEUE, id);
  if (item) {
    item.sync.status = status;
    if (error) {
      item.sync.lastError = error;
    }
    if (status === 'failed') {
      item.sync.retryCount++;
      item.sync.nextRetryAt = new Date(Date.now() + Math.min(1000 * Math.pow(2, item.sync.retryCount), 30000)).toISOString();
    }
    if (status === 'completed') {
      item.sync.completedAt = new Date().toISOString();
    }
    await put(OFFLINE_STORES.SYNC_QUEUE, item);
    logger.debug(`[OfflineDB] Updated sync item status: ${id} -> ${status}`);
  }
}

export async function removeSyncItem(id: string): Promise<void> {
  await remove(OFFLINE_STORES.SYNC_QUEUE, id);
  logger.debug('[OfflineDB] Removed sync item:', id);
}

export async function getSyncQueueCount(): Promise<{ pending: number; failed: number; total: number }> {
  const items = await getSyncQueue();
  return {
    pending: items.filter(i => i.sync.status === 'pending').length,
    failed: items.filter(i => i.sync.status === 'failed').length,
    total: items.length,
  };
}

// ============================================================
// CACHE OPERATIONS
// ============================================================

export async function cacheProducts(products: any[]): Promise<void> {
  const store = await getStore(OFFLINE_STORES.CACHED_PRODUCTS, 'readwrite');
  const now = new Date().toISOString();

  return new Promise((resolve, reject) => {
    const transaction = store.transaction;

    // Clear existing and add new
    store.clear();

    products.forEach(product => {
      store.put({ ...product, _cachedAt: now });
    });

    transaction.oncomplete = () => {
      logger.debug(`[OfflineDB] Cached ${products.length} products`);
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getCachedProducts(): Promise<any[]> {
  const products = await getAll<any>(OFFLINE_STORES.CACHED_PRODUCTS);
  // Remove internal _cachedAt field
  return products.map(({ _cachedAt, ...product }) => product);
}

export async function cacheCustomers(customers: any[]): Promise<void> {
  const store = await getStore(OFFLINE_STORES.CACHED_CUSTOMERS, 'readwrite');
  const now = new Date().toISOString();

  return new Promise((resolve, reject) => {
    const transaction = store.transaction;

    store.clear();

    customers.forEach(customer => {
      store.put({ ...customer, _cachedAt: now });
    });

    transaction.oncomplete = () => {
      logger.debug(`[OfflineDB] Cached ${customers.length} customers`);
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getCachedCustomers(): Promise<any[]> {
  const customers = await getAll<any>(OFFLINE_STORES.CACHED_CUSTOMERS);
  return customers.map(({ _cachedAt, ...customer }) => customer);
}

export async function cacheWarehouses(warehouses: any[]): Promise<void> {
  const store = await getStore(OFFLINE_STORES.CACHED_WAREHOUSES, 'readwrite');
  const now = new Date().toISOString();

  return new Promise((resolve, reject) => {
    const transaction = store.transaction;

    store.clear();

    warehouses.forEach(warehouse => {
      store.put({ ...warehouse, _cachedAt: now });
    });

    transaction.oncomplete = () => {
      logger.debug(`[OfflineDB] Cached ${warehouses.length} warehouses`);
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getCachedWarehouses(): Promise<any[]> {
  const warehouses = await getAll<any>(OFFLINE_STORES.CACHED_WAREHOUSES);
  return warehouses.map(({ _cachedAt, ...warehouse }) => warehouse);
}

export async function cacheSales(sales: any[]): Promise<void> {
  const store = await getStore(OFFLINE_STORES.CACHED_SALES, 'readwrite');
  const now = new Date().toISOString();

  return new Promise((resolve, reject) => {
    const transaction = store.transaction;
    store.clear();
    sales.forEach(sale => {
      store.put({ ...sale, _cachedAt: now });
    });
    transaction.oncomplete = () => {
      logger.debug(`[OfflineDB] Cached ${sales.length} sales`);
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getCachedSales(): Promise<any[]> {
  const sales = await getAll<any>(OFFLINE_STORES.CACHED_SALES);
  return sales
    .map(({ _cachedAt, ...sale }) => sale)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ============================================================
// OFFLINE SALES OPERATIONS
// ============================================================

export async function saveOfflineSale(sale: any): Promise<void> {
  await put(OFFLINE_STORES.OFFLINE_SALES, sale);
  logger.debug('[OfflineDB] Saved offline sale:', sale.localId);
}

export async function getOfflineSales(): Promise<any[]> {
  return getAll(OFFLINE_STORES.OFFLINE_SALES);
}

export async function removeOfflineSale(localId: string): Promise<void> {
  await remove(OFFLINE_STORES.OFFLINE_SALES, localId);
  logger.debug('[OfflineDB] Removed offline sale:', localId);
}

// ============================================================
// METADATA OPERATIONS
// ============================================================

export async function setMetadata(key: string, value: any): Promise<void> {
  await put(OFFLINE_STORES.SYNC_METADATA, { key, value, updatedAt: new Date().toISOString() });
}

export async function getMetadata<T>(key: string): Promise<T | null> {
  const result = await getById<{ key: string; value: T }>(OFFLINE_STORES.SYNC_METADATA, key);
  return result?.value ?? null;
}

export async function getLastSyncTime(): Promise<string | null> {
  return getMetadata<string>('lastSyncTime');
}

export async function setLastSyncTime(time: string): Promise<void> {
  await setMetadata('lastSyncTime', time);
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

export async function clearAllOfflineData(): Promise<void> {
  await clear(OFFLINE_STORES.SYNC_QUEUE);
  await clear(OFFLINE_STORES.CACHED_PRODUCTS);
  await clear(OFFLINE_STORES.CACHED_CUSTOMERS);
  await clear(OFFLINE_STORES.CACHED_WAREHOUSES);
  await clear(OFFLINE_STORES.CACHED_SALES);
  await clear(OFFLINE_STORES.OFFLINE_SALES);
  await clear(OFFLINE_STORES.SYNC_METADATA);
  logger.debug('[OfflineDB] Cleared all offline data');
}

export async function getOfflineDataSummary(): Promise<{
  syncQueueCount: number;
  cachedProductsCount: number;
  cachedCustomersCount: number;
  cachedWarehousesCount: number;
  cachedSalesCount: number;
  offlineSalesCount: number;
  lastSyncTime: string | null;
}> {
  const [syncQueue, products, customers, warehouses, cachedSales, offlineSales, lastSync] = await Promise.all([
    getSyncQueue(),
    getCachedProducts(),
    getCachedCustomers(),
    getCachedWarehouses(),
    getCachedSales(),
    getOfflineSales(),
    getLastSyncTime(),
  ]);

  return {
    syncQueueCount: syncQueue.length,
    cachedProductsCount: products.length,
    cachedCustomersCount: customers.length,
    cachedWarehousesCount: warehouses.length,
    cachedSalesCount: cachedSales.length,
    offlineSalesCount: offlineSales.length,
    lastSyncTime: lastSync,
  };
}
