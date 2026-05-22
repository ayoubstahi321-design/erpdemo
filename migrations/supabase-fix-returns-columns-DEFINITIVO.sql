-- ========================================
-- FIX DEFINITIVO: Tabla returns - Normalizar columnas a snake_case
-- ========================================
--
-- Error: Could not find the 'customerId' column of 'returns' in the schema cache
-- URL: columns="date","originalSaleId","customerId","customerName","reason","warehouseId"
--
-- CAUSA ROOT:
-- La tabla tiene columnas con DIFERENTES convenciones (mix de camelCase y snake_case)
-- Supabase REST API espera snake_case (estándar PostgreSQL)
--
-- EJECUTAR EN SUPABASE SQL EDITOR
-- ========================================

-- PASO 1: Verificar estructura ACTUAL de la tabla
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'returns'
ORDER BY ordinal_position;

-- ========================================
-- PASO 2: RENOMBRAR COLUMNAS si están en camelCase
-- ========================================

-- Si la tabla tiene customerId, renombrar a customer_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'returns'
        AND column_name = 'customerId'
    ) THEN
        ALTER TABLE returns RENAME COLUMN "customerId" TO customer_id;
        RAISE NOTICE '✅ Renamed customerId → customer_id';
    END IF;
END $$;

-- Si la tabla tiene originalSaleId, renombrar a original_sale_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'returns'
        AND column_name = 'originalSaleId'
    ) THEN
        ALTER TABLE returns RENAME COLUMN "originalSaleId" TO original_sale_id;
        RAISE NOTICE '✅ Renamed originalSaleId → original_sale_id';
    END IF;
END $$;

-- Si la tabla tiene customerName, renombrar a customer_name
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'returns'
        AND column_name = 'customerName'
    ) THEN
        ALTER TABLE returns RENAME COLUMN "customerName" TO customer_name;
        RAISE NOTICE '✅ Renamed customerName → customer_name';
    END IF;
END $$;

-- Si la tabla tiene warehouseId, renombrar a warehouse_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'returns'
        AND column_name = 'warehouseId'
    ) THEN
        ALTER TABLE returns RENAME COLUMN "warehouseId" TO warehouse_id;
        RAISE NOTICE '✅ Renamed warehouseId → warehouse_id';
    END IF;
END $$;

-- ========================================
-- PASO 3: Verificar foreign keys y recrearlas si es necesario
-- ========================================

-- Verificar si hay foreign keys rotas
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'returns'
  AND tc.constraint_type = 'FOREIGN KEY';

-- Si no existen foreign keys, crearlas
DO $$
BEGIN
    -- FK: original_sale_id → sales(id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'returns'
        AND constraint_name = 'returns_original_sale_id_fkey'
    ) THEN
        ALTER TABLE returns
        ADD CONSTRAINT returns_original_sale_id_fkey
        FOREIGN KEY (original_sale_id) REFERENCES sales(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Created FK: returns.original_sale_id → sales.id';
    END IF;

    -- FK: customer_id → customers(id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'returns'
        AND constraint_name = 'returns_customer_id_fkey'
    ) THEN
        ALTER TABLE returns
        ADD CONSTRAINT returns_customer_id_fkey
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Created FK: returns.customer_id → customers.id';
    END IF;

    -- FK: warehouse_id → warehouses(id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'returns'
        AND constraint_name = 'returns_warehouse_id_fkey'
    ) THEN
        ALTER TABLE returns
        ADD CONSTRAINT returns_warehouse_id_fkey
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Created FK: returns.warehouse_id → warehouses.id';
    END IF;
END $$;

-- ========================================
-- PASO 4: Verificar tabla return_items
-- ========================================

SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'return_items'
ORDER BY ordinal_position;

-- Renombrar columnas en return_items si están en camelCase
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'return_items'
        AND column_name = 'productId'
    ) THEN
        ALTER TABLE return_items RENAME COLUMN "productId" TO product_id;
        RAISE NOTICE '✅ Renamed productId → product_id in return_items';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'return_items'
        AND column_name = 'productName'
    ) THEN
        ALTER TABLE return_items RENAME COLUMN "productName" TO product_name;
        RAISE NOTICE '✅ Renamed productName → product_name in return_items';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'return_items'
        AND column_name = 'returnId'
    ) THEN
        ALTER TABLE return_items RENAME COLUMN "returnId" TO return_id;
        RAISE NOTICE '✅ Renamed returnId → return_id in return_items';
    END IF;
END $$;

-- ========================================
-- PASO 5: VERIFICACIÓN FINAL
-- ========================================

-- Debe mostrar SOLO snake_case:
-- customer_id, customer_name, original_sale_id, warehouse_id
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'returns'
ORDER BY ordinal_position;

-- ========================================
-- PASO 6: Limpiar schema cache de Supabase
-- ========================================

-- Notificar a Supabase que el schema cambió
NOTIFY pgrst, 'reload schema';

-- ========================================
-- RESULTADO ESPERADO:
-- ========================================
--
-- Después de ejecutar este script:
-- ✅ Todas las columnas de 'returns' están en snake_case
-- ✅ Las foreign keys están correctamente configuradas
-- ✅ La tabla 'return_items' también está normalizada
-- ✅ El schema cache de Supabase se actualizó
--
-- El error "Could not find 'customerId'" desaparecerá porque
-- la tabla ahora tiene 'customer_id' (snake_case) como espera Supabase.
-- ========================================
