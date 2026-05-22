-- ========================================
-- FIX: Agregar columnas faltantes a return_items
-- ========================================
-- Este script agrega las columnas unit_price y total
-- que faltan en la tabla return_items

-- Agregar columna unit_price si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'return_items'
    AND column_name = 'unit_price'
  ) THEN
    ALTER TABLE return_items
    ADD COLUMN unit_price NUMERIC DEFAULT 0 CHECK (unit_price >= 0);

    RAISE NOTICE 'Columna unit_price agregada a return_items';
  ELSE
    RAISE NOTICE 'Columna unit_price ya existe en return_items';
  END IF;
END $$;

-- Agregar columna total si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'return_items'
    AND column_name = 'total'
  ) THEN
    ALTER TABLE return_items
    ADD COLUMN total NUMERIC DEFAULT 0 CHECK (total >= 0);

    RAISE NOTICE 'Columna total agregada a return_items';
  ELSE
    RAISE NOTICE 'Columna total ya existe en return_items';
  END IF;
END $$;

-- Actualizar valores existentes calculando total = quantity * unit_price
-- (si ya hay datos en la tabla)
UPDATE return_items
SET total = quantity * COALESCE(unit_price, 0)
WHERE total = 0 OR total IS NULL;
