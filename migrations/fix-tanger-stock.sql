-- ================================================
-- SCRIPT PARA SOLUCIONAR STOCK DE TANGER
-- Ejecútalo en Supabase SQL Editor
-- ================================================

-- Paso 1: Verificar almacenes existentes
SELECT id, name, location, type FROM warehouses ORDER BY name;

-- Paso 2: Verificar stock levels actuales
SELECT 
    sl.warehouse_id,
    w.name as warehouse_name,
    COUNT(DISTINCT sl.product_id) as productos_con_stock,
    SUM(sl.quantity) as total_stock
FROM stock_levels sl
LEFT JOIN warehouses w ON sl.warehouse_id = w.id
GROUP BY sl.warehouse_id, w.name
ORDER BY total_stock DESC;

-- ================================================
-- CREAR ALMACÉN TANGER SI NO EXISTE
-- ================================================
DO $$
DECLARE
    tanger_id UUID := '550e8400-e29b-41d4-a716-446655440003'; -- Nuevo ID para Tanger
    exists_cnt INTEGER;
BEGIN
    -- Verificar si ya existe
    SELECT COUNT(*) INTO exists_cnt FROM warehouses WHERE id = tanger_id;
    
    IF exists_cnt = 0 THEN
        INSERT INTO warehouses (id, name, location, type)
        VALUES (tanger_id, 'Tanger', 'Tanger', 'Branch');
        RAISE NOTICE '✅ Almacén Tanger creado exitosamente';
    ELSE
        RAISE NOTICE '⚠️ El almacén Tanger ya existe';
    END IF;
END $$;

-- ================================================
-- VERIFICAR PRODUCTOS SIN STOCK EN TANGER
-- ================================================
DO $$
DECLARE
    tanger_id UUID := '550e8400-e29b-41d4-a716-446655440003';
    central_id UUID := '550e8400-e29b-41d4-a716-446655440001';
    missing_count INTEGER;
BEGIN
    -- Contar productos sin stock en Tanger
    SELECT COUNT(*) INTO missing_count
    FROM products p
    WHERE NOT EXISTS (
        SELECT 1 FROM stock_levels sl 
        WHERE sl.product_id = p.id AND sl.warehouse_id = tanger_id
    );
    
    RAISE NOTICE '📦 Productos sin stock en Tanger: %', missing_count;
END $$;

-- ================================================
-- COPIAR STOCK DE CENTRAL A TANGER
-- Si Central tiene stock y Tanger no, copiarlo
-- ================================================
DO $$
DECLARE
    tanger_id UUID := '550e8400-e29b-41d4-a716-446655440003';
    central_id UUID := '550e8400-e29b-41d4-a716-446655440003';
    inserted_count INTEGER := 0;
    p_id UUID;
    p_name TEXT;
    sl RECORD;
BEGIN
    -- NOTA: Ajusta el ID de Central según tu BD
    -- El ID de Central típico es: '550e8400-e29b-41d4-a716-446655440001'
    
    FOR sl IN 
        SELECT product_id, quantity 
        FROM stock_levels 
        WHERE warehouse_id = (
            SELECT id FROM warehouses WHERE name ILIKE '%Central%' LIMIT 1
        )
    LOOP
        -- Verificar si ya existe stock para Tanger
        IF NOT EXISTS (
            SELECT 1 FROM stock_levels 
            WHERE product_id = sl.product_id AND warehouse_id = tanger_id
        ) THEN
            -- Copiar stock de Central a Tanger
            INSERT INTO stock_levels (product_id, warehouse_id, quantity)
            VALUES (sl.product_id, tanger_id, sl.quantity);
            
            inserted_count := inserted_count + 1;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Stock copiado a Tanger: % productos', inserted_count;
END $$;

-- ================================================
-- VERIFICACIÓN FINAL
-- ================================================
SELECT 
    w.name as almacen,
    COUNT(DISTINCT sl.product_id) as productos,
    SUM(sl.quantity) as stock_total
FROM warehouses w
LEFT JOIN stock_levels sl ON w.id = sl.warehouse_id
GROUP BY w.name
ORDER BY w.name;

-- ================================================
-- OPCIONAL: Si Tanger tiene ID diferente, buscar por nombre
-- ================================================
-- Primero encuentra el ID real de Tanger
-- SELECT id FROM warehouses WHERE name ILIKE '%Tanger%';

-- Luego ejecuta este bloque con el ID correcto
/*
DO $$
DECLARE
    tanger_id UUID := 'AQUI_PON_EL_ID_DE_TANGER'; -- Reemplazar con el ID real
    central_id UUID := '550e8400-e29b-41d4-a716-446655440001';
    inserted_count INTEGER := 0;
BEGIN
    FOR sl IN 
        SELECT product_id, quantity 
        FROM stock_levels 
        WHERE warehouse_id = central_id
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM stock_levels 
            WHERE product_id = sl.product_id AND warehouse_id = tanger_id
        ) THEN
            INSERT INTO stock_levels (product_id, warehouse_id, quantity)
            VALUES (sl.product_id, tanger_id, sl.quantity);
            inserted_count := inserted_count + 1;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Stock copiado a Tanger: % productos', inserted_count;
END $$;
*/

