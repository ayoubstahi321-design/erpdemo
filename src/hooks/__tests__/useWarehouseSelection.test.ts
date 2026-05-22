/**
 * Tests for useWarehouseSelection hook
 * Validates warehouse selection logic, persistence, and sync
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWarehouseSelection, useWarehouseSelectionForPOS, useWarehouseSelectionForSales } from '../useWarehouseSelection';
import { User, Warehouse } from '../../types';

// Mock localStorage for jsdom
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'u1',
  email: 'test@test.com',
  name: 'Test User',
  role: 'Sales',
  companyId: 'c1',
  ...overrides,
} as User);

const makeWarehouses = (): Warehouse[] => [
  { id: 'wh1', name: 'Warehouse 1' } as Warehouse,
  { id: 'wh2', name: 'Warehouse 2' } as Warehouse,
  { id: 'wh3', name: 'Warehouse 3' } as Warehouse,
];

describe('useWarehouseSelection', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should default to user assigned warehouse', () => {
    const user = makeUser({ warehouseId: 'wh2' });
    const { result } = renderHook(() =>
      useWarehouseSelection({ currentUser: user, warehouses: makeWarehouses() })
    );

    expect(result.current.selectedWarehouseId).toBe('wh2');
  });

  it('should default to first warehouse when user has no assignment', () => {
    const user = makeUser({ warehouseId: undefined });
    const { result } = renderHook(() =>
      useWarehouseSelection({ currentUser: user, warehouses: makeWarehouses() })
    );

    expect(result.current.selectedWarehouseId).toBe('wh1');
  });

  it('should use localStorage saved value when no user warehouse', () => {
    localStorageMock.setItem('test_wh', 'wh3');
    const user = makeUser({ warehouseId: undefined });
    const { result } = renderHook(() =>
      useWarehouseSelection({
        currentUser: user,
        warehouses: makeWarehouses(),
        localStorageKey: 'test_wh',
      })
    );

    expect(result.current.selectedWarehouseId).toBe('wh3');
  });

  it('should ignore localStorage if saved warehouse no longer exists', () => {
    localStorageMock.setItem('test_wh', 'deleted_wh');
    const user = makeUser({ warehouseId: undefined });
    const { result } = renderHook(() =>
      useWarehouseSelection({
        currentUser: user,
        warehouses: makeWarehouses(),
        localStorageKey: 'test_wh',
      })
    );

    expect(result.current.selectedWarehouseId).toBe('wh1');
  });

  it('should allow manual selection change', () => {
    const user = makeUser({ warehouseId: undefined });
    const { result } = renderHook(() =>
      useWarehouseSelection({ currentUser: user, warehouses: makeWarehouses() })
    );

    act(() => {
      result.current.setSelectedWarehouseId('wh3');
    });

    expect(result.current.selectedWarehouseId).toBe('wh3');
  });

  it('should return empty string when no warehouses', () => {
    const user = makeUser({ warehouseId: undefined });
    const { result } = renderHook(() =>
      useWarehouseSelection({ currentUser: user, warehouses: [] })
    );

    expect(result.current.selectedWarehouseId).toBe('');
  });

  it('should use initialWarehouseId as fallback', () => {
    const user = makeUser({ warehouseId: undefined });
    const { result } = renderHook(() =>
      useWarehouseSelection({
        currentUser: user,
        warehouses: makeWarehouses(),
        initialWarehouseId: 'wh2',
      })
    );

    expect(result.current.selectedWarehouseId).toBe('wh2');
  });
});

describe('useWarehouseSelectionForPOS', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should use pos_warehouse_id localStorage key', () => {
    localStorageMock.setItem('pos_warehouse_id', 'wh2');
    const user = makeUser({ warehouseId: undefined });
    const { result } = renderHook(() =>
      useWarehouseSelectionForPOS(user, makeWarehouses())
    );

    expect(result.current.selectedWarehouseId).toBe('wh2');
  });
});

describe('useWarehouseSelectionForSales', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should not use localStorage persistence', () => {
    localStorageMock.setItem('pos_warehouse_id', 'wh3');
    const user = makeUser({ warehouseId: undefined });
    const { result } = renderHook(() =>
      useWarehouseSelectionForSales(user, makeWarehouses())
    );

    // Should NOT read from localStorage - defaults to first warehouse
    expect(result.current.selectedWarehouseId).toBe('wh1');
  });
});
