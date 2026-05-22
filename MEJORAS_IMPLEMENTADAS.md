# 🚀 Mejoras Implementadas - Azmol Stock ERP

Este documento describe todas las mejoras y nuevas funcionalidades implementadas en el sistema.

## 📋 Tabla de Contenidos

1. [Migración Completa a Supabase](#migración-completa-a-supabase)
2. [Sistema de Precios y TVA Mejorado](#sistema-de-precios-y-tva-mejorado)
3. [Historial de Cambios de Precios](#historial-de-cambios-de-precios)
4. [Sistema de Descuentos Avanzado](#sistema-de-descuentos-avanzado)
5. [Sincronización en Tiempo Real](#sincronización-en-tiempo-real)
6. [Sistema de Notificaciones](#sistema-de-notificaciones)

---

## 1. Migración Completa a Supabase

### ✅ Estado de Migración

Todas las entidades principales ahora están completamente migradas a Supabase:

| Entidad | Estado | Archivo Hook | Funcionalidades |
|---------|--------|--------------|-----------------|
| **Warehouses** | ✅ Completo | `useWarehouses` | CRUD completo, RLS |
| **Customers** | ✅ Completo | `useCustomers` | CRUD completo, RLS |
| **Users** | ✅ Completo | `useUsers` | CRUD completo, creación via Edge Function |
| **Products** | ✅ **NUEVO** | `useProducts` | CRUD completo, stock levels, RLS |
| **Sales** | ✅ **NUEVO** | `useSales` | CRUD completo, items, payments, stock update |
| **Stock Levels** | ✅ Completo | Integrado en Products | Gestión atómica con RPC |

### Nuevos Hooks Implementados

#### `useProducts` - [src/hooks/useSupabaseData.ts](src/hooks/useSupabaseData.ts)

```typescript
const { products, loading, error, addProduct, updateProduct, updateStock, deleteProduct, refresh } = useProducts();

// Agregar producto con stock levels
await addProduct({
  sku: 'AZM-HM-00001',
  name: 'Aceite 5W-40',
  category: 'Huile Moteur',
  price: 120,  // TTC
  cost: 80,
  stockLevels: {
    'warehouse-1': 100,
    'warehouse-2': 50
  },
  minStock: 20
});

// Actualizar stock
await updateStock(productId, warehouseId, newQuantity);
```

#### `useSales` - [src/hooks/useSupabaseData.ts](src/hooks/useSupabaseData.ts)

```typescript
const { sales, loading, error, createSale, registerPayment, refresh } = useSales();

// Crear venta
await createSale({
  invoiceNumber: 'FAC-2026-00001',
  customerId: 'xxx',
  customerName: 'Cliente X',
  items: [...],
  totalAmount: 1200,
  paymentStatus: 'Paid'
}, userId);

// Registrar pago
await registerPayment(saleId, {
  amount: 500,
  method: 'Cash',
  date: new Date().toISOString(),
  recordedBy: userId
});
```

### Feature Flags Actualizados

```typescript
// src/config/features.ts
export const FEATURE_FLAGS = {
  USE_SUPABASE_PRODUCTS: true,   // ✅ Habilitado
  USE_SUPABASE_SALES: true,      // ✅ Habilitado
  ENABLE_REALTIME: true,         // ✅ Habilitado
  // ...
};
```

---

## 2. Sistema de Precios y TVA Mejorado

### 🎯 Problema Resuelto

El sistema anterior tenía:
- ❌ Confusión entre precios HT (sin IVA) y TTC (con IVA)
- ❌ Cálculos dispersos en múltiples archivos
- ❌ Errores de redondeo
- ❌ Falta de flexibilidad para diferentes tasas de IVA

### ✅ Solución Implementada

Nuevo archivo centralizado: **[src/utils/pricing.ts](src/utils/pricing.ts)**

#### Filosofía del Sistema

```
📦 PRODUCTOS
   ├── Precio guardado: TTC (con IVA) ← Lo que ve el cliente
   ├── Cálculo de HT: Solo para facturación
   └── Tasa de TVA: Personalizable por producto o global

💰 CÁLCULOS
   ├── TTC → HT: HT = TTC / (1 + tasa_tva)
   ├── HT → TTC: TTC = HT × (1 + tasa_tva)
   └── Redondeo: 2 decimales para display, 4 para cálculos internos
```

### Funciones Principales

#### Conversiones Básicas

```typescript
import { calculateHT, calculateTVA, calculateTTC, breakdownPrice } from '@/utils/pricing';

// TTC → HT
const ht = calculateHT(120, 0.20); // 100

// TTC → TVA
const tva = calculateTVA(120, 0.20); // 20

// HT → TTC
const ttc = calculateTTC(100, 0.20); // 120

// Desglose completo
const breakdown = breakdownPrice(120, 0.20);
// { ht: 100, tva: 20, ttc: 120, taxRate: 0.20 }
```

#### Cálculos de Línea de Venta

```typescript
import { calculateSaleLine } from '@/utils/pricing';

const line = calculateSaleLine(
  5,          // cantidad
  120,        // precio unitario TTC
  10,         // descuento 10%
  0.20        // TVA 20%
);

// Retorna:
{
  quantity: 5,
  unitPriceTTC: 120,
  unitPriceHT: 100,
  discountPercent: 10,
  discountAmount: 60,
  subtotalTTC: 600,
  subtotalAfterDiscount: 540,
  ht: 450,
  tva: 90,
  ttc: 540,
  taxRate: 0.20
}
```

#### Cálculos de Factura Completa

```typescript
import { calculateInvoice } from '@/utils/pricing';

const invoice = calculateInvoice(
  [line1, line2, line3],  // Líneas de venta
  'percentage',           // Tipo de descuento global
  5                       // 5% de descuento global
);

// Retorna:
{
  itemsSubtotal: 1000,
  globalDiscountAmount: 50,
  subtotalAfterGlobalDiscount: 950,
  totalHT: 791.67,
  totalTVA: 158.33,
  totalTTC: 950,
  tvaBreakdown: [
    { taxRate: 0.20, baseHT: 791.67, tva: 158.33 }
  ]
}
```

#### Utilidades para Productos

```typescript
import { getProductTaxRate, calculateProductMargin, suggestPriceTTC } from '@/utils/pricing';

// Obtener tasa de TVA de un producto
const taxRate = getProductTaxRate(product, companySettings);

// Calcular margen de ganancia
const margin = calculateProductMargin(product, taxRate); // Retorna porcentaje

// Sugerir precio TTC basado en costo y margen deseado
const priceTTC = suggestPriceTTC(
  50,    // costo
  100,   // margen deseado (100%)
  0.20   // TVA
); // Retorna 120 (Costo 50 + 100% = 100 HT, + 20% TVA = 120 TTC)
```

### Tasas de TVA Predefinidas

```typescript
import { TVA_RATES } from '@/utils/pricing';

TVA_RATES.STANDARD    // 0.20 (20%)
TVA_RATES.REDUCED_1   // 0.14 (14%)
TVA_RATES.REDUCED_2   // 0.10 (10%)
TVA_RATES.REDUCED_3   // 0.07 (7%)
TVA_RATES.EXEMPT      // 0.00 (0%)
```

### Formateo

```typescript
import { formatCurrency, formatTaxRate } from '@/utils/pricing';

formatCurrency(120.50);        // "120.50 DH"
formatCurrency(120.50, false); // "120.50"
formatTaxRate(0.20);           // "20%"
```

---

## 3. Historial de Cambios de Precios

### 📊 Tabla: `price_history`

Registra automáticamente todos los cambios de precio de productos.

#### Esquema

```sql
CREATE TABLE price_history (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  old_price NUMERIC(10, 2),
  new_price NUMERIC(10, 2),
  old_cost NUMERIC(10, 2),
  new_cost NUMERIC(10, 2),
  changed_by UUID REFERENCES profiles(id),
  changed_at TIMESTAMP,
  reason TEXT
);
```

#### Trigger Automático

Cada vez que se actualiza un producto con nuevo precio o costo, se registra automáticamente en el historial.

```sql
CREATE TRIGGER trigger_log_price_change
  AFTER UPDATE ON products
  FOR EACH ROW
  WHEN (OLD.price IS DISTINCT FROM NEW.price OR OLD.cost IS DISTINCT FROM NEW.cost)
  EXECUTE FUNCTION log_price_change();
```

### Servicio TypeScript

**Archivo:** [src/services/priceHistoryService.ts](src/services/priceHistoryService.ts)

```typescript
import { priceHistoryService } from '@/services/priceHistoryService';

// Obtener historial completo
const history = await priceHistoryService.getAll(100);

// Obtener historial de un producto
const productHistory = await priceHistoryService.getByProduct(productId);

// Obtener por rango de fechas
const rangeHistory = await priceHistoryService.getByDateRange('2026-01-01', '2026-01-31');

// Estadísticas
const stats = await priceHistoryService.getStatistics(productId);
// Retorna:
{
  totalChanges: 15,
  averagePriceIncrease: 5.50,
  averagePriceDecrease: 3.20,
  lastChange: { ... }
}

// Productos con más cambios
const topChanged = await priceHistoryService.getTopChangedProducts(10);
```

---

## 4. Sistema de Descuentos Avanzado

### 🎁 Tipos de Descuentos

1. **Descuentos por Volumen** - Automáticos según cantidad comprada
2. **Descuentos por Cliente** - Específicos para clientes o tipos de cliente
3. **Promociones Temporales** - Descuentos con fecha de inicio y fin

### Tablas

#### `volume_discounts` - Descuentos por Volumen

```sql
CREATE TABLE volume_discounts (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id),  -- Opcional: aplica a producto específico
  category TEXT,                            -- Opcional: aplica a categoría
  min_quantity NUMERIC,                     -- Cantidad mínima
  max_quantity NUMERIC,                     -- Cantidad máxima (NULL = sin límite)
  discount_percentage NUMERIC(5, 2),        -- Descuento en %
  discount_fixed NUMERIC(10, 2),            -- O descuento fijo
  active BOOLEAN,
  valid_from DATE,
  valid_until DATE
);
```

**Ejemplo:**
```
Producto: Aceite 5W-40
- 1-9 unidades: 0% descuento
- 10-49 unidades: 5% descuento
- 50+ unidades: 10% descuento
```

#### `customer_discounts` - Descuentos por Cliente

```sql
CREATE TABLE customer_discounts (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),  -- Opcional: cliente específico
  customer_type TEXT,                         -- Opcional: 'Individual' o 'Professional'
  product_id UUID REFERENCES products(id),    -- Opcional: producto específico
  category TEXT,                              -- Opcional: categoría
  discount_percentage NUMERIC(5, 2),
  active BOOLEAN,
  valid_from DATE,
  valid_until DATE
);
```

**Ejemplo:**
```
Cliente: "Taller Mecánico ABC"
- Todos los productos: 5% descuento
- Categoría "Aceites": 10% descuento adicional
```

#### `promotions` - Promociones Temporales

```sql
CREATE TABLE promotions (
  id UUID PRIMARY KEY,
  name TEXT,
  description TEXT,
  product_id UUID REFERENCES products(id),
  category TEXT,
  discount_percentage NUMERIC(5, 2),
  discount_fixed NUMERIC(10, 2),
  min_purchase_amount NUMERIC(10, 2),
  active BOOLEAN,
  valid_from DATE,
  valid_until DATE
);
```

**Ejemplo:**
```
Promoción: "Black Friday 2026"
- Categoría: "Aceites"
- Descuento: 15%
- Válido: 2026-11-25 a 2026-11-30
- Monto mínimo: 500 DH
```

### Servicio TypeScript

**Archivo:** [src/services/discountService.ts](src/services/discountService.ts)

```typescript
import {
  volumeDiscountService,
  customerDiscountService,
  promotionService,
  getApplicableDiscount
} from '@/services/discountService';

// --- Descuentos por Volumen ---
await volumeDiscountService.create({
  productId: 'product-123',
  minQuantity: 10,
  maxQuantity: 49,
  discountPercentage: 5,
  active: true
});

const volumeDiscounts = await volumeDiscountService.getByProduct(productId);

// --- Descuentos por Cliente ---
await customerDiscountService.create({
  customerId: 'customer-456',
  category: 'Huile Moteur',
  discountPercentage: 10,
  active: true
});

const customerDiscounts = await customerDiscountService.getByCustomer(customerId);

// --- Promociones ---
await promotionService.create({
  name: 'Black Friday 2026',
  category: 'Huile Moteur',
  discountPercentage: 15,
  active: true,
  validFrom: '2026-11-25',
  validUntil: '2026-11-30'
});

const activePromotions = await promotionService.getActive();

// --- Obtener Mejor Descuento Aplicable ---
const discount = await getApplicableDiscount(
  productId,
  customerId,
  quantity,
  category
);

// Retorna (prioridad automática):
{
  discountType: 'percentage',
  discountValue: 10,
  discountSource: 'customer_specific' // o 'promotion', 'volume', 'customer_type'
}
```

### Función SQL para Calcular Descuento

```sql
-- Función que calcula el mejor descuento según prioridad
SELECT * FROM get_applicable_discount(
  'product-id',
  'customer-id',
  15,  -- cantidad
  NULL -- categoría (opcional)
);
```

**Prioridad de Descuentos:**

1. 🥇 Descuento específico cliente + producto
2. 🥈 Promoción activa para el producto
3. 🥉 Descuento por volumen
4. 4️⃣ Descuento por tipo de cliente

---

## 5. Sincronización en Tiempo Real

### ⚡ Supabase Realtime

Todos los usuarios ven cambios instantáneamente cuando otro usuario modifica datos.

### Hook: `useRealtime`

**Archivo:** [src/hooks/useRealtime.ts](src/hooks/useRealtime.ts)

```typescript
import { useRealtime, useRealtimeTable } from '@/hooks/useRealtime';

const {
  subscribeToProducts,
  subscribeToStockLevels,
  subscribeToSales,
  subscribeToCustomers,
  subscribeToWarehouses,
  subscribeToPriceHistory
} = useRealtime();

// Ejemplo 1: Suscribirse a cambios de productos
useEffect(() => {
  const unsubscribe = subscribeToProducts((payload) => {
    console.log('Evento:', payload.eventType); // 'INSERT', 'UPDATE', 'DELETE'
    console.log('Nuevo registro:', payload.new);
    console.log('Registro anterior:', payload.old);

    // Refrescar datos
    refetchProducts();
  });

  return unsubscribe; // Cleanup al desmontar
}, []);

// Ejemplo 2: Hook simplificado
useRealtimeTable('products', (payload) => {
  console.log('Producto cambió:', payload);
  refetchProducts();
});
```

### Configuración en Supabase

El script SQL ya habilita realtime para todas las tablas:

```sql
-- supabase-improvements.sql
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE stock_levels;
ALTER PUBLICATION supabase_realtime ADD TABLE sales;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;
-- ...
```

### Casos de Uso

1. **Inventario en Tiempo Real:** Múltiples vendedores ven el stock actualizado instantáneamente
2. **Ventas Colaborativas:** Gerentes ven las ventas nuevas en tiempo real
3. **Alertas de Precio:** Notificaciones cuando un precio cambia
4. **Sincronización Multi-Dispositivo:** Cambios en móvil se reflejan en desktop al instante

---

## 6. Sistema de Notificaciones

### 📧 Edge Function: `send-notification`

**Archivo:** [supabase/functions/send-notification/index.ts](supabase/functions/send-notification/index.ts)

Envía notificaciones por email (SMS próximamente) usando Resend.

#### Configuración

1. **Variables de entorno en Supabase:**
   ```bash
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   FROM_EMAIL=noreply@azmol.ma
   ```

2. **Obtener API Key de Resend:**
   - Crear cuenta en [resend.com](https://resend.com)
   - Generar API key
   - Configurar en Supabase Dashboard → Settings → Edge Functions

#### Tipos de Notificaciones Soportadas

1. `low_stock` - Alerta de bajo stock
2. `payment_due` - Recordatorio de pago pendiente
3. `payment_received` - Confirmación de pago recibido
4. `new_sale` - Notificación de nueva venta
5. `price_change` - Cambio de precio de producto
6. `stock_update` - Actualización de stock
7. `custom` - Notificación personalizada

#### Uso desde Frontend

```typescript
import { supabase } from '@/services/supabaseClient';

// Notificación de bajo stock
await supabase.functions.invoke('send-notification', {
  body: {
    type: 'low_stock',
    channel: 'email',
    to: 'admin@azmol.ma',
    userId: currentUserId,
    data: {
      productName: 'Aceite 5W-40',
      sku: 'AZM-HM-00001',
      currentStock: 5,
      minStock: 20,
      warehouseName: 'Almacén Central'
    }
  }
});

// Notificación de pago recibido
await supabase.functions.invoke('send-notification', {
  body: {
    type: 'payment_received',
    channel: 'email',
    to: 'sales@azmol.ma',
    userId: currentUserId,
    data: {
      customerName: 'Cliente ABC',
      amount: 1500,
      method: 'Bank Transfer',
      invoiceNumber: 'FAC-2026-00123',
      reference: 'REF-12345'
    }
  }
});

// Notificación personalizada
await supabase.functions.invoke('send-notification', {
  body: {
    type: 'custom',
    channel: 'email',
    to: 'user@example.com',
    subject: 'Asunto personalizado',
    message: 'Mensaje personalizado en HTML',
    userId: currentUserId
  }
});
```

#### Plantillas de Email Integradas

Cada tipo de notificación tiene una plantilla HTML automática con formato profesional.

**Ejemplo de plantilla `low_stock`:**

```
⚠️ Alerta: Bajo stock de Aceite 5W-40

Alerta de Bajo Stock
━━━━━━━━━━━━━━━━━━━

El producto Aceite 5W-40 tiene bajo stock.

• SKU: AZM-HM-00001
• Stock actual: 5
• Stock mínimo: 20
• Almacén: Almacén Central

Es recomendable reabastecer este producto pronto.
```

### Tabla: `notification_log`

Registra todas las notificaciones enviadas para auditoría.

```sql
CREATE TABLE notification_log (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  notification_type TEXT,
  channel TEXT,  -- 'email', 'sms', 'push'
  recipient TEXT,
  subject TEXT,
  message TEXT,
  status TEXT,  -- 'sent', 'failed'
  error_message TEXT,
  sent_at TIMESTAMP
);
```

#### Consultar Log

```typescript
const { data } = await supabase
  .from('notification_log')
  .select('*')
  .eq('user_id', userId)
  .order('sent_at', { ascending: false })
  .limit(50);
```

---

## 📦 Scripts SQL Principales

### 1. `supabase-improvements.sql`

Contiene todas las mejoras:
- ✅ Tabla `price_history` con trigger automático
- ✅ Tablas de descuentos (`volume_discounts`, `customer_discounts`, `promotions`)
- ✅ Función `get_applicable_discount`
- ✅ Configuración de Realtime
- ✅ Tablas de notificaciones
- ✅ Índices para performance

**Ejecutar en:** Supabase Dashboard → SQL Editor → New Query

---

## 🎯 Próximos Pasos

### Implementación Recomendada

1. **Ejecutar Script SQL** - [supabase-improvements.sql](supabase-improvements.sql)
2. **Configurar Resend** - Para notificaciones por email
3. **Actualizar Componentes** - Usar nuevas funciones de pricing
4. **Activar Realtime** - En componentes críticos (Inventory, Sales, POS)
5. **Probar Descuentos** - Crear reglas de descuento y validar

### Funcionalidades Futuras (No Implementadas)

- ❌ Módulo de Proveedores
- ❌ Órdenes de Compra (PO)
- ❌ Sistema de Presupuestos/Cotizaciones
- ❌ Notificaciones por SMS (Twilio)
- ❌ Reportes avanzados con Analytics
- ❌ Autenticación 2FA

---

## 📚 Referencias

### Archivos Clave Implementados

```
src/
├── utils/
│   ├── pricing.ts                      ✅ NUEVO - Sistema de precios
│   └── helpers.ts                      ✅ ACTUALIZADO - Usa pricing.ts
├── hooks/
│   ├── useSupabaseData.ts              ✅ ACTUALIZADO - Hooks completos
│   └── useRealtime.ts                  ✅ NUEVO - Realtime hooks
├── services/
│   ├── discountService.ts              ✅ NUEVO - Descuentos
│   └── priceHistoryService.ts          ✅ NUEVO - Historial precios
└── config/
    └── features.ts                     ✅ ACTUALIZADO - Flags habilitados

supabase/
└── functions/
    └── send-notification/
        └── index.ts                    ✅ NUEVO - Notificaciones

SQL/
├── supabase-improvements.sql           ✅ NUEVO - Todas las mejoras
```

### Documentación Adicional

- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Resend Email API](https://resend.com/docs/api-reference/introduction)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)

---

**Fecha de Implementación:** 2026-01-02
**Versión:** 2.0.0
**Autor:** Claude Code (Anthropic)
