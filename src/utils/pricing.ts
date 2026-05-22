/**
 * ============================================
 * SISTEMA DE PRECIOS Y TVA - AZMOL STOCK ERP
 * ============================================
 *
 * FILOSOFÍA:
 * - Todos los precios se guardan TTC (con IVA incluido) en la base de datos
 * - Los precios TTC son lo que ve el cliente final y el vendedor
 * - Los cálculos HT (sin IVA) se hacen solo para facturación y contabilidad
 * - Toda la lógica de precios está centralizada en este archivo
 *
 * TERMINOLOGÍA:
 * - TTC (Toutes Taxes Comprises) = Precio CON IVA incluido
 * - HT (Hors Taxes) = Precio SIN IVA
 * - TVA (Taxe sur la Valeur Ajoutée) = IVA / Impuesto al valor agregado
 */

import { Product, CompanySettings, TierConfig, PricingTier, VolumeTier } from '../types';

// ============================================
// CONSTANTES
// ============================================

/**
 * Precisión decimal para cálculos monetarios
 * Usamos 4 decimales internamente, pero mostramos 2
 */
const DECIMAL_PRECISION = 4;
const DISPLAY_PRECISION = 2;

/**
 * Tasas de TVA comunes en Marruecos
 */
export const TVA_RATES = {
  STANDARD: 0.20,      // 20% - Tasa estándar
  REDUCED_1: 0.14,     // 14% - Tasa reducida
  REDUCED_2: 0.10,     // 10% - Tasa reducida
  REDUCED_3: 0.07,     // 7% - Tasa reducida
  EXEMPT: 0.00,        // 0% - Exento de TVA
} as const;

// ============================================
// FUNCIONES DE REDONDEO
// ============================================

/**
 * Redondea un número a la precisión especificada
 * Usa redondeo matemático estándar (0.5 redondea hacia arriba)
 */
export const roundTo = (value: number, decimals: number = DISPLAY_PRECISION): number => {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
};

/**
 * Redondea hacia arriba (siempre favorece al comerciante)
 */
export const roundUp = (value: number, decimals: number = DISPLAY_PRECISION): number => {
  const multiplier = Math.pow(10, decimals);
  return Math.ceil(value * multiplier) / multiplier;
};

/**
 * Redondea hacia abajo (siempre favorece al cliente)
 */
export const roundDown = (value: number, decimals: number = DISPLAY_PRECISION): number => {
  const multiplier = Math.pow(10, decimals);
  return Math.floor(value * multiplier) / multiplier;
};

// ============================================
// CONVERSIONES TTC ↔ HT
// ============================================

/**
 * Calcula el precio HT (sin IVA) desde un precio TTC (con IVA)
 *
 * Fórmula: HT = TTC / (1 + tasa_tva)
 *
 * @param ttc Precio con IVA incluido
 * @param taxRate Tasa de TVA (ejemplo: 0.20 para 20%)
 * @returns Precio sin IVA
 *
 * @example
 * calculateHT(120, 0.20) // Returns 100
 * calculateHT(107, 0.07) // Returns 100
 */
export const calculateHT = (ttc: number, taxRate: number): number => {
  if (taxRate < 0 || taxRate > 1) {
    throw new Error(`Tasa de TVA inválida: ${taxRate}. Debe estar entre 0 y 1.`);
  }

  const ht = ttc / (1 + taxRate);
  return roundTo(ht, DECIMAL_PRECISION);
};

/**
 * Calcula el monto de TVA desde un precio TTC
 *
 * Fórmula: TVA = TTC - HT = TTC - (TTC / (1 + tasa_tva))
 *
 * @param ttc Precio con IVA incluido
 * @param taxRate Tasa de TVA
 * @returns Monto de TVA
 *
 * @example
 * calculateTVA(120, 0.20) // Returns 20
 */
export const calculateTVA = (ttc: number, taxRate: number): number => {
  const ht = calculateHT(ttc, taxRate);
  const tva = ttc - ht;
  return roundTo(tva, DECIMAL_PRECISION);
};

/**
 * Calcula el precio TTC (con IVA) desde un precio HT (sin IVA)
 *
 * Fórmula: TTC = HT × (1 + tasa_tva)
 *
 * @param ht Precio sin IVA
 * @param taxRate Tasa de TVA
 * @returns Precio con IVA incluido
 *
 * @example
 * calculateTTC(100, 0.20) // Returns 120
 */
export const calculateTTC = (ht: number, taxRate: number): number => {
  if (taxRate < 0 || taxRate > 1) {
    throw new Error(`Tasa de TVA inválida: ${taxRate}. Debe estar entre 0 y 1.`);
  }

  const ttc = ht * (1 + taxRate);
  return roundTo(ttc, DECIMAL_PRECISION);
};

// ============================================
// DESGLOSE COMPLETO
// ============================================

export interface PriceBreakdown {
  ht: number;        // Precio sin IVA
  tva: number;       // Monto de IVA
  ttc: number;       // Precio con IVA (precio original)
  taxRate: number;   // Tasa de IVA aplicada
}

/**
 * Desglosa un precio TTC en sus componentes HT, TVA y TTC
 *
 * @param ttc Precio con IVA incluido
 * @param taxRate Tasa de TVA
 * @returns Objeto con el desglose completo
 *
 * @example
 * breakdownPrice(120, 0.20)
 * // Returns: { ht: 100, tva: 20, ttc: 120, taxRate: 0.20 }
 */
export const breakdownPrice = (ttc: number, taxRate: number): PriceBreakdown => {
  const ht = calculateHT(ttc, taxRate);
  const tva = calculateTVA(ttc, taxRate);

  return {
    ht: roundTo(ht, DISPLAY_PRECISION),
    tva: roundTo(tva, DISPLAY_PRECISION),
    ttc: roundTo(ttc, DISPLAY_PRECISION),
    taxRate
  };
};

// ============================================
// DESCUENTOS
// ============================================

/**
 * Aplica un descuento porcentual a un precio TTC
 *
 * @param ttc Precio original TTC
 * @param discountPercent Porcentaje de descuento (0-100)
 * @returns Precio TTC después del descuento
 *
 * @example
 * applyDiscount(100, 10) // Returns 90 (10% de descuento)
 */
export const applyDiscount = (ttc: number, discountPercent: number): number => {
  // Clamp discount to valid range instead of throwing (defensive programming)
  const clampedDiscount = Math.max(0, Math.min(100, discountPercent));

  const discountAmount = ttc * (clampedDiscount / 100);
  const finalPrice = ttc - discountAmount;

  return roundTo(finalPrice, DECIMAL_PRECISION);
};

/**
 * Calcula el monto del descuento
 *
 * @param ttc Precio original TTC
 * @param discountPercent Porcentaje de descuento
 * @returns Monto del descuento
 */
export const calculateDiscountAmount = (ttc: number, discountPercent: number): number => {
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error(`Descuento inválido: ${discountPercent}%. Debe estar entre 0 y 100.`);
  }

  const discountAmount = ttc * (discountPercent / 100);
  return roundTo(discountAmount, DISPLAY_PRECISION);
};

// ============================================
// CÁLCULOS DE LÍNEA DE VENTA
// ============================================

export interface SaleLineCalculation {
  quantity: number;
  unitPriceTTC: number;
  unitPriceHT: number;
  discountPercent: number;
  discountAmount: number;
  subtotalTTC: number;      // Cantidad × Precio TTC
  subtotalAfterDiscount: number; // Después del descuento
  ht: number;               // Total HT de la línea
  tva: number;              // Total TVA de la línea
  ttc: number;              // Total TTC de la línea
  taxRate: number;
}

/**
 * Calcula todos los valores para una línea de venta
 *
 * @param quantity Cantidad de productos
 * @param unitPriceTTC Precio unitario TTC
 * @param discountPercent Descuento porcentual (0-100)
 * @param taxRate Tasa de TVA
 * @returns Objeto con todos los cálculos de la línea
 */
export const calculateSaleLine = (
  quantity: number,
  unitPriceTTC: number,
  discountPercent: number = 0,
  taxRate: number = TVA_RATES.STANDARD
): SaleLineCalculation => {
  // 1. Subtotal sin descuento (redondear multiplicación)
  const subtotalTTC = roundTo(quantity * unitPriceTTC, DISPLAY_PRECISION);

  // 2. Aplicar descuento
  const discountAmount = calculateDiscountAmount(subtotalTTC, discountPercent);
  const subtotalAfterDiscount = roundTo(subtotalTTC - discountAmount, DISPLAY_PRECISION);

  // 3. Calcular HT y TVA del subtotal final
  const ht = calculateHT(subtotalAfterDiscount, taxRate);
  const tva = calculateTVA(subtotalAfterDiscount, taxRate);
  const ttc = subtotalAfterDiscount;

  // 4. Calcular precio unitario HT
  const unitPriceHT = calculateHT(unitPriceTTC, taxRate);

  return {
    quantity,
    unitPriceTTC: roundTo(unitPriceTTC, DISPLAY_PRECISION),
    unitPriceHT: roundTo(unitPriceHT, DISPLAY_PRECISION),
    discountPercent,
    discountAmount: roundTo(discountAmount, DISPLAY_PRECISION),
    subtotalTTC: roundTo(subtotalTTC, DISPLAY_PRECISION),
    subtotalAfterDiscount: roundTo(subtotalAfterDiscount, DISPLAY_PRECISION),
    ht: roundTo(ht, DISPLAY_PRECISION),
    tva: roundTo(tva, DISPLAY_PRECISION),
    ttc: roundTo(ttc, DISPLAY_PRECISION),
    taxRate
  };
};

// ============================================
// CÁLCULOS DE FACTURA COMPLETA
// ============================================

export interface InvoiceCalculation {
  itemsSubtotal: number;         // Suma de todas las líneas (después de descuentos individuales)
  globalDiscountType?: 'percentage' | 'fixed';
  globalDiscountValue?: number;
  globalDiscountAmount: number;
  subtotalAfterGlobalDiscount: number; // itemsSubtotal - globalDiscountAmount
  totalHT: number;                // Total sin IVA
  totalTVA: number;               // Total IVA
  totalTTC: number;               // Total con IVA (precio final)
  tvaBreakdown: Array<{           // Desglose por tasa de TVA
    taxRate: number;
    baseHT: number;
    tva: number;
  }>;
}

/**
 * Calcula el total de una factura con descuento global opcional
 *
 * @param lineItems Array de cálculos de líneas de venta
 * @param globalDiscountType Tipo de descuento global ('percentage' o 'fixed')
 * @param globalDiscountValue Valor del descuento global
 * @returns Objeto con el cálculo completo de la factura
 */
export const calculateInvoice = (
  lineItems: SaleLineCalculation[],
  globalDiscountType?: 'percentage' | 'fixed',
  globalDiscountValue?: number
): InvoiceCalculation => {
  // 1. Sumar subtotales de todas las líneas (ya incluyen descuentos individuales)
  const itemsSubtotal = roundTo(lineItems.reduce((sum, item) => sum + item.ttc, 0), DISPLAY_PRECISION);

  // 2. Calcular descuento global
  let globalDiscountAmount = 0;

  if (globalDiscountType && globalDiscountValue && globalDiscountValue > 0) {
    if (globalDiscountType === 'percentage') {
      globalDiscountAmount = calculateDiscountAmount(itemsSubtotal, globalDiscountValue);
    } else {
      // Descuento fijo - no puede ser mayor que el subtotal
      globalDiscountAmount = Math.min(globalDiscountValue, itemsSubtotal);
    }
  }

  // 3. Subtotal después del descuento global
  const subtotalAfterGlobalDiscount = itemsSubtotal - globalDiscountAmount;

  // 4. Distribuir descuento global proporcionalmente con corrección de centavos
  //    Algoritmo: roundDown por línea, el residuo va a la última línea
  const tvaGroups = new Map<number, { baseHT: number; tva: number }>();

  let discountDistributed = 0;
  lineItems.forEach((item, index) => {
    let lineDiscountAmount: number;
    if (index === lineItems.length - 1) {
      // Última línea: absorbe el residuo para que la suma sea exacta
      lineDiscountAmount = roundTo(globalDiscountAmount - discountDistributed, DISPLAY_PRECISION);
    } else {
      const proportion = itemsSubtotal > 0 ? item.ttc / itemsSubtotal : 0;
      lineDiscountAmount = roundDown(globalDiscountAmount * proportion, DISPLAY_PRECISION);
      discountDistributed += lineDiscountAmount;
    }
    const lineFinalTTC = roundTo(item.ttc - lineDiscountAmount, DISPLAY_PRECISION);

    // Calcular HT y TVA de esta línea con el descuento global aplicado
    const lineHT = calculateHT(lineFinalTTC, item.taxRate);
    const lineTVA = calculateTVA(lineFinalTTC, item.taxRate);

    // Agrupar por tasa de TVA
    const existing = tvaGroups.get(item.taxRate) || { baseHT: 0, tva: 0 };
    tvaGroups.set(item.taxRate, {
      baseHT: roundTo(existing.baseHT + lineHT, DECIMAL_PRECISION),
      tva: roundTo(existing.tva + lineTVA, DECIMAL_PRECISION)
    });
  });

  // 5. Calcular totales
  let totalHT = 0;
  let totalTVA = 0;

  const tvaBreakdown = Array.from(tvaGroups.entries()).map(([taxRate, values]) => {
    const baseHT = roundTo(values.baseHT, DISPLAY_PRECISION);
    const tva = roundTo(values.tva, DISPLAY_PRECISION);
    totalHT += baseHT;
    totalTVA += tva;

    return { taxRate, baseHT, tva };
  });

  totalHT = roundTo(totalHT, DISPLAY_PRECISION);
  totalTVA = roundTo(totalTVA, DISPLAY_PRECISION);
  const totalTTC = roundTo(totalHT + totalTVA, DISPLAY_PRECISION);

  return {
    itemsSubtotal: roundTo(itemsSubtotal, DISPLAY_PRECISION),
    globalDiscountType,
    globalDiscountValue,
    globalDiscountAmount: roundTo(globalDiscountAmount, DISPLAY_PRECISION),
    subtotalAfterGlobalDiscount: roundTo(subtotalAfterGlobalDiscount, DISPLAY_PRECISION),
    totalHT: roundTo(totalHT, DISPLAY_PRECISION),
    totalTVA: roundTo(totalTVA, DISPLAY_PRECISION),
    totalTTC: roundTo(totalTTC, DISPLAY_PRECISION),
    tvaBreakdown
  };
};

// ============================================
// UTILIDADES PARA PRODUCTOS
// ============================================

/**
 * Obtiene la tasa de TVA para un producto
 * Usa la tasa personalizada del producto o la tasa por defecto de la configuración
 *
 * @param product Producto
 * @param defaultSettings Configuración de la empresa
 * @returns Tasa de TVA aplicable
 */
export const getProductTaxRate = (
  product: Product,
  defaultSettings?: CompanySettings
): number => {
  // 1. Si el producto tiene tasa personalizada, usarla
  if (product.customTaxRate !== undefined && product.customTaxRate !== null) {
    return product.customTaxRate;
  }

  // 2. Si hay configuración de empresa con tasa por defecto, usarla
  if (defaultSettings?.defaultTaxRate !== undefined) {
    return defaultSettings.defaultTaxRate;
  }

  // 3. Usar tasa estándar como fallback
  return TVA_RATES.STANDARD;
};

/**
 * Calcula el margen de ganancia de un producto
 *
 * @param product Producto con precio (TTC) y costo
 * @param taxRate Tasa de TVA
 * @returns Margen de ganancia en porcentaje
 */
export const calculateProductMargin = (product: Product, taxRate: number): number => {
  // Convertir precio TTC a HT para comparar con el costo
  const priceHT = calculateHT(product.price, taxRate);

  if (product.cost === 0) {
    return 0;
  }

  const margin = ((priceHT - product.cost) / product.cost) * 100;
  return roundTo(margin, DISPLAY_PRECISION);
};

/**
 * Calcula el precio TTC sugerido basado en el costo y margen deseado
 *
 * @param cost Costo del producto
 * @param marginPercent Margen de ganancia deseado (porcentaje)
 * @param taxRate Tasa de TVA
 * @returns Precio TTC sugerido
 *
 * @example
 * suggestPriceTTC(50, 100, 0.20) // Costo 50, margen 100%, TVA 20%
 * // Returns 120 (Costo 50 + 100% = 100 HT, + 20% TVA = 120 TTC)
 */
export const suggestPriceTTC = (
  cost: number,
  marginPercent: number,
  taxRate: number
): number => {
  // 1. Calcular precio HT con el margen
  const priceHT = cost * (1 + marginPercent / 100);

  // 2. Convertir a TTC
  const priceTTC = calculateTTC(priceHT, taxRate);

  return roundTo(priceTTC, DISPLAY_PRECISION);
};

// ============================================
// FORMATEO Y DISPLAY
// ============================================

/**
 * Formatea un monto en la moneda local (MAD - Dirham marroquí)
 *
 * @param amount Monto a formatear
 * @param showCurrency Si debe mostrar el símbolo de moneda
 * @returns String formateado
 */
export const formatCurrency = (amount: number, showCurrency: boolean = true, currencySymbol: string = 'DH'): string => {
  const formatted = roundTo(amount, DISPLAY_PRECISION).toFixed(DISPLAY_PRECISION);

  if (showCurrency) {
    return `${formatted} ${currencySymbol}`;
  }

  return formatted;
};

/**
 * Formatea una tasa de TVA como porcentaje
 *
 * @param taxRate Tasa de TVA (0.20 = 20%)
 * @returns String formateado "20%"
 */
export const formatTaxRate = (taxRate: number): string => {
  return `${(taxRate * 100).toFixed(0)}%`;
};

// ============================================
// SYSTÈME DE NIVEAUX (TARIFICATION PAR VOLUME)
// ============================================

/**
 * Niveaux de tarification basés sur les points de commande.
 *
 * Les seuils et noms sont configurables par l'admin depuis le Dashboard.
 * TIER_CONFIGS sert de valeur par défaut quand aucune config n'est enregistrée.
 *
 * Nivel 1 :  0–4.75 pts  →  0% du marge offert
 * Nivel 2 :  5–9.75 pts  → 20% du marge offert
 * Nivel 3 : 10–14.75 pts → 40% du marge offert
 * Nivel 4 : 15–49.75 pts → 60% du marge offert
 * Nivel 5 : 50+  pts     → 100% du marge offert (= prix coût)
 *
 * PricingTier and TierConfig are defined in ../types to avoid circular imports.
 * They are re-exported here for backward compatibility with existing consumers.
 */
export type { PricingTier, TierConfig };

// All marginFactors set to 0 — tier auto-discounts disabled for variable-market use.
// To re-enable, set marginFactor > 0 for the desired tiers (or configure via Dashboard).
export const TIER_CONFIGS: TierConfig[] = [
  { tier: 1, label: 'Bronze',  minPoints: 0,  maxPoints: 4.75,    marginFactor: 0.00 },
  { tier: 2, label: 'Argent',  minPoints: 5,  maxPoints: 9.75,    marginFactor: 0.00 },
  { tier: 3, label: 'Or',      minPoints: 10, maxPoints: 14.75,   marginFactor: 0.00 },
  { tier: 4, label: 'Platine', minPoints: 15, maxPoints: 49.75,   marginFactor: 0.00 },
  { tier: 5, label: 'VIP',     minPoints: 50, maxPoints: Infinity, marginFactor: 0.00 },
];

/**
 * Calcule les points totaux d'une commande.
 *
 * @param items Array de { quantity, points } — quantity en unités, points du produit
 * @returns Total des points de la commande
 */
export const calculateOrderPoints = (
  items: Array<{ quantity: number; points: number }>
): number => {
  return items.reduce((sum, item) => sum + item.quantity * item.points, 0);
};

/**
 * Détermine le niveau tarifaire à partir des points totaux de commande.
 *
 * @param totalPoints Points totaux de la commande
 * @param configs     Configs dynamiques (admin); TIER_CONFIGS si absent
 * @returns Niveau 1–4
 */
export const getOrderTier = (totalPoints: number, configs: TierConfig[] = TIER_CONFIGS): PricingTier => {
  const sorted = [...configs].sort((a, b) => b.minPoints - a.minPoints);
  for (const c of sorted) {
    if (totalPoints >= c.minPoints) return c.tier;
  }
  return 1;
};

/**
 * Calcule le prix TTC pour un niveau donné.
 *
 * Formule : marge = priceTTC − costTTC
 *           remise = marge × marginFactor
 *           tierPrice = priceTTC − remise  (plancher = costTTC)
 *
 * Exemple : priceTTC=100, costTTC=90, marginFactor=0.40 (Or)
 *   marge     = 100 − 90 = 10 DH
 *   remise    = 10 × 0.40 = 4 DH/unité
 *   tierPrice = 100 − 4   = 96 DH
 *
 * @param priceTTC   Prix de vente TTC
 * @param costTTC    Coût d'achat TTC
 * @param tier       Niveau tarifaire
 * @param configs    Config des niveaux (défaut TIER_CONFIGS)
 * @returns Prix TTC du niveau
 */
export const calculateTierPrice = (
  priceTTC: number,
  costTTC: number,
  tier: PricingTier,
  configs: TierConfig[] = TIER_CONFIGS
): number => {
  const config = configs.find(c => c.tier === tier)!;
  const margin = priceTTC - costTTC;
  if (margin <= 0) return roundTo(priceTTC, DISPLAY_PRECISION);
  const discount = margin * config.marginFactor;
  return roundTo(Math.max(costTTC, priceTTC - discount), DISPLAY_PRECISION);
};

/**
 * Calcule le % de remise sur priceTTC qui correspond au niveau.
 * C'est la valeur à stocker dans sale_items.discount (type percentage).
 *
 * @param priceTTC   Prix de vente TTC
 * @param costTTC    Coût d'achat TTC
 * @param tier       Niveau
 * @param configs    Config des niveaux
 * @returns Pourcentage de remise 0–100
 */
export const calculateTierDiscountPercent = (
  priceTTC: number,
  costTTC: number,
  tier: PricingTier,
  configs: TierConfig[] = TIER_CONFIGS
): number => {
  if (priceTTC <= 0) return 0;
  const tierPrice = calculateTierPrice(priceTTC, costTTC, tier, configs);
  const discountPct = ((priceTTC - tierPrice) / priceTTC) * 100;
  // Use 8 decimal places so percentage × subtotal stays precise (avoids 1799.99 instead of 1800)
  return roundTo(Math.max(0, Math.min(100, discountPct)), 8);
};

/**
 * Calcule l'économie totale d'une commande (différence entre total au vipPrice et total réel).
 *
 * @param lines Array de { vipPriceTTC, tierPriceTTC, quantity }
 * @returns Montant total économisé TTC
 */
export const calculateTotalSavings = (
  lines: Array<{ vipPriceTTC: number; tierPriceTTC: number; quantity: number }>
): number => {
  const savings = lines.reduce(
    (sum, l) => sum + (l.vipPriceTTC - l.tierPriceTTC) * l.quantity,
    0
  );
  return roundTo(savings, DISPLAY_PRECISION);
};

// ============================================
// SYSTÈME DE REMISE PAR VOLUME MENSUEL
// ============================================

/**
 * Finds the applicable VolumeTier for a customer's previous-month total.
 * Returns the highest tier whose minAmount is <= amount, or null if none qualifies.
 */
export function getVolumeTierForAmount(amount: number, tiers: VolumeTier[]): VolumeTier | null {
  if (!tiers || tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => b.minAmount - a.minAmount);
  return sorted.find(t => amount >= t.minAmount) || null;
}

/**
 * Computes the per-unit fixed discount to apply on a sale item
 * given the active volume tier and the item's sell mode.
 *
 * Box mode:  discount per box   = tier.discountPerBox
 * Unit mode: discount per unit  = tier.discountPerBox / unitsPerBox
 */
export function getItemVolumeDiscount(
  tier: VolumeTier,
  sellMode: 'box' | 'unit',
  unitsPerBox: number
): number {
  const upb = unitsPerBox > 0 ? unitsPerBox : 1;
  // Always return DH/unit — SaleItem.discount is stored per unit;
  // calcEffectiveDiscount expands to DH/box when displaying/calculating box items.
  return tier.discountPerBox / upb;
}

// ============================================
// French number-to-words (Moroccan Dirham)
// ============================================

const _ONES = [
  '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
];
const _TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

function _inWords(n: number): string {
  if (n === 0) return 'zéro';
  if (n < 20) return _ONES[n];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    if (t === 7) return 'soixante-' + _ONES[10 + o];
    if (t === 9) return 'quatre-vingt-' + _ONES[10 + o];
    if (t === 8) return o === 0 ? 'quatre-vingts' : 'quatre-vingt-' + _ONES[o];
    if (o === 0) return _TENS[t];
    if (o === 1) return _TENS[t] + ' et un';
    return _TENS[t] + '-' + _ONES[o];
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const r = n % 100;
    const hWord = h === 1 ? 'cent' : _ONES[h] + ' cent';
    return r > 0 ? hWord + ' ' + _inWords(r) : hWord + (h > 1 ? 's' : '');
  }
  if (n < 1_000_000) {
    const th = Math.floor(n / 1000);
    const r = n % 1000;
    const thWord = th === 1 ? 'mille' : _inWords(th) + ' mille';
    return r > 0 ? thWord + ' ' + _inWords(r) : thWord;
  }
  const m = Math.floor(n / 1_000_000);
  const r = n % 1_000_000;
  const mWord = m === 1 ? 'un million' : _inWords(m) + ' millions';
  return r > 0 ? mWord + ' ' + _inWords(r) : mWord;
}

/**
 * Converts an amount to French words in Moroccan Dirham format.
 * e.g. 1250.50 → "Mille deux cent cinquante Dirhams et cinquante Centimes"
 */
export function numberToWordsFr(amount: number): string {
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100);
  const wholeWord = whole === 0 ? 'zéro' : _inWords(whole);
  const dirham = whole <= 1 ? 'Dirham' : 'Dirhams';
  let result = wholeWord.charAt(0).toUpperCase() + wholeWord.slice(1) + ' ' + dirham;
  if (cents > 0) {
    const centWord = _inWords(cents);
    const centime = cents <= 1 ? 'Centime' : 'Centimes';
    result += ' et ' + centWord + ' ' + centime;
  }
  return result;
}
