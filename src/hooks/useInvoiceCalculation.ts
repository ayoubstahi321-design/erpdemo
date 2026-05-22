/**
 * Custom hook for invoice calculation logic
 * Eliminates duplication between POS and Sales components
 */

import { useMemo } from 'react';
import { SaleItem } from '../types';
import { SaleLineCalculation, calculateHT, calculateTVA, calculateInvoice, TVA_RATES } from '../utils/pricing';

interface InvoiceBreakdown {
  subtotalAfterGlobalDiscount: number;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
}

/**
 * Calculate invoice totals from sale items with optional global discount
 * @param items - Array of sale items
 * @param globalDiscountType - Optional global discount type ('percent' or 'amount')
 * @param globalDiscountValue - Optional global discount value
 * @returns Invoice breakdown with all calculated totals
 */
export function useInvoiceCalculation(
  items: SaleItem[],
  globalDiscountType?: 'percentage' | 'fixed',
  globalDiscountValue?: number
): InvoiceBreakdown & { itemsSubtotal: number; globalDiscountAmount: number } {
  return useMemo(() => {
    if (items.length === 0) {
      return {
        itemsSubtotal: 0,
        globalDiscountAmount: 0,
        subtotalAfterGlobalDiscount: 0,
        totalHT: 0,
        totalTVA: 0,
        totalTTC: 0
      };
    }

    const taxRate = TVA_RATES.STANDARD; // 20%

    // Convert items to SaleLineCalculation format
    const lineItems: SaleLineCalculation[] = items.map(item => ({
      quantity: item.quantity,
      unitPriceTTC: item.unitPrice,
      unitPriceHT: calculateHT(item.unitPrice, taxRate),
      discountPercent: item.discount,
      discountAmount: (item.quantity * item.unitPrice * item.discount) / 100,
      subtotalTTC: item.quantity * item.unitPrice,
      subtotalAfterDiscount: item.total,
      ht: calculateHT(item.total, taxRate),
      tva: calculateTVA(item.total, taxRate),
      ttc: item.total,
      taxRate: taxRate
    }));

    // Calculate invoice with global discount
    const invoice = calculateInvoice(
      lineItems,
      globalDiscountValue && globalDiscountValue > 0 ? globalDiscountType : undefined,
      globalDiscountValue && globalDiscountValue > 0 ? globalDiscountValue : undefined
    );

    return invoice;
  }, [items, globalDiscountType, globalDiscountValue]);
}

/**
 * Helper to format invoice calculation for POS component
 * Returns totals in POS-specific structure
 */
export function useInvoiceCalculationForPOS(
  items: SaleItem[],
  globalDiscountType?: 'percentage' | 'fixed',
  globalDiscountValue?: number
) {
  const invoice = useInvoiceCalculation(items, globalDiscountType, globalDiscountValue);

  return useMemo(() => ({
    itemsSubtotal: invoice.itemsSubtotal,
    globalDiscountAmount: invoice.globalDiscountAmount,
    subtotal: invoice.totalHT,      // Base imponible (HT)
    taxAmount: invoice.totalTVA,   // IVA extraído
    totalTTC: invoice.totalTTC      // Total a pagar (incluye IVA)
  }), [invoice]);
}

/**
 * Helper to format invoice calculation for Sales component
 * Returns totals in Sales-specific structure
 */
export function useInvoiceCalculationForSales(
  items: SaleItem[],
  globalDiscountType?: 'percentage' | 'fixed',
  globalDiscountValue?: number
) {
  const invoice = useInvoiceCalculation(items, globalDiscountType, globalDiscountValue);

  return useMemo(() => ({
    itemsSubtotal: invoice.itemsSubtotal,
    globalDiscountAmount: invoice.globalDiscountAmount,
    subtotal: invoice.totalHT,   // Base imponible (HT)
    tax: invoice.totalTVA,        // IVA extraído
    total: invoice.totalTTC       // Total TTC (IVA ya incluido)
  }), [invoice]);
}
