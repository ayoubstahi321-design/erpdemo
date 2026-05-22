/**
 * Tests para pricing.ts - Sistema de precios y TVA
 *
 * Casos de prueba críticos para facturación:
 * - Conversiones TTC ↔ HT
 * - Cálculos de TVA
 * - Redondeo de precios
 * - Descuentos individuales y globales
 * - Cálculo de líneas de venta
 * - Cálculo de facturas completas
 * - Edge cases y validaciones
 */

import { describe, it, expect } from 'vitest';
import {
  TVA_RATES,
  roundTo,
  roundUp,
  roundDown,
  calculateHT,
  calculateTVA,
  calculateTTC,
  breakdownPrice,
  applyDiscount,
  calculateDiscountAmount,
  calculateSaleLine,
  calculateInvoice,
  getProductTaxRate,
  calculateProductMargin,
  suggestPriceTTC,
  formatCurrency,
  formatTaxRate
} from '../pricing';

describe('pricing.ts - Funciones de Redondeo', () => {
  describe('roundTo', () => {
    it('debe redondear correctamente a 2 decimales (default)', () => {
      expect(roundTo(10.125)).toBe(10.13);
      expect(roundTo(10.124)).toBe(10.12);
      expect(roundTo(10.5)).toBe(10.5);
    });

    it('debe redondear a 4 decimales cuando se especifica', () => {
      expect(roundTo(10.12345, 4)).toBe(10.1235);
      expect(roundTo(10.12344, 4)).toBe(10.1234);
    });

    it('debe manejar números enteros', () => {
      expect(roundTo(10)).toBe(10);
      expect(roundTo(0)).toBe(0);
    });

    it('debe manejar redondeo del 0.5 hacia arriba (matemático)', () => {
      expect(roundTo(10.125, 2)).toBe(10.13);
      expect(roundTo(10.135, 2)).toBe(10.14);
    });
  });

  describe('roundUp', () => {
    it('debe redondear siempre hacia arriba', () => {
      expect(roundUp(10.121)).toBe(10.13);
      expect(roundUp(10.129)).toBe(10.13);
      expect(roundUp(10.1)).toBe(10.1);
    });
  });

  describe('roundDown', () => {
    it('debe redondear siempre hacia abajo', () => {
      expect(roundDown(10.129)).toBe(10.12);
      expect(roundDown(10.121)).toBe(10.12);
      expect(roundDown(10.1)).toBe(10.1);
    });
  });
});

describe('pricing.ts - Conversiones TTC ↔ HT', () => {
  describe('calculateHT', () => {
    it('debe calcular HT correctamente con TVA 20%', () => {
      expect(calculateHT(120, 0.20)).toBe(100);
      expect(calculateHT(60, 0.20)).toBe(50);
    });

    it('debe calcular HT correctamente con TVA 14%', () => {
      expect(calculateHT(114, 0.14)).toBe(100);
    });

    it('debe calcular HT correctamente con TVA 7%', () => {
      expect(calculateHT(107, 0.07)).toBe(100);
    });

    it('debe calcular HT cuando TVA es 0% (exento)', () => {
      expect(calculateHT(100, 0)).toBe(100);
    });

    it('debe lanzar error si tasa de TVA es inválida', () => {
      expect(() => calculateHT(100, -0.1)).toThrow();
      expect(() => calculateHT(100, 1.5)).toThrow();
    });

    it('debe manejar casos reales de Azmol', () => {
      // Caso real: Producto a 2400 DH TTC con TVA 20%
      expect(calculateHT(2400, 0.20)).toBe(2000);

      // Caso real: Producto a 1140 DH TTC con TVA 14%
      expect(calculateHT(1140, 0.14)).toBe(1000);
    });
  });

  describe('calculateTVA', () => {
    it('debe calcular monto de TVA correctamente', () => {
      expect(calculateTVA(120, 0.20)).toBe(20);
      expect(calculateTVA(114, 0.14)).toBe(14);
      expect(calculateTVA(107, 0.07)).toBe(7);
    });

    it('debe retornar 0 cuando no hay TVA', () => {
      expect(calculateTVA(100, 0)).toBe(0);
    });

    it('debe manejar redondeo correctamente', () => {
      // 150 TTC con 20% TVA -> HT = 125, TVA = 25
      expect(calculateTVA(150, 0.20)).toBe(25);
    });
  });

  describe('calculateTTC', () => {
    it('debe calcular TTC correctamente desde HT', () => {
      expect(calculateTTC(100, 0.20)).toBe(120);
      expect(calculateTTC(100, 0.14)).toBe(114);
      expect(calculateTTC(100, 0.07)).toBe(107);
    });

    it('debe ser inverso de calculateHT', () => {
      const ht = 100;
      const taxRate = 0.20;
      const ttc = calculateTTC(ht, taxRate);
      expect(calculateHT(ttc, taxRate)).toBe(ht);
    });

    it('debe lanzar error si tasa de TVA es inválida', () => {
      expect(() => calculateTTC(100, -0.1)).toThrow();
      expect(() => calculateTTC(100, 1.5)).toThrow();
    });
  });

  describe('breakdownPrice', () => {
    it('debe desglosar precio completo correctamente', () => {
      const breakdown = breakdownPrice(120, 0.20);

      expect(breakdown.ttc).toBe(120);
      expect(breakdown.ht).toBe(100);
      expect(breakdown.tva).toBe(20);
      expect(breakdown.taxRate).toBe(0.20);
    });

    it('debe verificar que HT + TVA = TTC', () => {
      const breakdown = breakdownPrice(150, 0.20);

      expect(breakdown.ht + breakdown.tva).toBeCloseTo(breakdown.ttc, 2);
    });
  });
});

describe('pricing.ts - Descuentos', () => {
  describe('applyDiscount', () => {
    it('debe aplicar descuento porcentual correctamente', () => {
      expect(applyDiscount(100, 10)).toBe(90);   // 10% de descuento
      expect(applyDiscount(100, 20)).toBe(80);   // 20% de descuento
      expect(applyDiscount(100, 50)).toBe(50);   // 50% de descuento
    });

    it('debe manejar 0% y 100% de descuento', () => {
      expect(applyDiscount(100, 0)).toBe(100);
      expect(applyDiscount(100, 100)).toBe(0);
    });

    it('debe clampar descuento a rango válido [0-100]', () => {
      // Negative discount clamped to 0% => returns original price
      expect(applyDiscount(100, -10)).toBe(100);
      // Over 100% clamped to 100% => returns 0
      expect(applyDiscount(100, 150)).toBe(0);
    });
  });

  describe('calculateDiscountAmount', () => {
    it('debe calcular monto de descuento correctamente', () => {
      expect(calculateDiscountAmount(100, 10)).toBe(10);
      expect(calculateDiscountAmount(100, 25)).toBe(25);
    });

    it('debe redondear correctamente', () => {
      // 15% de 99.99
      expect(calculateDiscountAmount(99.99, 15)).toBeCloseTo(15, 1);
    });
  });
});

describe('pricing.ts - Cálculos de Línea de Venta', () => {
  describe('calculateSaleLine', () => {
    it('debe calcular línea de venta sin descuento', () => {
      const line = calculateSaleLine(10, 120, 0, 0.20);

      expect(line.quantity).toBe(10);
      expect(line.unitPriceTTC).toBe(120);
      expect(line.unitPriceHT).toBe(100);
      expect(line.subtotalTTC).toBe(1200);
      expect(line.discountAmount).toBe(0);
      expect(line.subtotalAfterDiscount).toBe(1200);
      expect(line.ttc).toBe(1200);
      expect(line.ht).toBe(1000);
      expect(line.tva).toBe(200);
    });

    it('debe calcular línea de venta con descuento 10%', () => {
      const line = calculateSaleLine(10, 120, 10, 0.20);

      expect(line.subtotalTTC).toBe(1200);
      expect(line.discountAmount).toBe(120);  // 10% de 1200
      expect(line.subtotalAfterDiscount).toBe(1080);
      expect(line.ttc).toBe(1080);
      expect(line.ht).toBe(900);
      expect(line.tva).toBe(180);
    });

    it('debe manejar cantidad fraccionaria', () => {
      const line = calculateSaleLine(2.5, 100, 0, 0.20);

      expect(line.subtotalTTC).toBe(250);
      expect(line.ht).toBeCloseTo(208.33, 2);
    });

    it('debe usar TVA_RATES.STANDARD por defecto', () => {
      const line = calculateSaleLine(1, 120);

      expect(line.taxRate).toBe(TVA_RATES.STANDARD);
    });
  });
});

describe('pricing.ts - Cálculo de Factura Completa', () => {
  describe('calculateInvoice - Sin descuento global', () => {
    it('debe calcular factura con una línea', () => {
      const line = calculateSaleLine(10, 120, 0, 0.20);
      const invoice = calculateInvoice([line]);

      expect(invoice.itemsSubtotal).toBe(1200);
      expect(invoice.globalDiscountAmount).toBe(0);
      expect(invoice.subtotalAfterGlobalDiscount).toBe(1200);
      expect(invoice.totalHT).toBe(1000);
      expect(invoice.totalTVA).toBe(200);
      expect(invoice.totalTTC).toBe(1200);
    });

    it('debe calcular factura con múltiples líneas', () => {
      const line1 = calculateSaleLine(10, 120, 0, 0.20);  // 1200 TTC
      const line2 = calculateSaleLine(5, 60, 0, 0.20);     // 300 TTC

      const invoice = calculateInvoice([line1, line2]);

      expect(invoice.itemsSubtotal).toBe(1500);
      expect(invoice.totalHT).toBe(1250);
      expect(invoice.totalTVA).toBe(250);
      expect(invoice.totalTTC).toBe(1500);
    });

    it('debe agrupar TVA por tasa', () => {
      const line1 = calculateSaleLine(10, 120, 0, 0.20);  // TVA 20%
      const line2 = calculateSaleLine(5, 114, 0, 0.14);   // TVA 14%

      const invoice = calculateInvoice([line1, line2]);

      expect(invoice.tvaBreakdown).toHaveLength(2);

      const tva20 = invoice.tvaBreakdown.find(t => t.taxRate === 0.20);
      const tva14 = invoice.tvaBreakdown.find(t => t.taxRate === 0.14);

      expect(tva20).toBeDefined();
      expect(tva20!.tva).toBe(200);

      expect(tva14).toBeDefined();
      expect(tva14!.tva).toBe(70);
    });
  });

  describe('calculateInvoice - Con descuento global porcentual', () => {
    it('debe aplicar descuento global del 10%', () => {
      const line = calculateSaleLine(10, 120, 0, 0.20);
      const invoice = calculateInvoice([line], 'percentage', 10);

      expect(invoice.itemsSubtotal).toBe(1200);
      expect(invoice.globalDiscountAmount).toBe(120);
      expect(invoice.subtotalAfterGlobalDiscount).toBe(1080);
      expect(invoice.totalTTC).toBe(1080);
    });

    it('debe aplicar descuento global proporcionalmente a múltiples líneas', () => {
      const line1 = calculateSaleLine(10, 120, 0, 0.20);  // 1200 TTC
      const line2 = calculateSaleLine(5, 60, 0, 0.20);     // 300 TTC

      // Total: 1500, descuento 10% = 150
      const invoice = calculateInvoice([line1, line2], 'percentage', 10);

      expect(invoice.itemsSubtotal).toBe(1500);
      expect(invoice.globalDiscountAmount).toBe(150);
      expect(invoice.subtotalAfterGlobalDiscount).toBe(1350);
    });
  });

  describe('calculateInvoice - Con descuento global fijo', () => {
    it('debe aplicar descuento global fijo', () => {
      const line = calculateSaleLine(10, 120, 0, 0.20);
      const invoice = calculateInvoice([line], 'fixed', 200);

      expect(invoice.itemsSubtotal).toBe(1200);
      expect(invoice.globalDiscountAmount).toBe(200);
      expect(invoice.subtotalAfterGlobalDiscount).toBe(1000);
    });

    it('no debe permitir descuento fijo mayor que el subtotal', () => {
      const line = calculateSaleLine(10, 120, 0, 0.20);
      const invoice = calculateInvoice([line], 'fixed', 5000);

      // Descuento debe estar limitado al subtotal
      expect(invoice.globalDiscountAmount).toBe(1200);
      expect(invoice.subtotalAfterGlobalDiscount).toBe(0);
    });
  });

  describe('calculateInvoice - Escenarios reales de Azmol', () => {
    it('debe calcular factura real: 3 productos con descuento global', () => {
      // Producto 1: 10x 2400 DH = 24000 DH
      const line1 = calculateSaleLine(10, 2400, 0, 0.20);

      // Producto 2: 5x 1140 DH con 5% desc = 5415 DH
      const line2 = calculateSaleLine(5, 1140, 5, 0.14);

      // Producto 3: 20x 120 DH = 2400 DH
      const line3 = calculateSaleLine(20, 120, 0, 0.20);

      // Descuento global del 2%
      const invoice = calculateInvoice([line1, line2, line3], 'percentage', 2);

      const expectedSubtotal = 24000 + 5415 + 2400;
      expect(invoice.itemsSubtotal).toBe(expectedSubtotal);

      const expectedDiscount = expectedSubtotal * 0.02;
      expect(invoice.globalDiscountAmount).toBeCloseTo(expectedDiscount, 2);

      // Verificar coherencia: HT + TVA = TTC
      expect(invoice.totalHT + invoice.totalTVA).toBeCloseTo(invoice.totalTTC, 2);
    });
  });
});

describe('pricing.ts - Utilidades para Productos', () => {
  describe('getProductTaxRate', () => {
    it('debe usar customTaxRate del producto si existe', () => {
      const product = { customTaxRate: 0.14 } as any;
      expect(getProductTaxRate(product)).toBe(0.14);
    });

    it('debe usar defaultTaxRate de settings si no hay customTaxRate', () => {
      const product = {} as any;
      const settings = { defaultTaxRate: 0.10 } as any;
      expect(getProductTaxRate(product, settings)).toBe(0.10);
    });

    it('debe usar TVA_RATES.STANDARD como fallback', () => {
      const product = {} as any;
      expect(getProductTaxRate(product)).toBe(TVA_RATES.STANDARD);
    });
  });

  describe('calculateProductMargin', () => {
    it('debe calcular margen correctamente', () => {
      const product = { price: 120, cost: 50 } as any;
      // HT = 100 (120 TTC con 20% TVA)
      // Margen = (100 - 50) / 50 * 100 = 100%
      expect(calculateProductMargin(product, 0.20)).toBe(100);
    });

    it('debe retornar 0 si costo es 0', () => {
      const product = { price: 120, cost: 0 } as any;
      expect(calculateProductMargin(product, 0.20)).toBe(0);
    });
  });

  describe('suggestPriceTTC', () => {
    it('debe sugerir precio TTC con margen del 100%', () => {
      // Costo 50, margen 100% = 100 HT, + 20% TVA = 120 TTC
      expect(suggestPriceTTC(50, 100, 0.20)).toBe(120);
    });

    it('debe sugerir precio TTC con margen del 50%', () => {
      // Costo 100, margen 50% = 150 HT, + 20% TVA = 180 TTC
      expect(suggestPriceTTC(100, 50, 0.20)).toBe(180);
    });
  });
});

describe('pricing.ts - Formateo', () => {
  describe('formatCurrency', () => {
    it('debe formatear moneda con símbolo DH', () => {
      expect(formatCurrency(1200.5)).toBe('1200.50 DH');
      expect(formatCurrency(99.99)).toBe('99.99 DH');
    });

    it('debe formatear sin símbolo si se especifica', () => {
      expect(formatCurrency(1200.5, false)).toBe('1200.50');
    });

    it('debe redondear a 2 decimales', () => {
      expect(formatCurrency(1200.126)).toBe('1200.13 DH');
    });
  });

  describe('formatTaxRate', () => {
    it('debe formatear tasa de TVA como porcentaje', () => {
      expect(formatTaxRate(0.20)).toBe('20%');
      expect(formatTaxRate(0.14)).toBe('14%');
      expect(formatTaxRate(0.07)).toBe('7%');
    });
  });
});

describe('pricing.ts - Edge Cases y Validaciones', () => {
  it('debe manejar factura vacía', () => {
    const invoice = calculateInvoice([]);

    expect(invoice.itemsSubtotal).toBe(0);
    expect(invoice.totalTTC).toBe(0);
    expect(invoice.tvaBreakdown).toHaveLength(0);
  });

  it('debe manejar valores muy pequeños', () => {
    const line = calculateSaleLine(0.01, 0.01, 0, 0.20);
    expect(line.ttc).toBeGreaterThanOrEqual(0);
  });

  it('debe manejar valores muy grandes', () => {
    const line = calculateSaleLine(10000, 10000, 0, 0.20);
    expect(line.ttc).toBe(100000000);
  });

  it('debe mantener precisión en cálculos encadenados', () => {
    // Calcular TTC -> HT -> TTC debe dar el mismo valor
    const original = 12345.67;
    const ht = calculateHT(original, 0.20);
    const ttcAgain = calculateTTC(ht, 0.20);

    expect(ttcAgain).toBeCloseTo(original, 2);
  });

  it('debe verificar coherencia en factura compleja', () => {
    const lines = [
      calculateSaleLine(7, 2499.99, 3, 0.20),
      calculateSaleLine(12, 150.5, 5, 0.14),
      calculateSaleLine(3, 89.99, 10, 0.07),
      calculateSaleLine(50, 12.5, 0, 0.20),
    ];

    const invoice = calculateInvoice(lines, 'percentage', 5);

    // Verificar que HT + TVA = TTC (con margen de error por redondeo)
    expect(invoice.totalHT + invoice.totalTVA).toBeCloseTo(invoice.totalTTC, 1);

    // Verificar que suma de TVA breakdown = total TVA
    const sumTVA = invoice.tvaBreakdown.reduce((sum, item) => sum + item.tva, 0);
    expect(sumTVA).toBeCloseTo(invoice.totalTVA, 1);
  });
});
