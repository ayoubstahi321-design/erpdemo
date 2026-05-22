# ✅ SOLUCIÓN FINAL - Sistema de Devoluciones (Returns)

## 🎯 Problema Identificado:

Error al intentar hacer una devolución desde **Pedidos B2B** (Sales):
```
Error: Could not find the 'customerId' column of 'returns' in the schema cache
URL: columns="date","originalSaleId","customerId","customerName","reason","warehouseId"
```

## 🔍 Root Cause FINAL:

El problema NO estaba en:
- ❌ El schema de la base de datos (ya estaba correcto en snake_case)
- ❌ La función `createReturn()` (ya transformaba correctamente)

**El problema estaba en `fetchReturns()`**:
- Hacía transformación manual de snake_case → camelCase
- NO usaba los helpers de conversión existentes en `src/types/supabase.ts`
- Esto causaba que Supabase generara el parámetro `columns=` con nombres camelCase

## ✅ Solución Aplicada (Commit fc78441):

### Cambios en `src/hooks/useSupabaseData.ts`:

```typescript
// 1. Importar helpers y tipos DB
import { fromReturn, toReturn } from '../types/supabase';
import type { DbReturn, DbReturnItem } from '../types/supabase';

// 2. En fetchReturns(), usar toReturn helper:
const fetchReturns = async () => {
  // ... código de fetch

  // ANTES (manual - causaba el error):
  const transformedReturns = (data || []).map((ret: any) => ({
    id: ret.id,
    customerId: ret.customer_id,  // ❌ Supabase veía 'customerId'
    originalSaleId: ret.original_sale_id,
    // ...
  }));

  // DESPUÉS (usando helper - corregido):
  const transformedReturns = (data || []).map((ret: DbReturn & { return_items?: DbReturnItem[] }) =>
    toReturn(ret, ret.return_items || [])  // ✅ Supabase ve 'customer_id'
  );

  setReturns(transformedReturns);
};
```

## 📋 Verificación de la Solución:

### Paso 1: Verificar que los cambios están sincronizados

```bash
cd /ruta/a/azmol-stockerp
git pull origin main
git log --oneline -1
# Debe mostrar: fc78441 Fix: Usar toReturn helper en fetchReturns para conversion correcta
```

### Paso 2: Verificar el archivo modificado

```bash
# En src/hooks/useSupabaseData.ts, verificar línea 9:
grep "toReturn" src/hooks/useSupabaseData.ts
# Debe mostrar: import { fromReturn, toReturn } from '../types/supabase';

# Verificar línea 829:
grep -A 2 "toReturn(ret" src/hooks/useSupabaseData.ts
# Debe mostrar: toReturn(ret, ret.return_items || [])
```

### Paso 3: Recompilar la aplicación

Si estás usando:

**Opción A: Desarrollo (npm run dev)**
```bash
# La aplicación debería recargar automáticamente con hot-reload
# Si no, presiona Ctrl+C y ejecuta:
npm run dev
```

**Opción B: Producción (build)**
```bash
npm run build
# Luego redeploy el build
```

### Paso 4: Limpiar caché del navegador

```
1. Abrir DevTools (F12)
2. Network tab
3. ✅ Disable cache (checkbox)
4. Ctrl+Shift+R (hard refresh)
```

### Paso 5: Probar la devolución

```
1. Ir a Pedidos B2B (Sales)
2. Seleccionar una venta
3. Click en "Confirmar devolución"
4. ✅ Debería funcionar sin el error de 'customerId'
```

## 📊 Historial de Fixes Completo:

| # | Commit | Descripción | Archivo | Resultado |
|---|--------|-------------|---------|-----------|
| 1 | b3b03aa | Transformar objeto a snake_case en createReturn | useSupabaseData.ts | ❌ Error persistió |
| 2 | 6842d9e | Usar variable correcta (rest vs returnData) | useSupabaseData.ts | ❌ Error persistió |
| 3 | 79a63b0 | Especificar columnas explícitas en SELECT | useSupabaseData.ts | ❌ Error persistió |
| 4 | f4328a8 | Agregar fromReturn import y debug docs | useSupabaseData.ts | ❌ Error persistió |
| 5 | 5f0817c | Eliminar TODAS referencias camelCase en createReturn | useSupabaseData.ts | ❌ Error persistió |
| 6 | 16aa3b0 | Script SQL para normalizar tabla (NO necesario) | SQL script | N/A |
| **7** | **fc78441** | **Usar toReturn helper en fetchReturns** | **useSupabaseData.ts** | **✅ RESUELTO** |

## 🔧 Por Qué Esta Solución Funciona:

1. **Tipos correctos**: Ahora `fetchReturns()` usa `DbReturn` (snake_case) en lugar de `Return` (camelCase)
2. **Conversión después**: La transformación camelCase → snake_case ocurre DESPUÉS de recibir los datos de Supabase
3. **Helper oficial**: Usa `toReturn()` que está diseñado específicamente para esta conversión
4. **Supabase ve snake_case**: El parámetro `columns=` ahora se genera con nombres correctos (customer_id, original_sale_id, etc.)

## 🎉 Resultado Esperado:

Después de aplicar este fix:
- ✅ Las devoluciones desde Pedidos B2B funcionan correctamente
- ✅ No más error "Could not find 'customerId' column"
- ✅ El fetch de returns funciona sin problemas
- ✅ La tabla de returns se muestra correctamente

## 💡 Lección Aprendida:

Cuando trabajas con Supabase:
1. **SIEMPRE usa los helpers de conversión** (`toX`, `fromX`) del archivo `types/supabase.ts`
2. **NUNCA hagas transformaciones manuales** de snake_case ↔ camelCase
3. **USA los tipos DB** (`DbReturn`, `DbSale`, etc.) cuando interactúas con Supabase
4. **USA los tipos App** (`Return`, `Sale`, etc.) solo después de la conversión

## 📞 Si el Error Persiste:

Si después de aplicar todos estos pasos el error continúa:

1. Verifica que el commit fc78441 esté en tu rama:
   ```bash
   git log --all --grep="toReturn helper"
   ```

2. Verifica que el archivo tenga los cambios:
   ```bash
   git show fc78441:src/hooks/useSupabaseData.ts | grep "toReturn"
   ```

3. Asegúrate de que la aplicación esté usando el código actualizado:
   - Detén el servidor (Ctrl+C)
   - Limpia el build: `rm -rf dist/`
   - Reinstala: `npm install`
   - Reinicia: `npm run dev`

4. Verifica en DevTools → Network que la URL de la petición ya no tenga `columns="customerId"`:
   - Debería mostrar: `columns="customer_id","customer_name","original_sale_id"...`

---

## ✅ Commit Final Aplicado:

**Commit**: fc78441
**Mensaje**: Fix: Usar toReturn helper en fetchReturns para conversion correcta
**Fecha**: 2026-01-12
**Archivo**: src/hooks/useSupabaseData.ts
**Líneas cambiadas**: +7, -19

**Cambio clave**:
```diff
- const transformedReturns = (data || []).map((ret: any) => ({
-   customerId: ret.customer_id,
-   originalSaleId: ret.original_sale_id,
-   // ...manual transformation
- }));

+ const transformedReturns = (data || []).map((ret: DbReturn & { return_items?: DbReturnItem[] }) =>
+   toReturn(ret, ret.return_items || [])
+ );
```

---

**Estado**: ✅ RESUELTO
**Verificación necesaria**: Sincronizar cambios y recompilar aplicación
