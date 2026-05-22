-- ========================================
-- FIX: Corregir políticas RLS de products para permitir INSERT
-- ========================================
-- Este script actualiza las políticas de Row Level Security
-- para permitir que usuarios autorizados inserten productos

-- Eliminar política existente
DROP POLICY IF EXISTS "Authorized users can manage products" ON products;

-- Crear nueva política con WITH CHECK para INSERT
CREATE POLICY "Authorized users can manage products" ON products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Manager')
    )
  );
