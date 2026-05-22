# ✅ VERIFICACIÓN COMPLETA DEL SISTEMA - AZMOL STOCK ERP

## 🎯 OBJETIVO
Verificar que TODO el sistema funciona correctamente después de las correcciones aplicadas.

---

## 📋 CHECKLIST DE VERIFICACIÓN

### 1️⃣ BASE DE DATOS (BACKEND)

#### Ejecutar en Supabase SQL Editor:
```sql
-- Ejecuta el archivo VERIFICACION-COMPLETA.sql
```

**Debe mostrar:**
- ✅ Tabla customers existe con columnas snake_case (contact_person, tax_id)
- ✅ Tabla products existe
- ✅ Tabla stock_levels existe
- ✅ Función update_stock_level existe
- ✅ Triggers en transfer_items, sale_items, return_items existen
- ✅ Test de inserción en customers funciona

**Si algo falla:** Ejecuta [FIX-TRIGGERS-DEFINITIVO-V2.sql](FIX-TRIGGERS-DEFINITIVO-V2.sql) primero.

---

### 2️⃣ CONFIGURACIÓN DEL FRONTEND

#### Verifica que feature flags están habilitados:

**Archivo:** [src/config/features.ts](src/config/features.ts)

```typescript
export const FEATURE_FLAGS = {
  USE_SUPABASE_CUSTOMERS: true,  // ✅ Debe estar en true
  USE_SUPABASE_PRODUCTS: true,   // ✅ Debe estar en true
  USE_SUPABASE_STOCK_LEVELS: true, // ✅ Debe estar en true
  ENABLE_REALTIME: true,         // ✅ Debe estar en true
  // ... otros flags
};
```

---

### 3️⃣ CONVERSIÓN DE DATOS (CRITICAL)

El sistema usa **DOS convenciones de nombres**:
- **Base de datos (PostgreSQL):** snake_case (`contact_person`, `tax_id`, `to_warehouse_id`)
- **Aplicación (JavaScript/TypeScript):** camelCase (`contactPerson`, `taxId`, `toWarehouseId`)

#### Archivos que hacen la conversión:

| Archivo | Función | Ubicación |
|---------|---------|-----------|
| [types/supabase.ts](src/types/supabase.ts) | `toCustomer()` - DB → App | Líneas 279-292 |
| [types/supabase.ts](src/types/supabase.ts) | `fromCustomer()` - App → DB | Líneas 294-307 |
| [hooks/useSupabaseData.ts](src/hooks/useSupabaseData.ts) | `fetchCustomers()` | Líneas 72-107 |
| [hooks/useSupabaseData.ts](src/hooks/useSupabaseData.ts) | `addCustomer()` | Líneas 111-131 |
| [hooks/useSupabaseData.ts](src/hooks/useSupabaseData.ts) | `updateCustomer()` | Líneas 133-165 |

**Verificar manualmente:**
```typescript
// ✅ CORRECTO en types/supabase.ts
export function toCustomer(db: DbCustomer): Customer {
  return {
    contactPerson: db.contact_person,  // snake_case → camelCase
    taxId: db.tax_id,                  // snake_case → camelCase
    // ...
  };
}

export function fromCustomer(customer: Customer): Partial<DbCustomer> {
  return {
    contact_person: customer.contactPerson,  // camelCase → snake_case
    tax_id: customer.taxId,                  // camelCase → snake_case
    // ...
  };
}
```

---

### 4️⃣ ESTADO GLOBAL DE PRODUCTOS

**Problema resuelto:** App.tsx usaba `useState` local en lugar del hook `useProducts()`.

**Archivo:** [src/App.tsx](src/App.tsx)

**Verificar que tenga:**
```typescript
// ✅ CORRECTO (líneas 25, 38-40):
import { useProducts } from './hooks/useSupabaseData';

// ✅ Products now managed by useProducts hook - shared across all components
const productsHook = useProducts();
const products = productsHook.products;
```

**NO debe tener:**
```typescript
// ❌ INCORRECTO (esto debe estar comentado o eliminado):
const [products, setProducts] = useState<Product[]>(() =>
  dataService.load(KEYS.PRODUCTS, [])
);
```

---

## 🧪 PRUEBAS MANUALES

### Prueba 1: Añadir Cliente (CUSTOMERS)

1. Abre la aplicación en [http://localhost:3001](http://localhost:3001)
2. Ve a **GESTIÓN** → **Clientes**
3. Haz clic en **"+ Agregar Cliente"**
4. Completa el formulario:
   - Tipo: **Professional**
   - Nombre de Empresa: **Test Company**
   - Persona de Contacto: **Juan Pérez** ← IMPORTANTE
   - Teléfono: **+212600000000**
   - Email: **test@test.com**
   - ICE: **000000000000000**
   - Tax ID: **TEST123** ← IMPORTANTE
5. Haz clic en **"Guardar"**

**Resultado esperado:**
- ✅ El cliente se guarda sin errores
- ✅ Aparece en la lista de clientes
- ✅ Muestra "Persona de Contacto: Juan Pérez"
- ✅ Muestra "Tax ID: TEST123"

**Si falla con "Could not find the 'contactPerson' column":**
1. Refresca con **Ctrl+Shift+R** (hard refresh)
2. Abre DevTools → Application → Clear Storage → Clear Site Data
3. Cierra y abre el navegador de nuevo
4. Prueba de nuevo

---

### Prueba 2: Recibir Contenedor (STOCK)

1. Ve a **LOGISTIQUE & STOCK** → **Recepción de Contenedor**
2. Haz clic en **"+ Recibir Contenedor"**
3. Añade un producto (ej: **DOT 4**, cantidad: **10**)
4. Selecciona almacén: **Almacén Central**
5. Haz clic en **"Recibir Todo"**
6. **Espera 3-5 segundos**

**Verificar en múltiples lugares:**

| Ubicación | Qué verificar | Resultado esperado |
|-----------|---------------|-------------------|
| **INVENTARIO** | Cantidad en columna del almacén | ✅ Muestra 10 unidades |
| **DASHBOARD** | "Valor de Inventario" | ✅ Aumentó el valor |
| **DASHBOARD** | "Alertas de Stock Bajo" | ✅ Se actualizó el contador |
| **LAYOUT** (campanita 🔔) | Contador de alertas | ✅ Muestra número correcto |
| **POS** | Al buscar el producto | ✅ Muestra stock disponible |
| **ALMACENES** | Stock total por almacén | ✅ Muestra cantidad correcta |

**Si el stock NO aparece en Dashboard/Layout:**
1. Verifica que App.tsx use `useProducts()` hook (ver sección 4️⃣ arriba)
2. Refresca la página (F5)
3. Si persiste, revisa la consola del navegador para errores

**Si el stock NO se actualiza en la base de datos:**
1. Ejecuta [DIAGNOSTICO.sql](DIAGNOSTICO.sql) en Supabase
2. Verifica que los triggers estén activos
3. Ejecuta [FIX-TRIGGERS-DEFINITIVO-V2.sql](FIX-TRIGGERS-DEFINITIVO-V2.sql)

---

### Prueba 3: Realtime (SINCRONIZACIÓN EN TIEMPO REAL)

**Requisito:** `ENABLE_REALTIME: true` en [features.ts](src/config/features.ts)

1. Abre la aplicación en **DOS pestañas del navegador**
2. En la **Pestaña 1**: Ve a **INVENTARIO**
3. En la **Pestaña 2**: Ve a **Recepción de Contenedor**
4. En la **Pestaña 2**: Recibe un contenedor con 5 unidades de un producto
5. Observa la **Pestaña 1** (sin refrescar)

**Resultado esperado:**
- ✅ La Pestaña 1 se actualiza AUTOMÁTICAMENTE después de 2-3 segundos
- ✅ Muestra las nuevas cantidades sin refrescar

**Si NO se actualiza automáticamente:**
- Esto es normal si Realtime está deshabilitado
- Funciona igual, solo necesitas refrescar manualmente (F5)

---

## 🔍 DIAGNÓSTICO DE ERRORES COMUNES

### Error: "Could not find the 'contactPerson' column of 'customers' in the schema cache"

**Causas posibles:**
1. **Cache del navegador** - Solución: Ctrl+Shift+R (hard refresh)
2. **Service Worker antiguo** - Solución: DevTools → Application → Clear Storage
3. **Supabase cache** - Solución: Cerrar y abrir navegador
4. **Columna no existe en DB** - Solución: Ejecutar VERIFICACION-COMPLETA.sql

**Verificación rápida:**
```bash
# En la terminal de VSCode, busca queries incorrectas:
grep -r "\.select.*contactPerson" src/
# Resultado esperado: No matches found

grep -r "\.eq.*contactPerson" src/
# Resultado esperado: No matches found
```

---

### Error: Stock aparece en INVENTARIO pero NO en Dashboard

**Causa:** App.tsx usa estado local en lugar de hook.

**Solución:**
1. Abre [src/App.tsx](src/App.tsx)
2. Verifica líneas 38-40:
   ```typescript
   const productsHook = useProducts();
   const products = productsHook.products;
   ```
3. Si no lo tiene, lee [SOLUCION-STOCK-FRONTEND.md](SOLUCION-STOCK-FRONTEND.md)

---

### Error: Stock NO se actualiza en la base de datos

**Causa:** Triggers no están funcionando.

**Solución:**
1. Ejecuta [DIAGNOSTICO.sql](DIAGNOSTICO.sql) en Supabase
2. Verifica sección "Verificar Triggers"
3. Si faltan triggers, ejecuta [FIX-TRIGGERS-DEFINITIVO-V2.sql](FIX-TRIGGERS-DEFINITIVO-V2.sql)

---

## 📊 FLUJO COMPLETO DE DATOS

```
┌─────────────────────────────────────────────────────┐
│  USUARIO RECIBE CONTENEDOR (Frontend)              │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  useTransfers().createTransfer()                    │
│  (hooks/useSupabaseData.ts)                         │
│  - Convierte toWarehouseId → to_warehouse_id        │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Supabase INSERT en 'transfers' table               │
│  (snake_case: to_warehouse_id, from_warehouse_id)   │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Supabase INSERT en 'transfer_items' table          │
│  - Trigger: handle_transfer_items_stock_update()    │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Función: update_stock_level()                      │
│  - UPSERT en stock_levels                           │
│  - INSERT en audit_logs                             │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Realtime notifica cambio (si está habilitado)      │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  useProducts().refresh() (manual o automático)      │
│  - Fetch de products + stock_levels                 │
│  - Convierte contact_person → contactPerson         │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  App.tsx recibe productos actualizados              │
│  - Pasa a Dashboard, Layout, Inventory, POS, etc.   │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  UI SE ACTUALIZA EN TODAS PARTES ✅                 │
│  - Dashboard: Valor de inventario                   │
│  - Layout: Alertas de stock bajo                    │
│  - Inventory: Cantidades por almacén                │
│  - POS: Stock disponible                            │
│  - Warehouses: Stock por almacén                    │
└─────────────────────────────────────────────────────┘
```

---

## ✅ CHECKLIST FINAL

Marca cada item después de verificarlo:

### Base de Datos
- [ ] Ejecuté **VERIFICACION-COMPLETA.sql** en Supabase
- [ ] Todos los resultados muestran ✅ (sin ❌)
- [ ] Tabla `customers` tiene columnas `contact_person` y `tax_id` (snake_case)
- [ ] Función `update_stock_level` existe
- [ ] Triggers en `transfer_items`, `sale_items`, `return_items` existen

### Frontend - Código
- [ ] App.tsx usa `useProducts()` hook (no `useState`)
- [ ] types/supabase.ts tiene `toCustomer()` y `fromCustomer()` con conversiones correctas
- [ ] hooks/useSupabaseData.ts convierte camelCase ↔ snake_case en customers
- [ ] features.ts tiene `USE_SUPABASE_CUSTOMERS: true`
- [ ] features.ts tiene `ENABLE_REALTIME: true`

### Frontend - Pruebas
- [ ] Puedo añadir un cliente con Persona de Contacto y Tax ID sin errores
- [ ] El cliente aparece en la lista con los datos correctos
- [ ] Puedo recibir un contenedor y el stock se actualiza en la base de datos
- [ ] El stock aparece en **INVENTARIO** ✅
- [ ] El stock aparece en **DASHBOARD** (Valor de Inventario) ✅
- [ ] El stock aparece en **LAYOUT** (campanita de alertas) ✅
- [ ] El stock aparece en **POS** al buscar productos ✅
- [ ] El stock aparece en **ALMACENES** ✅

---

## 🚀 SI TODO FUNCIONA

**¡FELICITACIONES!** 🎉

Tu sistema AZMOL Stock ERP está completamente funcional y sincronizado:
- ✅ Base de datos con triggers funcionando
- ✅ Frontend convirtiendo camelCase ↔ snake_case correctamente
- ✅ Stock actualizado en todas partes de la aplicación
- ✅ Clientes con todos los campos funcionando
- ✅ Sistema listo para producción

---

## ❌ SI ALGO NO FUNCIONA

1. **Lee el error completo** en la consola del navegador (F12)
2. **Busca el error** en la sección "Diagnóstico de Errores Comunes" arriba
3. **Copia el mensaje de error exacto** y:
   - Verifica qué archivo lo genera
   - Verifica qué función lo genera
   - Busca esa función en este documento

4. **Errores de base de datos:**
   - Ejecuta DIAGNOSTICO.sql para ver el estado
   - Ejecuta FIX-TRIGGERS-DEFINITIVO-V2.sql para corregir

5. **Errores de frontend:**
   - Hard refresh: Ctrl+Shift+R
   - Clear storage: F12 → Application → Clear Site Data
   - Reinicia el servidor: `npm run dev`

---

**Última actualización:** 2026-01-09
**Archivos relacionados:**
- [VERIFICACION-COMPLETA.sql](VERIFICACION-COMPLETA.sql) - Script de verificación de base de datos
- [FIX-TRIGGERS-DEFINITIVO-V2.sql](FIX-TRIGGERS-DEFINITIVO-V2.sql) - Script de corrección de triggers
- [SOLUCION-STOCK-FRONTEND.md](SOLUCION-STOCK-FRONTEND.md) - Solución para stock en frontend
- [DIAGNOSTICO.sql](DIAGNOSTICO.sql) - Script de diagnóstico
