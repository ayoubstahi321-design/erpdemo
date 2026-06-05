-- ============================================================
-- STOQLY ERP — DEMO DATA V2
-- Reemplaza todos los datos demo anteriores por datos genéricos
-- coherentes (distribución de electrónica/accesorios tech)
--
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- ============================================================
-- 0. TABLA CHARGES (gastos/contabilidad) — crear si no existe
-- ============================================================
CREATE TABLE IF NOT EXISTS public.charges (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     TEXT,
  date           DATE NOT NULL,
  category       TEXT NOT NULL,
  description    TEXT NOT NULL,
  amount_ht      NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate       NUMERIC(5,4) NOT NULL DEFAULT 0,
  amount_ttc     NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  reference      TEXT,
  supplier_id    TEXT,
  created_by     TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_charges_company_id ON public.charges(company_id);
CREATE INDEX IF NOT EXISTS idx_charges_date ON public.charges(date);
ALTER TABLE public.charges ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='charges' AND policyname='charges_authenticated') THEN
    CREATE POLICY "charges_authenticated" ON public.charges
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- 1. LIMPIEZA (orden FK inverso)
-- ============================================================
DELETE FROM public.return_items  WHERE return_id  IN (SELECT id FROM public.returns  WHERE customer_id IN (SELECT id FROM public.customers WHERE company_id = 'demo-company-001'));
DELETE FROM public.returns       WHERE customer_id IN (SELECT id FROM public.customers WHERE company_id = 'demo-company-001');
DELETE FROM public.transfer_items WHERE transfer_id IN (SELECT id FROM public.transfers WHERE company_id = 'demo-company-001');
DELETE FROM public.transfers     WHERE company_id = 'demo-company-001';
DELETE FROM public.payments      WHERE sale_id IN (SELECT id FROM public.sales WHERE company_id = 'demo-company-001');
DELETE FROM public.sale_items    WHERE sale_id IN (SELECT id FROM public.sales WHERE company_id = 'demo-company-001');
DELETE FROM public.sales         WHERE company_id = 'demo-company-001';
DELETE FROM public.stock_levels  WHERE product_id IN (SELECT id FROM public.products WHERE sku LIKE 'STQ-%');
DELETE FROM public.purchase_orders WHERE supplier_id IN (SELECT id FROM public.suppliers WHERE id IN ('bbbbbbbb-0001-0001-0001-000000000001'::uuid,'bbbbbbbb-0001-0001-0001-000000000002'::uuid));
DELETE FROM public.charges WHERE company_id = 'demo-company-001';
DELETE FROM public.products      WHERE sku LIKE 'STQ-%';
DELETE FROM public.customers     WHERE company_id = 'demo-company-001';
DELETE FROM public.suppliers     WHERE id IN ('bbbbbbbb-0001-0001-0001-000000000001'::uuid,'bbbbbbbb-0001-0001-0001-000000000002'::uuid);

-- ============================================================
-- 2. ALMACENES (actualizar nombres)
-- ============================================================
UPDATE public.warehouses SET name='Entrepôt Principal', location='Casablanca', type='Central'
  WHERE id='aaaaaaaa-0001-0001-0001-000000000001';
UPDATE public.warehouses SET name='Agence Rabat', location='Rabat', type='Branch'
  WHERE id='aaaaaaaa-0001-0001-0001-000000000002';
UPDATE public.warehouses SET name='Agence Marrakech', location='Marrakech', type='Branch'
  WHERE id='aaaaaaaa-0001-0001-0001-000000000003';

-- ============================================================
-- 3. PROVEEDORES
-- ============================================================
INSERT INTO public.suppliers (id, name, contact, email, phone, city, country) VALUES
  ('bbbbbbbb-0001-0001-0001-000000000001','TechDistrib Maroc','Karim Nejjari','contact@techdistrib.ma','+212 522 44 55 66','Casablanca','Maroc'),
  ('bbbbbbbb-0001-0001-0001-000000000002','ProEquip SARL','Nadia Tazi','nadia@proequip.ma','+212 537 22 33 44','Rabat','Maroc')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. PRODUCTOS (electrónica y accesorios tech — genérico)
-- ============================================================
INSERT INTO public.products (id, sku, name, category, pack_size, unit, units_per_box, price, cost, min_stock, supplier_id) VALUES
  ('cccccccc-0001-0001-0001-000000000001','STQ-001','Laptop Ultrabook 15"',       'Informatique',  1,'pcs', 1, 7500.00,5800.00, 5,'bbbbbbbb-0001-0001-0001-000000000001'),
  ('cccccccc-0001-0001-0001-000000000002','STQ-002','Tablette Android 10"',        'Informatique',  1,'pcs', 1, 2200.00,1650.00,10,'bbbbbbbb-0001-0001-0001-000000000001'),
  ('cccccccc-0001-0001-0001-000000000003','STQ-003','Smartphone Pro X12',          'Smartphones',   1,'pcs', 1, 4500.00,3400.00,10,'bbbbbbbb-0001-0001-0001-000000000001'),
  ('cccccccc-0001-0001-0001-000000000004','STQ-004','Écran LED 24" Full HD',       'Moniteurs',     1,'pcs', 1, 1800.00,1350.00, 8,'bbbbbbbb-0001-0001-0001-000000000001'),
  ('cccccccc-0001-0001-0001-000000000005','STQ-005','Clavier Bluetooth',           'Périphériques', 1,'pcs',12,  280.00, 170.00,20,'bbbbbbbb-0001-0001-0001-000000000001'),
  ('cccccccc-0001-0001-0001-000000000006','STQ-006','Souris optique sans fil',     'Périphériques', 1,'pcs',12,  185.00, 105.00,20,'bbbbbbbb-0001-0001-0001-000000000001'),
  ('cccccccc-0001-0001-0001-000000000007','STQ-007','Imprimante Laser A4',         'Imprimantes',   1,'pcs', 1, 1650.00,1200.00, 5,'bbbbbbbb-0001-0001-0001-000000000002'),
  ('cccccccc-0001-0001-0001-000000000008','STQ-008','Cartouche Toner Noir',        'Consommables',  1,'pcs',12,  320.00, 190.00,30,'bbbbbbbb-0001-0001-0001-000000000002'),
  ('cccccccc-0001-0001-0001-000000000009','STQ-009','Câble HDMI 2m',               'Accessoires',   1,'pcs',20,   75.00,  38.00,50,'bbbbbbbb-0001-0001-0001-000000000002'),
  ('cccccccc-0001-0001-0001-000000000010','STQ-010','Clé USB 64Go',                'Accessoires',   1,'pcs',20,   95.00,  52.00,40,'bbbbbbbb-0001-0001-0001-000000000002'),
  ('cccccccc-0001-0001-0001-000000000011','STQ-011','Batterie externe 20000mAh',   'Accessoires',   1,'pcs',10,  350.00, 210.00,20,'bbbbbbbb-0001-0001-0001-000000000001'),
  ('cccccccc-0001-0001-0001-000000000012','STQ-012','Webcam HD 1080p',             'Périphériques', 1,'pcs', 6,  420.00, 255.00,15,'bbbbbbbb-0001-0001-0001-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. STOCK (todos los productos en los 3 almacenes)
-- ============================================================
INSERT INTO public.stock_levels (product_id, warehouse_id, quantity) VALUES
-- Entrepôt Principal (Casablanca)
  ('cccccccc-0001-0001-0001-000000000001','aaaaaaaa-0001-0001-0001-000000000001', 28),
  ('cccccccc-0001-0001-0001-000000000002','aaaaaaaa-0001-0001-0001-000000000001', 35),
  ('cccccccc-0001-0001-0001-000000000003','aaaaaaaa-0001-0001-0001-000000000001', 32),
  ('cccccccc-0001-0001-0001-000000000004','aaaaaaaa-0001-0001-0001-000000000001', 28),
  ('cccccccc-0001-0001-0001-000000000005','aaaaaaaa-0001-0001-0001-000000000001', 80),
  ('cccccccc-0001-0001-0001-000000000006','aaaaaaaa-0001-0001-0001-000000000001', 85),
  ('cccccccc-0001-0001-0001-000000000007','aaaaaaaa-0001-0001-0001-000000000001', 15),
  ('cccccccc-0001-0001-0001-000000000008','aaaaaaaa-0001-0001-0001-000000000001',110),
  ('cccccccc-0001-0001-0001-000000000009','aaaaaaaa-0001-0001-0001-000000000001',180),
  ('cccccccc-0001-0001-0001-000000000010','aaaaaaaa-0001-0001-0001-000000000001',165),
  ('cccccccc-0001-0001-0001-000000000011','aaaaaaaa-0001-0001-0001-000000000001', 55),
  ('cccccccc-0001-0001-0001-000000000012','aaaaaaaa-0001-0001-0001-000000000001', 42),
-- Agence Rabat
  ('cccccccc-0001-0001-0001-000000000001','aaaaaaaa-0001-0001-0001-000000000002',  8),
  ('cccccccc-0001-0001-0001-000000000002','aaaaaaaa-0001-0001-0001-000000000002', 12),
  ('cccccccc-0001-0001-0001-000000000003','aaaaaaaa-0001-0001-0001-000000000002', 10),
  ('cccccccc-0001-0001-0001-000000000004','aaaaaaaa-0001-0001-0001-000000000002',  9),
  ('cccccccc-0001-0001-0001-000000000005','aaaaaaaa-0001-0001-0001-000000000002', 28),
  ('cccccccc-0001-0001-0001-000000000006','aaaaaaaa-0001-0001-0001-000000000002', 32),
  ('cccccccc-0001-0001-0001-000000000007','aaaaaaaa-0001-0001-0001-000000000002',  5),
  ('cccccccc-0001-0001-0001-000000000008','aaaaaaaa-0001-0001-0001-000000000002', 40),
  ('cccccccc-0001-0001-0001-000000000009','aaaaaaaa-0001-0001-0001-000000000002', 70),
  ('cccccccc-0001-0001-0001-000000000010','aaaaaaaa-0001-0001-0001-000000000002', 62),
  ('cccccccc-0001-0001-0001-000000000011','aaaaaaaa-0001-0001-0001-000000000002', 20),
  ('cccccccc-0001-0001-0001-000000000012','aaaaaaaa-0001-0001-0001-000000000002', 15),
-- Agence Marrakech
  ('cccccccc-0001-0001-0001-000000000001','aaaaaaaa-0001-0001-0001-000000000003',  5),
  ('cccccccc-0001-0001-0001-000000000002','aaaaaaaa-0001-0001-0001-000000000003',  8),
  ('cccccccc-0001-0001-0001-000000000003','aaaaaaaa-0001-0001-0001-000000000003',  7),
  ('cccccccc-0001-0001-0001-000000000004','aaaaaaaa-0001-0001-0001-000000000003',  6),
  ('cccccccc-0001-0001-0001-000000000005','aaaaaaaa-0001-0001-0001-000000000003', 18),
  ('cccccccc-0001-0001-0001-000000000006','aaaaaaaa-0001-0001-0001-000000000003', 22),
  ('cccccccc-0001-0001-0001-000000000007','aaaaaaaa-0001-0001-0001-000000000003',  3),
  ('cccccccc-0001-0001-0001-000000000008','aaaaaaaa-0001-0001-0001-000000000003', 25),
  ('cccccccc-0001-0001-0001-000000000009','aaaaaaaa-0001-0001-0001-000000000003', 48),
  ('cccccccc-0001-0001-0001-000000000010','aaaaaaaa-0001-0001-0001-000000000003', 45),
  ('cccccccc-0001-0001-0001-000000000011','aaaaaaaa-0001-0001-0001-000000000003', 14),
  ('cccccccc-0001-0001-0001-000000000012','aaaaaaaa-0001-0001-0001-000000000003', 10)
ON CONFLICT (product_id, warehouse_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- ============================================================
-- 6. CLIENTES
-- ============================================================
INSERT INTO public.customers (id, type, name, contact_person, email, phone, address, city, company_id) VALUES
  ('dddddddd-0001-0001-0001-000000000001','Professional','Bureautique Plus SARL','Hamid Lahlou',   'hamid@bureauplus.ma',    '+212 522 10 20 30','15 Bd. Anfa',         'Casablanca','demo-company-001'),
  ('dddddddd-0001-0001-0001-000000000002','Professional','Techno Solutions',     'Rim Benkiran',   'rim@technosol.ma',       '+212 537 40 50 60','8 Av. Mohammed V',    'Rabat',     'demo-company-001'),
  ('dddddddd-0001-0001-0001-000000000003','Professional','InfoEquip Marrakech',  'Yassine Ouahbi', 'y.ouahbi@infoequip.ma',  '+212 524 30 40 50','22 Rue Ibn Toumert',  'Marrakech', 'demo-company-001'),
  ('dddddddd-0001-0001-0001-000000000004','Professional','Digital Office SARL',  'Leila Fassi',    'leila@digitaloffice.ma', '+212 522 60 70 80','45 Rue Ibnou Sina',   'Casablanca','demo-company-001'),
  ('dddddddd-0001-0001-0001-000000000005','Individual',  'Mohamed Amine Karimi', NULL,              NULL,                     '+212 600 11 22 33','12 Hay Hassani',      'Casablanca','demo-company-001'),
  ('dddddddd-0001-0001-0001-000000000006','Professional','Solutions Pro Tanger', 'Omar Alami',     'o.alami@solpro.ma',      '+212 539 55 66 77','7 Rue Moulay Rachid', 'Tanger',    'demo-company-001'),
  ('dddddddd-0001-0001-0001-000000000007','Professional','MediaTech Agadir',     'Sara El Idrissi','sara@mediatech.ma',      '+212 528 22 33 44','34 Bd. Mohammed V',   'Agadir',    'demo-company-001'),
  ('dddddddd-0001-0001-0001-000000000008','Professional','Informatique Express', 'Amine Tahiri',   'a.tahiri@infoexpress.ma','+212 535 88 99 00','19 Av. Allal Ben',    'Fès',       'demo-company-001'),
  ('dddddddd-0001-0001-0001-000000000009','Individual',  'Sara Bensouda',        NULL,              NULL,                     '+212 600 44 55 66','5 Rue Souissi',       'Rabat',     'demo-company-001'),
  ('dddddddd-0001-0001-0001-000000000010','Professional','LogiTech Distribution','Khalid Zouak',   'k.zouak@logitech.ma',    '+212 522 77 88 99','88 Zone Industrielle','Casablanca','demo-company-001')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7. VENTAS (12 ventas, últimos 90 días)
-- W1=Entrepôt Principal, W2=Agence Rabat, W3=Agence Marrakech
-- ============================================================
-- Abreviaciones de UUIDs usados:
--   W1=aaaaaaaa-0001-0001-0001-000000000001
--   W2=aaaaaaaa-0001-0001-0001-000000000002
--   W3=aaaaaaaa-0001-0001-0001-000000000003
--   C1=dddddddd-0001-0001-0001-000000000001 (Bureautique Plus)
--   C2=dddddddd-0001-0001-0001-000000000002 (Techno Solutions)
--   ... etc.

INSERT INTO public.sales
  (id, invoice_number, date, warehouse_id, customer_id, customer_name, customer_type,
   source, document_type, company_id,
   items_subtotal, subtotal_amount, tax_rate, tax_amount, total_amount,
   amount_paid, payment_status, status, created_by)
VALUES
-- S01: Bureautique Plus - 75 días atrás - Pagada
  ('ffffffff-0001-0001-0001-000000000001','FAC-2026-001',
   NOW()-INTERVAL '75 days',
   'aaaaaaaa-0001-0001-0001-000000000001',
   'dddddddd-0001-0001-0001-000000000001','Bureautique Plus SARL','Professional',
   'B2B','INVOICE','demo-company-001',
   28680,28680,0.20,5736,34416, 34416,'Paid','Completed',
   '7199d5d4-a6e7-497f-8556-3d9c7981bc18'),

-- S02: Techno Solutions - 60 días atrás - Pagada
  ('ffffffff-0001-0001-0001-000000000002','FAC-2026-002',
   NOW()-INTERVAL '60 days',
   'aaaaaaaa-0001-0001-0001-000000000002',
   'dddddddd-0001-0001-0001-000000000002','Techno Solutions','Professional',
   'B2B','INVOICE','demo-company-001',
   5350,5350,0.20,1070,6420, 6420,'Paid','Completed',
   '7199d5d4-a6e7-497f-8556-3d9c7981bc18'),

-- S03: InfoEquip Marrakech - 55 días atrás - Parcial
  ('ffffffff-0001-0001-0001-000000000003','FAC-2026-003',
   NOW()-INTERVAL '55 days',
   'aaaaaaaa-0001-0001-0001-000000000003',
   'dddddddd-0001-0001-0001-000000000003','InfoEquip Marrakech','Professional',
   'B2B','INVOICE','demo-company-001',
   3250,3250,0.20,650,3900, 2000,'Partial','Completed',
   '7199d5d4-a6e7-497f-8556-3d9c7981bc18'),

-- S04: Digital Office - 45 días atrás - Pagada
  ('ffffffff-0001-0001-0001-000000000004','FAC-2026-004',
   NOW()-INTERVAL '45 days',
   'aaaaaaaa-0001-0001-0001-000000000001',
   'dddddddd-0001-0001-0001-000000000004','Digital Office SARL','Professional',
   'B2B','INVOICE','demo-company-001',
   22875,22875,0.20,4575,27450, 27450,'Paid','Completed',
   '7199d5d4-a6e7-497f-8556-3d9c7981bc18'),

-- S05: Mohamed Amine - 40 días atrás - Pagada (POS)
  ('ffffffff-0001-0001-0001-000000000005','FAC-2026-005',
   NOW()-INTERVAL '40 days',
   'aaaaaaaa-0001-0001-0001-000000000001',
   'dddddddd-0001-0001-0001-000000000005','Mohamed Amine Karimi','Individual',
   'POS','TICKET','demo-company-001',
   2550,2550,0.20,510,3060, 3060,'Paid','Completed',
   '7199d5d4-a6e7-497f-8556-3d9c7981bc18'),

-- S06: Solutions Pro Tanger - 35 días atrás - Pagada
  ('ffffffff-0001-0001-0001-000000000006','FAC-2026-006',
   NOW()-INTERVAL '35 days',
   'aaaaaaaa-0001-0001-0001-000000000002',
   'dddddddd-0001-0001-0001-000000000006','Solutions Pro Tanger','Professional',
   'B2B','INVOICE','demo-company-001',
   4530,4530,0.20,906,5436, 5436,'Paid','Completed',
   '7199d5d4-a6e7-497f-8556-3d9c7981bc18'),

-- S07: MediaTech Agadir - 30 días atrás - Sin pagar
  ('ffffffff-0001-0001-0001-000000000007','FAC-2026-007',
   NOW()-INTERVAL '30 days',
   'aaaaaaaa-0001-0001-0001-000000000003',
   'dddddddd-0001-0001-0001-000000000007','MediaTech Agadir','Professional',
   'B2B','INVOICE','demo-company-001',
   26100,26100,0.20,5220,31320, 0,'Unpaid','Completed',
   '7199d5d4-a6e7-497f-8556-3d9c7981bc18'),

-- S08: Bureautique Plus - 22 días atrás - Pagada
  ('ffffffff-0001-0001-0001-000000000008','FAC-2026-008',
   NOW()-INTERVAL '22 days',
   'aaaaaaaa-0001-0001-0001-000000000001',
   'dddddddd-0001-0001-0001-000000000001','Bureautique Plus SARL','Professional',
   'B2B','INVOICE','demo-company-001',
   4425,4425,0.20,885,5310, 5310,'Paid','Completed',
   '7199d5d4-a6e7-497f-8556-3d9c7981bc18'),

-- S09: Informatique Express - 15 días atrás - Parcial
  ('ffffffff-0001-0001-0001-000000000009','FAC-2026-009',
   NOW()-INTERVAL '15 days',
   'aaaaaaaa-0001-0001-0001-000000000001',
   'dddddddd-0001-0001-0001-000000000008','Informatique Express','Professional',
   'B2B','INVOICE','demo-company-001',
   2235,2235,0.20,447,2682, 1500,'Partial','Completed',
   '7199d5d4-a6e7-497f-8556-3d9c7981bc18'),

-- S10: Sara Bensouda - 10 días atrás - Pagada (POS)
  ('ffffffff-0001-0001-0001-000000000010','FAC-2026-010',
   NOW()-INTERVAL '10 days',
   'aaaaaaaa-0001-0001-0001-000000000001',
   'dddddddd-0001-0001-0001-000000000009','Sara Bensouda','Individual',
   'POS','TICKET','demo-company-001',
   4575,4575,0.20,915,5490, 5490,'Paid','Completed',
   '7199d5d4-a6e7-497f-8556-3d9c7981bc18'),

-- S11: LogiTech Distribution - 6 días atrás - Pagada
  ('ffffffff-0001-0001-0001-000000000011','FAC-2026-011',
   NOW()-INTERVAL '6 days',
   'aaaaaaaa-0001-0001-0001-000000000001',
   'dddddddd-0001-0001-0001-000000000010','LogiTech Distribution','Professional',
   'B2B','INVOICE','demo-company-001',
   11325,11325,0.20,2265,13590, 13590,'Paid','Completed',
   '7199d5d4-a6e7-497f-8556-3d9c7981bc18'),

-- S12: Digital Office - 2 días atrás - Sin pagar (Presupuesto convertido)
  ('ffffffff-0001-0001-0001-000000000012','FAC-2026-012',
   NOW()-INTERVAL '2 days',
   'aaaaaaaa-0001-0001-0001-000000000002',
   'dddddddd-0001-0001-0001-000000000004','Digital Office SARL','Professional',
   'B2B','INVOICE','demo-company-001',
   24100,24100,0.20,4820,28920, 0,'Unpaid','Completed',
   '7199d5d4-a6e7-497f-8556-3d9c7981bc18')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 8. LÍNEAS DE VENTA (sale_items)
-- ============================================================
INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, discount, discount_type, sell_mode, units_per_box, stock_delta, total) VALUES
-- S01: 3 Laptops + 5 Claviers (subtotal=28680 HT → con TVA=34416)
-- Wait - recalculation needed. Let me fix: items_subtotal before tax
-- S01 items: 3*7500=22500 + 5*280=1400 = 23900 HT. Tax 20%=4780. Total=28680
-- But I set items_subtotal=28680 and total_amount=34416... That's wrong.
-- Let me recalculate: subtotal=23900, tax=4780, total=28680. Correct version:

-- Actually I already inserted wrong totals above. Let me note: the items total
-- matches items_subtotal. The sale totals in INSERT above are already correct
-- per the math below. Let me verify S01:
-- items: 3*7500=22500 + 5*280=1400 = 23900. With 20% tax: total = 23900*1.2 = 28680
-- So items_subtotal=23900, tax_amount=4780, total_amount=28680. ✓ (I had 28680 wrong in INSERT above)
-- NOTICE: The sales INSERT above has wrong math in some rows. I'll fix with UPDATE below.

-- Sale items (these totals are HT - before tax):
  ('ffffffff-0001-0001-0001-000000000001','cccccccc-0001-0001-0001-000000000001','Laptop Ultrabook 15"',       3, 7500,0,'percentage','unit',1,-3,22500),
  ('ffffffff-0001-0001-0001-000000000001','cccccccc-0001-0001-0001-000000000005','Clavier Bluetooth',          5,  280,0,'percentage','unit',12,-5,1400),
  ('ffffffff-0001-0001-0001-000000000002','cccccccc-0001-0001-0001-000000000002','Tablette Android 10"',       2, 2200,0,'percentage','unit',1,-2,4400),
  ('ffffffff-0001-0001-0001-000000000002','cccccccc-0001-0001-0001-000000000010','Clé USB 64Go',               10,   95,0,'percentage','unit',20,-10,950),
  ('ffffffff-0001-0001-0001-000000000003','cccccccc-0001-0001-0001-000000000007','Imprimante Laser A4',        1, 1650,0,'percentage','unit',1,-1,1650),
  ('ffffffff-0001-0001-0001-000000000003','cccccccc-0001-0001-0001-000000000008','Cartouche Toner Noir',       5,  320,0,'percentage','unit',12,-5,1600),
  ('ffffffff-0001-0001-0001-000000000004','cccccccc-0001-0001-0001-000000000003','Smartphone Pro X12',         5, 4500,0,'percentage','unit',1,-5,22500),
  ('ffffffff-0001-0001-0001-000000000004','cccccccc-0001-0001-0001-000000000009','Câble HDMI 2m',              5,   75,0,'percentage','unit',20,-5,375),
  ('ffffffff-0001-0001-0001-000000000005','cccccccc-0001-0001-0001-000000000002','Tablette Android 10"',       1, 2200,0,'percentage','unit',1,-1,2200),
  ('ffffffff-0001-0001-0001-000000000005','cccccccc-0001-0001-0001-000000000011','Batterie externe 20000mAh',  1,  350,0,'percentage','unit',10,-1,350),
  ('ffffffff-0001-0001-0001-000000000006','cccccccc-0001-0001-0001-000000000004','Écran LED 24" Full HD',      2, 1800,0,'percentage','unit',1,-2,3600),
  ('ffffffff-0001-0001-0001-000000000006','cccccccc-0001-0001-0001-000000000005','Clavier Bluetooth',          2,  280,0,'percentage','unit',12,-2,560),
  ('ffffffff-0001-0001-0001-000000000006','cccccccc-0001-0001-0001-000000000006','Souris optique sans fil',    2,  185,0,'percentage','unit',12,-2,370),
  ('ffffffff-0001-0001-0001-000000000007','cccccccc-0001-0001-0001-000000000001','Laptop Ultrabook 15"',       3, 7500,0,'percentage','unit',1,-3,22500),
  ('ffffffff-0001-0001-0001-000000000007','cccccccc-0001-0001-0001-000000000004','Écran LED 24" Full HD',      2, 1800,0,'percentage','unit',1,-2,3600),
  ('ffffffff-0001-0001-0001-000000000008','cccccccc-0001-0001-0001-000000000008','Cartouche Toner Noir',       10,  320,0,'percentage','unit',12,-10,3200),
  ('ffffffff-0001-0001-0001-000000000008','cccccccc-0001-0001-0001-000000000010','Clé USB 64Go',               5,   95,0,'percentage','unit',20,-5,475),
  ('ffffffff-0001-0001-0001-000000000008','cccccccc-0001-0001-0001-000000000009','Câble HDMI 2m',              10,  75,0,'percentage','unit',20,-10,750),
  ('ffffffff-0001-0001-0001-000000000009','cccccccc-0001-0001-0001-000000000012','Webcam HD 1080p',            2,  420,0,'percentage','unit',6,-2,840),
  ('ffffffff-0001-0001-0001-000000000009','cccccccc-0001-0001-0001-000000000006','Souris optique sans fil',    3,  185,0,'percentage','unit',12,-3,555),
  ('ffffffff-0001-0001-0001-000000000009','cccccccc-0001-0001-0001-000000000005','Clavier Bluetooth',          3,  280,0,'percentage','unit',12,-3,840),
  ('ffffffff-0001-0001-0001-000000000010','cccccccc-0001-0001-0001-000000000003','Smartphone Pro X12',         1, 4500,0,'percentage','unit',1,-1,4500),
  ('ffffffff-0001-0001-0001-000000000010','cccccccc-0001-0001-0001-000000000009','Câble HDMI 2m',              1,   75,0,'percentage','unit',20,-1,75),
  ('ffffffff-0001-0001-0001-000000000011','cccccccc-0001-0001-0001-000000000004','Écran LED 24" Full HD',      5, 1800,0,'percentage','unit',1,-5,9000),
  ('ffffffff-0001-0001-0001-000000000011','cccccccc-0001-0001-0001-000000000005','Clavier Bluetooth',          5,  280,0,'percentage','unit',12,-5,1400),
  ('ffffffff-0001-0001-0001-000000000011','cccccccc-0001-0001-0001-000000000006','Souris optique sans fil',    5,  185,0,'percentage','unit',12,-5,925),
  ('ffffffff-0001-0001-0001-000000000012','cccccccc-0001-0001-0001-000000000002','Tablette Android 10"',       10, 2200,0,'percentage','unit',1,-10,22000),
  ('ffffffff-0001-0001-0001-000000000012','cccccccc-0001-0001-0001-000000000012','Webcam HD 1080p',            5,  420,0,'percentage','unit',6,-5,2100);

-- Corregir los totales de ventas con los subtotales reales (HT)
-- S01: 22500+1400=23900 HT → TVA=4780 → TTC=28680
UPDATE public.sales SET items_subtotal=23900,subtotal_amount=23900,tax_amount=4780,total_amount=28680,amount_paid=28680
  WHERE id='ffffffff-0001-0001-0001-000000000001';
-- S02: 4400+950=5350 → 1070 → 6420
UPDATE public.sales SET items_subtotal=5350,subtotal_amount=5350,tax_amount=1070,total_amount=6420,amount_paid=6420
  WHERE id='ffffffff-0001-0001-0001-000000000002';
-- S03: 1650+1600=3250 → 650 → 3900 (parcial 2000)
UPDATE public.sales SET items_subtotal=3250,subtotal_amount=3250,tax_amount=650,total_amount=3900,amount_paid=2000
  WHERE id='ffffffff-0001-0001-0001-000000000003';
-- S04: 22500+375=22875 → 4575 → 27450
UPDATE public.sales SET items_subtotal=22875,subtotal_amount=22875,tax_amount=4575,total_amount=27450,amount_paid=27450
  WHERE id='ffffffff-0001-0001-0001-000000000004';
-- S05: 2200+350=2550 → 510 → 3060
UPDATE public.sales SET items_subtotal=2550,subtotal_amount=2550,tax_amount=510,total_amount=3060,amount_paid=3060
  WHERE id='ffffffff-0001-0001-0001-000000000005';
-- S06: 3600+560+370=4530 → 906 → 5436
UPDATE public.sales SET items_subtotal=4530,subtotal_amount=4530,tax_amount=906,total_amount=5436,amount_paid=5436
  WHERE id='ffffffff-0001-0001-0001-000000000006';
-- S07: 22500+3600=26100 → 5220 → 31320 (sin pagar)
UPDATE public.sales SET items_subtotal=26100,subtotal_amount=26100,tax_amount=5220,total_amount=31320,amount_paid=0
  WHERE id='ffffffff-0001-0001-0001-000000000007';
-- S08: 3200+475+750=4425 → 885 → 5310
UPDATE public.sales SET items_subtotal=4425,subtotal_amount=4425,tax_amount=885,total_amount=5310,amount_paid=5310
  WHERE id='ffffffff-0001-0001-0001-000000000008';
-- S09: 840+555+840=2235 → 447 → 2682 (parcial 1500)
UPDATE public.sales SET items_subtotal=2235,subtotal_amount=2235,tax_amount=447,total_amount=2682,amount_paid=1500
  WHERE id='ffffffff-0001-0001-0001-000000000009';
-- S10: 4500+75=4575 → 915 → 5490
UPDATE public.sales SET items_subtotal=4575,subtotal_amount=4575,tax_amount=915,total_amount=5490,amount_paid=5490
  WHERE id='ffffffff-0001-0001-0001-000000000010';
-- S11: 9000+1400+925=11325 → 2265 → 13590
UPDATE public.sales SET items_subtotal=11325,subtotal_amount=11325,tax_amount=2265,total_amount=13590,amount_paid=13590
  WHERE id='ffffffff-0001-0001-0001-000000000011';
-- S12: 22000+2100=24100 → 4820 → 28920 (sin pagar)
UPDATE public.sales SET items_subtotal=24100,subtotal_amount=24100,tax_amount=4820,total_amount=28920,amount_paid=0
  WHERE id='ffffffff-0001-0001-0001-000000000012';

-- ============================================================
-- 9. PAGOS
-- ============================================================
INSERT INTO public.payments (sale_id, date, amount, method, payment_status) VALUES
  ('ffffffff-0001-0001-0001-000000000001',NOW()-INTERVAL '75 days',28680,'Bank Transfer','Cashed'),
  ('ffffffff-0001-0001-0001-000000000002',NOW()-INTERVAL '60 days', 6420,'Bank Transfer','Cashed'),
  ('ffffffff-0001-0001-0001-000000000003',NOW()-INTERVAL '55 days', 2000,'Cash','Cashed'),
  ('ffffffff-0001-0001-0001-000000000004',NOW()-INTERVAL '45 days',27450,'Check','Cashed'),
  ('ffffffff-0001-0001-0001-000000000005',NOW()-INTERVAL '40 days', 3060,'Cash','Cashed'),
  ('ffffffff-0001-0001-0001-000000000006',NOW()-INTERVAL '35 days', 5436,'Bank Transfer','Cashed'),
  ('ffffffff-0001-0001-0001-000000000008',NOW()-INTERVAL '22 days', 5310,'Cash','Cashed'),
  ('ffffffff-0001-0001-0001-000000000009',NOW()-INTERVAL '15 days', 1500,'Cash','Cashed'),
  ('ffffffff-0001-0001-0001-000000000010',NOW()-INTERVAL '10 days', 5490,'Credit Card','Cashed'),
  ('ffffffff-0001-0001-0001-000000000011',NOW()-INTERVAL '6 days', 13590,'Bank Transfer','Cashed');

-- ============================================================
-- 10. TRANSFERENCIAS ENTRE ALMACENES
-- ============================================================
INSERT INTO public.transfers (id, date, type, from_warehouse_id, to_warehouse_id, reference, reason, company_id, status, created_by) VALUES
  ('11111111-0001-0001-0001-000000000001',
   NOW()-INTERVAL '50 days','INTERNAL',
   'aaaaaaaa-0001-0001-0001-000000000001','aaaaaaaa-0001-0001-0001-000000000002',
   'TRF-2026-001','Réapprovisionnement Agence Rabat','demo-company-001','Completed',
   '7199d5d4-a6e7-497f-8556-3d9c7981bc18'),
  ('11111111-0001-0001-0001-000000000002',
   NOW()-INTERVAL '35 days','INTERNAL',
   'aaaaaaaa-0001-0001-0001-000000000001','aaaaaaaa-0001-0001-0001-000000000003',
   'TRF-2026-002','Réapprovisionnement Agence Marrakech','demo-company-001','Completed',
   '7199d5d4-a6e7-497f-8556-3d9c7981bc18'),
  ('11111111-0001-0001-0001-000000000003',
   NOW()-INTERVAL '20 days','ADJUSTMENT',
   NULL,'aaaaaaaa-0001-0001-0001-000000000001',
   'TRF-2026-003','Entrée stock fournisseur TechDistrib','demo-company-001','Completed',
   '7199d5d4-a6e7-497f-8556-3d9c7981bc18')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.transfer_items (transfer_id, product_id, product_name, quantity) VALUES
  ('11111111-0001-0001-0001-000000000001','cccccccc-0001-0001-0001-000000000005','Clavier Bluetooth',       20),
  ('11111111-0001-0001-0001-000000000001','cccccccc-0001-0001-0001-000000000006','Souris optique sans fil', 20),
  ('11111111-0001-0001-0001-000000000001','cccccccc-0001-0001-0001-000000000008','Cartouche Toner Noir',    30),
  ('11111111-0001-0001-0001-000000000002','cccccccc-0001-0001-0001-000000000002','Tablette Android 10"',    10),
  ('11111111-0001-0001-0001-000000000002','cccccccc-0001-0001-0001-000000000004','Écran LED 24" Full HD',    8),
  ('11111111-0001-0001-0001-000000000002','cccccccc-0001-0001-0001-000000000009','Câble HDMI 2m',           40),
  ('11111111-0001-0001-0001-000000000003','cccccccc-0001-0001-0001-000000000001','Laptop Ultrabook 15"',    10),
  ('11111111-0001-0001-0001-000000000003','cccccccc-0001-0001-0001-000000000002','Tablette Android 10"',    20),
  ('11111111-0001-0001-0001-000000000003','cccccccc-0001-0001-0001-000000000003','Smartphone Pro X12',      20),
  ('11111111-0001-0001-0001-000000000003','cccccccc-0001-0001-0001-000000000011','Batterie externe 20000mAh',30);

-- ============================================================
-- 11. ÓRDENES DE COMPRA
-- ============================================================
INSERT INTO public.purchase_orders (id, po_number, date, supplier_id, supplier_name, warehouse_id, status, total_amount, notes, created_by) VALUES
  ('33333333-0001-0001-0001-000000000001','PO-2026-001',
   NOW()-INTERVAL '90 days',
   'bbbbbbbb-0001-0001-0001-000000000001','TechDistrib Maroc',
   'aaaaaaaa-0001-0001-0001-000000000001',
   'Received',159000,
   'Commande initiale de lancement — reçue et intégrée au stock',
   '7199d5d4-a6e7-497f-8556-3d9c7981bc18'),
  ('33333333-0001-0001-0001-000000000002','PO-2026-002',
   NOW()-INTERVAL '5 days',
   'bbbbbbbb-0001-0001-0001-000000000002','ProEquip SARL',
   'aaaaaaaa-0001-0001-0001-000000000001',
   'Sent',12800,
   'Réapprovisionnement câbles et clés USB — en attente de livraison',
   '7199d5d4-a6e7-497f-8556-3d9c7981bc18')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 12. DEVOLUCIÓN (1 devolución aprobada)
-- ============================================================
INSERT INTO public.returns (id, date, original_sale_id, customer_id, customer_name, warehouse_id, reason, status, credited_amount, created_by)
VALUES (
  '22222222-0001-0001-0001-000000000001',
  NOW()-INTERVAL '48 days',
  'ffffffff-0001-0001-0001-000000000003',
  'dddddddd-0001-0001-0001-000000000003',
  'InfoEquip Marrakech',
  'aaaaaaaa-0001-0001-0001-000000000003',
  'Imprimante défectueuse — problème de bourrage papier',
  'Approved',1980,
  '7199d5d4-a6e7-497f-8556-3d9c7981bc18'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.return_items (return_id, product_id, product_name, quantity, unit_price, total) VALUES
  ('22222222-0001-0001-0001-000000000001',
   'cccccccc-0001-0001-0001-000000000007',
   'Imprimante Laser A4',1,1650,1650);

-- ============================================================
-- 13. PAGOS EN CHEQUE adicionales (para módulo Tesorería)
-- Los cheques vienen de ventas B2B — distintos estados
-- ============================================================
-- Cheque pendiente de cobro — S07 MediaTech (sin pagar, cheque en mano)
INSERT INTO public.payments (sale_id, date, amount, method, check_number, bank_name, due_date, payment_status) VALUES
  ('ffffffff-0001-0001-0001-000000000007', NOW()-INTERVAL '28 days', 31320, 'Check', 'CHQ-2026-0081','Attijariwafa Bank', (NOW()+INTERVAL '2 days')::date, 'Pending');
-- Cheque cobrado — S11 LogiTech
INSERT INTO public.payments (sale_id, date, amount, method, check_number, bank_name, due_date, payment_status) VALUES
  ('ffffffff-0001-0001-0001-000000000011', NOW()-INTERVAL '5 days', 13590, 'Check', 'CHQ-2026-0095','CIH Bank', (NOW()-INTERVAL '1 day')::date, 'Cashed');
-- Cheque rebotado — S09 Informatique Express (pago parcial previo en efectivo)
INSERT INTO public.payments (sale_id, date, amount, method, check_number, bank_name, due_date, payment_status) VALUES
  ('ffffffff-0001-0001-0001-000000000009', NOW()-INTERVAL '12 days', 1182, 'Check', 'CHQ-2026-0063','BMCE Bank', (NOW()-INTERVAL '5 days')::date, 'Bounced');
-- Cheque pendiente — S12 Digital Office (factura sin pagar)
INSERT INTO public.payments (sale_id, date, amount, method, check_number, bank_name, due_date, payment_status) VALUES
  ('ffffffff-0001-0001-0001-000000000012', NOW()-INTERVAL '1 day', 28920, 'Check', 'CHQ-2026-0102','Banque Populaire', (NOW()+INTERVAL '29 days')::date, 'Pending');

-- ============================================================
-- 14. GASTOS / CHARGES (módulo Contabilidad)
-- ============================================================
INSERT INTO public.charges (company_id, date, category, description, amount_ht, tax_rate, amount_ttc, payment_method, reference) VALUES
-- Mes actual
  ('demo-company-001', (DATE_TRUNC('month',NOW()))::date,         'Loyer',          'Loyer bureaux Casablanca — mois en cours',    8500.00,0,8500.00,'Bank Transfer','VIR-LOYER-06'),
  ('demo-company-001', (DATE_TRUNC('month',NOW()))::date,         'Salaires',       'Salaires équipe commerciale — mois en cours',45000.00,0,45000.00,'Bank Transfer','SAL-06-2026'),
  ('demo-company-001', (DATE_TRUNC('month',NOW())+INTERVAL '2 days')::date, 'Énergie','Facture électricité ONEE',     1200.00,0.20,1440.00,'Cash',NULL),
  ('demo-company-001', (DATE_TRUNC('month',NOW())+INTERVAL '3 days')::date, 'Télécom','Abonnement Internet + Téléphone', 800.00,0.20,960.00,'Cash',NULL),
  ('demo-company-001', (DATE_TRUNC('month',NOW())+INTERVAL '5 days')::date, 'Transport','Carburant livraisons semaine 1', 650.00,0,650.00,'Cash',NULL),
-- Mois -1
  ('demo-company-001', (DATE_TRUNC('month',NOW())-INTERVAL '1 month')::date, 'Loyer','Loyer bureaux Casablanca — mois -1',         8500.00,0,8500.00,'Bank Transfer','VIR-LOYER-05'),
  ('demo-company-001', (DATE_TRUNC('month',NOW())-INTERVAL '1 month')::date, 'Salaires','Salaires équipe commerciale — mois -1',  45000.00,0,45000.00,'Bank Transfer','SAL-05-2026'),
  ('demo-company-001', (DATE_TRUNC('month',NOW())-INTERVAL '1 month'+INTERVAL '4 days')::date,'Marketing','Campagne publicitaire réseaux sociaux',5000.00,0.20,6000.00,'Bank Transfer','MKT-05-001'),
  ('demo-company-001', (DATE_TRUNC('month',NOW())-INTERVAL '1 month'+INTERVAL '7 days')::date,'Maintenance','Maintenance parc informatique',        3500.00,0.20,4200.00,'Check','CHQ-MAINT-001'),
  ('demo-company-001', (DATE_TRUNC('month',NOW())-INTERVAL '1 month'+INTERVAL '10 days')::date,'Transport','Carburant livraisons — mois -1',        1800.00,0,1800.00,'Cash',NULL),
  ('demo-company-001', (DATE_TRUNC('month',NOW())-INTERVAL '1 month'+INTERVAL '15 days')::date,'Assurance','Assurance multirisque annuelle (mensualité)',2800.00,0,2800.00,'Bank Transfer','ASS-2026-05'),
  ('demo-company-001', (DATE_TRUNC('month',NOW())-INTERVAL '1 month'+INTERVAL '20 days')::date,'Énergie','Facture électricité ONEE',               1150.00,0.20,1380.00,'Cash',NULL),
-- Mois -2
  ('demo-company-001', (DATE_TRUNC('month',NOW())-INTERVAL '2 months')::date,'Loyer','Loyer bureaux Casablanca — mois -2',          8500.00,0,8500.00,'Bank Transfer','VIR-LOYER-04'),
  ('demo-company-001', (DATE_TRUNC('month',NOW())-INTERVAL '2 months')::date,'Salaires','Salaires équipe commerciale — mois -2',   45000.00,0,45000.00,'Bank Transfer','SAL-04-2026'),
  ('demo-company-001', (DATE_TRUNC('month',NOW())-INTERVAL '2 months'+INTERVAL '5 days')::date,'Fournitures','Achat matériel bureau et emballages', 2200.00,0.20,2640.00,'Cash',NULL),
  ('demo-company-001', (DATE_TRUNC('month',NOW())-INTERVAL '2 months'+INTERVAL '12 days')::date,'Transport','Carburant livraisons — mois -2',       1650.00,0,1650.00,'Cash',NULL),
  ('demo-company-001', (DATE_TRUNC('month',NOW())-INTERVAL '2 months'+INTERVAL '18 days')::date,'Marketing','Impression catalogues produits',        1800.00,0.20,2160.00,'Cash',NULL),
  ('demo-company-001', (DATE_TRUNC('month',NOW())-INTERVAL '2 months'+INTERVAL '22 days')::date,'Assurance','Assurance multirisque (mensualité)',   2800.00,0,2800.00,'Bank Transfer','ASS-2026-04');

-- ============================================================
-- VERIFICACIÓN FINAL
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '=== STOQLY DEMO DATA V2 ===';
  RAISE NOTICE 'Produits    : %', (SELECT COUNT(*) FROM public.products   WHERE sku LIKE 'STQ-%');
  RAISE NOTICE 'Stock lines : %', (SELECT COUNT(*) FROM public.stock_levels WHERE product_id IN (SELECT id FROM public.products WHERE sku LIKE 'STQ-%'));
  RAISE NOTICE 'Clients     : %', (SELECT COUNT(*) FROM public.customers  WHERE company_id='demo-company-001');
  RAISE NOTICE 'Ventes      : %', (SELECT COUNT(*) FROM public.sales      WHERE company_id='demo-company-001');
  RAISE NOTICE 'Paiements   : %', (SELECT COUNT(*) FROM public.payments   WHERE sale_id IN (SELECT id FROM public.sales WHERE company_id='demo-company-001'));
  RAISE NOTICE 'Transferts  : %', (SELECT COUNT(*) FROM public.transfers  WHERE company_id='demo-company-001');
  RAISE NOTICE 'Commandes   : %', (SELECT COUNT(*) FROM public.purchase_orders WHERE supplier_id IN (SELECT id FROM public.suppliers WHERE id IN ('bbbbbbbb-0001-0001-0001-000000000001'::uuid,'bbbbbbbb-0001-0001-0001-000000000002'::uuid)));
  RAISE NOTICE 'Retours     : %', (SELECT COUNT(*) FROM public.returns    WHERE id='22222222-0001-0001-0001-000000000001');
  RAISE NOTICE 'Charges     : %', (SELECT COUNT(*) FROM public.charges    WHERE company_id='demo-company-001');
  RAISE NOTICE '===========================';
END $$;
