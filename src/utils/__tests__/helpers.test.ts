/**
 * Tests for helpers.ts - Business utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  calculateItemTotal,
  calculateFromTTC,
  calculateGlobalDiscount,
  generateInvoiceNumber,
  generateAutoSKU,
  calculateTotalStock,
  isProductLowStock,
  getStockInWarehouse,
  sortProducts,
  fuzzySearch
} from '../helpers';

describe('calculateItemTotal', () => {
  it('should calculate total without discount', () => {
    expect(calculateItemTotal(10, 120, 0)).toBe(1200);
  });

  it('should calculate total with percentage discount', () => {
    expect(calculateItemTotal(10, 120, 10, 'percentage')).toBe(1080);
  });

  it('should calculate total with fixed discount', () => {
    expect(calculateItemTotal(10, 120, 200, 'fixed')).toBe(1000);
  });

  it('should not go below 0 with fixed discount', () => {
    expect(calculateItemTotal(1, 100, 500, 'fixed')).toBe(0);
  });

  it('should round to 2 decimal places', () => {
    // 3 * 33.33 = 99.99
    expect(calculateItemTotal(3, 33.33, 0)).toBe(99.99);
  });

  it('should handle fractional quantities', () => {
    expect(calculateItemTotal(2.5, 100, 0)).toBe(250);
  });

  it('should default to percentage discount type', () => {
    expect(calculateItemTotal(10, 100, 10)).toBe(900);
  });

  it('should handle 100% discount', () => {
    expect(calculateItemTotal(10, 100, 100, 'percentage')).toBe(0);
  });
});

describe('calculateFromTTC', () => {
  it('should break down TTC into HT and TVA with 20%', () => {
    const result = calculateFromTTC(120, 0.20);
    expect(result.ht).toBe(100);
    expect(result.tva).toBe(20);
    expect(result.ttc).toBe(120);
  });

  it('should use 20% TVA by default', () => {
    const result = calculateFromTTC(120);
    expect(result.ht).toBe(100);
  });

  it('should handle 0% TVA', () => {
    const result = calculateFromTTC(100, 0);
    expect(result.ht).toBe(100);
    expect(result.tva).toBe(0);
  });
});

describe('calculateGlobalDiscount', () => {
  it('should calculate percentage global discount', () => {
    expect(calculateGlobalDiscount(1000, 'percentage', 10)).toBe(100);
  });

  it('should calculate fixed global discount', () => {
    expect(calculateGlobalDiscount(1000, 'fixed', 200)).toBe(200);
  });

  it('should cap fixed discount at subtotal', () => {
    expect(calculateGlobalDiscount(100, 'fixed', 500)).toBe(100);
  });

  it('should return 0 for no discount', () => {
    expect(calculateGlobalDiscount(1000, undefined, undefined)).toBe(0);
    expect(calculateGlobalDiscount(1000, 'percentage', 0)).toBe(0);
  });
});

describe('generateInvoiceNumber', () => {
  it('should generate FAC-YYYY-00001 for first invoice', () => {
    const year = new Date().getFullYear();
    const result = generateInvoiceNumber([]);
    expect(result).toBe(`FAC-${year}-00001`);
  });

  it('should increment from highest existing number', () => {
    const year = new Date().getFullYear();
    const existing = [
      { invoiceNumber: `FAC-${year}-00003` },
      { invoiceNumber: `FAC-${year}-00001` },
    ];
    const result = generateInvoiceNumber(existing);
    expect(result).toBe(`FAC-${year}-00004`);
  });

  it('should ignore invoices from other years', () => {
    const year = new Date().getFullYear();
    const existing = [
      { invoiceNumber: `FAC-2020-00099` },
    ];
    const result = generateInvoiceNumber(existing);
    expect(result).toBe(`FAC-${year}-00001`);
  });

  it('should ignore sales without invoice numbers', () => {
    const year = new Date().getFullYear();
    const existing = [
      { invoiceNumber: null },
      { invoiceNumber: undefined },
      {},
    ];
    const result = generateInvoiceNumber(existing);
    expect(result).toBe(`FAC-${year}-00001`);
  });
});

describe('generateAutoSKU', () => {
  it('should generate AZM-HM-00001 for first Huile Moteur product', () => {
    expect(generateAutoSKU('Huile Moteur', [])).toBe('AZM-HM-00001');
  });

  it('should increment from highest existing SKU', () => {
    const existing = [
      { sku: 'AZM-HM-00003' } as any,
      { sku: 'AZM-HM-00001' } as any,
    ];
    expect(generateAutoSKU('Huile Moteur', existing)).toBe('AZM-HM-00004');
  });

  it('should use GN for unknown category', () => {
    expect(generateAutoSKU('Unknown', [])).toBe('AZM-GN-00001');
  });
});

describe('Stock utilities', () => {
  const product = {
    stockLevels: { 'wh1': 10, 'wh2': 20, 'wh3': 0 },
    minStock: 25,
  } as any;

  describe('calculateTotalStock', () => {
    it('should sum all warehouse levels', () => {
      expect(calculateTotalStock(product)).toBe(30);
    });

    it('should return 0 for no stock levels', () => {
      expect(calculateTotalStock({} as any)).toBe(0);
    });
  });

  describe('isProductLowStock', () => {
    it('should return true when stock <= minStock', () => {
      expect(isProductLowStock({ stockLevels: { w: 5 }, minStock: 10 } as any)).toBe(true);
    });

    it('should return false when stock > minStock', () => {
      expect(isProductLowStock(product)).toBe(false);
    });

    it('should treat no minStock as 0', () => {
      expect(isProductLowStock({ stockLevels: { w: 1 } } as any)).toBe(false);
    });
  });

  describe('getStockInWarehouse', () => {
    it('should return stock for existing warehouse', () => {
      expect(getStockInWarehouse(product, 'wh1')).toBe(10);
    });

    it('should return 0 for unknown warehouse', () => {
      expect(getStockInWarehouse(product, 'unknown')).toBe(0);
    });
  });
});

describe('sortProducts', () => {
  it('should sort by name, then packSize, then SKU', () => {
    const products = [
      { name: 'Oil B', packSize: 4, sku: '002' },
      { name: 'Oil A', packSize: 20, sku: '003' },
      { name: 'Oil A', packSize: 1, sku: '001' },
    ] as any[];

    const sorted = sortProducts(products);
    expect(sorted[0].sku).toBe('001'); // Oil A, 1L
    expect(sorted[1].sku).toBe('003'); // Oil A, 20L
    expect(sorted[2].sku).toBe('002'); // Oil B
  });
});
