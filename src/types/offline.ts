/**
 * Offline Mode Types for Azmol ERP
 * Defines types for sync queue, offline operations, and conflict resolution
 */

// ============================================================
// SYNC QUEUE TYPES
// ============================================================

export type SyncOperationType =
  | 'CREATE_SALE'
  | 'UPDATE_STOCK'
  | 'CREATE_PAYMENT'
  | 'CREATE_RETURN'
  | 'CREATE_TRANSFER';

export type SyncStatus = 'pending' | 'processing' | 'failed' | 'conflict' | 'completed';

export type SyncEntity = 'sales' | 'products' | 'payments' | 'returns' | 'transfers';

export interface SyncQueueItem {
  id: string;                    // UUID for queue item
  type: SyncOperationType;       // Operation type
  entity: SyncEntity;            // Target entity
  payload: {
    data: any;                   // The actual data to sync
    userId: string;              // User who created it
    warehouseId?: string;        // For stock operations
  };
  metadata: {
    localId: string;             // Local ID for optimistic updates
    createdAt: string;           // ISO timestamp when created
    timestamp: number;           // Logical timestamp for ordering
  };
  sync: {
    status: SyncStatus;
    retryCount: number;
    maxRetries: number;
    lastError?: string;
    nextRetryAt?: string;
    completedAt?: string;
  };
}

// ============================================================
// CONFLICT RESOLUTION TYPES
// ============================================================

export type ConflictResolutionStrategy =
  | 'reduce_quantity'    // Auto-reduce to available stock
  | 'cancel_item'        // Remove item from sale
  | 'backorder'          // Mark for backorder
  | 'manual'             // User decides
  | 'last_write_wins'    // Default for most cases
  | 'server_wins'        // Keep server version
  | 'local_wins';        // Keep local version

export interface ConflictInfo {
  id: string;
  queueItemId: string;
  type: 'stock' | 'data' | 'deleted';
  field?: string;
  localValue: any;
  serverValue: any;
  detectedAt: string;
  resolved: boolean;
  resolution?: ConflictResolutionStrategy;
  resolvedAt?: string;
}

export interface StockConflict extends ConflictInfo {
  type: 'stock';
  productId: string;
  productName: string;
  warehouseId: string;
  requestedQuantity: number;
  availableQuantity: number;
}

// ============================================================
// SYNC STATE TYPES
// ============================================================

export interface SyncState {
  isOnline: boolean;
  isChecking: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncAt: string | null;
  lastCheckAt: string | null;
  conflicts: ConflictInfo[];
}

export interface NetworkState {
  isOnline: boolean;
  isChecking: boolean;
  lastCheckAt: string | null;
  connectionType?: string;  // 'wifi' | '4g' | '3g' | 'slow-2g' | 'unknown'
}

// ============================================================
// OFFLINE DATA CACHE TYPES
// ============================================================

export interface CachedData<T> {
  data: T;
  cachedAt: string;
  expiresAt?: string;
  version: number;
}

export interface OfflineCache {
  products: CachedData<any[]>;
  customers: CachedData<any[]>;
  warehouses: CachedData<any[]>;
}

// ============================================================
// OFFLINE SALE TYPES
// ============================================================

export interface OfflineSaleMetadata {
  localId: string;           // Temporary UUID until synced
  syncStatus: 'pending' | 'synced' | 'failed' | 'conflict';
  queueItemId: string;       // Reference to sync queue
  createdOfflineAt: string;
  syncedAt?: string;
  serverId?: string;         // Real ID after sync
}

// ============================================================
// SYNC ENGINE EVENTS
// ============================================================

export type SyncEventType =
  | 'sync_started'
  | 'sync_completed'
  | 'sync_failed'
  | 'item_synced'
  | 'item_failed'
  | 'conflict_detected'
  | 'conflict_resolved'
  | 'online'
  | 'offline'
  | 'queue_updated';

export interface SyncEvent {
  type: SyncEventType;
  timestamp: string;
  data?: any;
}

export type SyncEventListener = (event: SyncEvent) => void;

// ============================================================
// INDEXEDDB SCHEMA TYPES
// ============================================================

export interface OfflineDbSchema {
  syncQueue: SyncQueueItem[];
  cachedProducts: any[];
  cachedCustomers: any[];
  cachedWarehouses: any[];
  offlineSales: any[];
  syncMetadata: Record<string, any>;
}

export const OFFLINE_DB_NAME = 'azmol-offline-db';
export const OFFLINE_DB_VERSION = 2;

export const OFFLINE_STORES = {
  SYNC_QUEUE: 'syncQueue',
  CACHED_PRODUCTS: 'cachedProducts',
  CACHED_CUSTOMERS: 'cachedCustomers',
  CACHED_WAREHOUSES: 'cachedWarehouses',
  CACHED_SALES: 'cachedSales',
  OFFLINE_SALES: 'offlineSales',
  SYNC_METADATA: 'syncMetadata',
} as const;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function createSyncQueueItem(
  type: SyncOperationType,
  entity: SyncEntity,
  data: any,
  userId: string,
  warehouseId?: string,
  localId?: string
): SyncQueueItem {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    type,
    entity,
    payload: {
      data,
      userId,
      warehouseId,
    },
    metadata: {
      localId: localId ?? crypto.randomUUID(),
      createdAt: now,
      timestamp: Date.now(),
    },
    sync: {
      status: 'pending',
      retryCount: 0,
      maxRetries: 5,
    },
  };
}

export function isRetryable(item: SyncQueueItem): boolean {
  return item.sync.status === 'failed' && item.sync.retryCount < item.sync.maxRetries;
}

export function getRetryDelay(retryCount: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s
  return Math.min(1000 * Math.pow(2, retryCount), 30000);
}
