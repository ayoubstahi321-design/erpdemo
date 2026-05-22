-- FIX: sales that have returns created but return_status was never set
-- (happened when the sales UPDATE was blocked by RLS before the fix)

UPDATE sales
SET return_status = 'partial'
WHERE return_status IS NULL
  AND id IN (
    SELECT DISTINCT original_sale_id
    FROM returns
    WHERE original_sale_id IS NOT NULL
  );

-- Verify: show affected sales
SELECT invoice_number, customer_name, return_status, payment_status
FROM sales
WHERE return_status IS NOT NULL
ORDER BY date DESC
LIMIT 20;
