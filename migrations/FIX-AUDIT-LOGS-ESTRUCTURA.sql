-- ========================================
-- CORRECCIÓN DE ESTRUCTURA audit_logs
-- ========================================
-- Problema: La columna user_name es NOT NULL pero no siempre tenemos ese dato
-- Solución: Hacer user_name nullable o proporcionar valor por defecto
-- ========================================

-- OPCIÓN 1: Hacer user_name opcional (RECOMENDADO)
-- Esto es más flexible y evita problemas futuros
ALTER TABLE audit_logs
  ALTER COLUMN user_name DROP NOT NULL;

-- Verificar estructura
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Columna user_name ahora es nullable';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Ahora ejecuta: FIX-TRIGGERS-DEFINITIVO.sql';
  RAISE NOTICE '';
END $$;

-- Mostrar estructura de audit_logs
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'audit_logs'
  AND table_schema = 'public'
ORDER BY ordinal_position;
