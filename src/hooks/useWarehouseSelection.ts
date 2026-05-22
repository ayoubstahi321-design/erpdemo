/**
 * Custom hook for warehouse selection logic
 * Eliminates duplication between POS and Sales components
 */

import { useState, useEffect } from 'react';
import { User, Warehouse } from '../types';

interface UseWarehouseSelectionOptions {
  /**
   * Current authenticated user
   */
  currentUser: User;

  /**
   * Available warehouses
   */
  warehouses: Warehouse[];

  /**
   * LocalStorage key for persisting selection (optional)
   * If provided, the selection will be saved/loaded from localStorage
   */
  localStorageKey?: string;

  /**
   * Initial warehouse ID (optional)
   * Used as fallback if no user warehouse and no saved selection
   */
  initialWarehouseId?: string;

  /**
   * When true, fall back to '' (all warehouses) instead of warehouses[0].
   * Use this for list views where "show all" is the correct default.
   */
  defaultToAll?: boolean;
}

/**
 * Unified warehouse selection hook
 * Handles warehouse initialization, persistence, and synchronization
 */
export function useWarehouseSelection(options: UseWarehouseSelectionOptions) {
  const { currentUser, warehouses, localStorageKey, initialWarehouseId, defaultToAll } = options;

  // Get default warehouse ID
  const getDefaultWarehouseId = (): string => {
    // 1. User's assigned warehouse (highest priority)
    if (currentUser?.warehouseId) {
      return currentUser.warehouseId;
    }

    // 2. Saved selection from localStorage (if enabled)
    if (localStorageKey) {
      const saved = localStorage.getItem(localStorageKey);
      if (saved && warehouses.some(w => w.id === saved)) {
        return saved;
      }
    }

    // 3. Explicit initial value
    if (initialWarehouseId && warehouses.some(w => w.id === initialWarehouseId)) {
      return initialWarehouseId;
    }

    // 4. defaultToAll: return '' so list views show every warehouse by default.
    //    Without this, the first warehouse gets auto-selected and hides sales
    //    from other warehouses (causes "shows briefly then empty" flash).
    if (defaultToAll) {
      return '';
    }

    // 5. First available warehouse (fallback for POS and similar views)
    return warehouses.length > 0 ? warehouses[0].id : '';
  };

  // Initialize selected warehouse
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(getDefaultWarehouseId);

  // Sync with user's assigned warehouse when it changes
  useEffect(() => {
    if (currentUser.warehouseId && selectedWarehouseId !== currentUser.warehouseId) {
      setSelectedWarehouseId(currentUser.warehouseId);
    }
  }, [currentUser.warehouseId, selectedWarehouseId]);

  // Sync with warehouses list (handle case where selected warehouse no longer exists)
  useEffect(() => {
    const defaultId = getDefaultWarehouseId();
    if (defaultId && (!selectedWarehouseId || !warehouses.some(w => w.id === selectedWarehouseId))) {
      setSelectedWarehouseId(defaultId);
    }
  }, [warehouses]);

  // Persist to localStorage when selection changes (if enabled)
  useEffect(() => {
    if (localStorageKey && selectedWarehouseId && !currentUser.warehouseId) {
      localStorage.setItem(localStorageKey, selectedWarehouseId);
    }
  }, [selectedWarehouseId, localStorageKey, currentUser.warehouseId]);

  return {
    selectedWarehouseId,
    setSelectedWarehouseId,
    getDefaultWarehouseId
  };
}

/**
 * Specialized hook for POS component
 * Includes localStorage persistence
 */
export function useWarehouseSelectionForPOS(currentUser: User, warehouses: Warehouse[]) {
  return useWarehouseSelection({
    currentUser,
    warehouses,
    localStorageKey: 'pos_warehouse_id'
  });
}

/**
 * Specialized hook for Sales component (Commandes B2B list).
 * Defaults to '' (all warehouses) — the list should show every warehouse
 * unless the user has a specific warehouse assigned to their profile.
 * No localStorage persistence.
 */
export function useWarehouseSelectionForSales(currentUser: User, warehouses: Warehouse[]) {
  return useWarehouseSelection({
    currentUser,
    warehouses,
    defaultToAll: true,   // don't auto-select first warehouse — show all by default
  });
}
