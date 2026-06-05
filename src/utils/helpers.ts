
import { Product } from '../types';

/**
 * Sorts products by Name (ASC) and then by Pack Size (ASC).
 * This ensures variants (e.g., 1L, 4L, 20L) appear grouped and ordered logically.
 * Tie-breaks with SKU for identical name/size products.
 */
export const sortProducts = (products: Product[]): Product[] => {
  return [...products].sort((a, b) => {
    if (a.name === b.name) {
      if (a.packSize === b.packSize) {
          return a.sku.localeCompare(b.sku);
      }
      return a.packSize - b.packSize;
    }
    return a.name.localeCompare(b.name);
  });
};

// --- FUZZY SEARCH UTILITIES ---

/**
 * Calculates Levenshtein distance between two strings.
 * Used for detecting typos.
 */
export const getLevenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

/**
 * Performs a fuzzy search of query inside text.
 * Strategies:
 * 1. Direct inclusion.
 * 2. Stripped inclusion (ignoring special chars like - or space).
 * 3. Levenshtein distance on words (for typos).
 */
export const fuzzySearch = (text: string, query: string): boolean => {
    if (!query) return true;
    const t = text.toLowerCase();
    const q = query.toLowerCase();
    
    // 1. Exact substring match
    if (t.includes(q)) return true;
    
    // 2. Clean match (ignore separators like - _ space to match "5w40" with "5W-40")
    const cleanT = t.replace(/[^a-z0-9]/g, '');
    const cleanQ = q.replace(/[^a-z0-9]/g, '');
    if (cleanQ.length > 0 && cleanT.includes(cleanQ)) return true;

    // 3. Fuzzy Levenshtein on words (handles typos)
    if (q.length < 3) return false; // Too short for reliable fuzzy matching
    
    // Allow 1 error for short words, 2 for longer ones
    const maxErrors = q.length <= 4 ? 1 : 2;
    
    // Split text into words, check if query matches any word closely
    const words = t.split(/[\s\-_]+/);
    for (const word of words) {
        // Optimization: length difference check
        if (Math.abs(word.length - q.length) > maxErrors) continue;
        if (getLevenshteinDistance(word, q) <= maxErrors) return true;
    }
    
    return false;
};

// --- SKU GENERATION ---

/**
 * Category code mapping for SKU generation
 */
const CATEGORY_CODES: Record<string, string> = {
  'Huile Moteur': 'HM',
  'Transmission': 'TR',
  'Graisses': 'GR',
  'Hydraulique': 'HY',
  'Liquide de Frein': 'LF',
  'Additifs': 'AD'
};

/**
 * Generates an automatic SKU for a product
 * Format: AZM-[CATEGORY_CODE]-[5_DIGIT_NUMBER]
 * Example: AZM-HM-00001, AZM-TR-00023
 *
 * @param category Product category
 * @param existingProducts List of existing products to avoid duplicates
 * @returns Generated SKU string
 */
export const generateAutoSKU = (category: string, existingProducts: Product[]): string => {
  // Get category code
  const categoryCode = CATEGORY_CODES[category] || 'GN'; // GN = General if unknown

  // Find all existing SKUs with the same category prefix
  const prefix = `AZM-${categoryCode}-`;
  const existingSKUsForCategory = existingProducts
    .filter(p => p.sku && p.sku.startsWith(prefix))
    .map(p => p.sku);

  // Extract numbers from existing SKUs
  const existingNumbers = existingSKUsForCategory
    .map(sku => {
      const match = sku.match(/AZM-[A-Z]{2}-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(num => !isNaN(num));

  // Find the next available number
  const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
  const nextNumber = maxNumber + 1;

  // Format with 5 digits (pad with zeros)
  const paddedNumber = nextNumber.toString().padStart(5, '0');

  return `${prefix}${paddedNumber}`;
};

// --- INVOICE NUMBER GENERATION ---

/**
 * Generates a sequential invoice number for a sale
 * Format: FAC-[YEAR]-[5_DIGIT_NUMBER]
 * Example: FAC-2026-00001, FAC-2026-00023
 *
 * @param existingSales List of existing sales (to find the highest number for current year)
 * @returns Generated invoice number string
 */
export const generateInvoiceNumber = (existingSales: any[]): string => {
  const now = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1–12
  const mm = String(currentMonth).padStart(2, '0');
  const prefix = `FAC-${currentYear}-${mm}-`;

  // Find all existing invoice numbers for the current month
  const existingInvoicesForMonth = existingSales
    .filter(sale => sale.invoiceNumber && sale.invoiceNumber.startsWith(prefix))
    .map(sale => sale.invoiceNumber);

  // Extract sequence numbers from existing invoice numbers
  const existingNumbers = existingInvoicesForMonth
    .map(invoiceNum => {
      const match = invoiceNum.match(/FAC-\d{4}-\d{2}-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(num => !isNaN(num));

  const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
  const paddedNumber = (maxNumber + 1).toString().padStart(5, '0');

  return `${prefix}${paddedNumber}`;
};

// --- PRICING AND TAX CALCULATIONS ---
// NOTA: La lógica principal de precios y TVA ahora está en src/utils/pricing.ts
// Estas funciones se mantienen por compatibilidad pero usan el nuevo sistema

import {
  calculateSaleLine,
  applyDiscount,
  calculateHT,
  calculateTVA,
  calculateDiscountAmount
} from './pricing';

/**
 * Calcula el total de una línea de venta incluyendo descuento
 * @deprecated Usar calculateSaleLine de pricing.ts para cálculos completos
 */
export const calculateItemTotal = (
  qty: number,
  priceTTC: number,
  discountValue: number,
  discountType: 'percentage' | 'fixed' = 'percentage'
): number => {
  const subtotal = Math.round(qty * priceTTC * 100) / 100;
  if (discountType === 'fixed') {
    // Fixed discount is per unit/colis — multiply by qty to get total line discount
    const totalDiscount = Math.round(discountValue * qty * 100) / 100;
    return Math.max(0, Math.round((subtotal - totalDiscount) * 100) / 100);
  }
  // Descuento porcentual — round to 2dp to avoid floating point drift
  return Math.round(applyDiscount(subtotal, discountValue) * 100) / 100;
};

/**
 * Calcula HT y TVA desde un monto TTC
 * @deprecated Usar calculateHT y calculateTVA de pricing.ts directamente
 */
export const calculateFromTTC = (ttc: number, taxRate: number = 0.20): { ht: number; tva: number; ttc: number } => {
  const ht = calculateHT(ttc, taxRate);
  const tva = calculateTVA(ttc, taxRate);
  return { ht, tva, ttc };
};

/**
 * Calcula el monto de descuento global
 * @deprecated Usar calculateInvoice de pricing.ts para cálculos completos de factura
 */
export const calculateGlobalDiscount = (
  itemsSubtotal: number,
  discountType?: 'percentage' | 'fixed',
  discountValue?: number
): number => {
  if (!discountType || !discountValue || discountValue <= 0) {
    return 0;
  }

  if (discountType === 'percentage') {
    return calculateDiscountAmount(itemsSubtotal, discountValue);
  } else {
    // Fixed discount: min(discountValue, itemsSubtotal) to avoid negative totals
    return Math.min(discountValue, itemsSubtotal);
  }
};

/**
 * Triggers a browser download for a CSV file.
 * @param filename Name of the file to download
 * @param headers Array of header strings
 * @param rows Array of strings, where each string is a CSV formatted row
 */
export const exportToCSV = (filename: string, headers: string[], rows: string[]) => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
        + headers.join(",") + "\n"
        + rows.join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// --- STOCK UTILITIES ---

/**
 * Formats stock quantity as "X caj. + Y uds" or "X uds" depending on packSize.
 * Stock is stored in individual units; this converts to a human-readable box+unit display.
 * @param units Total stock in individual units
 * @param packSize Units per box/pack (use 1 for bulk/loose products)
 * @returns Formatted string like "2 caj. + 7 uds", "3 caj.", or "5 uds"
 */
export const formatStock = (units: number, packSize: number, boxLabel = 'caj.', unitLabel = 'uds'): string => {
  if (!packSize || packSize <= 1) return `${units} ${unitLabel}`;
  const boxes = Math.floor(units / packSize);
  const loose = units % packSize;
  if (boxes > 0 && loose > 0) return `${boxes} ${boxLabel} + ${loose} ${unitLabel}`;
  if (boxes > 0) return `${boxes} ${boxLabel}`;
  return `${loose} ${unitLabel}`;
};

/**
 * Calculates total stock across all warehouses for a product
 * @param product Product to calculate total stock for
 * @returns Total stock quantity across all warehouses
 */
export const calculateTotalStock = (product: Product): number => {
  const stockLevels = product.stockLevels || {};
  return Object.values(stockLevels).reduce((a, b) => a + b, 0);
};

/**
 * Checks if a product is below minimum stock threshold
 * @param product Product to check
 * @returns true if total stock is at or below minimum stock level
 */
export const isProductLowStock = (product: Product): boolean => {
  const totalStock = calculateTotalStock(product);
  return totalStock <= (product.minStock || 0);
};

/**
 * Gets stock quantity for a specific warehouse, with fallback to 0
 * @param product Product to get stock for
 * @param warehouseId Warehouse ID to check
 * @returns Stock quantity in the warehouse (0 if not found)
 */
export const getStockInWarehouse = (product: Product, warehouseId: string): number => {
  return product.stockLevels ? (product.stockLevels[warehouseId] || 0) : 0;
};

/**
 * Initializes empty stock levels for all warehouses
 * @param warehouses Array of warehouses
 * @returns Object with warehouse IDs as keys and 0 as values
 */
export const initializeEmptyStockLevels = (warehouses: any[]): Record<string, number> => {
  return warehouses.reduce((acc, w) => ({...acc, [w.id]: 0}), {});
};
