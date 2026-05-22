/**
 * Hook to fetch unpaid balance for a specific customer.
 * Replaces the previous approach of loading ALL sales to calculate credit status.
 * Only queries unpaid sales for the selected customer (typically 0-20 rows).
 */

import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { logger } from '../utils/logger';

interface CustomerCreditStatus {
  creditLimit: number;
  unpaidBalance: number;
  availableCredit: number;
  loading: boolean;
}

export function useCustomerUnpaidBalance(
  customerId: string | null,
  newSaleTotal?: number
): CustomerCreditStatus & { wouldExceed: boolean } {
  const [unpaidBalance, setUnpaidBalance] = useState(0);
  const [creditLimit, setCreditLimit] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setUnpaidBalance(0);
      setCreditLimit(0);
      return;
    }

    const fetchBalance = async () => {
      setLoading(true);
      try {
        // Fetch customer credit limit
        const { data: customer, error: custError } = await supabase
          .from('customers')
          .select('credit_limit')
          .eq('id', customerId)
          .single();

        if (custError) throw custError;

        const limit = customer?.credit_limit || 0;
        setCreditLimit(limit);

        // If no credit limit set, no need to calculate balance
        if (!limit || limit <= 0) {
          setUnpaidBalance(0);
          setLoading(false);
          return;
        }

        // Fetch only unpaid/partial sales for this customer
        const { data: unpaidSales, error: salesError } = await supabase
          .from('sales')
          .select('total_amount, amount_paid, credited_amount')
          .eq('customer_id', customerId)
          .neq('payment_status', 'Paid');

        if (salesError) throw salesError;

        // Sum remaining balance across all unpaid sales
        const balance = (unpaidSales || []).reduce((sum, sale) => {
          const remaining = (sale.total_amount || 0) - (sale.amount_paid || 0) - (sale.credited_amount || 0);
          return sum + (remaining > 0 ? remaining : 0);
        }, 0);

        setUnpaidBalance(Math.round(balance * 100) / 100);
      } catch (err) {
        logger.error('Error fetching customer unpaid balance', err);
        setUnpaidBalance(0);
        setCreditLimit(0);
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, [customerId]);

  const availableCredit = Math.round((creditLimit - unpaidBalance) * 100) / 100;
  const wouldExceed = creditLimit > 0 && (unpaidBalance + (newSaleTotal || 0)) > creditLimit;

  return { creditLimit, unpaidBalance, availableCredit, wouldExceed, loading };
}
