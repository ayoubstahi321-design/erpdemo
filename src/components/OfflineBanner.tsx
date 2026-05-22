/**
 * Offline Banner Component
 * Shows a prominent banner when the app is offline
 */

import { useState, useEffect } from 'react';
import { WifiOff, X, RefreshCw, CloudOff } from 'lucide-react';
import {
  useNetworkStatus,
  checkConnection,
  getSyncState,
  onSyncEvent,
} from '../services/offline';
import { FEATURES } from '../config/features';
import { useLanguage } from '../services/i18n';

interface OfflineBannerProps {
  dismissible?: boolean;
  position?: 'top' | 'bottom';
  className?: string;
}

export function OfflineBanner({
  dismissible = true,
  position = 'top',
  className = '',
}: OfflineBannerProps) {
  const { t } = useLanguage();
  const networkState = useNetworkStatus();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Don't render if offline mode is disabled
  if (!FEATURES.OFFLINE_MODE) {
    return null;
  }

  useEffect(() => {
    // Reset dismissed state when connection is restored
    if (networkState.isOnline) {
      setIsDismissed(false);
    }

    // Get initial pending count
    const state = getSyncState();
    setPendingCount(state.pendingCount + state.failedCount);

    // Subscribe to sync events
    const unsubscribe = onSyncEvent((event) => {
      if (event.type === 'queue_updated') {
        setPendingCount((event.data?.pendingCount || 0) + (event.data?.failedCount || 0));
      }
    });

    return unsubscribe;
  }, [networkState.isOnline]);

  const handleRetryConnection = async () => {
    setIsChecking(true);
    try {
      await checkConnection();
    } finally {
      setIsChecking(false);
    }
  };

  // Don't show if online or dismissed
  if (networkState.isOnline || isDismissed) {
    return null;
  }

  const positionClasses = position === 'top'
    ? 'top-0 left-0 right-0'
    : 'bottom-0 left-0 right-0';

  return (
    <div
      className={`fixed ${positionClasses} z-50 ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="bg-yellow-500 text-yellow-900 px-4 py-3 shadow-lg">
        <div className="container mx-auto flex items-center justify-between gap-4">
          {/* Icon and message */}
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <WifiOff className="w-5 h-5" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="font-medium">
                {t('offline_no_connection')}
              </span>
              <span className="text-sm text-yellow-800">
                {pendingCount > 0 ? (
                  <>
                    <CloudOff className="w-4 h-4 inline mr-1" />
                    {pendingCount} {t('offline_pending_sync')}
                  </>
                ) : (
                  t('offline_changes_saved')
                )}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRetryConnection}
              disabled={isChecking}
              className="flex items-center gap-1 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {isChecking ? t('offline_checking') : t('offline_retry')}
              </span>
            </button>

            {dismissible && (
              <button
                onClick={() => setIsDismissed(true)}
                className="p-1.5 hover:bg-yellow-600 rounded-md transition-colors"
                aria-label={t('cancel')}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact offline indicator for inline use
 */
export function OfflineIndicator({ className = '' }: { className?: string }) {
  const { t } = useLanguage();
  const networkState = useNetworkStatus();

  if (!FEATURES.OFFLINE_MODE || networkState.isOnline) {
    return null;
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-md text-sm ${className}`}
    >
      <WifiOff className="w-3.5 h-3.5" />
      <span>{t('offline_offline')}</span>
    </div>
  );
}

export default OfflineBanner;
