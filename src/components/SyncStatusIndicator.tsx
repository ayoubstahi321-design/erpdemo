/**
 * Sync Status Indicator Component
 * Shows online/offline status and pending sync count in the header
 */

import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, AlertCircle, Check } from 'lucide-react';
import {
  useNetworkStatus,
  getSyncState,
  onSyncEvent,
  triggerSync,
  getQueueSummary,
  SyncEvent,
} from '../services/offline';
import { FEATURES } from '../config/features';
import { useLanguage } from '../services/i18n';

interface SyncStatusIndicatorProps {
  showDetails?: boolean;
  className?: string;
}

export function SyncStatusIndicator({ showDetails = false, className = '' }: SyncStatusIndicatorProps) {
  const { t } = useLanguage();
  const networkState = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [lastSyncEvent, setLastSyncEvent] = useState<string | null>(null);
  const [queueDetails, setQueueDetails] = useState<{
    sales: number;
    payments: number;
    stockUpdates: number;
    returns: number;
    transfers: number;
  } | null>(null);

  // Don't render if offline mode is disabled
  if (!FEATURES.OFFLINE_MODE) {
    return null;
  }

  useEffect(() => {
    // Subscribe to sync events
    const unsubscribe = onSyncEvent((event: SyncEvent) => {
      switch (event.type) {
        case 'sync_started':
          setIsSyncing(true);
          setLastSyncEvent(t('offline_syncing'));
          break;
        case 'sync_completed':
          setIsSyncing(false);
          setLastSyncEvent(t('offline_synced_items').replace('{count}', String(event.data?.synced || 0)));
          refreshCounts();
          break;
        case 'sync_failed':
          setIsSyncing(false);
          setLastSyncEvent(t('offline_sync_error'));
          break;
        case 'queue_updated':
          setPendingCount(event.data?.pendingCount || 0);
          setFailedCount(event.data?.failedCount || 0);
          break;
        case 'item_synced':
          refreshCounts();
          break;
        case 'item_failed':
          refreshCounts();
          break;
        case 'conflict_detected':
          setLastSyncEvent(t('offline_conflict_detected'));
          break;
        case 'conflict_resolved':
          setLastSyncEvent(t('offline_conflict_resolved'));
          break;
      }
    });

    // Initial load
    refreshCounts();

    return unsubscribe;
  }, []);

  const refreshCounts = async () => {
    try {
      const state = getSyncState();
      setPendingCount(state.pendingCount);
      setFailedCount(state.failedCount);

      const summary = await getQueueSummary();
      setQueueDetails({
        sales: summary.sales,
        payments: summary.payments,
        stockUpdates: summary.stockUpdates,
        returns: summary.returns,
        transfers: summary.transfers,
      });
    } catch (error) {
      console.error('Error refreshing sync counts:', error);
    }
  };

  const handleManualSync = async () => {
    if (isSyncing || !networkState.isOnline) return;
    await triggerSync();
  };

  const totalPending = pendingCount + failedCount;
  const hasIssues = failedCount > 0;

  // Determine status color and icon
  const getStatusColor = () => {
    if (!networkState.isOnline) return 'text-red-500';
    if (isSyncing) return 'text-blue-500';
    if (hasIssues) return 'text-yellow-500';
    if (totalPending > 0) return 'text-orange-500';
    return 'text-green-500';
  };

  const getStatusIcon = () => {
    if (!networkState.isOnline) {
      return <WifiOff className="w-4 h-4" />;
    }
    if (isSyncing) {
      return <RefreshCw className="w-4 h-4 animate-spin" />;
    }
    if (hasIssues) {
      return <AlertCircle className="w-4 h-4" />;
    }
    if (totalPending > 0) {
      return <Cloud className="w-4 h-4" />;
    }
    return <Check className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (!networkState.isOnline) return t('offline_offline');
    if (isSyncing) return t('offline_syncing');
    if (hasIssues) return `${failedCount} ${t('offline_ops_with_error')}`;
    if (totalPending > 0) return `${totalPending} ${t('offline_pending_sync')}`;
    return t('offline_all_synced');
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
          networkState.isOnline
            ? 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
            : 'bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50'
        }`}
        title={getStatusText()}
      >
        <span className={getStatusColor()}>{getStatusIcon()}</span>

        {showDetails && (
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        )}

        {totalPending > 0 && !showDetails && (
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
            hasIssues
              ? 'bg-yellow-500 text-white'
              : 'bg-orange-500 text-white'
          }`}>
            {totalPending}
          </span>
        )}
      </button>

      {/* Dropdown details */}
      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
            <div className="p-4">
              {/* Connection status */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {networkState.isOnline ? (
                    <Wifi className="w-5 h-5 text-green-500" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-red-500" />
                  )}
                  <span className="font-medium">
                    {networkState.isOnline ? t('offline_online') : t('offline_offline')}
                  </span>
                </div>
                {networkState.isOnline && (
                  <button
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? t('offline_syncing') : t('offline_sync_now')}
                  </button>
                )}
              </div>

              {/* Queue summary */}
              {queueDetails && totalPending > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mb-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    {t('offline_pending_ops')}
                  </p>
                  <div className="space-y-1 text-sm">
                    {queueDetails.sales > 0 && (
                      <div className="flex justify-between">
                        <span>{t('offline_sales')}</span>
                        <span className="font-medium">{queueDetails.sales}</span>
                      </div>
                    )}
                    {queueDetails.payments > 0 && (
                      <div className="flex justify-between">
                        <span>{t('offline_payments')}</span>
                        <span className="font-medium">{queueDetails.payments}</span>
                      </div>
                    )}
                    {queueDetails.stockUpdates > 0 && (
                      <div className="flex justify-between">
                        <span>{t('offline_stock_updates')}</span>
                        <span className="font-medium">{queueDetails.stockUpdates}</span>
                      </div>
                    )}
                    {queueDetails.returns > 0 && (
                      <div className="flex justify-between">
                        <span>{t('offline_returns')}</span>
                        <span className="font-medium">{queueDetails.returns}</span>
                      </div>
                    )}
                    {queueDetails.transfers > 0 && (
                      <div className="flex justify-between">
                        <span>{t('offline_transfers')}</span>
                        <span className="font-medium">{queueDetails.transfers}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status message */}
              {lastSyncEvent && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {lastSyncEvent}
                  </p>
                </div>
              )}

              {/* Failed items warning */}
              {failedCount > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                  <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">
                      {failedCount} {t('offline_ops_with_error')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('offline_will_retry')}
                  </p>
                </div>
              )}

              {/* All synced message */}
              {totalPending === 0 && networkState.isOnline && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-500">
                  <Check className="w-4 h-4" />
                  <span className="text-sm">{t('offline_all_synced')}</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default SyncStatusIndicator;
