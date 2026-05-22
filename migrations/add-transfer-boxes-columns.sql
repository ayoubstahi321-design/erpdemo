-- Añade boxes_entered y loose_entered a transfer_items
-- boxes_entered NULL = datos históricos (cantidad en BD es cajas brutas)
-- boxes_entered NOT NULL = datos nuevos (cantidad en BD es unidades = boxes×upb + loose)
ALTER TABLE transfer_items
ADD COLUMN IF NOT EXISTS boxes_entered INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS loose_entered INTEGER DEFAULT NULL;
