-- ========================================
-- FIX: Agregar columna custom_tax_rate a products
-- ========================================
-- Este script agrega la columna custom_tax_rate
-- que falta en la tabla products

-- Agregar columna custom_tax_rate si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products'
    AND column_name = 'custom_tax_rate'
  ) THEN
    ALTER TABLE products
    ADD COLUMN custom_tax_rate NUMERIC CHECK (custom_tax_rate >= 0 AND custom_tax_rate <= 100);

    RAISE NOTICE 'Columna custom_tax_rate agregada a products';
  ELSE
    RAISE NOTICE 'Columna custom_tax_rate ya existe en products';
  END IF;
END $$;
