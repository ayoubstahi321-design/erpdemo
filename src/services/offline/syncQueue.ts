/**
 * Sync Queue Manager
 * Manages the queue of offline operations to be synchronized
 */

import {
  SyncQueueItem,
  SyncOperationType,
  SyncEntity,
  SyncStatus,
  createSyncQueueItem,
  isRetryable,
  getRetryDelay,
} from '../../types/offline';
import {
  addToSyncQueue,
  getSyncQueue,
  getPendingSyncItems,
  updateSyncItemStatus,
  removeSyncItem,
  getSyncQueueCount,
} from './offlineDb';
import { logger } from '../../utils/logger';

// ============================================================
// QUEUE OPERATIONS
// ============================================================

/**
 * Add an operation to the sync queue
 */
export async function queueOperation(
  type: SyncOperationType,
  entity: SyncEntity,
  data: any,
  userId: string,
  warehouseId?: string,
  localId?: string
): Promise<SyncQueueItem> {
  const item = createSyncQueueItem(type, entity, data, userId, warehouseId, localId);
  await addToSyncQueue(item);
  logger.debug(`[SyncQueue] Queued operation: ${type} ${item.id}`);
  return item;
}

/**
 * Queue a sale for later synchronization
 */
export async function queueSale(
  saleData: any,
  userId: string,
  warehouseId: string,
  localId?: string
): Promise<SyncQueueItem> {
  return queueOperation('CREATE_SALE', 'sales', saleData, userId, warehouseId, localId);
}

/**
 * Queue a payment for later synchronization
 */
export async function queuePayment(
  paymentData: any,
  saleId: string,
  userId: string
): Promise<SyncQueueItem> {
  return queueOperation('CREATE_PAYMENT', 'payments', { ...paymentData, saleId }, userId);
}

/**
 * Queue a stock update for later synchronization
 */
export async function queueStockUpdate(
  productId: string,
  warehouseId: string,
  delta: number,
  reason: string,
  userId: string
): Promise<SyncQueueItem> {
  return queueOperation(
    'UPDATE_STOCK',
    'products',
    { productId, warehouseId, delta, reason },
    userId,
    warehouseId
  );
}

/**
 * Queue a return for later synchronization
 */
export async function queueReturn(
  returnData: any,
  userId: string,
  warehouseId: string
): Promise<SyncQueueItem> {
  return queueOperation('CREATE_RETURN', 'returns', returnData, userId, warehouseId);
}

/**
 * Queue a transfer for later synchronization
 */
export async function queueTransfer(
  transferData: any,
  userId: string
): Promise<SyncQueueItem> {
  return queueOperation('CREATE_TRANSFER', 'transfers', transferData, userId);
}

// ============================================================
// QUEUE STATUS
// ============================================================

/**
 * Get all pending items that need to be synced
 */
export async function getPendingItems(): Promise<SyncQueueItem[]> {
  return getPendingSyncItems();
}

/**
 * Get items that are ready for retry
 */
export async function getRetryableItems(): Promise<SyncQueueItem[]> {
  const items = await getSyncQueue();
  const now = Date.now();

  return items.filter(item => {
    if (!isRetryable(item)) return false;

    // Check if retry delay has passed
    if (item.sync.nextRetryAt) {
      const retryTime = new Date(item.sync.nextRetryAt).getTime();
      return now >= retryTime;
    }

    return true;
  });
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  pending: number;
  failed: number;
  total: number;
  nextRetryAt: string | null;
}> {
  const counts = await getSyncQueueCount();
  const items = await getSyncQueue();

  // Find next retry time
  let nextRetryAt: string | null = null;
  for (const item of items) {
    if (item.sync.status === 'failed' && item.sync.nextRetryAt) {
      if (!nextRetryAt || item.sync.nextRetryAt < nextRetryAt) {
        nextRetryAt = item.sync.nextRetryAt;
      }
    }
  }

  return {
    ...counts,
    nextRetryAt,
  };
}

// ============================================================
// QUEUE ITEM MANAGEMENT
// ============================================================

/**
 * Mark an item as processing
 */
export async function markAsProcessing(id: string): Promise<void> {
  await updateSyncItemStatus(id, 'processing');
}

/**
 * Mark an item as completed and remove from queue
 */
export async function markAsCompleted(id: string): Promise<void> {
  await updateSyncItemStatus(id, 'completed');
  await removeSyncItem(id);
  logger.debug('[SyncQueue] Item completed and removed:', id);
}

/**
 * Mark an item as failed
 */
export async function markAsFailed(id: string, error: string): Promise<void> {
  await updateSyncItemStatus(id, 'failed', error);
  logger.debug(`[SyncQueue] Item failed: ${id}`, error);
}

/**
 * Mark an item as having a conflict
 */
export async function markAsConflict(id: string, conflictDetails: string): Promise<void> {
  await updateSyncItemStatus(id, 'conflict', conflictDetails);
  logger.debug(`[SyncQueue] Item has conflict: ${id}`, conflictDetails);
}

/**
 * Reset a failed item to pending for immediate retry
 */
export async function resetForRetry(id: string): Promise<void> {
  await updateSyncItemStatus(id, 'pending');
  logger.debug('[SyncQueue] Item reset for retry:', id);
}

/**
 * Remove an item from the queue (manual deletion)
 */
export async function removeFromQueue(id: string): Promise<void> {
  await removeSyncItem(id);
  logger.debug('[SyncQueue] Item manually removed:', id);
}

// ============================================================
// QUEUE PRIORITIZATION
// ============================================================

/**
 * Get items in priority order for processing
 * Priority: CREATE_SALE > CREATE_PAYMENT > UPDATE_STOCK > CREATE_RETURN > CREATE_TRANSFER
 */
export async function getItemsByPriority(): Promise<SyncQueueItem[]> {
  const items = await getPendingItems();

  const priorityOrder: Record<SyncOperationType, number> = {
    'CREATE_SALE': 1,
    'CREATE_PAYMENT': 2,
    'UPDATE_STOCK': 3,
    'CREATE_RETURN': 4,
    'CREATE_TRANSFER': 5,
  };

  return items.sort((a, b) => {
    // First by priority
    const priorityDiff = priorityOrder[a.type] - priorityOrder[b.type];
    if (priorityDiff !== 0) return priorityDiff;

    // Then by timestamp (oldest first)
    return a.metadata.timestamp - b.metadata.timestamp;
  });
}

// ============================================================
// BATCH OPERATIONS
// ============================================================

/**
 * Clear all completed items from queue (cleanup)
 */
export async function clearCompletedItems(): Promise<number> {
  const items = await getSyncQueue();
  const completedItems = items.filter(i => i.sync.status === 'completed');

  for (const item of completedItems) {
    await removeSyncItem(item.id);
  }

  logger.debug(`[SyncQueue] Cleared ${completedItems.length} completed items`);
  return completedItems.length;
}

/**
 * Clear all failed items that have exceeded max retries
 */
export async function clearExhaustedItems(): Promise<number> {
  const items = await getSyncQueue();
  const exhaustedItems = items.filter(
    i => i.sync.status === 'failed' && i.sync.retryCount >= i.sync.maxRetries
  );

  for (const item of exhaustedItems) {
    await removeSyncItem(item.id);
  }

  logger.debug(`[SyncQueue] Cleared ${exhaustedItems.length} exhausted items`);
  return exhaustedItems.length;
}

/**
 * Get a summary of the queue for display
 */
export async function getQueueSummary(): Promise<{
  sales: number;
  payments: number;
  stockUpdates: number;
  returns: number;
  transfers: number;
  totalPending: number;
  totalFailed: number;
}> {
  const items = await getSyncQueue();

  const pending = items.filter(i => i.sync.status === 'pending');
  const failed = items.filter(i => i.sync.status === 'failed');

  return {
    sales: items.filter(i => i.type === 'CREATE_SALE').length,
    payments: items.filter(i => i.type === 'CREATE_PAYMENT').length,
    stockUpdates: items.filter(i => i.type === 'UPDATE_STOCK').length,
    returns: items.filter(i => i.type === 'CREATE_RETURN').length,
    transfers: items.filter(i => i.type === 'CREATE_TRANSFER').length,
    totalPending: pending.length,
    totalFailed: failed.length,
  };
}
