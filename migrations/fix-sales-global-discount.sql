-- ========================================
-- FIX: Agregar columnas faltantes a tabla sales
-- Fecha: 2026-01-11
-- Descripción: Agregar columnas de descuento global, credited_amount, invoice_number
-- ========================================

-- 1. AGREGAR COLUMNAS DE DESCUENTO GLOBAL
-- ========================================

-- Tipo de descuento: 'percentage' o 'fixed'
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS global_discount_type TEXT;

-- Valor del descuento: 5 (para 5%) o 100 (para 100 DH)
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS global_discount_value NUMERIC;

-- Monto calculado del descuento en DH
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS global_discount_amount NUMERIC DEFAULT 0;

-- Comentarios de documentación
COMMENT ON COLUMN sales.global_discount_type IS 'Tipo de descuento global: percentage o fixed';
COMMENT ON COLUMN sales.global_discount_value IS 'Valor del descuento: porcentaje (5) o monto fijo (100)';
COMMENT ON COLUMN sales.global_discount_amount IS 'Monto calculado del descuento en DH';


-- 2. AGREGAR OTRAS COLUMNAS FALTANTES
-- ========================================

-- Monto acreditado por devoluciones (Credit Notes)
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS credited_amount NUMERIC DEFAULT 0;

-- Número de factura secuencial (ej. "FAC-2026-00001")
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- Comentarios de documentación
COMMENT ON COLUMN sales.credited_amount IS 'Valor total de items devueltos (Credit Notes)';
COMMENT ON COLUMN sales.invoice_number IS 'Número de factura secuencial (ej. FAC-2026-00001)';


-- 3. VERIFICACIÓN
-- ========================================

-- Ver estructura actualizada de la tabla sales
SELECT
  '✓ Columnas de descuento global agregadas' AS info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'sales'
  AND column_name LIKE '%discount%'
ORDER BY ordinal_position;

-- Contar ventas existentes
SELECT
  '📊 Estadísticas de la tabla sales:' AS info,
  COUNT(*) AS total_ventas,
  COUNT(global_discount_type) AS ventas_con_descuento_global,
  COUNT(*) - COUNT(global_discount_type) AS ventas_sin_descuento_global
FROM sales;


-- ========================================
-- FIN DE LA MIGRACIÓN
-- ========================================
--
-- INSTRUCCIONES PARA EJECUTAR:
-- 1. Abre Supabase Dashboard → SQL Editor
-- 2. Copia y pega este script completo
-- 3. Ejecuta (Run)
-- 4. Verifica los resultados de las consultas
--
-- NOTA: Las columnas son opcionales (nullable) porque no todas
-- las ventas tienen descuentos globales o devoluciones.
--
-- ROLLBACK (si es necesario):
-- ALTER TABLE sales DROP COLUMN IF EXISTS global_discount_type;
-- ALTER TABLE sales DROP COLUMN IF EXISTS global_discount_value;
-- ALTER TABLE sales DROP COLUMN IF EXISTS global_discount_amount;
-- ALTER TABLE sales DROP COLUMN IF EXISTS credited_amount;
-- ALTER TABLE sales DROP COLUMN IF EXISTS invoice_number;
