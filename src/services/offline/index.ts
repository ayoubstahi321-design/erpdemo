/**
 * Offline Services Module
 * Exports all offline functionality for use throughout the application
 */

// Types
export type {
  SyncQueueItem,
  SyncOperationType,
  SyncStatus,
  SyncEntity,
  SyncState,
  NetworkState,
  ConflictInfo,
  StockConflict,
  SyncEvent,
  SyncEventType,
  SyncEventListener,
  OfflineSaleMetadata,
  CachedData,
} from '../../types/offline';

// Network Status
export {
  useNetworkStatus,
  isOnline,
  checkConnection,
  onNetworkStatusChange,
  getConnectionType,
  getNetworkStatusService,
} from './networkStatus';

// Sync Queue
export {
  queueOperation,
  queueSale,
  queuePayment,
  queueStockUpdate,
  queueReturn,
  queueTransfer,
  getPendingItems,
  getRetryableItems,
  getQueueStats,
  getQueueSummary,
  markAsProcessing,
  markAsCompleted,
  markAsFailed,
  markAsConflict,
  resetForRetry,
  removeFromQueue,
  getItemsByPriority,
  clearCompletedItems,
  clearExhaustedItems,
} from './syncQueue';

// Sync Engine
export {
  getSyncEngine,
  initializeSyncEngine,
  destroySyncEngine,
  getSyncState,
  triggerSync,
  refreshSyncState,
  onSyncEvent,
  refreshOfflineCache,
} from './syncEngine';

// Offline Database
export {
  openDatabase,
  closeDatabase,
  getCachedProducts,
  getCachedCustomers,
  getCachedWarehouses,
  cacheProducts,
  cacheCustomers,
  cacheWarehouses,
  cacheSales,
  getCachedSales,
  saveOfflineSale,
  getOfflineSales,
  removeOfflineSale,
  getLastSyncTime,
  setLastSyncTime,
  clearAllOfflineData,
  getOfflineDataSummary,
} from './offlineDb';
