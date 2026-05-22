-- ================================================================
-- CORRECCIÓN DE STOCK — transferencias afectadas por bug qty=cajas
-- Cada fila aplica el delta faltante (qty × (upb-1)) al stock.
-- FROM warehouse: se le quita más (tenía demasiado)
-- TO  warehouse: se le añade más (recibió muy poco)
-- ================================================================

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT
      ti.product_id,
      ti.quantity,
      t.from_warehouse_id,
      t.to_warehouse_id,
      COALESCE(p.units_per_box, 1)                    AS upb,
      ti.quantity * (COALESCE(p.units_per_box, 1) - 1) AS delta
    FROM transfer_items ti
    JOIN transfers t ON t.id = ti.transfer_id
    JOIN products  p ON p.id = ti.product_id
    WHERE ti.transfer_id IN (
      'fae1b146-848f-464b-ab31-9050ba766d42',  -- ANTIFREEZE G12+  Tánger→Casablaca 120 cajas
      '1f70937b-456a-4d50-b9d8-e6d2776e8da2',  -- ANTIFREEZE G13   Tánger→Casablaca  36 cajas
      'c9762720-ea06-49b9-b01f-f96d22dcaa6a',  -- ANTIFREEZE G11   Tánger→Casablaca  59 cajas
      '4a4311e0-b1dd-4f81-afa1-3eb61bd2fccd',  -- ANTIFREEZE G11   Tánger→Casablaca  36 cajas
      '4bf1a58d-180c-423a-9b17-aa013e34475b',  -- Ultra Plus 5W30  Tánger→Casablaca   8 cajas
      '9d08e68f-6a6e-4c85-a203-32332e5bf69b',  -- FAVORITE 10W40   Tánger→Casablaca 141 cajas
      '7850f078-a772-40ec-97f3-b19aec4928f7',  -- FAVORITE 10W40   Tánger→Casablaca   5 cajas
      'fa4502ca-dcc3-4e80-a6cb-4b4cf4b6e461',  -- LEADER 5W40      Tánger→Casablaca   2 cajas
      '4af91cee-4a12-4683-826a-f221d67385fb',  -- Forward 75W90    Tánger→OUJDA       3 cajas
      '27219fb7-aacf-44b7-a90c-ad7598c22f11',  -- FAVORITE 10W40   Tánger→OUJDA       5 cajas
      'a736d821-45a6-410a-8082-3ccc46dfb5b8',  -- Ultra Plus 5W30  Tánger→OUJDA       3 cajas
      '4ddd83d8-a555-4b47-9b6b-c3cdecb7c218',  -- Ultra Plus 5W30  Tánger→OUJDA      10 cajas
      '67dca25f-1e42-4765-a4af-d4598edb1b80',  -- LEADER 10W40     Tánger→OUJDA       3 cajas
      'c29190a0-0b98-440c-a146-d38db4ff02ad',  -- ULTRA SYNTH 5W30 OUJDA→Tánger       1 caja
      'd52c090a-547a-4941-b8fb-52e61979a852',  -- Ultra Plus 0W20  OUJDA→Tánger       2 cajas
      'c01c400a-4bf9-4a7e-bdd6-ef01622d4abb',  -- ANTIFREEZE G13   Tánger→OUJDA       1 caja
      '996c17ac-3e8d-4878-9bf6-78c4dd323b12',  -- FAVORITE 10W40   Tánger→OUJDA      24 cajas
      'f5f53362-d0fd-420a-bcc8-f4846bf32d7f',  -- ANTIFREEZE G13   Tánger→OUJDA      26 cajas
      'f045fc8b-8b75-4f63-9229-43817f6f9527'   -- ANTIFREEZE G12+  Tánger→OUJDA      45 cajas
    )
  LOOP
    RAISE NOTICE 'Corrigiendo product=%, de=%, a=%, delta=%',
      rec.product_id, rec.from_warehouse_id, rec.to_warehouse_id, rec.delta;

    -- Quitar del almacén ORIGEN el delta que faltó descontar
    -- GREATEST(..., 0) evita violar el check constraint si el stock ya fue consumido
    UPDATE stock_levels
    SET quantity = GREATEST(quantity - rec.delta, 0)
    WHERE product_id = rec.product_id
      AND warehouse_id = rec.from_warehouse_id;

    -- Añadir al almacén DESTINO el delta que faltó añadir
    UPDATE stock_levels
    SET quantity = quantity + rec.delta
    WHERE product_id = rec.product_id
      AND warehouse_id = rec.to_warehouse_id;

  END LOOP;

  RAISE NOTICE '✅ Corrección completada — verifica con el SELECT de abajo';
END;
$$;

-- ================================================================
-- VERIFICACIÓN — stock actual en todos los almacenes afectados
-- ================================================================
SELECT
  w.name    AS almacen,
  p.name    AS producto,
  sl.quantity AS stock_uds,
  CASE WHEN COALESCE(p.units_per_box,1) > 1
       THEN floor(sl.quantity / p.units_per_box)::text || ' cajas + ' ||
            (sl.quantity % p.units_per_box)::text || ' uds'
       ELSE sl.quantity::text || ' uds'
  END       AS stock_legible
FROM stock_levels sl
JOIN warehouses w ON w.id = sl.warehouse_id
JOIN products   p ON p.id = sl.product_id
WHERE (w.name ILIKE '%tanger%' OR w.name ILIKE '%casablanc%' OR w.name ILIKE '%oujda%')
ORDER BY w.name, p.name;
