/**
 * Server-side paginated sales hook.
 * Fetches only the current page of sales from Supabase with server-side filtering.
 * Used by Sales.tsx listing. Other components (Dashboard, Treasury, Returns)
 * continue using the full useSales() hook.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Sale } from '../types';
import { logger } from '../utils/logger';
import { applyCompanyFilter, getCurrentUserCompanyId } from './useSupabaseData';
import { useRealtimeTable } from './useRealtime';
import { useStore } from '../store/useStore';

interface UsePaginatedSalesParams {
  page: number;
  pageSize?: number;
  search?: string;
  statusFilter?: 'All' | 'Paid' | 'Unpaid' | 'Partial' | 'Returned' | 'Quote';
  warehouseId?: string;
}

interface UsePaginatedSalesResult {
  sales: Sale[];
  totalCount: number;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/** Transform a raw Supabase sale row to camelCase Sale object */
function transformSale(s: any): Sale {
  return {
    id: s.id,
    invoiceNumber: s.invoice_number || undefined,
    deliveryNoteNumber: s.delivery_note_number || undefined,
    date: s.date,
    warehouseId: s.warehouse_id,
    customerId: s.customer_id,
    customerName: s.customer_name,
    customerType: s.customer_type,
    items: (s.sale_items || []).map((item: any) => ({
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      discount: item.discount,
      discountType: item.discount_type || 'percentage',
      total: item.total,
      sellMode: item.sell_mode || 'unit',
      unitsPerBox: item.units_per_box || 1
    })),
    source: s.source || 'B2B',
    documentType: s.document_type || 'INVOICE',
    isFastSale: s.is_fast_sale || false,
    globalDiscountType: s.global_discount_type || undefined,
    globalDiscountValue: s.global_discount_value || undefined,
    globalDiscountAmount: s.global_discount_amount || undefined,
    itemsSubtotal: s.items_subtotal,
    subtotalAmount: s.subtotal_amount,
    taxRate: s.tax_rate,
    taxAmount: s.tax_amount,
    totalAmount: s.total_amount,
    amountPaid: s.amount_paid,
    paymentStatus: s.payment_status,
    payments: (s.payments || []).map((p: any) => ({
      id: p.id,
      date: p.date,
      amount: p.amount,
      method: p.method,
      reference: p.reference || undefined,
      checkNumber: p.check_number || undefined,
      dueDate: p.due_date || undefined,
      paymentStatus: p.payment_status || undefined,
      recordedBy: p.recorded_by,
      bankName: p.bank_name || undefined
    })),
    creditedAmount: s.credited_amount || 0,
    returnStatus: s.return_status || undefined,
    status: s.status,
    companyId: s.company_id || null
  };
}

export function usePaginatedSales(params: UsePaginatedSalesParams): UsePaginatedSalesResult {
  const { page, pageSize = 25, search, statusFilter, warehouseId } = params;
  const [sales, setSales] = useState<Sale[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const activeCompanyId = useStore(s => s.activeCompanyId);

  // Use ref to hold latest params for realtime callback
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const fetchPage = useCallback(async () => {
    try {
      setLoading(true);
      const companyId = await getCurrentUserCompanyId();

      // Build query with server-side filters
      let query = supabase
        .from('sales')
        .select(`
          *,
          sale_items (
            id, product_id, product_name, quantity, unit_price,
            discount, discount_type, total, sell_mode, units_per_box
          ),
          payments (
            id, date, amount, method, reference, check_number,
            due_date, payment_status, recorded_by, bank_name
          )
        `, { count: 'exact' });

      // Company filter
      query = applyCompanyFilter(query, companyId);

      // Server-side search
      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`customer_name.ilike.${term},invoice_number.ilike.${term},delivery_note_number.ilike.${term}`);
      }

      // Server-side status filter
      if (statusFilter === 'Quote') {
        query = query.eq('document_type', 'QUOTE');
      } else {
        // Never show QUOTEs in the normal invoice list
        query = query.neq('document_type', 'QUOTE');
        if (statusFilter && statusFilter !== 'All') {
          if (statusFilter === 'Returned') {
            query = query.eq('return_status', 'full');
          } else {
            query = query.eq('payment_status', statusFilter);
          }
        }
      }

      // Warehouse filter
      if (warehouseId) {
        query = query.eq('warehouse_id', warehouseId);
      }

      // Order + pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error: fetchError, count } = await query
        .order('date', { ascending: false })
        .range(from, to);

      if (fetchError) {
        if (fetchError.code === 'PGRST301' || fetchError.message?.includes('JWT')) {
          logger.warn('Session expired while fetching paginated sales');
          return;
        }
        throw fetchError;
      }

      setSales((data || []).map(transformSale));
      setTotalCount(count || 0);
      setError(null);
    } catch (err: any) {
      logger.error('Error fetching paginated sales', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, warehouseId, activeCompanyId]);

  useEffect(() => { fetchPage(); }, [fetchPage]);

  // Realtime: refetch current page on changes
  useRealtimeTable('sales', () => { fetchPage(); });

  return { sales, totalCount, loading, error, refresh: fetchPage };
}
