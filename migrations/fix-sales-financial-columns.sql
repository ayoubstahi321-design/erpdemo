-- ========================================
-- FIX: Agregar columnas financieras faltantes a tabla sales
-- Fecha: 2026-01-11
-- Descripción: Agregar items_subtotal, subtotal_amount, tax_rate, tax_amount, total_amount, amount_paid
-- ========================================

-- 1. AGREGAR COLUMNAS FINANCIERAS
-- ========================================

-- Subtotal de items (suma de líneas TTC después de descuentos individuales, antes de descuento global)
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS items_subtotal NUMERIC DEFAULT 0;

-- Subtotal después del descuento global (itemsSubtotal - globalDiscountAmount)
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC DEFAULT 0;

-- Tasa de IVA usada (ej. 0.20 para 20%)
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 0.20;

-- Monto total de IVA extraído del TTC
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0;

-- Total final TTC (= subtotalAmount, el IVA ya está incluido)
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;

-- Total pagado
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;

-- Estado de pago
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Unpaid';

-- Comentarios de documentación
COMMENT ON COLUMN sales.items_subtotal IS 'Suma de líneas TTC (después de descuentos individuales, antes de descuento global)';
COMMENT ON COLUMN sales.subtotal_amount IS 'TTC después del descuento global (itemsSubtotal - globalDiscountAmount)';
COMMENT ON COLUMN sales.tax_rate IS 'Tasa de TVA usada (ej. 0.20 para 20%)';
COMMENT ON COLUMN sales.tax_amount IS 'Total TVA extraído del TTC';
COMMENT ON COLUMN sales.total_amount IS 'Total final TTC (= subtotalAmount, el IVA ya está incluido)';
COMMENT ON COLUMN sales.amount_paid IS 'Total pagado';
COMMENT ON COLUMN sales.payment_status IS 'Estado de pago: Paid, Partial, Unpaid';


-- 2. VERIFICACIÓN
-- ========================================

-- Ver todas las columnas financieras
SELECT
  '✓ Columnas financieras agregadas' AS info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'sales'
  AND column_name IN (
    'items_subtotal',
    'subtotal_amount',
    'tax_rate',
    'tax_amount',
    'total_amount',
    'amount_paid',
    'payment_status',
    'global_discount_type',
    'global_discount_value',
    'global_discount_amount',
    'credited_amount',
    'invoice_number'
  )
ORDER BY column_name;

-- Verificar estructura completa de sales
SELECT
  '📊 Resumen de columnas en tabla sales:' AS info,
  COUNT(*) AS total_columnas,
  COUNT(CASE WHEN column_name LIKE '%amount%' OR column_name LIKE '%total%' THEN 1 END) AS columnas_financieras
FROM information_schema.columns
WHERE table_name = 'sales';


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
-- NOTA: Este script agrega todas las columnas financieras necesarias
-- para el sistema de ventas TTC (con IVA incluido)
--
-- ROLLBACK (si es necesario):
-- ALTER TABLE sales DROP COLUMN IF EXISTS items_subtotal;
-- ALTER TABLE sales DROP COLUMN IF EXISTS subtotal_amount;
-- ALTER TABLE sales DROP COLUMN IF EXISTS tax_rate;
-- ALTER TABLE sales DROP COLUMN IF EXISTS tax_amount;
-- ALTER TABLE sales DROP COLUMN IF EXISTS total_amount;
-- ALTER TABLE sales DROP COLUMN IF EXISTS amount_paid;
-- ALTER TABLE sales DROP COLUMN IF EXISTS payment_status;
