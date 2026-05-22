-- ========================================
-- FIX: Verificar y corregir columnas de tabla returns
-- ========================================
--
-- Error: Could not find the 'customerId' column of 'returns' in the schema cache
--
-- Causa: La tabla tiene customer_id (snake_case) pero el código busca customerId (camelCase)
-- Solución: Verificar estructura de la tabla returns
--
-- EJECUTAR EN SUPABASE SQL EDITOR
-- ========================================

-- 1. Verificar estructura actual de la tabla returns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'returns'
ORDER BY ordinal_position;

-- Resultado esperado:
-- column_name       | data_type                 | is_nullable
-- ------------------+---------------------------+-------------
-- id                | uuid                      | NO
-- date              | timestamp with time zone  | NO
-- original_sale_id  | uuid                      | NO
-- customer_id       | uuid                      | NO
-- customer_name     | text                      | NO
-- warehouse_id      | uuid                      | NO
-- reason            | text                      | NO
-- created_by        | uuid                      | YES
-- created_at        | timestamp with time zone  | NO

-- 2. Verificar que la tabla tenga las columnas correctas
DO $$
BEGIN
    -- Verificar que customer_id existe
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'returns'
        AND column_name = 'customer_id'
    ) THEN
        RAISE NOTICE '✅ Column customer_id exists';
    ELSE
        RAISE EXCEPTION '❌ Column customer_id does NOT exist';
    END IF;

    -- Verificar que original_sale_id existe
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'returns'
        AND column_name = 'original_sale_id'
    ) THEN
        RAISE NOTICE '✅ Column original_sale_id exists';
    ELSE
        RAISE EXCEPTION '❌ Column original_sale_id does NOT exist';
    END IF;

    -- Verificar que warehouse_id existe
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'returns'
        AND column_name = 'warehouse_id'
    ) THEN
        RAISE NOTICE '✅ Column warehouse_id exists';
    ELSE
        RAISE EXCEPTION '❌ Column warehouse_id does NOT exist';
    END IF;
END $$;

-- 3. Si todo está bien, el problema está en el código TypeScript
-- El código debe convertir camelCase a snake_case antes de insertar

-- 4. Verificar datos existentes (si hay)
SELECT
    id,
    date,
    customer_id,
    customer_name,
    original_sale_id,
    warehouse_id,
    reason
FROM returns
ORDER BY date DESC
LIMIT 10;

-- ========================================
-- NOTAS PARA EL DESARROLLADOR:
-- ========================================
--
-- El problema NO está en la base de datos, está en el código TypeScript.
--
-- En src/hooks/useSupabaseData.ts línea 844-846:
--
--   const { data: newReturn, error: returnError } = await supabase
--     .from('returns')
--     .insert([returnInfo])  <-- Aquí está el problema
--
-- El objeto returnInfo tiene:
--   {
--     customerId: '...',      // ❌ camelCase
--     warehouseId: '...',     // ❌ camelCase
--     originalSaleId: '...'   // ❌ camelCase
--   }
--
-- Pero Supabase espera:
--   {
--     customer_id: '...',     // ✅ snake_case
--     warehouse_id: '...',    // ✅ snake_case
--     original_sale_id: '...' // ✅ snake_case
--   }
--
-- SOLUCIÓN: Transformar el objeto antes de insertar:
--
--   const returnInfo = {
--     customer_id: returnData.customerId,
--     customer_name: returnData.customerName,
--     original_sale_id: returnData.originalSaleId,
--     warehouse_id: returnData.warehouseId,
--     reason: returnData.reason,
--     date: returnData.date
--   };
--
-- ========================================
