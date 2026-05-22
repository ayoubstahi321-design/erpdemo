-- ================================================
-- SCRIPT DEFINITIVO: SOLUCIONAR STOCK DE TANGER
-- Ejecutar en Supabase SQL Editor
-- ================================================

-- Mostrar almacenes actuales
SELECT 'ALMACENES ACTIVOS:' as info;
SELECT id, name, location, type FROM warehouses ORDER BY name;

-- ================================================
-- VERIFICAR STOCK ACTUAL POR ALMACÉN
-- ================================================
SELECT 'STOCK ACTUAL POR ALMACÉN:' as info;
SELECT 
    w.name as almacen,
    w.id as warehouse_id,
    COUNT(DISTINCT sl.product_id) as productos_con_stock,
    COALESCE(SUM(sl.quantity), 0) as stock_total
FROM warehouses w
LEFT JOIN stock_levels sl ON w.id = sl.warehouse_id
GROUP BY w.name, w.id
ORDER BY w.name;

-- ================================================
-- IDENTIFICAR ALMACÉN TANGER
-- ================================================
DO $$
DECLARE
    tanger_id UUID;
    central_id UUID;
    tanger_exists BOOLEAN := FALSE;
BEGIN
    -- Buscar ID de Tanger
    SELECT id INTO tanger_id FROM warehouses WHERE name ILIKE '%Tanger%' LIMIT 1;
    
    IF tanger_id IS NULL THEN
        RAISE EXCEPTION '❌ ERROR: No se encontró ningún almacén con nombre Tanger. 
        Verifica los almacenes en la tabla warehouses.';
    END IF;
    
    RAISE NOTICE '✅ ID de Tanger: %', tanger_id;
    
    -- Verificar si Tanger tiene stock
    IF NOT EXISTS (
        SELECT 1 FROM stock_levels WHERE warehouse_id = tanger_id
    ) THEN
        RAISE NOTICE '⚠️ Tanger NO tiene stock. Buscando Central para copiar...';
        
        -- Buscar ID de Central
        SELECT id INTO central_id FROM warehouses WHERE name ILIKE '%Central%' LIMIT 1;
        
        IF central_id IS NULL THEN
            RAISE EXCEPTION '❌ ERROR: No se encontró Almacén Central para copiar stock.';
        END IF;
        
        RAISE NOTICE '✅ ID de Central: %', central_id;
        
        -- ================================================
        -- COPIAR STOCK DE CENTRAL A TANGER
        -- ================================================
        INSERT INTO stock_levels (product_id, warehouse_id, quantity)
        SELECT sl.product_id, tanger_id, sl.quantity
        FROM stock_levels sl
        WHERE sl.warehouse_id = central_id
        AND NOT EXISTS (
            SELECT 1 FROM stock_levels sl2 
            WHERE sl2.product_id = sl.product_id 
            AND sl2.warehouse_id = tanger_id
        );
        
        RAISE NOTICE '✅ Stock copiado exitosamente de Central a Tanger';
    ELSE
        RAISE NOTICE '⚠️ Tanger YA tiene stock. No se copió nada.';
    END IF;
END $$;

-- ================================================
-- VERIFICACIÓN FINAL
-- ================================================
SELECT 'VERIFICACIÓN FINAL:' as info;
SELECT 
    w.name as almacen,
    COUNT(DISTINCT sl.product_id) as productos,
    COALESCE(SUM(sl.quantity), 0) as stock_total
FROM warehouses w
LEFT JOIN stock_levels sl ON w.id = sl.warehouse_id
GROUP BY w.name
ORDER BY w.name;

-- ================================================
-- MOSTRAR DETALLE DE STOCK DE TANGER
-- ================================================
SELECT 'DETALLE STOCK TANGER:' as info;
SELECT 
    p.sku,
    p.name,
    sl.quantity as stock_tanger
FROM products p
JOIN stock_levels sl ON p.id = sl.product_id
JOIN warehouses w ON sl.warehouse_id = w.id
WHERE w.name ILIKE '%Tanger%'
ORDER BY p.name
LIMIT 20;

