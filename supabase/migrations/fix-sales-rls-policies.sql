-- Migration: Fix RLS policies for sales table
-- Description: Allow Admin/Manager to create sales in any warehouse
-- Date: 2026-01-29

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can create sales from their warehouse" ON sales;

-- Create new flexible policy for INSERT
CREATE POLICY "Users can create sales with proper permissions" ON sales
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          -- Admin and Manager can create sales in any warehouse
          profiles.role IN ('Admin', 'Manager')
          OR
          -- Other users can only create sales in their assigned warehouse
          (profiles.warehouse_id = sales.warehouse_id)
        )
    )
  );

-- Ensure other policies allow proper access
-- Drop and recreate SELECT policy to be more permissive
DROP POLICY IF EXISTS "Users can view sales from their warehouse" ON sales;
DROP POLICY IF EXISTS "sales_select_policy" ON sales;

CREATE POLICY "Users can view sales based on role" ON sales
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          -- Admin and Manager can see all sales
          profiles.role IN ('Admin', 'Manager', 'Accountant')
          OR
          -- Other users can only see sales from their warehouse
          (profiles.warehouse_id = sales.warehouse_id)
        )
    )
  );

-- Update policy for modifications (UPDATE/DELETE)
DROP POLICY IF EXISTS "sales_modify_policy" ON sales;

CREATE POLICY "Users can modify sales with proper permissions" ON sales
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          -- Admin and Manager can modify any sale
          profiles.role IN ('Admin', 'Manager')
          OR
          -- Accountant can modify sales for payment updates
          (profiles.role = 'Accountant')
          OR
          -- Other users can modify sales from their warehouse
          (profiles.warehouse_id = sales.warehouse_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.role IN ('Admin', 'Manager')
          OR
          (profiles.warehouse_id = sales.warehouse_id)
        )
    )
  );

-- Add comment
COMMENT ON POLICY "Users can create sales with proper permissions" ON sales IS
  'Admin/Manager can create sales in any warehouse. Other users only in their assigned warehouse.';
COMMENT ON POLICY "Users can view sales based on role" ON sales IS
  'Admin/Manager/Accountant can view all sales. Other users only from their warehouse.';
COMMENT ON POLICY "Users can modify sales with proper permissions" ON sales IS
  'Admin/Manager can modify any sale. Accountant can update payments. Others only their warehouse.';
