-- FIX: Allow deletion of QUOTE sales and their sale_items
-- Quotes have no stock/payment impact so they can be freely deleted.
-- Run in Supabase SQL Editor

-- Allow qualified roles to delete sales of type QUOTE
DROP POLICY IF EXISTS "sales_delete_quotes" ON sales;
CREATE POLICY "sales_delete_quotes" ON sales
  FOR DELETE USING (
    document_type = 'QUOTE'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager', 'Accountant', 'Sales', 'Salesperson')
    )
  );

-- Allow deletion of sale_items belonging to a QUOTE
DROP POLICY IF EXISTS "sale_items_delete_quotes" ON sale_items;
CREATE POLICY "sale_items_delete_quotes" ON sale_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_items.sale_id
        AND s.document_type = 'QUOTE'
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Admin', 'Manager', 'Accountant', 'Sales', 'Salesperson')
    )
  );
