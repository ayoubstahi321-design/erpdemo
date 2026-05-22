-- ================================================================
-- FIX CASABLANCA — transferencias del 11/05 guardadas como unidades
-- pero tratadas como cajas en el fix anterior
-- ================================================================
-- Lógica:
--   06/04 transfers (INT-97, INT-507) → cajas brutas → ya correcto
--   11/05 transfers (INT-806, INT-393, INT-441, INT-781, INT-135, INT-68) → unidades

-- ANTIFREEZE G11:
--   INT-806=36 uds + INT-393=59 uds = 95 uds - ventas 0 = 95
UPDATE stock_levels SET quantity = 95
WHERE warehouse_id = '7c5d7cd2-24df-468d-ad69-c12f84b2d345'
  AND product_id = (SELECT id FROM products WHERE name = 'ANTIFREEZE G 11' LIMIT 1);

-- ANTIFREEZE G12+:
--   INT-441=120 uds - ventas 2 = 118
UPDATE stock_levels SET quantity = 118
WHERE warehouse_id = '7c5d7cd2-24df-468d-ad69-c12f84b2d345'
  AND product_id = (SELECT id FROM products WHERE name = 'ANTIFREEZE G 12+' LIMIT 1);

-- ANTIFREEZE G13:
--   INT-781=36 uds - ventas 2 = 34
UPDATE stock_levels SET quantity = 34
WHERE warehouse_id = '7c5d7cd2-24df-468d-ad69-c12f84b2d345'
  AND product_id = (SELECT id FROM products WHERE name = 'ANTIFREEZE G 13' LIMIT 1);

-- FAVORITE PLUS 10W-40:
--   INT-507=5 cajas×4=20 uds + INT-68=141 uds - ventas 2 = 159
UPDATE stock_levels SET quantity = 159
WHERE warehouse_id = '7c5d7cd2-24df-468d-ad69-c12f84b2d345'
  AND product_id = (
    SELECT ti.product_id FROM transfer_items ti
    JOIN transfers t ON t.id = ti.transfer_id
    WHERE t.reference = 'INT-68' LIMIT 1
  );

-- Ultra Plus 5W-30 (5L, upb=4):
--   INT-135=8 uds - ventas 2 = 6
UPDATE stock_levels SET quantity = 6
WHERE warehouse_id = '7c5d7cd2-24df-468d-ad69-c12f84b2d345'
  AND product_id = (
    SELECT ti.product_id FROM transfer_items ti
    JOIN transfers t ON t.id = ti.transfer_id
    WHERE t.reference = 'INT-135' LIMIT 1
  );

-- VERIFICACIÓN FINAL
SELECT p.name, p.units_per_box AS upb, sl.quantity AS stock_uds,
  ROUND(sl.quantity::numeric / p.units_per_box, 1) AS stock_cajas
FROM stock_levels sl
JOIN products p ON p.id = sl.product_id
WHERE sl.warehouse_id = '7c5d7cd2-24df-468d-ad69-c12f84b2d345'
  AND p.name IN ('ANTIFREEZE G 11','ANTIFREEZE G 12+','ANTIFREEZE G 13')
  OR (sl.warehouse_id = '7c5d7cd2-24df-468d-ad69-c12f84b2d345'
    AND p.id IN (
      SELECT ti.product_id FROM transfer_items ti
      JOIN transfers t ON t.id = ti.transfer_id
      WHERE t.reference IN ('INT-68','INT-135')
    ))
ORDER BY p.name;
