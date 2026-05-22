/**
 * Network Status Detection Service
 * Provides real-time network connectivity status with Supabase health checks
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { NetworkState } from '../../types/offline';
import { logger } from '../../utils/logger';

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
  // How often to check connection when online (ms)
  ONLINE_CHECK_INTERVAL: 30000,
  // How often to retry when offline (ms)
  OFFLINE_CHECK_INTERVAL: 5000,
  // Timeout for health check requests (ms)
  HEALTH_CHECK_TIMEOUT: 5000,
  // Debounce time for status changes (ms)
  DEBOUNCE_MS: 1000,
};

// ============================================================
// NETWORK STATUS SERVICE (Singleton)
// ============================================================

type NetworkStatusListener = (isOnline: boolean) => void;

class NetworkStatusService {
  private _isOnline: boolean = navigator.onLine;
  private _isChecking: boolean = false;
  private _lastCheckAt: string | null = null;
  private listeners: Set<NetworkStatusListener> = new Set();
  private checkInterval: NodeJS.Timeout | null = null;
  private debounceTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.setupEventListeners();
  }

  get isOnline(): boolean {
    return this._isOnline;
  }

  get isChecking(): boolean {
    return this._isChecking;
  }

  get lastCheckAt(): string | null {
    return this._lastCheckAt;
  }

  private setupEventListeners(): void {
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));

    // Initial check
    this.checkConnection();
  }

  private handleNetworkChange(online: boolean): void {
    // Debounce rapid changes
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = setTimeout(() => {
      if (online) {
        // When browser reports online, verify with actual request
        this.checkConnection();
      } else {
        this.setOnlineStatus(false);
      }
    }, CONFIG.DEBOUNCE_MS);
  }

  private setOnlineStatus(online: boolean): void {
    const wasOnline = this._isOnline;
    this._isOnline = online;

    if (wasOnline !== online) {
      logger.debug('[NetworkStatus] Status changed:', online ? 'ONLINE' : 'OFFLINE');
      this.notifyListeners(online);
    }

    // Adjust check interval based on status
    this.updateCheckInterval();
  }

  private notifyListeners(isOnline: boolean): void {
    this.listeners.forEach(listener => {
      try {
        listener(isOnline);
      } catch (error) {
        logger.error('[NetworkStatus] Listener error:', error);
      }
    });
  }

  private updateCheckInterval(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    const interval = this._isOnline
      ? CONFIG.ONLINE_CHECK_INTERVAL
      : CONFIG.OFFLINE_CHECK_INTERVAL;

    this.checkInterval = setInterval(() => {
      this.checkConnection();
    }, interval);
  }

  async checkConnection(): Promise<boolean> {
    if (this._isChecking) {
      return this._isOnline;
    }

    this._isChecking = true;
    this._lastCheckAt = new Date().toISOString();

    try {
      // First check browser's online status
      if (!navigator.onLine) {
        this.setOnlineStatus(false);
        return false;
      }

      // Then verify with an actual request
      const isReachable = await this.pingServer();
      this.setOnlineStatus(isReachable);
      return isReachable;
    } catch (error) {
      logger.debug('[NetworkStatus] Check failed:', error);
      this.setOnlineStatus(false);
      return false;
    } finally {
      this._isChecking = false;
    }
  }

  private async pingServer(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.HEALTH_CHECK_TIMEOUT);

      // Try to fetch a small resource - use Supabase URL if available
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      if (supabaseUrl) {
        // Ping Supabase health endpoint
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'HEAD',
          signal: controller.signal,
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          },
        });
        clearTimeout(timeoutId);
        // Any HTTP response (even 4xx) means the server is reachable.
        // 401 = needs auth (normal for anon ping), 400 = no table specified — both are "online".
        // Only treat as offline if the request itself fails (network error / AbortError).
        return response.status < 600;
      } else {
        // Fallback: try to fetch our own origin
        const response = await fetch(window.location.origin, {
          method: 'HEAD',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response.ok;
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        logger.debug('[NetworkStatus] Health check timed out');
      }
      return false;
    }
  }

  subscribe(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);
    // Immediately notify of current status
    listener(this._isOnline);

    return () => {
      this.listeners.delete(listener);
    };
  }

  // Force a check (useful after failed operations)
  forceCheck(): Promise<boolean> {
    return this.checkConnection();
  }

  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    this.listeners.clear();
    window.removeEventListener('online', () => this.handleNetworkChange(true));
    window.removeEventListener('offline', () => this.handleNetworkChange(false));
  }
}

// Singleton instance
let networkStatusService: NetworkStatusService | null = null;

export function getNetworkStatusService(): NetworkStatusService {
  if (!networkStatusService) {
    networkStatusService = new NetworkStatusService();
  }
  return networkStatusService;
}

// ============================================================
// REACT HOOK
// ============================================================

export function useNetworkStatus(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    isOnline: navigator.onLine,
    isChecking: false,
    lastCheckAt: null,
  });

  const serviceRef = useRef<NetworkStatusService | null>(null);

  useEffect(() => {
    serviceRef.current = getNetworkStatusService();

    const unsubscribe = serviceRef.current.subscribe((isOnline) => {
      setState({
        isOnline,
        isChecking: serviceRef.current?.isChecking ?? false,
        lastCheckAt: serviceRef.current?.lastCheckAt ?? null,
      });
    });

    // Update state with initial values
    setState({
      isOnline: serviceRef.current.isOnline,
      isChecking: serviceRef.current.isChecking,
      lastCheckAt: serviceRef.current.lastCheckAt,
    });

    return unsubscribe;
  }, []);

  return state;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Check if currently online (synchronous, cached value)
 */
export function isOnline(): boolean {
  return getNetworkStatusService().isOnline;
}

/**
 * Force a connection check and return result
 */
export async function checkConnection(): Promise<boolean> {
  return getNetworkStatusService().forceCheck();
}

/**
 * Subscribe to network status changes
 */
export function onNetworkStatusChange(listener: NetworkStatusListener): () => void {
  return getNetworkStatusService().subscribe(listener);
}

/**
 * Get connection quality indicator (if available)
 */
export function getConnectionType(): string {
  const connection = (navigator as any).connection;
  if (connection) {
    return connection.effectiveType || 'unknown';
  }
  return 'unknown';
}
