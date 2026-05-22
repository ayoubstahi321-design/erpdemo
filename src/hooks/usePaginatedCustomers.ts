/**
 * Server-side paginated customers hook.
 * Used by Customers.tsx listing. Other components (Sales dropdown, POS dropdown)
 * continue using the full useCustomers() hook.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Customer } from '../types';
import { logger } from '../utils/logger';
import { getCurrentUserCompanyId } from './useSupabaseData';
import { useRealtimeTable } from './useRealtime';
import { useStore } from '../store/useStore';

interface UsePaginatedCustomersParams {
  page: number;
  pageSize?: number;
  search?: string;
  cityFilter?: string;
  assignedToFilter?: string | null; // when set, only return customers assigned to this user ID
}

interface UsePaginatedCustomersResult {
  customers: Customer[];
  totalCount: number;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

function transformCustomer(c: any): Customer {
  return {
    id: c.id,
    type: c.type,
    name: c.name,
    contactPerson: c.contact_person,
    email: c.email,
    phone: c.phone,
    address: c.address,
    city: c.city,
    ice: c.ice,
    taxId: c.tax_id,
    creditLimit: c.credit_limit,
    notes: c.notes,
    companyId: c.company_id,
    latitude: c.latitude ?? null,
    longitude: c.longitude ?? null,
    assignedTo: c.assigned_to ?? null,
  };
}

export function usePaginatedCustomers(params: UsePaginatedCustomersParams): UsePaginatedCustomersResult {
  const { page, pageSize = 24, search, cityFilter, assignedToFilter } = params;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const activeCompanyId = useStore(s => s.activeCompanyId);

  const fetchPage = useCallback(async () => {
    try {
      setLoading(true);
      const companyId = await getCurrentUserCompanyId();

      let query = supabase
        .from('customers')
        .select('*', { count: 'exact' });

      // Company filter
      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }

      // Server-side search
      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`name.ilike.${term},phone.ilike.${term},email.ilike.${term},ice.ilike.${term},city.ilike.${term},address.ilike.${term}`);
      }

      // City filter
      if (cityFilter && cityFilter.trim()) {
        query = query.ilike('city', `%${cityFilter.trim()}%`);
      }

      // Sales rep filter — when set, only show customers assigned to that user
      if (assignedToFilter) {
        query = query.eq('assigned_to', assignedToFilter);
      }

      // Order + pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error: fetchError, count } = await query
        .order('name', { ascending: true })
        .range(from, to);

      if (fetchError) {
        if (fetchError.code === 'PGRST301' || fetchError.message?.includes('JWT')) {
          logger.warn('Session expired while fetching paginated customers');
          return;
        }
        throw fetchError;
      }

      setCustomers((data || []).map(transformCustomer));
      setTotalCount(count || 0);
      setError(null);
    } catch (err: any) {
      logger.error('Error fetching paginated customers', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, cityFilter, activeCompanyId, assignedToFilter]);

  useEffect(() => { fetchPage(); }, [fetchPage]);

  useRealtimeTable('customers', () => { fetchPage(); });

  return { customers, totalCount, loading, error, refresh: fetchPage };
}
