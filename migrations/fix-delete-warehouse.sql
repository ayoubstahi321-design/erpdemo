-- ========================================
-- FIX: Eliminar almacén con transferencias asociadas
-- ========================================
--
-- PASO 1: Identificar el almacén a eliminar
-- Reemplaza 'NOMBRE_DEL_ALMACEN' con el nombre real
SELECT id, name, location, type
FROM warehouses
WHERE name ILIKE '%NOMBRE_DEL_ALMACEN%';
-- Copia el ID que aparece

-- ========================================
-- PASO 2: Ver qué transferencias están asociadas
-- ========================================
-- Reemplaza 'ID_DEL_ALMACEN' con el ID copiado arriba
SELECT
    t.id,
    t.date,
    t.type,
    t.reference,
    wh_from.name as warehouse_origen,
    wh_to.name as warehouse_destino,
    t.status
FROM transfers t
LEFT JOIN warehouses wh_from ON t.from_warehouse_id = wh_from.id
LEFT JOIN warehouses wh_to ON t.to_warehouse_id = wh_to.id
WHERE t.from_warehouse_id = 'ID_DEL_ALMACEN'
   OR t.to_warehouse_id = 'ID_DEL_ALMACEN'
ORDER BY t.date DESC;

-- ========================================
-- OPCIÓN A: ELIMINAR las transferencias
-- ========================================
-- CUIDADO: Esto elimina permanentemente las transferencias
-- Solo ejecuta si estás seguro

-- Primero eliminar los items de las transferencias
DELETE FROM transfer_items
WHERE transfer_id IN (
    SELECT id FROM transfers
    WHERE from_warehouse_id = 'ID_DEL_ALMACEN'
       OR to_warehouse_id = 'ID_DEL_ALMACEN'
);

-- Luego eliminar las transferencias
DELETE FROM transfers
WHERE from_warehouse_id = 'ID_DEL_ALMACEN'
   OR to_warehouse_id = 'ID_DEL_ALMACEN';

-- ========================================
-- OPCIÓN B: REASIGNAR a otro almacén
-- ========================================
-- Más seguro: mueve las transferencias a otro almacén existente

-- Primero, ver almacenes disponibles
SELECT id, name, location, type
FROM warehouses
ORDER BY name;

-- Reasignar transferencias DESDE este almacén a otro
UPDATE transfers
SET from_warehouse_id = 'ID_DEL_NUEVO_ALMACEN'
WHERE from_warehouse_id = 'ID_DEL_ALMACEN';

-- Reasignar transferencias HACIA este almacén a otro
UPDATE transfers
SET to_warehouse_id = 'ID_DEL_NUEVO_ALMACEN'
WHERE to_warehouse_id = 'ID_DEL_ALMACEN';

-- ========================================
-- PASO 3: Verificar ventas y devoluciones
-- ========================================
-- Ver si hay ventas
SELECT id, date, customer_name, total_amount, status
FROM sales
WHERE warehouse_id = 'ID_DEL_ALMACEN'
ORDER BY date DESC
LIMIT 10;

-- Ver si hay devoluciones
SELECT id, date, customer_name, reason
FROM returns
WHERE warehouse_id = 'ID_DEL_ALMACEN'
ORDER BY date DESC
LIMIT 10;

-- Si hay ventas o devoluciones, reasignarlas también:
UPDATE sales
SET warehouse_id = 'ID_DEL_NUEVO_ALMACEN'
WHERE warehouse_id = 'ID_DEL_ALMACEN';

UPDATE returns
SET warehouse_id = 'ID_DEL_NUEVO_ALMACEN'
WHERE warehouse_id = 'ID_DEL_ALMACEN';

-- ========================================
-- PASO 4: Eliminar stock_levels del almacén
-- ========================================
DELETE FROM stock_levels
WHERE warehouse_id = 'ID_DEL_ALMACEN';

-- ========================================
-- PASO 5: AHORA SÍ eliminar el almacén
-- ========================================
DELETE FROM warehouses
WHERE id = 'ID_DEL_ALMACEN';

-- Verificar que se eliminó
SELECT id, name FROM warehouses ORDER BY name;

-- ========================================
-- RESULTADO ESPERADO:
-- ========================================
-- ✅ El almacén ha sido eliminado
-- ✅ Las transferencias fueron eliminadas o reasignadas
-- ✅ Las ventas y devoluciones fueron reasignadas (si las había)
-- ✅ Los niveles de stock fueron eliminados
-- ========================================
