/**
 * Tests for useInvoiceCalculation hook
 * Ensures financial calculations are correct across POS and Sales
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInvoiceCalculation, useInvoiceCalculationForPOS, useInvoiceCalculationForSales } from '../useInvoiceCalculation';
import { SaleItem } from '../../types';

const makeItem = (overrides: Partial<SaleItem> = {}): SaleItem => ({
  productId: 'p1',
  productName: 'Test Product',
  quantity: 1,
  unitPrice: 120,
  discount: 0,
  discountType: 'percentage',
  total: 120,
  isGift: false,
  sellMode: 'unit',
  unitsPerBox: 1,
  ...overrides,
});

describe('useInvoiceCalculation', () => {
  it('should return zeros for empty items', () => {
    const { result } = renderHook(() => useInvoiceCalculation([]));
    expect(result.current.totalTTC).toBe(0);
    expect(result.current.totalHT).toBe(0);
    expect(result.current.totalTVA).toBe(0);
    expect(result.current.itemsSubtotal).toBe(0);
  });

  it('should calculate single item correctly (120 TTC = 100 HT + 20 TVA)', () => {
    const items = [makeItem({ quantity: 1, unitPrice: 120, total: 120 })];
    const { result } = renderHook(() => useInvoiceCalculation(items));

    expect(result.current.itemsSubtotal).toBe(120);
    expect(result.current.totalTTC).toBe(120);
    expect(result.current.totalHT).toBe(100);
    expect(result.current.totalTVA).toBe(20);
  });

  it('should calculate multiple items', () => {
    const items = [
      makeItem({ quantity: 10, unitPrice: 120, total: 1200 }),
      makeItem({ productId: 'p2', quantity: 5, unitPrice: 60, total: 300 }),
    ];
    const { result } = renderHook(() => useInvoiceCalculation(items));

    expect(result.current.itemsSubtotal).toBe(1500);
    expect(result.current.totalTTC).toBe(1500);
    expect(result.current.totalHT).toBe(1250);
    expect(result.current.totalTVA).toBe(250);
  });

  it('should apply percentage global discount', () => {
    const items = [makeItem({ quantity: 10, unitPrice: 120, total: 1200 })];
    const { result } = renderHook(() =>
      useInvoiceCalculation(items, 'percentage', 10)
    );

    expect(result.current.itemsSubtotal).toBe(1200);
    expect(result.current.globalDiscountAmount).toBe(120);
    expect(result.current.totalTTC).toBe(1080);
  });

  it('should apply fixed global discount', () => {
    const items = [makeItem({ quantity: 10, unitPrice: 120, total: 1200 })];
    const { result } = renderHook(() =>
      useInvoiceCalculation(items, 'fixed', 200)
    );

    expect(result.current.globalDiscountAmount).toBe(200);
    expect(result.current.totalTTC).toBe(1000);
  });

  it('should ignore global discount when value is 0', () => {
    const items = [makeItem({ quantity: 10, unitPrice: 120, total: 1200 })];
    const { result } = renderHook(() =>
      useInvoiceCalculation(items, 'percentage', 0)
    );

    expect(result.current.globalDiscountAmount).toBe(0);
    expect(result.current.totalTTC).toBe(1200);
  });

  it('should ensure HT + TVA = TTC', () => {
    const items = [
      makeItem({ quantity: 7, unitPrice: 2499.99, discount: 3, total: 16974.93 }),
      makeItem({ productId: 'p2', quantity: 12, unitPrice: 150.5, discount: 5, total: 1715.7 }),
    ];
    const { result } = renderHook(() =>
      useInvoiceCalculation(items, 'percentage', 5)
    );

    const { totalHT, totalTVA, totalTTC } = result.current;
    expect(totalHT + totalTVA).toBeCloseTo(totalTTC, 1);
  });

  it('should handle gift items (total = 0)', () => {
    const items = [
      makeItem({ quantity: 5, unitPrice: 120, total: 600 }),
      makeItem({ productId: 'p2', quantity: 1, unitPrice: 120, total: 0, isGift: true }),
    ];
    const { result } = renderHook(() => useInvoiceCalculation(items));

    expect(result.current.itemsSubtotal).toBe(600);
    expect(result.current.totalTTC).toBe(600);
  });
});

describe('useInvoiceCalculationForPOS', () => {
  it('should return POS-specific field names', () => {
    const items = [makeItem({ quantity: 10, unitPrice: 120, total: 1200 })];
    const { result } = renderHook(() =>
      useInvoiceCalculationForPOS(items, 'percentage', 10)
    );

    expect(result.current).toHaveProperty('itemsSubtotal');
    expect(result.current).toHaveProperty('globalDiscountAmount');
    expect(result.current).toHaveProperty('subtotal'); // HT
    expect(result.current).toHaveProperty('taxAmount'); // TVA
    expect(result.current).toHaveProperty('totalTTC');

    expect(result.current.totalTTC).toBe(1080);
    expect(result.current.globalDiscountAmount).toBe(120);
  });
});

describe('useInvoiceCalculationForSales', () => {
  it('should return Sales-specific field names', () => {
    const items = [makeItem({ quantity: 10, unitPrice: 120, total: 1200 })];
    const { result } = renderHook(() =>
      useInvoiceCalculationForSales(items, 'percentage', 10)
    );

    expect(result.current).toHaveProperty('itemsSubtotal');
    expect(result.current).toHaveProperty('globalDiscountAmount');
    expect(result.current).toHaveProperty('subtotal'); // HT
    expect(result.current).toHaveProperty('tax'); // TVA
    expect(result.current).toHaveProperty('total'); // TTC

    expect(result.current.total).toBe(1080);
    expect(result.current.globalDiscountAmount).toBe(120);
  });
});
