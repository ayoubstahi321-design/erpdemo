/**
 * Server-side paginated products hook.
 * Used by Inventory.tsx listing. POS.tsx continues using the full useProducts() hook
 * for instant cart search.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { Product } from '../types';
import { logger } from '../utils/logger';
import { useRealtimeTable } from './useRealtime';

interface UsePaginatedProductsParams {
  page: number;
  pageSize?: number;
  search?: string;
  category?: string;
}

interface UsePaginatedProductsResult {
  products: Product[];
  totalCount: number;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

function transformProduct(p: any): Product {
  const stockLevels: Record<string, number> = {};
  if (p.stock_levels && Array.isArray(p.stock_levels)) {
    p.stock_levels.forEach((sl: any) => {
      stockLevels[sl.warehouse_id] = sl.quantity;
    });
  }

  return {
    id: p.id,
    sku: p.sku,
    barcode: p.barcode || undefined,
    name: p.name,
    category: p.category,
    viscosity: p.viscosity || undefined,
    packSize: p.pack_size,
    unit: p.unit,
    unitsPerBox: p.units_per_box || 1,
    price: p.price,
    vipPrice: p.vip_price ?? undefined,
    points: p.points ?? 1,
    cost: p.cost,
    supplierId: p.supplier_id || undefined,
    supplierRef: p.supplier_ref || undefined,
    customTaxRate: p.custom_tax_rate || undefined,
    stockLevels,
    minStock: p.min_stock,
    lastRestock: p.last_restock
  };
}

/**
 * For purely alphanumeric queries (no separators), generate a flexible ILIKE
 * pattern that tolerates separators like hyphens, spaces, dots.
 *
 * Examples:
 *   "5w30"   → "%5%w%30%"   matches "5W-30", "5W 30", "5W30"
 *   "10w40"  → "%10%w%40%"  matches "10W-40", "10W40"
 *   "fac2024"→ "%fac%2024%" matches "FAC-2024", "FAC 2024"
 *
 * Returns null if the term already contains separators (standard search works).
 */
function buildFlexPattern(term: string): string | null {
  // Only activate when there are no separators in the input
  if (!/^[a-zA-Z0-9]+$/.test(term)) return null;
  // Insert % at every letter↔digit boundary
  const withBoundaries = term
    .replace(/([a-zA-Z])([0-9])/g, '$1%$2')
    .replace(/([0-9])([a-zA-Z])/g, '$1%$2');
  // If no boundaries found, nothing to improve
  if (withBoundaries === term) return null;
  return `%${withBoundaries}%`;
}

export function usePaginatedProducts(params: UsePaginatedProductsParams): UsePaginatedProductsResult {
  const { page, pageSize = 25, search, category } = params;
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPage = useCallback(async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('products')
        .select(`
          *,
          stock_levels (
            warehouse_id,
            quantity
          )
        `, { count: 'exact' });

      // Server-side search
      if (search && search.trim()) {
        const raw = search.trim();
        const exactPattern = `%${raw}%`;
        const flexPattern = buildFlexPattern(raw);

        if (flexPattern) {
          // e.g. "5w30" → search both "%5w30%" (matches "5W30") and "%5%w%30%" (matches "5W-30")
          query = query.or(
            `name.ilike.${exactPattern},sku.ilike.${exactPattern},barcode.ilike.${exactPattern},` +
            `name.ilike.${flexPattern},sku.ilike.${flexPattern}`
          );
        } else {
          query = query.or(`name.ilike.${exactPattern},sku.ilike.${exactPattern},barcode.ilike.${exactPattern}`);
        }
      }

      // Category filter
      if (category && category !== 'All' && category !== '') {
        query = query.eq('category', category);
      }

      // Order + pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error: fetchError, count } = await query
        .order('name', { ascending: true })
        .range(from, to);

      if (fetchError) {
        if (fetchError.code === 'PGRST301' || fetchError.message?.includes('JWT')) {
          logger.warn('Session expired while fetching paginated products');
          return;
        }
        throw fetchError;
      }

      setProducts((data || []).map(transformProduct));
      setTotalCount(count || 0);
      setError(null);
    } catch (err: any) {
      logger.error('Error fetching paginated products', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, category]);

  useEffect(() => { fetchPage(); }, [fetchPage]);

  useRealtimeTable('products', () => { fetchPage(); });
  useRealtimeTable('stock_levels', () => { fetchPage(); });

  return { products, totalCount, loading, error, refresh: fetchPage };
}
