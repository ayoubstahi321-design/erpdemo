-- ========================================
-- DIAGNÓSTICO: Verificar columnas en tabla sales
-- ========================================

-- Ver todas las columnas actuales de la tabla sales
SELECT
  '📋 COLUMNAS ACTUALES EN TABLA SALES:' AS info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'sales'
ORDER BY ordinal_position;

-- ========================================
-- COLUMNAS ESPERADAS POR LA APLICACIÓN:
-- ========================================
--
-- Basadas en src/types.ts y src/hooks/useSupabaseData.ts
--
-- BÁSICAS:
-- - id (UUID, PK)
-- - invoice_number (TEXT, nullable)
-- - date (TIMESTAMP)
-- - warehouse_id (UUID, FK a warehouses)
-- - customer_id (UUID, FK a customers)
-- - customer_name (TEXT)
-- - customer_type (TEXT: 'Individual' o 'Professional')
-- - items (JSONB: array de SaleItem)
--
-- DESCUENTOS GLOBALES (OPCIONALES):
-- - global_discount_type (TEXT: 'percentage' o 'fixed', nullable)
-- - global_discount_value (NUMERIC, nullable)
-- - global_discount_amount (NUMERIC, nullable, default 0)
--
-- FINANCIERO:
-- - items_subtotal (NUMERIC: subtotal de items antes de descuento global)
-- - subtotal_amount (NUMERIC: subtotal después de descuento global)
-- - tax_rate (NUMERIC: tasa de IVA, ej. 0.20)
-- - tax_amount (NUMERIC: monto de IVA)
-- - total_amount (NUMERIC: total TTC)
--
-- PAGOS:
-- - amount_paid (NUMERIC: total pagado)
-- - payment_status (TEXT: 'Paid', 'Partial', 'Unpaid')
-- - payments (JSONB: array de Payment)
-- - credited_amount (NUMERIC: valor de devoluciones, nullable, default 0)
--
-- ESTADO:
-- - status (TEXT: 'Completed', 'Pending', 'Cancelled')
--
-- AUDITORÍA:
-- - created_at (TIMESTAMP)
-- - updated_at (TIMESTAMP)
--
-- ========================================

-- Verificar si faltan columnas críticas
SELECT
  '⚠️ VERIFICACIÓN DE COLUMNAS CRÍTICAS:' AS info,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'global_discount_type')
    THEN '✓ global_discount_type existe'
    ELSE '❌ global_discount_type FALTA' END AS col_1,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'global_discount_value')
    THEN '✓ global_discount_value existe'
    ELSE '❌ global_discount_value FALTA' END AS col_2,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'global_discount_amount')
    THEN '✓ global_discount_amount existe'
    ELSE '❌ global_discount_amount FALTA' END AS col_3,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'credited_amount')
    THEN '✓ credited_amount existe'
    ELSE '❌ credited_amount FALTA' END AS col_4,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'invoice_number')
    THEN '✓ invoice_number existe'
    ELSE '❌ invoice_number FALTA' END AS col_5;
